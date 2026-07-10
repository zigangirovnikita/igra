import type { GameConfig, GameState } from '../types';

export function assertStateInvariants(state: GameState, config: GameConfig): void {
  if (state.resources.bank < 0) throw new Error('Invariant violation: bank is negative');
  if (state.resources.energy < 0 || state.resources.energy > 100) {
    throw new Error('Invariant violation: energy out of bounds');
  }
  if (state.resources.day < 1 || state.resources.day > config.totalDays) {
    throw new Error('Invariant violation: day out of bounds');
  }
  if (state.configVersion !== config.version) {
    throw new Error('Invariant violation: configVersion changed');
  }
  if (state.metrics.revenue !== state.metrics.sales * state.player.productPrice) {
    throw new Error('Invariant violation: revenue does not match sales');
  }
  for (const value of Object.values(state.metrics)) {
    if (!Number.isFinite(value)) throw new Error('Invariant violation: non-finite metric');
    if (value < 0) throw new Error('Invariant violation: negative metric');
  }
  for (const cohort of state.cohorts) {
    if (cohort.sales > cohort.processed + cohort.heldCalls + 0.0001) {
      throw new Error('Invariant violation: cohort sales exceed eligible audience');
    }
  }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
