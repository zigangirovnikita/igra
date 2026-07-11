import type { GameState, GameConfig } from '../types';
import { applyProcessing, applySales, applyFollowup } from '../calculations/funnel';
import { recalculateMetrics } from '../time/ticks';
import { calculateDiagnostics } from '../diagnostics/report';

export function deriveNextPendingDecision(state: GameState): NonNullable<GameState['pendingDecision']> | null {
  for (const cohort of state.cohorts) {
    if (cohort.unprocessedInbound > 0 && cohort.routeSnapshot.processing === 'manual' && cohort.inboundDecision === 'pending') {
      return { type: 'inbound', cohortId: cohort.id };
    }
  }

  for (const cohort of state.cohorts) {
    if (cohort.unprocessedApplications > 0 && ['manual_chat', 'call'].includes(cohort.routeSnapshot.saleMethod) && cohort.salesDecision === 'pending') {
      return { type: 'sales', cohortId: cohort.id };
    }
  }

  for (const cohort of state.cohorts) {
    if (cohort.pendingFollowup > 0 && cohort.routeSnapshot.followup === 'manual' && cohort.followupDecision === 'pending' && !cohort.followedUp) {
      return { type: 'followup', cohortId: cohort.id };
    }
  }

  return null;
}

export function resolvePendingDecision(state: GameState, config: GameConfig, payload: { cohortId?: string, action: string, amount?: number }): GameState {
  const currentDecision = state.pendingDecision;
  if (!currentDecision) throw new Error('No pending decision');

  if (currentDecision.type === 'finish_confirmation') {
    if (payload.action === 'confirm') {
      state.status = 'finished';
      state.flow.stage = 'final';
      state.flow.step = 'final_diagnosis';
      state.diagnostics = calculateDiagnostics(state, config);
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

  if (!payload.cohortId) throw new Error('cohortId required for this decision');

  const cohortIndex = state.cohorts.findIndex(c => c.id === payload.cohortId);
  if (cohortIndex === -1) throw new Error('Cohort not found');
  const cohort = state.cohorts[cohortIndex];

  if (currentDecision.type === 'inbound') {
    if (payload.action === 'process') {
      const amount = payload.amount || Math.min(cohort.unprocessedInbound, 15);
      state.cohorts[cohortIndex] = applyProcessing(state, config, cohort, 'manual', amount);
      state.resources.energy = Math.max(0, state.resources.energy - amount * 0.3);
      if (state.cohorts[cohortIndex].unprocessedInbound <= 0) state.cohorts[cohortIndex].inboundDecision = 'resolved';
    } else if (payload.action === 'defer') {
      if (cohort.deferCount >= 1) throw new Error('This cohort has already been deferred');
      state.cohorts[cohortIndex].inboundDecision = 'deferred';
      state.cohorts[cohortIndex].deferredUntilDay = state.resources.day + 1;
      state.cohorts[cohortIndex].deferCount += 1;
    } else {
      state.cohorts[cohortIndex].inboundDecision = 'ignored';
      state.cohorts[cohortIndex].lost += state.cohorts[cohortIndex].unprocessedInbound;
      state.cohorts[cohortIndex].unprocessedInbound = 0;
    }
  } else if (currentDecision.type === 'sales') {
    if (payload.action === 'process') {
      const amount = payload.amount || Math.min(cohort.unprocessedApplications, 10);
      state.cohorts[cohortIndex] = applySales(state, config, cohort, cohort.routeSnapshot.saleMethod, amount);
      state.resources.energy = Math.max(0, state.resources.energy - amount * 0.5);
      if (state.cohorts[cohortIndex].unprocessedApplications <= 0) state.cohorts[cohortIndex].salesDecision = 'resolved';
    } else if (payload.action === 'defer') {
      if (cohort.deferCount >= 1) throw new Error('This cohort has already been deferred');
      state.cohorts[cohortIndex].salesDecision = 'deferred';
      state.cohorts[cohortIndex].deferredUntilDay = state.resources.day + 1;
      state.cohorts[cohortIndex].deferCount += 1;
    } else {
      state.cohorts[cohortIndex].salesDecision = 'ignored';
      state.cohorts[cohortIndex].lost += state.cohorts[cohortIndex].unprocessedApplications;
      state.cohorts[cohortIndex].unprocessedApplications = 0;
    }
  } else if (currentDecision.type === 'followup') {
    if (payload.action === 'process') {
      state.cohorts[cohortIndex] = applyFollowup(state, config, cohort);
      state.resources.energy = Math.max(0, state.resources.energy - 5);
      state.cohorts[cohortIndex].followupDecision = 'resolved';
    } else if (payload.action === 'defer') {
      if (cohort.deferCount >= 1) throw new Error('This cohort has already been deferred');
      state.cohorts[cohortIndex].followupDecision = 'deferred';
      state.cohorts[cohortIndex].deferredUntilDay = state.resources.day + 1;
      state.cohorts[cohortIndex].deferCount += 1;
    } else {
      state.cohorts[cohortIndex].followupDecision = 'ignored';
      state.cohorts[cohortIndex].lost += state.cohorts[cohortIndex].pendingFollowup;
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
  if (!state.pendingDecision) {
    if (state.flow.step === 'post_action') {
      state.flow.step = 'day_summary';
    }
  }
  recalculateMetrics(state);
  return state;
}
