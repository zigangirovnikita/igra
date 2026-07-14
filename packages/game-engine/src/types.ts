export type Id = string;

export type Gender = 'female' | 'male';
export type GameStatus = 'setup' | 'active' | 'finished' | 'abandoned';
export type Superpower = 'sales' | 'marketing' | 'energy' | 'ads';
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
  superpower: Superpower;
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
  | 'v3'
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
  | 'final_diagnosis'
  | 'v3_story_budget'
  | 'v3_rules'
  | 'v3_story_plan'
  | 'v3_product'
  | 'v3_price'
  | 'v3_dream'
  | 'v3_goal_summary'
  | 'v3_reflection_intro'
  | 'v3_reflection'
  | 'v3_prepare_category'
  | 'v3_advice_category'
  | 'v3_advice_option'
  | 'v3_advice_result'
  | 'v3_rest'
  | 'v3_past_runs'
  | 'v3_pre_action_summary'
  | 'v3_action_select'
  | 'v3_active_intro'
  | 'v3_active_stage'
  | 'v3_stage_report';

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

  bankBefore: number;
  bankAfter: number;
  bankSpent: number;

  energyBefore: number;
  energyAfter: number;
  energySpent: number;

  metricsBefore: GameMetrics;
  metricsAfter: GameMetrics;

  impressionsDelta: number;
  inboundDelta: number;
  processedDelta: number;
  applicationsDelta: number;
  bookedCallsDelta: number;
  heldCallsDelta: number;
  salesDelta: number;
  revenueDelta: number;
  lostDelta: number;

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

type PendingReturnStep = 'daily_intro' | 'day_summary';

export type PendingDecision =
  | { type: 'inbound'; cohortId: string; returnStep: PendingReturnStep }
  | { type: 'mini_game'; cohortId: string; returnStep: PendingReturnStep }
  | { type: 'sales'; cohortId: string; returnStep: PendingReturnStep }
  | { type: 'followup'; cohortId: string; returnStep: PendingReturnStep }
  | { type: 'energy_crisis'; returnStep: PendingReturnStep }
  | { type: 'budget_notice'; returnStep: PendingReturnStep }
  | { type: 'goal_reached'; returnStep: PendingReturnStep }
  | { type: 'finish_confirmation'; returnStep: FlowStep };

export type EndingReason =
  | 'time_finished'
  | 'goal_finished'
  | 'manual_finished'
  | 'resource_finished';

export type MiniGameMessageKind =
  | 'payment_ready'
  | 'price_question'
  | 'program_question'
  | 'doubt'
  | 'installment_question'
  | 'irrelevant'
  | 'unusual'
  | 'call_ready';

export type MiniGameMessage = {
  id: string;
  kind: MiniGameMessageKind;
  text: string;
  qualityWeight: number;
  applicationModifier: number;
  saleModifier: number;
  displayOrder: number;
};

export type MiniGameSession = {
  id: string;
  cohortId: string;
  startedAt: string;
  expiresAt: string;
  durationSeconds: 60;
  messages: MiniGameMessage[];
  status: 'active' | 'resolved';
};

export type DecisionRecord = {
  sequence: number;
  day: number;
  commandType: GameCommand['type'];
  payload: Record<string, unknown>;
};

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

export type LossBreakdown = {
  entry: number;
  processing: number;
  qualification: number;
  callBooking: number;
  callNoShow: number;
  sale: number;
  followup: number;
  capacity: number;
};

export type CohortContextSnapshot = {
  productPrice: number;
  productType: string;
  demandConfidence: number;
  productQuality: number;
  energyAtCreation: number;
  createdDay: number;
};

export type LeadCohort = {
  id: string;
  createdDay: number;
  sourceActionId: string;
  sourceType: SourceType;
  contentType: ContentType;

  impressions: number;
  inbound: number;
  activated: number;
  processed: number;
  applications: number;
  bookedCalls: number;
  heldCalls: number;
  sales: number;

  unprocessedInbound: number;
  unprocessedApplications: number;
  pendingFollowup: number;

  inboundDecision: 'pending' | 'resolved' | 'deferred' | 'ignored';
  salesDecision: 'not_ready' | 'pending' | 'resolved' | 'deferred' | 'ignored';
  followupDecision: 'not_ready' | 'pending' | 'resolved' | 'deferred' | 'ignored';

  deferredUntilDay: number | null;
  deferCount: number;

  losses: LossBreakdown;
  capacityLostLeads: number;

  routeSnapshot: RouteSnapshot;
  contextSnapshot: CohortContextSnapshot;
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
  inbound: number;
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

export type V3ProductType =
  | 'consultation'
  | 'service'
  | 'live_course'
  | 'recorded_course'
  | 'membership'
  | 'mentorship';

export type V3PreparationArea = 'warmup' | 'sales' | 'ads';
export type V3PreparationMode = 'self' | 'expert';
export type V3AdviceCategory = 'ads' | 'warmup' | 'sales';
export type V3AdviceOption = 'friend' | 'consult_5k' | 'consult_10k';
export type V3AdvicePrecision = 'rough' | 'exact';
export type V3SelectionKind = 'ad' | 'warmup' | 'sales';

export type V3PreparationPlanItem = {
  id: string;
  area: V3PreparationArea;
  instrumentId: string;
  mode: V3PreparationMode;
  title: string;
  cost: number;
  energyCost: number;
  days: number;
  confirmedDay: number;
};

export type V3PreparedTool = {
  key: string;
  area: 'warmup' | 'sales';
  instrumentId: string;
  mode: V3PreparationMode;
  title: string;
  known: boolean;
  uses: number;
};

export type V3PreparedAd = {
  key: string;
  instrumentId: string;
  mode: V3PreparationMode;
  title: string;
  known: boolean;
  uses: number;
};

export type V3ActiveSelection = {
  ad: string | null;
  warmup: string | null;
  sales: string | null;
};

export type V3AdviceEffect = {
  category: V3AdviceCategory;
  multiplier: number;
  precision: V3AdvicePrecision;
};

export type V3AdviceResult = {
  category: V3AdviceCategory;
  option: V3AdviceOption;
  cost: number;
  title: string;
  adviser: string;
  paragraphs: string[];
  conversionRows: Array<{ label: string; value: string; note?: string }>;
  effectLines: string[];
  createdDay: number;
};

export type V3StageReport = {
  id: string;
  stageNumber: number;
  startedDay: number;
  finishedDay: number;
  daysSpent: number;
  energySpent: number;
  adTitle: string;
  warmupTitle: string;
  salesTitle: string;
  views: number;
  newLeads: number;
  notInterested: number;
  interested: number;
  requiredAnswer: number;
  lost: number;
  applications: number;
  callsHeld: number;
  callsNoBuy: number;
  callsBuy: number;
  chatsHeld: number;
  chatsNoBuy: number;
  chatsBuy: number;
  siteVisits: number;
  siteBuys: number;
  siteMessages: number;
  salesCount: number;
  revenue: number;
  goalReached: boolean;
  endedByBurnout: boolean;
};

export type V3ActiveAdEvent = {
  id: string;
  second: number;
  label: string;
  viewsDelta: number;
  hot: boolean;
};

export type V3ActiveWarmupMessage = {
  id: string;
  second: number;
  expiresSecond: number;
  text: string;
};

export type V3ActiveSaleOutcome = {
  id: string;
  text: string;
  buy: boolean;
  followupMessage: boolean;
  followupBuy: boolean;
};

export type V3ActiveStagePlan = {
  durationSeconds: 60;
  callDurationSeconds: number;
  chatDurationSeconds: number;
  messageTimeoutSeconds: number;
  adLabel: string;
  adEvents: V3ActiveAdEvent[];
  warmupMessages: V3ActiveWarmupMessage[];
  callOutcomes: V3ActiveSaleOutcome[];
  chatOutcomes: V3ActiveSaleOutcome[];
  totals: {
    views: number;
    newLeads: number;
    notInterested: number;
    interested: number;
    requiredAnswer: number;
    autoSales: number;
    siteMessages: number;
  };
};

export type V3State = {
  productType: V3ProductType | null;
  productPrice: number | null;
  dreamId: string | null;
  customDreamTitle: string | null;
  customDreamPrice: number | null;
  explanationSeen: Record<string, boolean>;
  preparedTools: V3PreparedTool[];
  preparedAds: V3PreparedAd[];
  plannedPreparations: V3PreparationPlanItem[];
  loopAdviceUsed: Record<string, boolean>;
  loopAdviceEffects: Partial<Record<V3AdviceCategory, V3AdviceEffect>>;
  lastAdvice: V3AdviceResult | null;
  loopRestDays: number;
  loopRestEnergy: number;
  lastPreparationSummary: {
    items: V3PreparationPlanItem[];
    unlockedTitles: string[];
    preparationDays: number;
    restDays: number;
  } | null;
  activeSelection: V3ActiveSelection;
  stageReports: V3StageReport[];
  lastStageReport: V3StageReport | null;
  activeStageStartedAt: string | null;
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
  miniGame: MiniGameSession | null;
  decisionLog: DecisionRecord[];
  v3: V3State;
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
  | { commandId: string; type: 'back_to_day1_price'; payload: Record<string, never> }
  | { commandId: string; type: 'edit_day1_plan'; payload: Record<string, never> }
  | { commandId: string; type: 'complete_day_one'; payload: Record<string, never> }
  | { commandId: string; type: 'advance_day2_intro'; payload: Record<string, never> }
  | { commandId: string; type: 'set_channels'; payload: { channels: AudienceChannel[] } }
  | { commandId: string; type: 'set_audience_metrics'; payload: { reels?: number; stories?: number; telegram?: number; contacts?: number } }
  | { commandId: string; type: 'edit_day2_resources'; payload: Record<string, never> }
  | { commandId: string; type: 'complete_day_two'; payload: Record<string, never> }
  | { commandId: string; type: 'advance_daily_intro'; payload: Record<string, never> }
  | { commandId: string; type: 'choose_intent'; payload: { intent: DailyIntent | null } }
  | { commandId: string; type: 'choose_action_group'; payload: { group: string | null } }
  | { commandId: string; type: 'select_action'; payload: { actionId: string } }
  | { commandId: string; type: 'configure_action'; payload: { contentType?: ContentType; route?: RouteSelection; targetCohortId?: string } }
  | { commandId: string; type: 'cancel_pending_action'; payload: Record<string, never> }
  | { commandId: string; type: 'confirm_action'; payload: Record<string, never> }
  | { commandId: string; type: 'acknowledge_action_process'; payload: Record<string, never> }
  | { commandId: string; type: 'acknowledge_action_result'; payload: Record<string, never> }
  | { commandId: string; type: 'follow_advice'; payload: Record<string, never> }
  | { commandId: string; type: 'resolve_inbound'; payload: { cohortId: string; mode: 'all' | 'manual' | 'bot' | 'manager' | 'none' | 'defer'; processed?: number } }
  | { commandId: string; type: 'defer_inbound'; payload: { cohortId: string } }
  | { commandId: string; type: 'resolve_sales'; payload: { cohortId: string; action: 'process' | 'defer' | 'ignore'; amount?: number } }
  | { commandId: string; type: 'resolve_followup'; payload: { cohortId: string; action: 'process' | 'defer' | 'ignore' } }
  | { commandId: string; type: 'resolve_pending_decision'; payload: { cohortId?: string; action: 'process' | 'process_all' | 'process_available' | 'process_selected' | 'defer' | 'ignore' | 'connect_manager' | 'connect_bot' | 'sell_chat' | 'sell_call' | 'sell_website' | 'sell_bot' | 'sell_webinar' | 'followup_message' | 'followup_call' | 'followup_case' | 'followup_discount' | 'followup_bot' | 'confirm' | 'cancel' | 'rest_day' | 'rest_two_days' | 'delegate' | 'push_through' | 'continue_without_budget'; amount?: number } }
  | { commandId: string; type: 'complete_day'; payload: Record<string, never> }
  | { commandId: string; type: 'continue_after_goal'; payload: Record<string, never> }
  | { commandId: string; type: 'request_finish'; payload: Record<string, never> }
  | { commandId: string; type: 'cancel_finish'; payload: Record<string, never> }
  | { commandId: string; type: 'repair_flow'; payload: Record<string, never> }
  | { commandId: string; type: 'abandon_game'; payload: Record<string, never> }
  | { commandId: string; type: 'resolve_mini_game'; payload: { cohortId: string; mode: 'manual' | 'auto'; processed?: number } }
  | { commandId: string; type: 'start_parallel'; payload: { actionAId: string; actionBId: string; contentType?: ContentType; route?: RouteSelection } }
  | { commandId: string; type: 'record_reflection'; payload: { eventId: string; answer: string } }
  | { commandId: string; type: 'set_route'; payload: RouteSelection }
  | { commandId: string; type: 'acknowledge_event'; payload: Record<string, never> }
  | { commandId: string; type: 'v3_next'; payload?: Record<string, never> }
  | { commandId: string; type: 'v3_set_product'; payload: { productType: V3ProductType } }
  | { commandId: string; type: 'v3_set_price'; payload: { productPrice: number } }
  | { commandId: string; type: 'v3_set_dream'; payload: { dreamId: string; customTitle?: string; customPrice?: number } }
  | { commandId: string; type: 'v3_open_reflection'; payload: { target: 'prepare' | 'advice' | 'rest' | 'history' | 'act' } }
  | { commandId: string; type: 'v3_confirm_preparation'; payload: { area: V3PreparationArea; instrumentId: string; mode: V3PreparationMode } }
  | { commandId: string; type: 'v3_request_advice'; payload: { category: V3AdviceCategory; option: V3AdviceOption } }
  | { commandId: string; type: 'v3_rest'; payload: { days: 1 | 2 | 3 } }
  | { commandId: string; type: 'v3_begin_action_plan'; payload?: Record<string, never> }
  | { commandId: string; type: 'v3_ack_pre_action_summary'; payload?: Record<string, never> }
  | { commandId: string; type: 'v3_select_active'; payload: { kind: V3SelectionKind; key: string } }
  | { commandId: string; type: 'v3_start_active_stage'; payload?: Record<string, never> }
  | { commandId: string; type: 'v3_complete_active_stage'; payload?: { manualAnswers?: number; salesChats?: number; directSalesChats?: number; postCallChats?: number; calls?: number } }
  | { commandId: string; type: 'v3_return_reflection'; payload?: Record<string, never> };
