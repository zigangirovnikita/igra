import { describe, expect, it } from 'vitest';
import {
  applyCommand,
  assertStateInvariants,
  createInitialState,
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

  it('applies low-ticket minimum revenue', () => {
    const state = createInitialState({ ...setup, productPrice: 3_000 }, config, 'goal_seed');
    expect(state.targets.targetSales).toBe(100);
    expect(state.targets.targetRevenue).toBe(300_000);
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
  it('stores the initial plan without activating unbuilt tools', () => {
    const state = createInitialState(setup, config, 'plan_seed');
    const plannedRoute = { entry: 'website' as const, nurture: ['none' as const], processing: 'manager' as const, saleMethod: 'website_auto' as const, followup: 'bot' as const };
    const next = applyCommand(state, config, { commandId: 'plan', type: 'set_plan', payload: plannedRoute });
    expect(next.initialPlan).toEqual(plannedRoute);
    expect(next.activeRoute.processing).toBe('manual');
    expect(next.history.at(-1)?.type).toBe('initial_plan_set');
  });

  it('turns a pilot offer into a real sales attempt', () => {
    const state = createInitialState(setup, config, 'pilot_attempt_seed');
    const next = applyCommand(state, config, { commandId: 'pilot-offer', type: 'start_action', payload: { actionId: 'demand_pilot_offer' } });
    const cohort = next.cohorts.find((item) => item.sourceActionId === 'demand_pilot_offer');
    expect(cohort).toBeDefined();
    expect(cohort?.applications).toBe(3);
    expect(next.assets.demandConfidence).toBe(1);
  });

  it('records reflection answers for the final diagnosis', () => {
    const state = createInitialState(setup, config, 'reflection_seed');
    const next = applyCommand(state, config, { commandId: 'reflection', type: 'record_reflection', payload: { eventId: 'weak_stories', answer: 'audience' } });
    expect(next.history.at(-1)).toMatchObject({ type: 'reflection', message: 'audience' });
  });

  it('dispatches conditional game events once', () => {
    const state = createInitialState(setup, config, 'event_seed');
    const first = applyCommand(state, config, { commandId: 'consult', type: 'start_action', payload: { actionId: 'consultation_basic' } });
    expect(first.history.some((entry) => entry.type === 'game_event' && entry.payload?.eventId === 'consultation_risk_reveal')).toBe(true);
    const second = applyCommand(first, config, { commandId: 'rest', type: 'start_action', payload: { actionId: 'rest_one_day' } });
    expect(second.history.filter((entry) => entry.payload?.eventId === 'consultation_risk_reveal')).toHaveLength(1);
  });

  it('does not apply the same command twice', () => {
    const state = createInitialState(setup, config, 'idempotent_seed');
    const command = { commandId: 'same', type: 'start_action' as const, payload: { actionId: 'demand_poll' } };
    const once = applyCommand(state, config, command);
    const twice = applyCommand(once, config, command);
    expect(twice).toEqual(once);
  });

  it('blocks actions without enough bank', () => {
    const state = createInitialState(setup, config, 'bank_seed');
    expect(() =>
      applyCommand(
        { ...state, resources: { ...state.resources, bank: 1_000 } },
        config,
        { commandId: 'site', type: 'start_action', payload: { actionId: 'website_beautiful' } }
      )
    ).toThrow(/Не хватает/);
  });

  it('finishes fixture scenarios without invariant violations', () => {
    for (const scenario of scenarios) {
      let state = createInitialState(scenario.setup, config, scenario.seed);
      for (const command of scenario.commands) {
        state = applyCommand(state, config, command);
      }
      assertStateInvariants(state, config);
      expect(state.status).toBe('finished');
      expect(state.metrics.revenue).toBe(state.metrics.sales * state.player.productPrice);
      expect(Number.isFinite(state.metrics.revenue)).toBe(true);
    }
  });

  it('keeps finished sessions immutable', () => {
    let state = createInitialState(setup, config, 'finished_seed');
    state = applyCommand(state, config, { commandId: 'finish', type: 'finish_game', payload: {} });
    expect(() =>
      applyCommand(state, config, { commandId: 'late', type: 'start_action', payload: { actionId: 'stories_3d' } })
    ).toThrow(/Finished session/);
  });
});
