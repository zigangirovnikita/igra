import type { GameConfig, GameState } from '../types';

export function assertStateInvariants(state: GameState, config: GameConfig): void {
  // Resources
  if (state.resources.bank < 0 || state.resources.bank > config.startingBank) {
    throw new Error('Invariant violation: bank out of bounds');
  }
  if (state.resources.energy < 0 || state.resources.energy > 100) {
    throw new Error('Invariant violation: energy out of bounds');
  }
  if (state.resources.day < 1 || state.resources.day > config.totalDays) {
    throw new Error('Invariant violation: day out of bounds');
  }
  
  // Financials
  if (state.metrics.expenses !== config.startingBank - state.resources.bank) {
    throw new Error('Invariant violation: expenses mismatch bank diff');
  }
  if (state.metrics.revenue !== state.metrics.sales * (state.launchPlan.productPrice || 0)) {
    throw new Error('Invariant violation: revenue does not match sales');
  }

  // Config
  if (state.configVersion !== config.version) {
    throw new Error('Invariant violation: configVersion changed');
  }

  // Metrics
  for (const [key, value] of Object.entries(state.metrics)) {
    if (!Number.isFinite(value)) throw new Error(`Invariant violation: non-finite metric ${key}`);
    if (value < 0) throw new Error(`Invariant violation: negative metric ${key}`);
  }

  // Cohorts
  for (const cohort of state.cohorts) {
    const fields = [
      'impressions', 'inbound', 'activated', 'processed', 
      'applications', 'bookedCalls', 'heldCalls', 'sales',
      'unprocessedInbound', 'unprocessedApplications'
    ] as const;

    for (const key of fields) {
      const val = cohort[key];
      if (val === undefined) continue;
      if (!Number.isFinite(val)) throw new Error(`Invariant violation: non-finite cohort metric ${key}`);
      if (val < 0) throw new Error(`Invariant violation: negative cohort metric ${key}`);
    }

    if (cohort.processed > cohort.activated + 0.0001) throw new Error('Invariant violation: processed > activated');
    if (cohort.applications > cohort.processed + 0.0001) throw new Error('Invariant violation: applications > processed');
    if (cohort.heldCalls > cohort.bookedCalls + 0.0001) throw new Error('Invariant violation: heldCalls > bookedCalls');
    if (cohort.sales > cohort.applications + cohort.heldCalls + 0.0001) throw new Error('Invariant violation: sales > max possible');
    if (cohort.unprocessedInbound > cohort.activated + 0.0001) throw new Error('Invariant violation: unprocessedInbound > activated');
    if (cohort.unprocessedApplications > cohort.applications + 0.0001) throw new Error('Invariant violation: unprocessedApplications > applications');
    
    if (cohort.deferCount !== 0 && cohort.deferCount !== 1) {
      throw new Error('Invariant violation: deferCount must be 0 or 1');
    }
  }

  // Finished State
  if (state.status === 'finished') {
    if (!state.endingReason) throw new Error('Invariant violation: finished state missing endingReason');
    if (!state.diagnostics) throw new Error('Invariant violation: finished state missing diagnostics');
  }

  // Flow State (basic check)
  if (state.flow.stage === 'final' && !state.flow.step.startsWith('final_')) {
    throw new Error('Invariant violation: flow.step incompatible with flow.stage');
  }

  // Pending References
  if (state.pendingDecision) {
    const dec = state.pendingDecision;
    if (dec.type === 'inbound' || dec.type === 'sales' || dec.type === 'followup' || dec.type === 'mini_game') {
      if (!state.cohorts.some(c => c.id === dec.cohortId)) {
        throw new Error('Invariant violation: pendingDecision.cohortId does not exist');
      }
    }
  }
  
  if (state.miniGame) {
    if (!state.cohorts.some(c => c.id === state.miniGame!.cohortId)) {
      throw new Error('Invariant violation: miniGame.cohortId does not exist');
    }
  }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
