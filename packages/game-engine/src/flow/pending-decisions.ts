import type { GameState, GameConfig } from '../types';
import { applyProcessing, applySales, applyFollowup } from '../calculations/funnel';
import { recalculateMetrics } from '../time/ticks';

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

export function resolvePendingDecision(state: GameState, config: GameConfig, payload: { cohortId: string, action: 'process' | 'defer' | 'ignore', amount?: number }): GameState {
  const cohortIndex = state.cohorts.findIndex(c => c.id === payload.cohortId);
  if (cohortIndex === -1) throw new Error('Cohort not found');
  const cohort = state.cohorts[cohortIndex];
  
  const currentDecision = state.pendingDecision;
  if (!currentDecision) throw new Error('No pending decision');
  
  if (currentDecision.type === 'inbound') {
    if (payload.action === 'process') {
      const amount = payload.amount || Math.min(cohort.unprocessedInbound, 15);
      state.cohorts[cohortIndex] = applyProcessing(state, config, cohort, 'manual', amount);
      state.resources.energy = Math.max(0, state.resources.energy - amount * 0.3);
      if (state.cohorts[cohortIndex].unprocessedInbound <= 0) state.cohorts[cohortIndex].inboundDecision = 'resolved';
    } else if (payload.action === 'defer') {
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
      state.cohorts[cohortIndex].salesDecision = 'deferred';
      state.cohorts[cohortIndex].deferredUntilDay = state.resources.day + 1;
      state.cohorts[cohortIndex].deferCount += 1;
    } else {
      state.cohorts[cohortIndex].salesDecision = 'ignored';
      state.cohorts[cohortIndex].lost += state.cohorts[cohortIndex].unprocessedApplications;
      state.cohorts[cohortIndex].unprocessedApplications = 0;
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
