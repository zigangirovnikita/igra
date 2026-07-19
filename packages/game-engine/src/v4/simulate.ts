import { hashToUnitInterval, stochasticRound } from '../random/keyed';
import { getV4Instrument, V4_STARTING_BANK, V4_STARTING_ENERGY } from './config';
import type { V4AttemptInput, V4AttemptReport, V4FunnelStage, V4StageResult } from './types';

const MAX_STAGES = 6;
const MIN_STAGES = 2;

export function simulateV4Attempt(input: V4AttemptInput): V4AttemptReport {
  const errors = validate(input.stages);
  const startingBank = input.startingBank ?? V4_STARTING_BANK;
  const startingEnergy = input.startingEnergy ?? V4_STARTING_ENERGY;
  let bank = startingBank;
  let audience = 0;
  let spent = 0;
  let mainProductSales = 0;
  let tripwireRevenue = 0;
  let fallbackManualQueue = 0;
  let lostPotentialRevenue = 0;
  const stageResults: V4StageResult[] = [];

  for (let index = 0; index < input.stages.length; index += 1) {
    const stage = input.stages[index];
    const definition = getV4Instrument(stage.instrumentId);
    const hasNext = index < input.stages.length - 1;
    const spend = stageSpend(stage);
    const affordableSpend = Math.min(bank, spend);
    bank -= affordableSpend;
    spent += affordableSpend;
    if (affordableSpend < spend) errors.push('Бюджет закончился до запуска всех выбранных инструментов');

    const views = definition.kind === 'traffic' ? trafficViews(input.seed, stage) : 0;
    const entered = definition.kind === 'traffic'
      ? count(views, definition[stage.execution].entryRate, input.seed, `${stage.id}:entry`)
      : audience;
    const completed = definition.kind === 'traffic'
      ? entered
      : count(entered, definition[stage.execution].completionRate, input.seed, `${stage.id}:complete`);
    const tripwireSales = stage.offerMode === 'tripwire'
      ? count(completed, pricedRate(definition.directSaleRate, stage.tripwirePrice ?? 0), input.seed, `${stage.id}:tripwire`)
      : 0;
    const mainSales = definition.kind === 'sales'
      ? count(completed, definition.directSaleRate, input.seed, `${stage.id}:main-sale`)
      : 0;
    const remaining = Math.max(0, completed - tripwireSales - mainSales);
    const manualQueue = definition.manual
      ? count(remaining, definition.manualRate, input.seed, `${stage.id}:manual`)
      : 0;
    const progressed = hasNext
      ? count(Math.max(0, remaining - manualQueue), definition.nextStageRate, input.seed, `${stage.id}:next`)
      : 0;
    const lost = Math.max(0, entered - tripwireSales - mainSales - manualQueue - progressed);

    if (!hasNext) fallbackManualQueue += manualQueue;
    audience = progressed;
    mainProductSales += mainSales;
    tripwireRevenue += tripwireSales * (stage.tripwirePrice ?? 0);
    lostPotentialRevenue += Math.round((lost + manualQueue) * input.mainProductPrice * 0.12);
    stageResults.push({
      stageId: stage.id,
      instrumentId: stage.instrumentId,
      spend: affordableSpend,
      views,
      entered,
      progressed,
      tripwireSales,
      mainProductSales: mainSales,
      manualQueue,
      lost,
    });
    if (bank <= 0) break;
  }

  const mainProductRevenue = mainProductSales * input.mainProductPrice;
  const totalRevenue = mainProductRevenue + tripwireRevenue;
  const totalMoney = bank + totalRevenue;
  const afterDream = totalMoney - input.dreamPrice;
  const result = totalMoney < input.dreamPrice
    ? 'not_reached'
    : afterDream >= V4_STARTING_BANK ? 'sustainable_win' : 'dream_bought';

  return {
    valid: errors.every((error) => !error.startsWith('Первый') && !error.startsWith('Воронка')),
    errors,
    startingBank,
    spent,
    bankRemaining: bank,
    energyRemaining: startingEnergy,
    mainProductRevenue,
    tripwireRevenue,
    totalRevenue,
    totalMoney,
    afterDream,
    result,
    stageResults,
    lostPotentialRevenue,
    fallbackManualQueue,
  };
}

function validate(stages: V4FunnelStage[]): string[] {
  const errors: string[] = [];
  if (stages.length < MIN_STAGES || stages.length > MAX_STAGES) errors.push('Воронка должна содержать от 2 до 6 этапов');
  const first = stages[0];
  if (!first || getV4Instrument(first.instrumentId).kind !== 'traffic') errors.push('Первый этап — всегда реклама');
  for (const stage of stages) {
    const definition = getV4Instrument(stage.instrumentId);
    if (!Number.isInteger(stage.volume) || stage.volume < 1 || stage.volume > definition[stage.execution].maxVolume && stage.instrumentId !== 'paid_ads') {
      errors.push(`Некорректный объем этапа «${definition.title}»`);
    }
    if (stage.offerMode === 'tripwire' && (!stage.tripwirePrice || stage.tripwirePrice < 100 || stage.tripwirePrice > 50_000)) {
      errors.push(`Некорректная цена трипваера «${definition.title}»`);
    }
  }
  return errors;
}

function stageSpend(stage: V4FunnelStage): number {
  const definition = getV4Instrument(stage.instrumentId);
  return definition[stage.execution].unitCost * (definition.kind === 'traffic' ? stage.volume : 1);
}

function trafficViews(seed: string, stage: V4FunnelStage): number {
  const definition = getV4Instrument(stage.instrumentId);
  if (stage.instrumentId === 'paid_ads') return Math.floor(stage.volume * (1.7 + hashToUnitInterval(seed, stage.id, 'cpm')));
  const [low, high] = definition[stage.execution].reach;
  let views = 0;
  for (let unit = 0; unit < stage.volume; unit += 1) {
    const reach = low + (high - low) * hashToUnitInterval(seed, stage.id, 'reach', unit);
    const viralMultiplier = hashToUnitInterval(seed, stage.id, 'viral', unit) > 0.94 ? 2.5 : 1;
    views += Math.round(reach * viralMultiplier);
  }
  return views;
}

function pricedRate(base: number, price: number): number {
  if (price <= 1_000) return base * 2.5;
  if (price <= 3_000) return base * 1.8;
  if (price <= 5_000) return base;
  return base * 0.55;
}

function count(value: number, rate: number, seed: string, key: string): number {
  return Math.max(0, stochasticRound(Math.max(0, value) * Math.max(0, Math.min(1, rate)), `${seed}|${key}`));
}
