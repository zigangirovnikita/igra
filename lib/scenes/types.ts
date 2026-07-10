import type { Diagnostics, GameConfig, GameMetrics, GameState, SetupInput } from '@/packages/game-engine/src';

// ─── Setup draft (collected before session creation) ────────────────────────

export type FamilyType = 'couple_no_kids' | 'couple_kids' | 'single_no_kids' | 'single_kids';

export type SetupDraft = {
  gender: 'female' | 'male';
  name: string;
  niche: string;
  superpowers: string[];
  productType: string;
  productPrice: number;
  familyType: FamilyType;
  dreams: string[];
  hasTelegram: boolean;
  averageReelViews: number;
  averageStoryViews: number;
  averageTelegramViews: number;
};

// ─── Scene image ─────────────────────────────────────────────────────────────

export type SceneImage =
  | 'welcome'
  | 'character_thinking'
  | 'character_beach'
  | 'character_working'
  | 'character_happy'
  | 'character_sad'
  | 'character_tired'
  | 'phone_direct'
  | 'phone_payment'
  | 'phone_notification'
  | 'city_morning'
  | 'office'
  | 'final';

// ─── Choice option ────────────────────────────────────────────────────────────

export type ChoiceOption = {
  id: string;
  icon: string;
  title: string;
  description: string;
  costLabel?: string;
  daysLabel?: string;
  energyLabel?: string;
  disabled?: boolean;
  disabledReason?: string;
  /** Payload to send with command (actionId, etc.) */
  payload?: Record<string, unknown>;
};

// ─── Metric delta for result screens ─────────────────────────────────────────

export type MetricDelta = {
  label: string;
  value: string;
  direction?: 'up' | 'down' | 'neutral';
};

// ─── Scene definitions ────────────────────────────────────────────────────────

export type NarrativeScene = {
  type: 'narrative';
  image: SceneImage;
  lines: string[];          // tap to advance through lines
};

export type ChoiceScene = {
  type: 'choice';
  image: SceneImage;
  question: string;
  subtext?: string;
  options: ChoiceOption[];
};

export type ResultScene = {
  type: 'result';
  image: SceneImage;
  headline: string;
  lines: string[];
  deltas: MetricDelta[];
};

export type MetricsScene = {
  type: 'metrics';
  day: number;
  bank: number;
  bankDelta: number;
  energy: number;
  revenue: number;
  sales: number;
};

export type DirectMiniGameScene = {
  type: 'mini_game_direct';
  cohortId: string;
  totalInbound: number;
  messages: string[];
};

export type DiagnosisScene = {
  type: 'diagnosis';
  diagnostics: Diagnostics;
  metrics: GameMetrics;
  productPrice: number;
  personalGoal: number;
  targetRevenue: number;
  dreamsMet: boolean;
};

export type CtaScene = {
  type: 'cta';
  won: boolean;
  revenue: number;
  personalGoal: number;
};

// ─── Setup scenes ─────────────────────────────────────────────────────────────

export type SetupScene =
  | { type: 'setup_welcome' }
  | { type: 'setup_gender' }
  | { type: 'setup_name' }
  | { type: 'setup_niche' }
  | { type: 'setup_superpowers'; config: GameConfig }
  | { type: 'setup_product'; config: GameConfig }
  | { type: 'setup_price' }
  | { type: 'setup_family' }
  | { type: 'setup_legend'; draft: SetupDraft }
  | { type: 'setup_dreams'; config: GameConfig; draft: SetupDraft }
  | { type: 'setup_channels' }
  | { type: 'setup_reach'; draft: SetupDraft }
  | { type: 'setup_summary'; draft: SetupDraft };

// ─── Union ────────────────────────────────────────────────────────────────────

export type Scene =
  | SetupScene
  | NarrativeScene
  | ChoiceScene
  | ResultScene
  | MetricsScene
  | DirectMiniGameScene
  | DiagnosisScene
  | CtaScene;

// ─── Scene engine state ───────────────────────────────────────────────────────

export type SceneEngineState = {
  queue: Scene[];
  gameState: GameState | null;
  draft: SetupDraft;
  config: GameConfig;
  busy: boolean;
  error: string | null;
};

// ─── Event from a scene back to the engine ───────────────────────────────────

export type SceneEvent =
  | { type: 'tap' }                                     // advance narrative
  | { type: 'setup_field'; field: keyof SetupDraft; value: unknown }
  | { type: 'setup_next' }                              // proceed to next setup step
  | { type: 'action_chosen'; actionId: string; payload?: Record<string, unknown> }
  | { type: 'mini_game_resolved'; cohortId: string; mode: 'manual' | 'auto'; processed?: number }
  | { type: 'finish_game' }
  | { type: 'lead_submitted' }
  | { type: 'restart' };

export type { GameState, SetupInput, GameConfig };
