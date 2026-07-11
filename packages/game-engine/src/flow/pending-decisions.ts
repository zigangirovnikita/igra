import type { GameConfig, GameState, SaleMethod } from '../types';
import { applyFollowup, applyProcessing, applySales } from '../calculations/funnel';
import { recalculateMetrics } from '../time/ticks';
import { generateMiniGameSession } from '../calculations/minigame';

const MINI_GAME_TRIGGER = 30;
const MINI_GAME_LIMIT = 2;
const MANUAL_MESSAGE_ENERGY = 0.3;
const MANUAL_SALE_ENERGY = 0.5;
const LOW_ENERGY_THRESHOLD = 30;
const AUTO_THROUGHPUT_NORMAL = 18;
const AUTO_THROUGHPUT_LOW_ENERGY = 12;

export function deriveNextPendingDecision(state: GameState): NonNullable<GameState['pendingDecision']> | null {
  for (const cohort of state.cohorts) {
    const miniGameSeen = Boolean(state.flags[`mini_game_seen:${cohort.id}`]);
    if (
      cohort.unprocessedInbound >= MINI_GAME_TRIGGER &&
      cohort.routeSnapshot.processing === 'manual' &&
      cohort.inboundDecision === 'pending' &&
      state.metrics.miniGameCount < MINI_GAME_LIMIT &&
      !miniGameSeen
    ) {
      return { type: 'mini_game', cohortId: cohort.id, returnStep: 'daily_intro' };
    }
    if (cohort.unprocessedInbound > 0 && cohort.routeSnapshot.processing === 'manual' && cohort.inboundDecision === 'pending') {
      return { type: 'inbound', cohortId: cohort.id, returnStep: 'daily_intro' };
    }
  }

  for (const cohort of state.cohorts) {
    if (cohort.unprocessedApplications > 0 && ['manual_chat', 'call'].includes(cohort.routeSnapshot.saleMethod) && cohort.salesDecision === 'pending') {
      return { type: 'sales', cohortId: cohort.id, returnStep: 'daily_intro' };
    }
  }

  for (const cohort of state.cohorts) {
    if (cohort.pendingFollowup > 0 && cohort.routeSnapshot.followup === 'manual' && cohort.followupDecision === 'pending' && !cohort.followedUp) {
      return { type: 'followup', cohortId: cohort.id, returnStep: 'daily_intro' };
    }
  }

  if (state.resources.energy <= 0) return { type: 'energy_crisis', returnStep: 'daily_intro' };
  if (state.resources.bank <= 0 && !state.flags.budgetNoticeHandled) return { type: 'budget_notice', returnStep: 'daily_intro' };
  if (!state.flow.goalPromptHandled && state.targets.targetRevenue > 0 && state.metrics.revenue >= state.targets.targetRevenue) {
    return { type: 'goal_reached', returnStep: 'daily_intro' };
  }
  return null;
}

export function resolvePendingDecision(
  state: GameState,
  config: GameConfig,
  payload: { cohortId?: string; action: string; amount?: number },
): GameState {
  const currentDecision = state.pendingDecision;
  if (!currentDecision) throw new Error('No pending decision');

  if (currentDecision.type === 'finish_confirmation') {
    if (payload.action === 'confirm') {
      state.flow.stage = 'final';
      state.endingReason = 'manual_finished';
      state.flow.step = 'final_reason';
      state.pendingDecision = null;
    } else {
      state.pendingDecision = null;
      state.flow.step = state.flow.backStep ?? 'daily_intent';
    }
    return state;
  }

  if (currentDecision.type === 'goal_reached') {
    if (payload.action === 'confirm') {
      state.endingReason = 'goal_finished';
      state.flow.stage = 'final';
      state.flow.step = 'final_reason';
      state.pendingDecision = null;
    } else {
      state.flow.goalPromptHandled = true;
      state.pendingDecision = null;
      state.flow.step = 'day_summary';
    }
    return state;
  }

  if (currentDecision.type === 'energy_crisis') {
    if (payload.action === 'rest_day' || payload.action === 'rest_two_days') {
      const days = payload.action === 'rest_two_days' ? 2 : 1;
      if (state.resources.day + days > config.totalDays) throw new Error('Not enough days to rest');
      state.resources.day += Math.max(0, days - 1);
      state.resources.energy = Math.min(100, state.resources.energy + (days === 2 ? 45 : 20));
    } else if (payload.action === 'delegate') {
      if (state.resources.bank < 5_000) throw new Error('Not enough money to delegate');
      state.resources.bank -= 5_000;
      state.metrics.expenses += 5_000;
      state.resources.energy = 10;
    } else if (payload.action === 'confirm') {
      state.flow.stage = 'final';
      state.endingReason = 'resource_finished';
      state.flow.step = 'final_reason';
      state.pendingDecision = null;
      return state;
    } else {
      throw new Error('Invalid energy crisis action');
    }
    state.pendingDecision = null;
    state.flow.step = 'day_summary';
    return state;
  }

  if (currentDecision.type === 'budget_notice') {
    if (payload.action === 'continue_without_budget' || payload.action === 'cancel') {
      state.flags.budgetNoticeHandled = true;
      state.pendingDecision = null;
      state.flow.step = 'day_summary';
    } else if (payload.action === 'confirm') {
      state.flow.stage = 'final';
      state.endingReason = 'resource_finished';
      state.flow.step = 'final_reason';
      state.pendingDecision = null;
    } else {
      throw new Error('Invalid budget action');
    }
    return state;
  }

  if (!payload.cohortId) throw new Error('cohortId required for this decision');
  const cohortIndex = state.cohorts.findIndex((cohort) => cohort.id === payload.cohortId);
  if (cohortIndex === -1) throw new Error('Cohort not found');
  const cohort = state.cohorts[cohortIndex];

  if (currentDecision.type === 'inbound') {
    if (['process', 'process_all', 'process_available', 'process_selected'].includes(payload.action)) {
      const energyCapacity = Math.max(0, Math.floor(state.resources.energy / MANUAL_MESSAGE_ENERGY));
      const requested = payload.action === 'process_all'
        ? cohort.unprocessedInbound
        : payload.action === 'process_available'
          ? energyCapacity
          : payload.amount ?? Math.min(cohort.unprocessedInbound, 15);
      const amount = Math.min(cohort.unprocessedInbound, energyCapacity, Math.max(0, Math.floor(requested)));
      if (amount <= 0) throw new Error('Not enough energy to process inbound');
      state.cohorts[cohortIndex] = applyProcessing(state, config, cohort, 'manual', amount);
      state.resources.energy = Math.max(0, state.resources.energy - amount * MANUAL_MESSAGE_ENERGY);
      if (state.cohorts[cohortIndex].unprocessedInbound <= 0) state.cohorts[cohortIndex].inboundDecision = 'resolved';
    } else if (payload.action === 'connect_manager' || payload.action === 'connect_bot') {
      throw new Error('Create automation through a normal paid game action');
    } else if (payload.action === 'defer') {
      deferCohort(state.cohorts[cohortIndex], state.resources.day, 'inbound');
    } else {
      state.cohorts[cohortIndex].inboundDecision = 'ignored';
      state.cohorts[cohortIndex].losses.processing += state.cohorts[cohortIndex].unprocessedInbound;
      state.cohorts[cohortIndex].unprocessedInbound = 0;
    }
  } else if (currentDecision.type === 'mini_game') {
    const miniGame = state.miniGame;
    if (!miniGame || miniGame.status !== 'active' || miniGame.cohortId !== cohort.id) {
      throw new Error('Mini-game session is not active');
    }

    const manual = payload.action === 'process_mini_game';
    const automatic = payload.action === 'skip_mini_game';
    if (!manual && !automatic) throw new Error('Invalid mini-game action');

    const beforeExpiry = Date.now() <= Date.parse(miniGame.expiresAt);
    const energyCapacity = Math.max(0, Math.floor(state.resources.energy / MANUAL_MESSAGE_ENERGY));
    const requested = manual
      ? (beforeExpiry ? Math.max(0, Math.floor(payload.amount ?? 0)) : 0)
      : (state.resources.energy < LOW_ENERGY_THRESHOLD ? AUTO_THROUGHPUT_LOW_ENERGY : AUTO_THROUGHPUT_NORMAL);
    const amount = Math.min(
      requested,
      miniGame.messages.length,
      cohort.unprocessedInbound,
      manual ? energyCapacity : cohort.unprocessedInbound,
    );

    if (amount > 0) {
      state.cohorts[cohortIndex] = applyProcessing(state, config, cohort, 'auto', amount);
      if (manual) {
        state.resources.energy = Math.max(0, state.resources.energy - amount * MANUAL_MESSAGE_ENERGY);
      }
    }

    const unresolved = state.cohorts[cohortIndex].unprocessedInbound;
    if (unresolved > 0) {
      state.cohorts[cohortIndex].losses.processing += unresolved;
      state.cohorts[cohortIndex].unprocessedInbound = 0;
    }
    state.cohorts[cohortIndex].inboundDecision = 'resolved';
    state.flags[`mini_game_seen:${cohort.id}`] = true;
    state.metrics.miniGameCount += 1;
    state.miniGame = null;
  } else if (currentDecision.type === 'sales') {
    if (['process', 'sell_chat', 'sell_call', 'sell_website', 'sell_bot', 'sell_webinar'].includes(payload.action)) {
      const method = saleMethodForAction(payload.action, cohort.routeSnapshot.saleMethod);
      validateSaleAsset(state, method);
      const energyCost = method === 'manual_chat' || method === 'call' ? MANUAL_SALE_ENERGY : 0;
      const energyCapacity = energyCost > 0 ? Math.floor(state.resources.energy / energyCost) : cohort.unprocessedApplications;
      const requested = payload.amount ?? Math.min(cohort.unprocessedApplications, 10);
      const amount = Math.min(cohort.unprocessedApplications, Math.max(0, Math.floor(requested)), energyCapacity);
      if (amount <= 0) throw new Error('Not enough energy to process sales');
      const routeSnapshot = cohort.routeSnapshot;
      const updated = applySales(
        state,
        config,
        { ...cohort, routeSnapshot: { ...routeSnapshot, saleMethod: method } },
        method,
        amount,
      );
      state.cohorts[cohortIndex] = { ...updated, routeSnapshot };
      if (energyCost > 0) state.resources.energy = Math.max(0, state.resources.energy - amount * energyCost);
      if (state.cohorts[cohortIndex].unprocessedApplications <= 0) state.cohorts[cohortIndex].salesDecision = 'resolved';
    } else if (payload.action === 'defer') {
      deferCohort(state.cohorts[cohortIndex], state.resources.day, 'sales');
    } else {
      state.cohorts[cohortIndex].salesDecision = 'ignored';
      state.cohorts[cohortIndex].losses.sale += state.cohorts[cohortIndex].unprocessedApplications;
      state.cohorts[cohortIndex].unprocessedApplications = 0;
    }
  } else if (currentDecision.type === 'followup') {
    if (['process', 'followup_message', 'followup_call', 'followup_case', 'followup_discount', 'followup_bot'].includes(payload.action)) {
      const followup = payload.action === 'followup_bot' ? 'bot' : 'manual';
      if (followup === 'bot' && !state.assets.simpleBot && !state.assets.aiBot) {
        throw new Error('Create a bot before automated follow-up');
      }
      if (followup === 'manual' && state.resources.energy < 5) throw new Error('Not enough energy for follow-up');
      const routeSnapshot = cohort.routeSnapshot;
      const updated = applyFollowup(state, config, {
        ...cohort,
        routeSnapshot: { ...routeSnapshot, followup },
      });
      state.cohorts[cohortIndex] = { ...updated, routeSnapshot };
      if (followup === 'manual') state.resources.energy -= 5;
      state.cohorts[cohortIndex].followupDecision = 'resolved';
    } else if (payload.action === 'defer') {
      deferCohort(state.cohorts[cohortIndex], state.resources.day, 'followup');
    } else {
      state.cohorts[cohortIndex].followupDecision = 'ignored';
      state.cohorts[cohortIndex].losses.followup += state.cohorts[cohortIndex].pendingFollowup;
      state.cohorts[cohortIndex].pendingFollowup = 0;
    }
  }

  if (state.currentDayReport) {
    state.currentDayReport.decisions.push({ type: currentDecision.type, label: payload.action });
  }

  state.pendingDecision = deriveNextPendingDecision(state);
  if (state.pendingDecision?.type === 'mini_game') {
    state.miniGame = generateMiniGameSession(state, state.pendingDecision.cohortId);
  }
  if (!state.pendingDecision && state.flow.step === 'post_action') {
    state.flow.step = 'day_summary';
  }
  recalculateMetrics(state);
  return state;
}

function deferCohort(
  cohort: GameState['cohorts'][number],
  currentDay: number,
  stage: 'inbound' | 'sales' | 'followup',
): void {
  if (cohort.deferCount >= 1) throw new Error('This cohort has already been deferred');
  if (stage === 'inbound') cohort.inboundDecision = 'deferred';
  if (stage === 'sales') cohort.salesDecision = 'deferred';
  if (stage === 'followup') cohort.followupDecision = 'deferred';
  cohort.deferredUntilDay = currentDay + 1;
  cohort.deferCount += 1;
}

function saleMethodForAction(action: string, fallback: SaleMethod): SaleMethod {
  if (action === 'sell_chat') return 'manual_chat';
  if (action === 'sell_call') return 'call';
  if (action === 'sell_website') return 'website_auto';
  if (action === 'sell_bot') return 'bot_auto';
  if (action === 'sell_webinar') return 'webinar_direct';
  return fallback;
}

function validateSaleAsset(state: GameState, method: SaleMethod): void {
  if (method === 'website_auto' && !state.assets.website) throw new Error('Create a website before website sales');
  if (method === 'bot_auto' && !state.assets.simpleBot && !state.assets.aiBot) throw new Error('Create a bot before bot sales');
}
