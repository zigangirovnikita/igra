import { describe, expect, it } from 'vitest';
import {
  applyCommand,
  assertStateInvariants,
  createInitialState,
  finishGame,
  getActionAvailability,
  getBucketTargetSales,
  hashToUnitInterval,
  stochasticRound,
  type GameCommand,
  type GameState,
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
    const command = { commandId: 'same', type: 'advance_intro' as const, payload: {} };
    const once = applyCommand(state, config, command);
    const twice = applyCommand(once, config, command);
    expect(twice).toEqual(once);
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
    const scenario = scenarios[0];
    let state = createInitialState(scenario.setup, config, 'outcome_seed');
    for (const command of scenario.commands) {
      state = applyCommand(state, config, command);
      if (command.commandId === 'c18') break;
    }

    const action = config.actions.find((candidate) => candidate.id === 'product_pilot');
    const outcome = state.lastOutcome;
    expect(action).toBeDefined();
    expect(outcome).toBeDefined();
    if (!action || !outcome) throw new Error('Missing action outcome');

    expect(outcome.bankSpent).toBe(action.cost);
    expect(outcome.energySpent).toBe(action.energyCost);
    expect(outcome.bankBefore - outcome.bankAfter).toBe(action.cost);
    expect(outcome.finishedDay - outcome.startedDay + 1).toBe(action.days);
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
