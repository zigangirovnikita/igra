import type { GameConfig, GameState, PlayerProfile } from '../types';
import { assertStateInvariants } from './invariants';

export function createInitialState(setup: PlayerProfile, config: GameConfig, seed: string): GameState {
  const state: GameState = {
    schemaVersion: 2,
    sessionId: seed,
    configVersion: config.version,
    seed,
    stateVersion: 0,
    appliedCommandIds: [],
    status: 'active',
    player: setup,
    launchPlan: {
      productType: null,
      productName: '',
      productPrice: null,
      plannedSaleMethod: null,
      plannedEntry: null,
      plannedNurture: [],
      nurtureUncertain: false,
      dreams: [],
      confirmed: false
    },
    audience: {
      channels: [],
      averageReelViews: 0,
      averageStoryViews: 0,
      averageTelegramViews: 0,
      contactsCount: 0,
      confirmed: false
    },
    flow: {
      stage: 'intro',
      step: 'intro_budget',
      selectedIntent: null,
      selectedGroup: null,
      goalPromptHandled: false,
      backStep: null
    },
    targets: {
      targetSales: 0,
      targetRevenue: 0,
      personalGoal: 0
    },
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
    scheduledActions: [],
    cohorts: [],
    metrics: {
      impressions: 0,
      inbound: 0,
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
    diagnostics: null,

    pendingAction: null,
    pendingDecision: null,
    lastOutcome: null,
    currentDayReport: null,
    dayReports: [],
    endingReason: null,
    miniGame: null,
    decisionLog: [],
  };

  assertStateInvariants(state, config);
  return state;
}
