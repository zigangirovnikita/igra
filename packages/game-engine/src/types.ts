export type Id = string;

export type Gender = 'female' | 'male';
export type GameStatus = 'setup' | 'active' | 'goal_reached' | 'finished' | 'abandoned';
export type ContentType = 'useful' | 'storytelling' | 'selling' | 'chaotic';
export type SourceType = 'reels' | 'stories' | 'telegram' | 'live' | 'webinar';
export type ProcessingType = 'manual' | 'simple_bot' | 'ai_bot' | 'manager' | 'website_auto';
export type SaleMethod = 'manual_chat' | 'call' | 'website_auto' | 'bot_auto' | 'webinar_direct';
export type FollowupType = 'none' | 'manual' | 'bot';
export type EntryPoint = 'direct_messages' | 'guide' | 'video_lesson' | 'website' | 'webinar_registration';
export type NurtureType = 'none' | 'guide' | 'video_lesson' | 'telegram' | 'webinar';

export type SetupInput = {
  avatarGender: Gender;
  name: string;
  niche: string;
  superpowers: Id[];
  productType: Id;
  productPrice: number;
  averageReelViews: number;
  averageStoryViews: number;
  telegramStatus: 'none' | 'known' | 'unknown';
  averageTelegramViews: number | null;
  dreams: Id[];
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
  superpowers: NamedConfig[];
  actions: ActionConfig[];
  content: Record<string, unknown>;
  routes: Record<string, unknown>;
  conversions: Record<string, unknown>;
  randomness: { distribution: Array<{ probability: number; multiplier: number }> };
  decay: number[];
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
  responses: number;
  activated: number;
  processed: number;
  applications: number;
  bookedCalls: number;
  heldCalls: number;
  sales: number;
  considering: number;
  unprocessedWarm: number;
  lost: number;
  capacityLostLeads: number;
  temperature: number;
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
};

export type GameState = {
  schemaVersion: 1;
  sessionId: string;
  configVersion: string;
  seed: string;
  stateVersion: number;
  appliedCommandIds: string[];
  status: GameStatus;
  player: SetupInput;
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
  scheduledActions: ScheduledAction[];
  cohorts: LeadCohort[];
  metrics: GameMetrics;
  flags: Record<string, boolean>;
  history: Array<{ day: number; type: string; message: string; payload?: Record<string, unknown> }>;
  diagnostics: Diagnostics | null;
};

export type GameCommand =
  | { commandId: string; type: 'start_action'; payload: { actionId: string; contentType?: ContentType; route?: RouteSelection } }
  | { commandId: string; type: 'set_route'; payload: RouteSelection }
  | { commandId: string; type: 'start_parallel'; payload: { actionAId: string; actionBId: string; contentType?: ContentType; route?: RouteSelection } }
  | { commandId: string; type: 'resolve_mini_game'; payload: { cohortId: string; mode: 'manual' | 'auto'; processed?: number } }
  | { commandId: string; type: 'finish_game'; payload?: { continueAfterGoal?: boolean } };
