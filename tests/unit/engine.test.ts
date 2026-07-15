import { describe, expect, it } from 'vitest';
import {
  applyCommand,
  assertStateInvariants,
  buildV3ActiveStagePlan,
  createInitialState,
  finishGame,
  getActionAvailability,
  getV3ActiveOptions,
  getV3PreparationDefinitions,
  getV3PreparationDisplayOptions,
  getBucketTargetSales,
  hashToUnitInterval,
  stochasticRound,
  type GameCommand,
  type GameState,
  type Superpower,
} from '../../packages/game-engine/src';
import { createContentCohort } from '../../packages/game-engine/src/calculations/content';
import { executeActionEffects } from '../../packages/game-engine/src/flow/outcome';
import { loadGameConfig } from '../../lib/config/game-config';
import { scenarios } from '../fixtures/scenarios';

const config = loadGameConfig();
const setup = scenarios[0].setup;

describe('goals', () => {
  it('uses configured price buckets', () => {
    expect(getBucketTargetSales(5_000, config)).toBe(60);
    expect(getBucketTargetSales(5_001, config)).toBe(50);
    expect(getBucketTargetSales(250_000, config)).toBe(5);
  });
});

describe('randomness', () => {
  it('is stable for the same key and changes for different keys', () => {
    expect(hashToUnitInterval('a', 'b')).toBe(hashToUnitInterval('a', 'b'));
    expect(hashToUnitInterval('a', 'b')).not.toBe(hashToUnitInterval('a', 'c'));
  });

  it('stochastic rounding is deterministic', () => {
    expect(stochasticRound(3.4, 'round_key')).toBe(stochasticRound(3.4, 'round_key'));
  });
});

describe('commands and invariants', () => {
  it('does not apply the same command twice', () => {
    const state = createInitialState(setup, config, 'idempotent_seed');
    const command = { commandId: 'same', type: 'v3_next' as const, payload: {} };
    const once = applyCommand(state, config, command);
    const twice = applyCommand(once, config, command);
    expect(twice).toEqual(once);
  });

  it('moves a confirmed early finish to the final reason without leaving a pending decision', () => {
    const state = createInitialState(setup, config, 'finish_confirmation_seed');
    state.status = 'active';
    state.flow.stage = 'daily';
    state.flow.step = 'finish_confirmation';
    state.pendingDecision = { type: 'finish_confirmation', returnStep: 'daily_intent' };

    const next = applyCommand(state, config, {
      commandId: 'confirm_finish',
      type: 'resolve_pending_decision',
      payload: { action: 'confirm' },
    });

    expect(next.flow.stage).toBe('final');
    expect(next.flow.step).toBe('final_reason');
    expect(next.pendingDecision).toBeNull();
    expect(next.endingReason).toBe('manual_finished');
  });

  it('runs every fixture without invariant violations', () => {
    for (const scenario of scenarios) {
      let state = createInitialState(scenario.setup, config, scenario.seed);
      let resolutionSequence = 0;
      for (const command of scenario.commands) {
        state = applyCommand(state, config, command);
        state = resolvePending(state, `${scenario.id}_${resolutionSequence}`);
        resolutionSequence += 1;
      }
      state = finishGame(state, config);
      assertStateInvariants(state, config);
      expect(state.status).toBe('finished');
      expect(state.metrics.revenue).toBe(state.metrics.sales * (state.launchPlan.productPrice ?? 0));
      expect(Number.isFinite(state.metrics.revenue)).toBe(true);
      expect(state.diagnostics).toBeDefined();
    }
  });

  it('reports the full bank and energy cost of an action', () => {
    const state = createInitialState(scenarios[0].setup, config, 'outcome_seed');
    const next = applyCommand(state, config, {
      commandId: 'prepare',
      type: 'v3_confirm_preparation',
      payload: { area: 'warmup', instrumentId: 'simple_bot', mode: 'expert' },
    });
    expect(state.resources.bank - next.resources.bank).toBe(20_000);
    expect(state.resources.energy - next.resources.energy).toBe(0);
    expect(next.v3.plannedPreparations[0]?.days).toBe(3);
    expect(next.flow.step).toBe('v3_prepare_category');
  });

  it('unlocks a confirmed v3 preparation for active stage selection', () => {
    let state = createInitialState(scenarios[0].setup, config, 'v3_unlock_preparation_seed');
    state = applyCommand(state, config, {
      commandId: 'prepare_simple_bot',
      type: 'v3_confirm_preparation',
      payload: { area: 'warmup', instrumentId: 'simple_bot', mode: 'expert' },
    });
    state = applyCommand(state, config, {
      commandId: 'begin_action_plan',
      type: 'v3_begin_action_plan',
      payload: {},
    });

    expect(state.v3.preparedTools.some((tool) => tool.key === 'warmup:simple_bot:expert')).toBe(true);
    expect(getV3ActiveOptions(state, 'warmup')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'warmup:simple_bot:expert',
          locked: false,
          title: 'Обычный бот - со специалистом',
        }),
      ]),
    );
  });

  it('shows v3 advice result and keeps the strongest advice bonus for the loop', () => {
    let state = createInitialState(scenarios[0].setup, config, 'v3_advice_seed');
    const bankBefore = state.resources.bank;

    state = applyCommand(state, config, {
      commandId: 'advice_5k',
      type: 'v3_request_advice',
      payload: { category: 'ads', option: 'consult_5k' },
    });

    expect(state.flow.step).toBe('v3_advice_result');
    expect(state.resources.bank).toBe(bankBefore - 5_000);
    expect(state.v3.lastAdvice?.effectLines).toContain('Результативность рекламы стала выше на 5%.');
    expect(state.v3.loopAdviceEffects.ads?.multiplier).toBe(1.05);

    state = applyCommand(state, config, {
      commandId: 'advice_10k',
      type: 'v3_request_advice',
      payload: { category: 'ads', option: 'consult_10k' },
    });

    expect(state.resources.bank).toBe(bankBefore - 15_000);
    expect(state.v3.loopAdviceEffects.ads?.multiplier).toBe(1.10);
    expect(state.v3.lastAdvice?.effectLines).toContain('Результативность рекламы стала выше на 10%.');
  });

  it('applies v3 advice bonus to the matching active-stage conversion and resets it after the stage', () => {
    const base = createInitialState(scenarios[0].setup, config, 'v3_advice_bonus_seed');
    base.v3.activeSelection = {
      ad: 'ad:unprepared',
      warmup: 'warmup:manual',
      sales: 'sales:intuition',
    };

    const advised = structuredClone(base);
    advised.v3.loopAdviceEffects = {
      ads: { category: 'ads', multiplier: 1.10, precision: 'exact' },
    };

    const baseResult = applyCommand(base, config, {
      commandId: 'complete_base',
      type: 'v3_complete_active_stage',
      payload: { manualAnswers: 200, salesChats: 200, calls: 60 },
    });
    const advisedResult = applyCommand(advised, config, {
      commandId: 'complete_advised',
      type: 'v3_complete_active_stage',
      payload: { manualAnswers: 200, salesChats: 200, calls: 60 },
    });

    expect(advisedResult.v3.lastStageReport?.newLeads).toBeGreaterThan(baseResult.v3.lastStageReport?.newLeads ?? 0);
    expect(advisedResult.v3.loopAdviceEffects).toEqual({});
  });

  it('builds the same v3 active-stage plan used by the final report', () => {
    const state = createInitialState(scenarios[0].setup, config, 'v3_active_plan_seed');
    state.v3.activeSelection = {
      ad: 'ad:unprepared',
      warmup: 'warmup:manual',
      sales: 'sales:intuition',
    };

    const plan = buildV3ActiveStagePlan(state);
    const completed = applyCommand(state, config, {
      commandId: 'complete_active_plan',
      type: 'v3_complete_active_stage',
      payload: { manualAnswers: 20, directSalesChats: 6, postCallChats: 2, salesChats: 8, calls: 4 },
    });
    const report = completed.v3.lastStageReport;

    expect(plan.callDurationSeconds).toBe(6);
    expect(plan.messageTimeoutSeconds).toBe(6);
    expect(plan.totals.views).toBe(report?.views);
    expect(plan.totals.newLeads).toBe(report?.newLeads);
    expect(report?.callsHeld).toBe(4);
    expect(report?.chatsHeld).toBeLessThanOrEqual(8);
    expect(report?.chatsHeld).toBeGreaterThan(0);
    expect(report?.salesCount).toBe((report?.autoSales ?? 0) + (report?.callsBuy ?? 0) + (report?.chatsBuy ?? 0) + (report?.siteBuys ?? 0));
    expect(report?.applications).toBe(report?.interested);
    expect(completed.metrics.applications).toBe(report?.applications);
  });

  it('moves a terminal v3 active-stage report to the final reason screen', () => {
    let state = createInitialState({ ...scenarios[0].setup, superpower: 'sales' }, config, 'v3_terminal_report_seed');
    state.launchPlan.productPrice = 15_000;
    state.targets = { targetSales: 30, targetRevenue: 450_000, personalGoal: 150_000 };
    state.v3.activeSelection = {
      ad: 'ad:unprepared',
      warmup: 'warmup:manual',
      sales: 'sales:intuition',
    };

    state = applyCommand(state, config, {
      commandId: 'complete_terminal_v3_stage',
      type: 'v3_complete_active_stage',
      payload: { manualAnswers: 200, directSalesChats: 200, postCallChats: 200, salesChats: 200, calls: 60 },
    });

    expect(state.flow.stage).toBe('v3');
    expect(state.flow.step).toBe('v3_stage_report');
    expect(state.endingReason).toBe('resource_finished');

    state = applyCommand(state, config, {
      commandId: 'open_terminal_v3_final',
      type: 'v3_return_reflection',
      payload: {},
    });

    expect(state.flow.stage).toBe('final');
    expect(state.flow.step).toBe('final_reason');
  });

  it('keeps custom v3 dream price in final diagnostics', () => {
    let state = createInitialState(scenarios[0].setup, config, 'v3_custom_dream_diagnostics_seed');
    state = applyCommand(state, config, {
      commandId: 'set_product',
      type: 'v3_set_product',
      payload: { productType: 'service' },
    });
    state = applyCommand(state, config, {
      commandId: 'set_price',
      type: 'v3_set_price',
      payload: { productPrice: 15_000 },
    });
    state = applyCommand(state, config, {
      commandId: 'set_custom_dream',
      type: 'v3_set_dream',
      payload: { dreamId: 'custom', customTitle: 'Новый айфон', customPrice: 150_000 },
    });

    const finished = finishGame(state, config);
    expect(finished.diagnostics?.dreams[0]).toEqual(
      expect.objectContaining({ title: 'Новый айфон', price: 150_000 }),
    );
  });

  it('reveals effective active option conversions from superpowers and consultations', () => {
    const superpowered = createInitialState({ ...scenarios[0].setup, superpower: 'sales' }, config, 'v3_sales_superpower_seed');
    const preparationOptions = getV3PreparationDisplayOptions(superpowered, 'sales');
    const chatScript = preparationOptions.find((option) => option.id === 'chat_script');
    expect(chatScript?.self.known).toBe(true);
    expect(chatScript?.self.effectiveConversion).toBeCloseTo(0.1596);
    expect(chatScript?.expert.known).toBe(true);
    expect(chatScript?.expert.effectiveConversion).toBeCloseTo(0.228);

    const salesOptions = getV3ActiveOptions(superpowered, 'sales');
    const superpoweredCall = salesOptions.find((option) => option.key.includes('locked:sales:call_script:self'));
    expect(superpoweredCall).toEqual(expect.objectContaining({ known: true, baseConversion: 0.20 }));
    expect(superpoweredCall?.effectiveConversion).toBeCloseTo(0.228);

    const consulted = createInitialState(scenarios[0].setup, config, 'v3_sales_advice_seed');
    consulted.v3.loopAdviceEffects = {
      sales: { category: 'sales', multiplier: 1.10, precision: 'exact' },
    };
    const consultedChat = getV3ActiveOptions(consulted, 'sales').find((option) => option.key.includes('locked:sales:chat_script:expert'));
    expect(consultedChat).toEqual(expect.objectContaining({ known: true, baseConversion: 0.20 }));
    expect(consultedChat?.effectiveConversion).toBeCloseTo(0.22);

    const ads = createInitialState({ ...scenarios[0].setup, superpower: 'ads' }, config, 'v3_ads_superpower_seed');
    const adsStories = getV3ActiveOptions(ads, 'ad').find((option) => option.key.includes('locked:ads:stories:self'));
    expect(adsStories).toEqual(expect.objectContaining({ known: true, baseConversion: 0.10 }));
    expect(adsStories?.effectiveConversion).toBeCloseTo(0.116);

    const warmed = createInitialState(scenarios[0].setup, config, 'v3_warmup_advice_seed');
    warmed.v3.loopAdviceEffects = {
      warmup: { category: 'warmup', multiplier: 1.05, precision: 'rough' },
    };
    const warmedBot = getV3ActiveOptions(warmed, 'warmup').find((option) => option.key.includes('locked:warmup:ai_bot:expert'));
    expect(warmedBot).toEqual(expect.objectContaining({ known: true, baseConversion: 0.27 }));
    expect(warmedBot?.effectiveConversion).toBeCloseTo(0.32319);
  });

  it('uses high-conversion low-reach stories and telegram ads in v3', () => {
    const state = createInitialState(scenarios[0].setup, config, 'v3_low_reach_ads_seed');
    state.v3.preparedAds = [
      { key: 'ad:stories:self:test', instrumentId: 'stories', mode: 'self', title: 'Контент для сторис - самостоятельно', known: false, uses: 0 },
    ];
    state.v3.activeSelection = {
      ad: 'ad:stories:self:test',
      warmup: 'warmup:manual',
      sales: 'sales:intuition',
    };

    expect(getV3ActiveOptions(state, 'ad').find((option) => option.key === 'ad:stories:self:test')).toEqual(
      expect.objectContaining({ baseConversion: 0.10 }),
    );
    expect(getV3ActiveOptions(state, 'ad').find((option) => option.key.includes('locked:ads:telegram:expert'))).toEqual(
      expect.objectContaining({ baseConversion: 0.14 }),
    );

    const plan = buildV3ActiveStagePlan(state);
    expect(plan.totals.views).toBeGreaterThanOrEqual(6_000);
    expect(plan.totals.views).toBeLessThanOrEqual(8_000);
    expect(Math.max(...plan.adEvents.map((event) => event.viewsDelta))).toBeLessThanOrEqual(450);
    expect(plan.adEvents.some((event) => event.hot)).toBe(false);
  });

  it('uses the requested v3 warmup conversion rates and keeps webinar auto-sales', () => {
    const state = createInitialState(scenarios[0].setup, config, 'v3_warmup_rates_seed');
    const warmupOptions = getV3ActiveOptions(state, 'warmup');

    expect(warmupOptions.find((option) => option.key.includes('locked:warmup:guide:self'))).toEqual(
      expect.objectContaining({ baseConversion: 0.10 }),
    );
    expect(warmupOptions.find((option) => option.key.includes('locked:warmup:simple_bot:expert'))).toEqual(
      expect.objectContaining({ baseConversion: 0.18 }),
    );
    expect(warmupOptions.find((option) => option.key.includes('locked:warmup:ai_bot:expert'))).toEqual(
      expect.objectContaining({ baseConversion: 0.27 }),
    );
    expect(warmupOptions.find((option) => option.key.includes('locked:warmup:video_lesson:self'))).toEqual(
      expect.objectContaining({ baseConversion: 0.16 }),
    );
    expect(warmupOptions.find((option) => option.key.includes('locked:warmup:auto_webinar:expert'))).toEqual(
      expect.objectContaining({ baseConversion: 0.19 }),
    );

    state.v3.preparedAds = [
      { key: 'ad:reels:expert:test', instrumentId: 'reels', mode: 'expert', title: 'Контент для рилс - со специалистом', known: false, uses: 0 },
    ];
    state.v3.preparedTools = [
      { key: 'warmup:auto_webinar:expert', area: 'warmup', instrumentId: 'auto_webinar', mode: 'expert', title: 'Автовебинар - со специалистом', known: false, uses: 0 },
    ];
    state.v3.activeSelection = {
      ad: 'ad:reels:expert:test',
      warmup: 'warmup:auto_webinar:expert',
      sales: 'sales:intuition',
    };

    const plan = buildV3ActiveStagePlan(state);
    expect(plan.totals.autoSales).toBeGreaterThan(0);

    const completed = applyCommand(state, config, {
      commandId: 'complete_auto_webinar_sales',
      type: 'v3_complete_active_stage',
      payload: { manualAnswers: 56, directSalesChats: 0, postCallChats: 0, salesChats: 0, calls: 0 },
    });
    expect(completed.v3.lastStageReport?.salesCount).toBe(plan.totals.autoSales);
    expect(completed.v3.lastStageReport?.autoSales).toBe(plan.totals.autoSales);
  });

  it('keeps low-ticket sales-superpower chat conversion above the minimum floor', () => {
    const state = createInitialState({ ...scenarios[0].setup, superpower: 'sales' }, config, 'v3_sales_chat_streak_seed');
    state.launchPlan.productPrice = 15_000;
    state.v3.activeSelection = {
      ad: 'ad:unprepared',
      warmup: 'warmup:manual',
      sales: 'sales:intuition',
    };

    const plan = buildV3ActiveStagePlan(state);
    expect(plan.chatOutcomes.slice(0, 24).filter((outcome) => outcome.buy).length).toBeGreaterThanOrEqual(3);

    const completed = applyCommand(state, config, {
      commandId: 'complete_chat_streak',
      type: 'v3_complete_active_stage',
      payload: { manualAnswers: 56, directSalesChats: 24, salesChats: 24, calls: 0 },
    });
    expect(completed.v3.lastStageReport?.chatsBuy).toBeGreaterThanOrEqual(3);
  });

  it('keeps every v3 ad, warmup, sales, and superpower conversion combination consistent', () => {
    const superpowers: Superpower[] = ['marketing', 'sales', 'energy', 'ads'];
    const failures: string[] = [];
    let checked = 0;

    for (const superpower of superpowers) {
      const state = createConversionMatrixState(superpower, `v3_matrix_${superpower}`);
      const ads = getV3ActiveOptions(state, 'ad').filter((option) => !option.locked);
      const warmups = getV3ActiveOptions(state, 'warmup').filter((option) => !option.locked);
      const salesOptions = getV3ActiveOptions(state, 'sales').filter((option) => !option.locked);

      for (const ad of ads) {
        for (const warmup of warmups) {
          for (const sales of salesOptions) {
            if (warmup.key.includes('auto_webinar') && sales.key.includes('auto_webinar')) continue;
            const combo = `${superpower} / ${ad.key} / ${warmup.key} / ${sales.key}`;
            try {
              const comboState = structuredClone(state);
              comboState.v3.activeSelection = { ad: ad.key, warmup: warmup.key, sales: sales.key };
              const plan = buildV3ActiveStagePlan(comboState);
              const completed = applyCommand(comboState, config, {
                commandId: `complete_${checked}`,
                type: 'v3_complete_active_stage',
                payload: {
                  manualAnswers: plan.totals.requiredAnswer,
                  calls: plan.totals.interested,
                  directSalesChats: plan.totals.interested,
                  postCallChats: plan.totals.interested,
                  salesChats: plan.totals.interested,
                },
              });
              const report = completed.v3.lastStageReport;
              if (!report) throw new Error('missing report');

              expect(report.views, combo).toBe(plan.totals.views);
              expect(report.newLeads, combo).toBe(plan.totals.newLeads);
              expect(report.interested, combo).toBe(plan.totals.interested);
              expect(report.notInterested, combo).toBe(plan.totals.notInterested);
              expect(report.requiredAnswer, combo).toBe(plan.totals.requiredAnswer);
              expect(report.applications, combo).toBe(report.interested);
              expect(report.lost, combo).toBe(0);
              expect(report.callsBuy, combo).toBeLessThanOrEqual(report.callsHeld);
              expect(report.chatsBuy, combo).toBeLessThanOrEqual(report.chatsHeld);
              expect(report.siteBuys, combo).toBeLessThanOrEqual(report.siteVisits);
              expect(report.siteMessages, combo).toBeLessThanOrEqual(report.siteVisits);
              expect(report.autoSales, combo).toBeLessThanOrEqual(report.applications);
              expect(report.salesCount, combo).toBe(
                report.autoSales + report.callsBuy + report.chatsBuy + report.siteBuys,
              );
              expect(report.salesCount, combo).toBeLessThanOrEqual(report.applications);
              expect(completed.metrics.impressions, combo).toBe(report.views);
              expect(completed.metrics.inbound, combo).toBe(report.newLeads);
              expect(completed.metrics.activated, combo).toBe(report.interested);
              expect(completed.metrics.processed, combo).toBe(report.interested);
              expect(completed.metrics.applications, combo).toBe(report.applications);
              expect(completed.metrics.sales, combo).toBe(report.salesCount);
              expect(completed.metrics.revenue, combo).toBe(report.revenue);
              assertStateInvariants(completed, config);
              checked += 1;
            } catch (error) {
              failures.push(`${combo}: ${error instanceof Error ? error.message : String(error)}`);
            }
          }
        }
      }
    }

    expect(failures).toEqual([]);
    expect(checked).toBeGreaterThan(2_000);
  });

  it('blocks an action when energy is below its complete cost', () => {
    const action = config.actions.find((candidate) => candidate.energyCost > 1 && candidate.enabled);
    expect(action).toBeDefined();
    if (!action) throw new Error('Missing energy-consuming action');

    const state = createInitialState(setup, config, 'energy_seed');
    state.status = 'active';
    state.resources.energy = Math.max(0, action.energyCost - 1);
    const availability = getActionAvailability(state, action, config);
    expect(availability.available).toBe(false);
    if (!availability.available) expect(availability.reason).toMatch(/энергии/i);
  });

  it('offers all alternative creation methods immediately', () => {
    const state = createInitialState(setup, config, 'alternative_methods_seed');
    state.status = 'active';
    state.resources.day = 3;

    const pairs = [
      ['guide_self', 'guide_specialist'],
      ['video_self', 'video_specialist'],
      ['simple_bot_self', 'simple_bot_specialist'],
      ['ai_bot_self', 'ai_bot_specialist'],
      ['website_basic', 'website_beautiful'],
    ] as const;

    for (const pair of pairs) {
      for (const actionId of pair) {
        const action = config.actions.find((candidate) => candidate.id === actionId);
        if (!action) throw new Error(`Missing action ${actionId}`);
        expect(getActionAvailability(state, action, config)).toEqual({ available: true });
      }
    }
  });

  it('closes every sibling creation method after the tool is created', () => {
    const cases = [
      { asset: 'guide', value: 'self', actions: ['guide_self', 'guide_specialist'] },
      { asset: 'videoLesson', value: 'specialist', actions: ['video_self', 'video_specialist'] },
      { asset: 'simpleBot', value: 'self', actions: ['simple_bot_self', 'simple_bot_specialist'] },
      { asset: 'aiBot', value: 'specialist', actions: ['ai_bot_self', 'ai_bot_specialist'] },
      { asset: 'website', value: 'basic', actions: ['website_basic', 'website_beautiful'] },
    ] as const;

    for (const testCase of cases) {
      const state = createInitialState(setup, config, `exclusive_${testCase.asset}`);
      state.status = 'active';
      state.resources.day = 3;
      state.assets[testCase.asset] = testCase.value;

      for (const actionId of testCase.actions) {
        const action = config.actions.find((candidate) => candidate.id === actionId);
        if (!action) throw new Error(`Missing action ${actionId}`);
        const availability = getActionAvailability(state, action, config);
        expect(availability.available).toBe(false);
        if (!availability.available) expect(availability.reason).toMatch(/уже создан/i);
      }
    }
  });

  it('allows choosing a stronger option directly without artificial prerequisite levels', () => {
    const state = createInitialState(setup, config, 'direct_upgrade_seed');
    state.status = 'active';
    state.resources.day = 3;

    const directOptions = [
      'consultation_detailed',
      'demand_interviews',
      'demand_pilot_offer',
      'product_home',
      'product_studio',
    ];

    for (const actionId of directOptions) {
      const action = config.actions.find((candidate) => candidate.id === actionId);
      if (!action) throw new Error(`Missing action ${actionId}`);
      expect(getActionAvailability(state, action, config)).toEqual({ available: true });
    }
  });

  it('does not offer weaker variants after a stronger one was completed', () => {
    const state = createInitialState(setup, config, 'stronger_variant_seed');
    state.status = 'active';
    state.resources.day = 3;
    state.history.push({
      day: 3,
      type: 'action_completed',
      message: 'Студия, оператор и монтаж',
      payload: { actionId: 'product_studio' },
    });

    const weaker = config.actions.find((candidate) => candidate.id === 'product_self');
    if (!weaker) throw new Error('Missing product_self');
    const availability = getActionAvailability(state, weaker, config);
    expect(availability.available).toBe(false);
    if (!availability.available) expect(availability.reason).toMatch(/более сильный вариант/i);
  });

  it('creates separate integer cohorts for combined reels and stories', () => {
    const state = createInitialState(setup, config, 'combined_content_seed');
    state.status = 'active';
    state.resources.day = 3;
    state.audience.channels = ['instagram'];
    state.audience.averageReelViews = 1_000;
    state.audience.averageStoryViews = 300;
    state.launchPlan.productType = 'consultation';
    state.launchPlan.productPrice = 10_000;
    const action = config.actions.find((candidate) => candidate.id === 'reels_stories_7d');
    if (!action) throw new Error('Missing combined content action');
    const beforeMetrics = { ...state.metrics };

    const report = executeActionEffects(
      state,
      config,
      action,
      3,
      3 + action.days - 1,
      'storytelling',
      state.resources.bank,
      state.resources.energy,
      beforeMetrics,
    );

    expect(report.outcome.createdCohortIds).toHaveLength(2);
    expect(state.cohorts.map((cohort) => cohort.sourceType).sort()).toEqual(['reels', 'stories']);
    for (const cohort of state.cohorts) {
      expect(Number.isInteger(cohort.impressions)).toBe(true);
      expect(Number.isInteger(cohort.inbound)).toBe(true);
    }
  });

  it('does not invent webinar audience when all channels are empty', () => {
    const state = createInitialState(setup, config, 'empty_webinar_seed');
    state.resources.day = 3;
    state.audience.averageReelViews = 0;
    state.audience.averageStoryViews = 0;
    state.audience.averageTelegramViews = 0;
    state.audience.contactsCount = 0;
    const cohort = createContentCohort(state, config, 'webinar', 'storytelling', 0);
    expect(cohort?.impressions).toBe(0);
    expect(cohort?.inbound).toBe(0);
  });

  it('counts one-day and two-day rest exactly once', () => {
    for (const [action, expectedDay] of [['rest_day', 11], ['rest_two_days', 12]] as const) {
      let state = createInitialState(setup, config, `rest_${action}`);
      state.status = 'active';
      state.flow.stage = 'daily';
      state.flow.step = 'energy_crisis';
      state.resources.day = 10;
      state.resources.energy = 0;
      state.pendingDecision = { type: 'energy_crisis', returnStep: 'daily_intro' };

      state = applyCommand(state, config, {
        commandId: `resolve_${action}`,
        type: 'resolve_pending_decision',
        payload: { action },
      });
      expect(state.flow.step).toBe('day_summary');
      state = applyCommand(state, config, {
        commandId: `complete_${action}`,
        type: 'complete_day',
        payload: {},
      });
      expect(state.resources.day).toBe(expectedDay);
    }
  });

  it('keeps finished sessions immutable', () => {
    let state = createInitialState(setup, config, 'finished_seed');
    state = finishGame(state, config);
    expect(() =>
      applyCommand(state, config, { commandId: 'late', type: 'choose_intent', payload: { intent: 'get_sales' } })
    ).toThrow(/Finished session does not accept game commands/);
  });
});

function resolvePending(input: GameState, key: string): GameState {
  let state = input;
  let guard = 0;
  while (state.pendingDecision && guard < 20) {
    guard += 1;
    const pending = state.pendingDecision;
    const cohortId = 'cohortId' in pending ? pending.cohortId : undefined;
    let command: GameCommand;

    if (pending.type === 'mini_game') {
      command = {
        commandId: `resolve_${key}_${guard}`,
        type: 'resolve_mini_game',
        payload: { cohortId: pending.cohortId, mode: 'auto', processed: 0 },
      };
    } else if (pending.type === 'inbound') {
      command = {
        commandId: `resolve_${key}_${guard}`,
        type: 'resolve_pending_decision',
        payload: { cohortId, action: state.resources.energy >= 0.3 ? 'process_available' : 'ignore' },
      };
    } else if (pending.type === 'sales') {
      command = {
        commandId: `resolve_${key}_${guard}`,
        type: 'resolve_pending_decision',
        payload: { cohortId, action: state.resources.energy >= 0.5 ? 'process' : 'ignore', amount: 10 },
      };
    } else if (pending.type === 'followup') {
      command = {
        commandId: `resolve_${key}_${guard}`,
        type: 'resolve_pending_decision',
        payload: { cohortId, action: state.resources.energy >= 5 ? 'followup_message' : 'ignore' },
      };
    } else if (pending.type === 'energy_crisis') {
      command = {
        commandId: `resolve_${key}_${guard}`,
        type: 'resolve_pending_decision',
        payload: { action: state.resources.day < config.totalDays ? 'rest_day' : 'confirm' },
      };
    } else if (pending.type === 'budget_notice') {
      command = {
        commandId: `resolve_${key}_${guard}`,
        type: 'resolve_pending_decision',
        payload: { action: 'continue_without_budget' },
      };
    } else {
      command = {
        commandId: `resolve_${key}_${guard}`,
        type: 'resolve_pending_decision',
        payload: { action: 'cancel' },
      };
    }
    state = applyCommand(state, config, command);
  }
  if (state.pendingDecision) throw new Error(`Pending decision loop: ${state.pendingDecision.type}`);
  return state;
}

function createConversionMatrixState(superpower: Superpower, seed: string): GameState {
  const state = createInitialState({ ...scenarios[0].setup, superpower }, config, seed);
  state.launchPlan.productPrice = 15_000;
  state.targets = { targetSales: 30, targetRevenue: 450_000, personalGoal: 150_000 };
  state.v3.preparedAds = getV3PreparationDefinitions('ads').flatMap((definition) => (['self', 'expert'] as const).map((mode) => ({
    key: `ad:${definition.id}:${mode}:matrix`,
    instrumentId: definition.id,
    mode,
    title: `${definition.title} - ${mode === 'self' ? 'самостоятельно' : 'со специалистом'}`,
    known: true,
    uses: 0,
  })));
  state.v3.preparedTools = (['warmup', 'sales'] as const).flatMap((area) =>
    getV3PreparationDefinitions(area).flatMap((definition) => (['self', 'expert'] as const).map((mode) => ({
      key: `${area}:${definition.id}:${mode}`,
      area,
      instrumentId: definition.id,
      mode,
      title: `${definition.title} - ${mode === 'self' ? 'самостоятельно' : 'со специалистом'}`,
      known: true,
      uses: 0,
    }))),
  );
  return state;
}
