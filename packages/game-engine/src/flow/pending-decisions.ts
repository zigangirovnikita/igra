import type { GameState, GameConfig, ProcessingType, SaleMethod } from '../types';
import { applyProcessing, applySales, applyFollowup } from '../calculations/funnel';
import { recalculateMetrics } from '../time/ticks';
import { generateMiniGameSession } from '../calculations/minigame';

export function deriveNextPendingDecision(state: GameState): NonNullable<GameState['pendingDecision']> | null {
  for (const cohort of state.cohorts) {
    if (cohort.unprocessedInbound > 5 && cohort.routeSnapshot.processing === 'manual' && cohort.inboundDecision === 'pending' && state.metrics.miniGameCount < 1) {
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

export function resolvePendingDecision(state: GameState, config: GameConfig, payload: { cohortId?: string, action: string, amount?: number }): GameState {
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
      if (state.flow.backStep) {
        state.flow.step = state.flow.backStep;
      } else {
        state.flow.step = 'daily_intent';
      }
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
      state.resources.day += days;
      state.resources.energy = Math.min(100, state.resources.energy + (days === 2 ? 45 : 20));
    } else if (payload.action === 'delegate') {
      if (state.resources.bank < 5_000) throw new Error('Not enough money to delegate');
      state.resources.bank -= 5_000;
      state.metrics.expenses += 5_000;
      state.resources.energy = 10;
    } else if (payload.action === 'push_through') {
      state.resources.energy = 1;
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

  const cohortIndex = state.cohorts.findIndex(c => c.id === payload.cohortId);
  if (cohortIndex === -1) throw new Error('Cohort not found');
  const cohort = state.cohorts[cohortIndex];

  if (currentDecision.type === 'inbound') {
    if (['process', 'process_all', 'process_available', 'process_selected'].includes(payload.action)) {
      const amount = payload.action === 'process_all'
        ? cohort.unprocessedInbound
        : payload.action === 'process_available'
          ? Math.min(cohort.unprocessedInbound, Math.max(5, Math.floor(state.resources.energy / 0.3)))
          : payload.amount || Math.min(cohort.unprocessedInbound, 15);
      state.cohorts[cohortIndex] = applyProcessing(state, config, cohort, 'manual', amount);
      state.resources.energy = Math.max(0, state.resources.energy - amount * 0.3);
      if (state.cohorts[cohortIndex].unprocessedInbound <= 0) state.cohorts[cohortIndex].inboundDecision = 'resolved';
    } else if (payload.action === 'connect_manager' || payload.action === 'connect_bot') {
      const processing: ProcessingType = payload.action === 'connect_manager' ? 'manager' : 'simple_bot';
      if (payload.action === 'connect_manager') {
        if (state.resources.bank < 30_000) throw new Error('Not enough money to hire manager');
        state.resources.bank -= 30_000;
        state.metrics.expenses += 30_000;
        state.assets.manager = 'urgent';
      } else {
        state.assets.simpleBot = 'urgent';
      }
      state.activeRoute = { ...state.activeRoute, processing };
      state.cohorts[cohortIndex] = applyProcessing(state, config, { ...cohort, routeSnapshot: { ...cohort.routeSnapshot, processing } }, 'auto');
      state.cohorts[cohortIndex].inboundDecision = 'resolved';
    } else if (payload.action === 'defer') {
      if (cohort.deferCount >= 1) throw new Error('This cohort has already been deferred');
      state.cohorts[cohortIndex].inboundDecision = 'deferred';
      state.cohorts[cohortIndex].deferredUntilDay = state.resources.day + 1;
      state.cohorts[cohortIndex].deferCount += 1;
    } else {
      state.cohorts[cohortIndex].inboundDecision = 'ignored';
      state.cohorts[cohortIndex].losses.processing += state.cohorts[cohortIndex].unprocessedInbound;
      state.cohorts[cohortIndex].unprocessedInbound = 0;
    }
  } else if (currentDecision.type === 'mini_game') {
    if (payload.action === 'process_mini_game') {
      const amount = payload.amount || Math.min(cohort.unprocessedInbound, 15);
      // Mini-game bonus: slightly higher processing and application rates
      const originalProcessing = cohort.routeSnapshot.processing;
      cohort.routeSnapshot.processing = 'ai_bot'; // Simulate high quality processing
      state.cohorts[cohortIndex] = applyProcessing(state, config, cohort, 'manual', amount);
      cohort.routeSnapshot.processing = originalProcessing; // Restore
      
      state.resources.energy = Math.max(0, state.resources.energy - amount * 0.3);
      if (state.cohorts[cohortIndex].unprocessedInbound <= 0) {
        state.cohorts[cohortIndex].inboundDecision = 'resolved';
      }
      state.metrics.miniGameCount += 1;
      state.miniGame = null;
    } else if (payload.action === 'skip_mini_game') {
      state.cohorts[cohortIndex].inboundDecision = 'ignored';
      state.cohorts[cohortIndex].losses.processing += state.cohorts[cohortIndex].unprocessedInbound;
      state.cohorts[cohortIndex].unprocessedInbound = 0;
      state.metrics.miniGameCount += 1;
      state.miniGame = null;
    }
  } else if (currentDecision.type === 'sales') {
    if (['process', 'sell_chat', 'sell_call', 'sell_website', 'sell_bot', 'sell_webinar'].includes(payload.action)) {
      const amount = payload.amount || Math.min(cohort.unprocessedApplications, 10);
      const method = saleMethodForAction(payload.action, cohort.routeSnapshot.saleMethod);
      state.activeRoute = { ...state.activeRoute, saleMethod: method };
      state.cohorts[cohortIndex] = applySales(state, config, { ...cohort, routeSnapshot: { ...cohort.routeSnapshot, saleMethod: method } }, method, amount);
      state.resources.energy = Math.max(0, state.resources.energy - amount * 0.5);
      if (state.cohorts[cohortIndex].unprocessedApplications <= 0) state.cohorts[cohortIndex].salesDecision = 'resolved';
    } else if (payload.action === 'defer') {
      if (cohort.deferCount >= 1) throw new Error('This cohort has already been deferred');
      state.cohorts[cohortIndex].salesDecision = 'deferred';
      state.cohorts[cohortIndex].deferredUntilDay = state.resources.day + 1;
      state.cohorts[cohortIndex].deferCount += 1;
    } else {
      state.cohorts[cohortIndex].salesDecision = 'ignored';
      state.cohorts[cohortIndex].losses.sale += state.cohorts[cohortIndex].unprocessedApplications;
      state.cohorts[cohortIndex].unprocessedApplications = 0;
    }
  } else if (currentDecision.type === 'followup') {
    if (['process', 'followup_message', 'followup_call', 'followup_case', 'followup_discount', 'followup_bot'].includes(payload.action)) {
      const followup = payload.action === 'followup_bot' ? 'bot' : 'manual';
      state.activeRoute = { ...state.activeRoute, followup };
      state.cohorts[cohortIndex] = applyFollowup(state, config, { ...cohort, routeSnapshot: { ...cohort.routeSnapshot, followup } });
      state.resources.energy = Math.max(0, state.resources.energy - 5);
      state.cohorts[cohortIndex].followupDecision = 'resolved';
    } else if (payload.action === 'defer') {
      if (cohort.deferCount >= 1) throw new Error('This cohort has already been deferred');
      state.cohorts[cohortIndex].followupDecision = 'deferred';
      state.cohorts[cohortIndex].deferredUntilDay = state.resources.day + 1;
      state.cohorts[cohortIndex].deferCount += 1;
    } else {
      state.cohorts[cohortIndex].followupDecision = 'ignored';
      state.cohorts[cohortIndex].losses.followup += state.cohorts[cohortIndex].pendingFollowup;
      state.cohorts[cohortIndex].pendingFollowup = 0;
    }
  }

  if (state.currentDayReport) {
    state.currentDayReport.decisions.push({
      type: currentDecision.type,
      label: payload.action,
    });
  }

  state.pendingDecision = deriveNextPendingDecision(state);
  if (state.pendingDecision?.type === 'mini_game') {
    state.miniGame = generateMiniGameSession(state, state.pendingDecision.cohortId);
  }

  if (!state.pendingDecision) {
    if (state.flow.step === 'post_action') {
      state.flow.step = 'day_summary';
    }
  }
  recalculateMetrics(state);
  return state;
}

function saleMethodForAction(action: string, fallback: SaleMethod): SaleMethod {
  if (action === 'sell_chat') return 'manual_chat';
  if (action === 'sell_call') return 'call';
  if (action === 'sell_website') return 'website_auto';
  if (action === 'sell_bot') return 'bot_auto';
  if (action === 'sell_webinar') return 'webinar_direct';
  return fallback;
}
