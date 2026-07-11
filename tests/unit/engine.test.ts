import { describe, expect, it } from 'vitest';
import {
  applyCommand,
  assertStateInvariants,
  createInitialState,
  finishGame,
  getBucketTargetSales,
  hashToUnitInterval,
  stochasticRound
} from '../../packages/game-engine/src';
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

  it('finishes fixture scenarios without invariant violations', () => {
    for (const scenario of scenarios) {
      let state = createInitialState(scenario.setup, config, scenario.seed);
      for (const command of scenario.commands) {
        state = applyCommand(state, config, command);

        while (state.flow.step === 'post_action' && state.pendingDecision) {
          const decision = state.pendingDecision;
          const cohortId = 'cohortId' in decision ? decision.cohortId : undefined;
          state = applyCommand(state, config, {
            commandId: `auto_resolve_${Date.now()}`,
            type: 'resolve_pending_decision',
            payload: { action: 'defer', cohortId }
          });
        }
      }
      if (state.flow.step === 'final_reason') state = finishGame(state, config);
      assertStateInvariants(state, config);
      expect(state.status).toBe('finished');
      expect(state.metrics.revenue).toBe(state.metrics.sales * (state.launchPlan.productPrice ?? 0));
      expect(Number.isFinite(state.metrics.revenue)).toBe(true);
      expect(state.diagnostics).toBeDefined();
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
