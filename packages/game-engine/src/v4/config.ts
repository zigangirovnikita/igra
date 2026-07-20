import type { V4FunnelStage, V4InstrumentDefinition, V4InstrumentId } from './types';

const traffic = (
  id: Extract<V4InstrumentId, 'stories' | 'reels' | 'telegram' | 'paid_ads'>,
  title: string,
  selfReach: [number, number],
  expertReach: [number, number],
  selfCost: number,
  expertCost: number,
  entryRate: number,
): V4InstrumentDefinition => ({
  id, title, kind: 'traffic', supportsTripwire: false, manual: false,
  self: { unitCost: selfCost, maxVolume: 14, reach: selfReach, entryRate, completionRate: 1 },
  expert: { unitCost: expertCost, maxVolume: 28, reach: expertReach, entryRate: entryRate * 1.12, completionRate: 1 },
  directSaleRate: 0, nextStageRate: 1, manualRate: 0,
});

const value = (
  id: Extract<V4InstrumentId, 'guide' | 'simple_bot' | 'ai_bot' | 'video_lesson' | 'auto_webinar'>,
  title: string,
  manual: boolean,
  baseCompletion: number,
  directSaleRate: number,
  nextStageRate: number,
  manualRate: number,
): V4InstrumentDefinition => ({
  id, title, kind: 'value', supportsTripwire: true, manual,
  self: { unitCost: 0, maxVolume: 1, reach: [0, 0], entryRate: 1, completionRate: baseCompletion },
  expert: { unitCost: 18_000, maxVolume: 1, reach: [0, 0], entryRate: 1, completionRate: Math.min(0.95, baseCompletion * 1.15) },
  directSaleRate, nextStageRate, manualRate,
});

const sales = (
  id: Extract<V4InstrumentId, 'chat' | 'call' | 'website'>,
  title: string,
  manual: boolean,
  completion: number,
): V4InstrumentDefinition => ({
  id, title, kind: 'sales', supportsTripwire: false, manual,
  self: { unitCost: 0, maxVolume: 1, reach: [0, 0], entryRate: 1, completionRate: completion },
  expert: { unitCost: id === 'website' ? 35_000 : 20_000, maxVolume: 1, reach: [0, 0], entryRate: 1, completionRate: Math.min(0.95, completion * 1.2) },
  directSaleRate: completion, nextStageRate: 0.35, manualRate: manual ? 1 : 0.25,
});

export const V4_INSTRUMENTS: Record<V4InstrumentId, V4InstrumentDefinition> = {
  stories: traffic('stories', 'Сторис', [1_200, 2_000], [2_000, 3_200], 0, 2_000, 0.018),
  reels: traffic('reels', 'Рилс', [2_500, 5_500], [4_500, 9_000], 0, 2_000, 0.012),
  telegram: traffic('telegram', 'Telegram-канал', [1_500, 3_000], [2_500, 4_800], 0, 1_600, 0.025),
  paid_ads: traffic('paid_ads', 'Внешняя реклама', [2_000, 2_000], [2_000, 2_000], 1, 1, 0.014),
  guide: value('guide', 'Гайд / лендинг', false, 0.46, 0.03, 0.55, 0.18),
  simple_bot: value('simple_bot', 'Обычный бот', true, 0.52, 0.04, 0.52, 0.22),
  ai_bot: value('ai_bot', 'ИИ-бот', false, 0.62, 0.06, 0.58, 0.12),
  video_lesson: value('video_lesson', 'Урок', false, 0.48, 0.05, 0.5, 0.2),
  auto_webinar: value('auto_webinar', 'Автовебинар', false, 0.42, 0.08, 0.42, 0.22),
  chat: sales('chat', 'Переписка', true, 0.16),
  call: sales('call', 'Созвон', true, 0.25),
  website: sales('website', 'Сайт', false, 0.04),
};

export const V4_STARTING_BANK = 100_000;
export const V4_STARTING_ENERGY = 100;
export const V4_MANUAL_ENERGY_COST = 8;
export const V4_CALL_ENERGY_COST = 14;

export function getV4Instrument(id: V4InstrumentId): V4InstrumentDefinition {
  return V4_INSTRUMENTS[id];
}

export function defaultV4Funnel(): V4FunnelStage[] {
  return [
    makeV4Stage('stage-1', 'reels', 'self', 'free', null, 14),
    makeV4Stage('stage-2', 'ai_bot', 'expert', 'free', null, 1),
    makeV4Stage('stage-3', 'auto_webinar', 'expert', 'free', null, 1),
    makeV4Stage('stage-4', 'website', 'expert', 'main_product', null, 1),
  ];
}

export function emptyV4Funnel(): V4FunnelStage[] {
  return [
    makeV4Stage('stage-1', 'stories', 'self', 'free', null, 1),
    makeV4Stage('stage-2', 'guide', 'self', 'free', null, 1),
    makeV4Stage('stage-3', 'guide', 'self', 'free', null, 1),
    makeV4Stage('stage-4', 'guide', 'self', 'free', null, 1),
  ];
}

export function tutorialV4Funnel(): V4FunnelStage[] {
  return [
    makeV4Stage('tutorial-1', 'paid_ads', 'expert', 'free', null, 95_000),
    makeV4Stage('tutorial-2', 'telegram', 'self', 'free', null, 14),
    makeV4Stage('tutorial-3', 'call', 'self', 'main_product', null, 1),
  ];
}

export function makeV4Stage(
  id: string,
  instrumentId: V4InstrumentId,
  execution: 'self' | 'expert',
  offerMode: 'free' | 'tripwire' | 'main_product',
  tripwirePrice: number | null,
  volume: number,
): V4FunnelStage {
  return { id, instrumentId, execution, offerMode, tripwirePrice, volume };
}

export function estimateV4Views(stage: V4FunnelStage): [number, number] {
  const definition = getV4Instrument(stage.instrumentId);
  if (definition.kind !== 'traffic') return [0, 0];
  if (stage.instrumentId === 'paid_ads') {
    return [Math.round(stage.volume * 1.7), Math.round(stage.volume * 2.7)];
  }
  const [low, high] = definition[stage.execution].reach;
  return [Math.round(low * stage.volume), Math.round(high * stage.volume * 1.25)];
}
