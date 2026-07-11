export type Id = string;

export type Gender = 'female' | 'male';
export type GameStatus = 'setup' | 'active' | 'finished' | 'abandoned';
export type ContentType = 'useful' | 'storytelling' | 'selling' | 'chaotic';
export type SourceType = 'reels' | 'stories' | 'telegram' | 'live' | 'webinar' | 'contacts';
export type ProcessingType = 'manual' | 'simple_bot' | 'ai_bot' | 'manager' | 'website_auto';
export type SaleMethod = 'manual_chat' | 'call' | 'website_auto' | 'bot_auto' | 'webinar_direct';
export type FollowupType = 'none' | 'manual' | 'bot';
export type EntryPoint = 'direct_messages' | 'guide' | 'video_lesson' | 'website' | 'webinar_registration';
export type NurtureType = 'none' | 'guide' | 'video_lesson' | 'telegram' | 'webinar';

export type PlayerProfile = {
  avatarGender: Gender;
  name: string;
  niche: string;
};

export type SetupInput = PlayerProfile;

export type LaunchPlan = {
  productType: string | null;
  productName: string;
  productPrice: number | null;

  plannedSaleMethod: SaleMethod | null;
  plannedEntry: EntryPoint | null;
  plannedNurture: NurtureType[];
  nurtureUncertain: boolean;

  dreams: string[];
  confirmed: boolean;
};

export type AudienceChannel = 'instagram' | 'telegram' | 'contacts';

export type AudienceResources = {
  channels: AudienceChannel[];
  averageReelViews: number;
  averageStoryViews: number;
  averageTelegramViews: number;
  contactsCount: number;
  confirmed: boolean;
};

export type FlowStage =
  | 'intro'
  | 'day1_plan'
  | 'day2_resources'
  | 'daily'
  | 'final';

export type FlowStep =
  | 'intro_budget'
  | 'intro_beach'
  | 'day1_product_type'
  | 'day1_product_name'
  | 'day1_product_price'
  | 'day1_sale_method'
  | 'day1_nurture'
  | 'day1_entry_point'
  | 'day1_business_goal'
  | 'day1_dreams'
  | 'day1_summary'
  | 'day2_intro'
  | 'day2_channels'
  | 'day2_metrics'
  | 'day2_summary'
  | 'daily_intro'
  | 'daily_intent'
  | 'action_list'
  | 'action_configuration'
  | 'action_confirmation'
  | 'action_process'
  | 'action_result'
  | 'post_action'
  | 'day_summary'
  | 'energy_crisis'
  | 'budget_notice'
  | 'goal_reached'
  | 'finish_confirmation'
  | 'final_reason'
  | 'final_diagnosis';

export type DailyIntent =
  | 'get_sales'
  | 'fix_system'
  | 'get_advice'
  | 'restore_energy'
  | 'repeat_last'
  | 'automate'
  | 'finish';

export type FlowState = {
  stage: FlowStage;
  step: FlowStep;
  selectedIntent: DailyIntent | null;
  selectedGroup: string | null;
  goalPromptHandled: boolean;
  backStep: FlowStep | null;
};

export type PendingAction = {
  actionId: string;
  selectedAtDay: number;
  contentType?: ContentType;
  temporaryRoute?: RouteSelection;
  targetCohortId?: string;
  confirmed: boolean;
};

export type ActionOutcome = {
  actionId: string;
  title: string;
  startedDay: number;
  finishedDay: number;

  impressionsDelta: number;
  inboundDelta: number;
  processedDelta: number;
  applicationsDelta: number;
  bookedCallsDelta: number;
  heldCallsDelta: number;
  salesDelta: number;
  revenueDelta: number;
  lostDelta: number;

  bankDelta: number;
  energyDelta: number;

  createdCohortIds: string[];
  narrativeKeys: string[];
};

export type DayReport = {
  id: string;
  startedDay: number;
  finishedDay: number;
  actionId: string;
  actionTitle: string;
  outcome: ActionOutcome;
  decisions: Array<{
    type: string;
    label: string;
  }>;
};

export type PendingDecision =
  | {
      type: 'inbound';
      cohortId: string;
    }
  | {
      type: 'sales';
      cohortId: string;
    }
  | {
      type: 'followup';
      cohortId: string;
    }
  | {
      type: 'energy_crisis';
    }
  | {
      type: 'goal_reached';
    }
  | {
      type: 'finish_confirmation';
    };

export type EndingReason =
  | 'time_finished'
  | 'goal_finished'
  | 'manual_finished'
  | 'resource_finished';

export type NamedConfig = {
  id: Id;
  enabled: boolean;
  title: string;
  description?: string;
  modifiers?: Record<string, unknown>[];
};

export type ProductTypeConfig = NamedConfig & {
  capacity: number | null;
  recommendedSalesMethods?: Id[];
};

export type Condition = {
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'notIn' | 'hasFlag' | 'lacksFlag' | 'and' | 'or' | 'not';
  path?: string;
  value?: unknown;
  conditions?: Condition[];
};

export type Effect = {
  operator: 'setFlag' | 'addMetric' | 'multiplyMetric' | 'addResource' | 'createAsset' | 'replaceAsset' | 'scheduleAction' | 'emitEvent';
  path?: string;
  value?: unknown;
  payload?: Record<string, unknown>;
};

export type ActionConfig = {
  id: Id;
  enabled: boolean;
  category: Id;
  title: string;
  description?: string;
  cost: number;
  days: number;
  energyCost: number;
  requirements: Condition[];
  effects: Effect[];
  repeatPolicy: 'never' | 'once_per_cohort' | 'unlimited' | 'upgrade';
  analyticsId?: Id;
  intent: 'get_sales' | 'fix_system' | 'get_advice' | 'restore_energy';
  group: string;
  configurationSteps: string[];
  uiVisible: boolean;
  upgradeGroup?: string;
  upgradeLevel?: number;
  upgradeCost?: number;
};

export type GameConfig = {
  version: string;
  currency: 'RUB';
  startingBank: number;
  totalDays: number;
  startingEnergy: number;
  goals: {
    lowTicketMinimumRevenue: number;
    priceBuckets: Array<{ maxPrice: number | null; targetSales: number }>;
  };
  productTypes: ProductTypeConfig[];
  actions: ActionConfig[];
  content: Record<string, unknown>;
  routes: Record<string, unknown>;
  conversions: Record<string, unknown>;
  randomness: { distribution: Array<{ probability: number; multiplier: number }> };
  events: Array<{
    id: Id;
    enabled: boolean;
    priority: number;
    once: boolean;
    conditions: Condition[];
    sceneType: Id;
    messages: string[];
    effects: Effect[];
    analyticsId: Id;
  }>;
  dreams: Array<{ id: Id; enabled: boolean; title: string; price: number; custom?: boolean }>;
  copy: Record<string, unknown>;
  assets: Record<string, unknown>;
  cta: { primary: string; secondary: string };
};

export type RouteSelection = {
  entry: EntryPoint;
  nurture: NurtureType[];
  processing: ProcessingType;
  saleMethod: SaleMethod;
  followup: FollowupType;
};

export type RouteSnapshot = RouteSelection & {
  capturedDay: number;
};

export type LeadCohort = {
  id: string;
  createdDay: number;
  sourceActionId: string;
  sourceType: SourceType;
  contentType: ContentType;
  impressions: number;

  unprocessedInbound: number;
  pendingFollowup: number;

  inboundDecision: 'pending' | 'resolved' | 'deferred' | 'ignored';
  salesDecision: 'not_ready' | 'pending' | 'resolved' | 'deferred' | 'ignored';
  followupDecision: 'not_ready' | 'pending' | 'resolved' | 'deferred' | 'ignored';

  deferredUntilDay: number | null;
  deferCount: number;

  responses: number;
  activated: number;
  processed: number;
  applications: number;
  bookedCalls: number;
  heldCalls: number;
  sales: number;

  unprocessedApplications: number;
  lost: number;
  capacityLostLeads: number;

  routeSnapshot: RouteSnapshot;
  followedUp: boolean;
};

export type ScheduledAction = {
  id: string;
  actionId: string;
  startedDay: number;
  completesDay: number;
  payload: Record<string, unknown>;
  completed: boolean;
};

export type GameMetrics = {
  impressions: number;
  responses: number;
  activated: number;
  processed: number;
  applications: number;
  bookedCalls: number;
  heldCalls: number;
  sales: number;
  revenue: number;
  expenses: number;
  capacityLostLeads: number;
  lostLeads: number;
  expectedLostRevenue: number;
  miniGameCount: number;
};

export type Targets = {
  targetSales: number;
  targetRevenue: number;
  personalGoal: number;
};

export type Diagnostics = {
  finalStatus: string;
  financials: {
    revenue: number;
    expenses: number;
    launchProfit: number;
    bankRemaining: number;
    totalLiquidity: number;
    dreamMoney: number;
  };
  strongDecisions: string[];
  bottlenecks: Array<{ category: string; expectedLoss: number }>;
  counterfactuals: Array<{ change: string; expectedProfitDelta: number }>;
  mistakes: Array<{ day: number; message: string; category: string }>;
  dreams: Array<{ id: string; title: string; price: number; affordable: boolean }>;
};

export type GameState = {
  schemaVersion: 2;
  sessionId: string;
  configVersion: string;
  seed: string;
  stateVersion: number;
  appliedCommandIds: string[];
  status: GameStatus;
  player: PlayerProfile;
  launchPlan: LaunchPlan;
  audience: AudienceResources;
  flow: FlowState;
  targets: Targets;
  resources: {
    day: number;
    bank: number;
    energy: number;
  };
  assets: {
    demandConfidence: number;
    pilotReady: boolean;
    productQuality: number;
    guide: string | null;
    videoLesson: string | null;
    simpleBot: string | null;
    aiBot: string | null;
    website: string | null;
    manager: string | null;
  };
  activeRoute: RouteSelection;
  initialRoute?: RouteSelection;
  scheduledActions: ScheduledAction[];
  cohorts: LeadCohort[];
  metrics: GameMetrics;
  flags: Record<string, boolean>;
  history: Array<{ day: number; type: string; message: string; payload?: Record<string, unknown> }>;
  diagnostics: Diagnostics | null;

  pendingAction: PendingAction | null;
  pendingDecision: PendingDecision | null;
  lastOutcome: ActionOutcome | null;
  currentDayReport: DayReport | null;
  dayReports: DayReport[];
  endingReason: EndingReason | null;
};

export type GameCommand =
  | { commandId: string; type: 'advance_intro'; payload: Record<string, never> }
  | { commandId: string; type: 'set_product_type'; payload: { productType: string } }
  | { commandId: string; type: 'set_product_name'; payload: { productName: string } }
  | { commandId: string; type: 'set_product_price'; payload: { productPrice: number } }
  | { commandId: string; type: 'set_sale_method'; payload: { saleMethod: SaleMethod } }
  | { commandId: string; type: 'set_nurture'; payload: { nurture: NurtureType[]; uncertain?: boolean } }
  | { commandId: string; type: 'set_entry_point'; payload: { entryPoint: EntryPoint } }
  | { commandId: string; type: 'set_dreams'; payload: { dreams: string[] } }
  | { commandId: string; type: 'advance_day1_goal'; payload: Record<string, never> }
  | { commandId: string; type: 'complete_day_one'; payload: Record<string, never> }
  | { commandId: string; type: 'advance_day2_intro'; payload: Record<string, never> }
  | { commandId: string; type: 'set_channels'; payload: { channels: AudienceChannel[] } }
  | { commandId: string; type: 'set_audience_metrics'; payload: { reels?: number; stories?: number; telegram?: number; contacts?: number } }
  | { commandId: string; type: 'complete_day_two'; payload: Record<string, never> }
  | { commandId: string; type: 'advance_daily_intro'; payload: Record<string, never> }
  | { commandId: string; type: 'choose_intent'; payload: { intent: DailyIntent } }
  | { commandId: string; type: 'choose_action_group'; payload: { group: string } }
  | { commandId: string; type: 'select_action'; payload: { actionId: string } }
  | { commandId: string; type: 'configure_action'; payload: { contentType?: ContentType; route?: RouteSelection; targetCohortId?: string } }
  | { commandId: string; type: 'cancel_pending_action'; payload: Record<string, never> }
  | { commandId: string; type: 'confirm_action'; payload: Record<string, never> }
  | { commandId: string; type: 'acknowledge_action_process'; payload: Record<string, never> }
  | { commandId: string; type: 'acknowledge_action_result'; payload: Record<string, never> }
  | { commandId: string; type: 'resolve_inbound'; payload: { cohortId: string; mode: 'all' | 'manual' | 'bot' | 'manager' | 'none' | 'defer'; processed?: number } }
  | { commandId: string; type: 'defer_inbound'; payload: { cohortId: string } }
  | { commandId: string; type: 'resolve_sales'; payload: { cohortId: string; action: 'process' | 'defer' | 'ignore'; amount?: number } }
  | { commandId: string; type: 'resolve_followup'; payload: { cohortId: string; action: 'process' | 'defer' | 'ignore' } }
  | { commandId: string; type: 'resolve_pending_decision'; payload: { cohortId?: string; action: 'process' | 'defer' | 'ignore' | 'confirm'; amount?: number } }
  | { commandId: string; type: 'complete_day'; payload: Record<string, never> }
  | { commandId: string; type: 'continue_after_goal'; payload: Record<string, never> }
  | { commandId: string; type: 'request_finish'; payload: Record<string, never> }
  | { commandId: string; type: 'cancel_finish'; payload: Record<string, never> }
  | { commandId: string; type: 'repair_flow'; payload: Record<string, never> }
  | { commandId: string; type: 'abandon_game'; payload: Record<string, never> }
  | { commandId: string; type: 'resolve_mini_game'; payload: { cohortId: string; mode: 'manual' | 'auto'; processed?: number } }
  | { commandId: string; type: 'start_parallel'; payload: { actionAId: string; actionBId: string; contentType?: ContentType; route?: RouteSelection } }
  | { commandId: string; type: 'record_reflection'; payload: { eventId: string; answer: string } }
  | { commandId: string; type: 'set_route'; payload: RouteSelection };
