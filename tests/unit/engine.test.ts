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
    expect(action).toBeDefined();
    expect(state.lastOutcome?.bankSpent).toBe(action?.cost);
    expect(state.lastOutcome?.energySpent).toBe(action?.energyCost);
    expect(state.lastOutcome?.bankBefore - (state.lastOutcome?.bankAfter ?? 0)).toBe(action?.cost);
    expect(state.lastOutcome?.finishedDay - state.lastOutcome?.startedDay + 1).toBe(action?.days);
  });

  it('blocks an action when energy is below its complete cost', () => {
    const action = config.actions.find((candidate) => candidate.energyCost > 1 && candidate.enabled);
    expect(action).toBeDefined();
    const state = createInitialState(setup, config, 'energy_seed');
    state.status = 'active';
    state.resources.energy = Math.max(0, (action?.energyCost ?? 1) - 1);
    const availability = getActionAvailability(state, action!, config);
    expect(availability.available).toBe(false);
    if (!availability.available) expect(availability.reason).toMatch(/энергии/i);
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
