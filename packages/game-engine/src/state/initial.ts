import type { GameConfig, GameState, SetupInput } from '../types';
import { calculateTargets } from './goals';
import { assertStateInvariants } from './invariants';

export function createInitialState(setup: SetupInput, config: GameConfig, seed: string): GameState {
  const state: GameState = {
    schemaVersion: 1,
    sessionId: seed,
    configVersion: config.version,
    seed,
    stateVersion: 0,
    appliedCommandIds: [],
    status: 'active',
    player: setup,
    targets: calculateTargets(setup, config),
    resources: {
      day: 1,
      bank: config.startingBank,
      energy: config.startingEnergy
    },
    assets: {
      demandConfidence: 0,
      pilotReady: false,
      productQuality: 0,
      guide: null,
      videoLesson: null,
      simpleBot: null,
      aiBot: null,
      website: null,
      manager: null
    },
    activeRoute: {
      entry: 'direct_messages',
      nurture: ['none'],
      processing: 'manual',
      saleMethod: 'manual_chat',
      followup: 'none'
    },
    initialPlan: undefined,
    scheduledActions: [],
    cohorts: [],
    metrics: {
      impressions: 0,
      responses: 0,
      activated: 0,
      processed: 0,
      applications: 0,
      bookedCalls: 0,
      heldCalls: 0,
      sales: 0,
      revenue: 0,
      expenses: 0,
      capacityLostLeads: 0,
      lostLeads: 0,
      expectedLostRevenue: 0,
      miniGameCount: 0
    },
    flags: {},
    history: [],
    diagnostics: null
  };

  assertStateInvariants(state, config);
  return state;
}
