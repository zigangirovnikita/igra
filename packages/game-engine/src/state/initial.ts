import type { GameConfig, GameState, PlayerProfile } from '../types';
import { defaultV4Funnel } from '../v4/config';
import { assertStateInvariants } from './invariants';

export function createInitialState(setup: PlayerProfile, config: GameConfig, seed: string): GameState {
  return createV4InitialState(setup, config, seed);
}

export function createV4InitialState(setup: PlayerProfile, config: GameConfig, seed: string): GameState {
  const state = createBaseState(setup, config, seed);
  state.flow = {
    stage: 'v4',
    step: 'v4_dream',
    selectedIntent: null,
    selectedGroup: null,
    goalPromptHandled: false,
    backStep: null,
  };
  state.resources.energy = 100;
  state.v4 = {
    dream: null,
    productType: null,
    productPrice: null,
    funnel: defaultV4Funnel(),
    tutorialCompleted: false,
    attemptNumber: 0,
    activeAttempt: null,
    lastReport: null,
    reportHistory: [],
    detailsOpen: false,
  };
  assertStateInvariants(state, config);
  return state;
}

export function createLegacyV3InitialState(setup: PlayerProfile, config: GameConfig, seed: string): GameState {
  const state = createBaseState(setup, config, seed);
  assertStateInvariants(state, config);
  return state;
}

function createBaseState(setup: PlayerProfile, config: GameConfig, seed: string): GameState {
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
      stage: 'v3',
      step: 'v3_story_budget',
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
      energy: setup.superpower === 'energy' ? 120 : config.startingEnergy
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
    v3: {
      productType: null,
      productPrice: null,
      dreamId: null,
      dreamChoices: [],
      customDreamTitle: null,
      customDreamPrice: null,
      explanationSeen: {},
      preparedTools: [],
      preparedAds: [],
      plannedPreparations: [],
      loopAdviceUsed: {},
      loopAdviceEffects: {},
      lastAdvice: null,
      loopRestDays: 0,
      loopRestEnergy: 0,
      lastPreparationSummary: null,
      activeSelection: { ad: null, warmup: null, sales: null },
      stageReports: [],
      lastStageReport: null,
      activeStageStartedAt: null,
      activeStage: null,
    },
    v4: {
      dream: null,
      productType: null,
      productPrice: null,
      funnel: defaultV4Funnel(),
      tutorialCompleted: false,
      attemptNumber: 0,
      activeAttempt: null,
      lastReport: null,
      reportHistory: [],
      detailsOpen: false,
    },
  };

  return state;
}
