export type V4InstrumentId =
  | 'stories'
  | 'reels'
  | 'telegram'
  | 'paid_ads'
  | 'guide'
  | 'simple_bot'
  | 'ai_bot'
  | 'video_lesson'
  | 'auto_webinar'
  | 'chat'
  | 'call'
  | 'website';

export type V4Execution = 'self' | 'expert';
export type V4OfferMode = 'free' | 'tripwire' | 'main_product';
export type V4StageKind = 'traffic' | 'value' | 'sales';
export type V4AudienceStatus = 'new' | 'warm' | 'manual' | 'won' | 'lost';

export type V4FunnelStage = {
  id: string;
  instrumentId: V4InstrumentId;
  execution: V4Execution;
  offerMode: V4OfferMode;
  tripwirePrice: number | null;
  volume: number;
};

export type V4InstrumentDefinition = {
  id: V4InstrumentId;
  title: string;
  kind: V4StageKind;
  supportsTripwire: boolean;
  manual: boolean;
  self: {
    unitCost: number;
    maxVolume: number;
    reach: [number, number];
    entryRate: number;
    completionRate: number;
  };
  expert: {
    unitCost: number;
    maxVolume: number;
    reach: [number, number];
    entryRate: number;
    completionRate: number;
  };
  directSaleRate: number;
  nextStageRate: number;
  manualRate: number;
};

export type V4AttemptInput = {
  seed: string;
  mainProductPrice: number;
  dreamPrice: number;
  stages: V4FunnelStage[];
  manualActions?: number;
  startingBank?: number;
  startingEnergy?: number;
};

export type V4StageResult = {
  stageId: string;
  instrumentId: V4InstrumentId;
  spend: number;
  views: number;
  entered: number;
  progressed: number;
  tripwireSales: number;
  mainProductSales: number;
  manualQueue: number;
  lost: number;
};

export type V4AttemptReport = {
  valid: boolean;
  errors: string[];
  startingBank: number;
  spent: number;
  bankRemaining: number;
  energyRemaining: number;
  endingReason: 'completed' | 'budget_empty' | 'burnout';
  mainProductRevenue: number;
  tripwireRevenue: number;
  totalRevenue: number;
  totalMoney: number;
  afterDream: number;
  result: 'not_reached' | 'dream_bought' | 'sustainable_win';
  stageResults: V4StageResult[];
  lostPotentialRevenue: number;
  fallbackManualQueue: number;
  handledManualQueue: number;
  manualQueueLost: number;
  observations: string[];
  spendBreakdown: Array<{ label: string; amount: number }>;
};
