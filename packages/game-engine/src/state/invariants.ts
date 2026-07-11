import type { GameConfig, GameState } from '../types';

export function assertStateInvariants(state: GameState, config: GameConfig): void {
  if (state.resources.bank < 0 || state.resources.bank > config.startingBank) {
    throw new Error('Invariant violation: bank out of bounds');
  }
  if (state.resources.energy < 0 || state.resources.energy > 100) {
    throw new Error('Invariant violation: energy out of bounds');
  }
  if (state.resources.day < 1 || state.resources.day > config.totalDays) {
    throw new Error('Invariant violation: day out of bounds');
  }

  if (state.metrics.expenses !== config.startingBank - state.resources.bank) {
    throw new Error('Invariant violation: expenses mismatch bank diff');
  }
  if (state.metrics.revenue !== state.metrics.sales * (state.launchPlan.productPrice || 0)) {
    throw new Error('Invariant violation: revenue does not match sales');
  }
  if (state.configVersion !== config.version) {
    throw new Error('Invariant violation: configVersion changed');
  }

  for (const [key, value] of Object.entries(state.metrics)) {
    if (!Number.isFinite(value)) throw new Error(`Invariant violation: non-finite metric ${key}`);
    if (value < 0) throw new Error(`Invariant violation: negative metric ${key}`);
  }

  const integerMetricKeys = [
    'impressions',
    'inbound',
    'activated',
    'processed',
    'applications',
    'bookedCalls',
    'heldCalls',
    'sales',
    'capacityLostLeads',
    'lostLeads',
  ] as const;
  for (const key of integerMetricKeys) {
    if (!Number.isInteger(state.metrics[key])) {
      throw new Error(`Invariant violation: fractional people metric ${key}`);
    }
  }

  for (const cohort of state.cohorts) {
    const peopleFields = [
      'impressions',
      'inbound',
      'activated',
      'processed',
      'applications',
      'bookedCalls',
      'heldCalls',
      'sales',
      'unprocessedInbound',
      'unprocessedApplications',
      'pendingFollowup',
      'capacityLostLeads',
    ] as const;

    for (const key of peopleFields) {
      const value = cohort[key];
      if (value === undefined) continue;
      if (!Number.isFinite(value)) throw new Error(`Invariant violation: non-finite cohort metric ${key}`);
      if (value < 0) throw new Error(`Invariant violation: negative cohort metric ${key}`);
      if (!Number.isInteger(value)) throw new Error(`Invariant violation: fractional cohort metric ${key}`);
    }

    for (const [lossKey, value] of Object.entries(cohort.losses)) {
      if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
        throw new Error(`Invariant violation: invalid cohort loss ${lossKey}`);
      }
    }

    if (cohort.processed > cohort.activated) throw new Error('Invariant violation: processed > activated');
    if (cohort.applications > cohort.processed) throw new Error('Invariant violation: applications > processed');
    if (cohort.heldCalls > cohort.bookedCalls) throw new Error('Invariant violation: heldCalls > bookedCalls');
    if (cohort.sales > cohort.applications + cohort.heldCalls) throw new Error('Invariant violation: sales > max possible');
    if (cohort.unprocessedInbound > cohort.activated) throw new Error('Invariant violation: unprocessedInbound > activated');
    if (cohort.unprocessedApplications > cohort.applications) throw new Error('Invariant violation: unprocessedApplications > applications');

    if (cohort.deferCount !== 0 && cohort.deferCount !== 1) {
      throw new Error('Invariant violation: deferCount must be 0 or 1');
    }
  }

  if (state.status === 'finished') {
    if (!state.endingReason) throw new Error('Invariant violation: finished state missing endingReason');
    if (!state.diagnostics) throw new Error('Invariant violation: finished state missing diagnostics');
  }

  if (state.flow.stage === 'final' && !state.flow.step.startsWith('final_')) {
    throw new Error('Invariant violation: flow.step incompatible with flow.stage');
  }

  if (state.pendingDecision) {
    const decision = state.pendingDecision;
    if (decision.type === 'inbound' || decision.type === 'sales' || decision.type === 'followup' || decision.type === 'mini_game') {
      if (!state.cohorts.some((cohort) => cohort.id === decision.cohortId)) {
        throw new Error('Invariant violation: pendingDecision.cohortId does not exist');
      }
    }
  }

  if (state.miniGame && !state.cohorts.some((cohort) => cohort.id === state.miniGame?.cohortId)) {
    throw new Error('Invariant violation: miniGame.cohortId does not exist');
  }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
