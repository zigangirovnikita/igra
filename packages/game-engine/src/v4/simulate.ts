import { hashToUnitInterval, stochasticRound } from '../random/keyed';
import { getV4Instrument, V4_CALL_ENERGY_COST, V4_MANUAL_ENERGY_COST, V4_STARTING_BANK, V4_STARTING_ENERGY } from './config';
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
  let salesManualQueue = 0;
  let coldLostPeople = 0;
  let totalManualQueue = 0;
  const stageResults: V4StageResult[] = [];
  const spendBreakdown: Array<{ label: string; amount: number }> = [];

  for (let index = 0; index < input.stages.length; index += 1) {
    const stage = input.stages[index];
    const definition = getV4Instrument(stage.instrumentId);
    const hasNext = index < input.stages.length - 1;
    const spend = stageSpend(stage);
    const affordableSpend = Math.min(bank, spend);
    bank -= affordableSpend;
    spent += affordableSpend;
    if (affordableSpend < spend) errors.push('Бюджет закончился до запуска всех выбранных инструментов');
    if (affordableSpend > 0) spendBreakdown.push({ label: getV4Instrument(stage.instrumentId).title, amount: affordableSpend });

    const telegramWarmup = stage.instrumentId === 'telegram' && index > 0;
    const brokenTrafficPosition = definition.kind === 'traffic' && index > 0 && !telegramWarmup;
    const views = definition.kind === 'traffic' && !brokenTrafficPosition && !telegramWarmup ? trafficViews(input.seed, stage) : 0;
    const entered = definition.kind === 'traffic' && !telegramWarmup
      ? count(views, definition[stage.execution].entryRate, input.seed, `${stage.id}:entry`)
      : audience;
    const completed = definition.kind === 'sales'
      ? entered
      : definition.kind === 'traffic' && !telegramWarmup
      ? entered
      : count(entered, telegramWarmup ? 0.5 : definition[stage.execution].completionRate, input.seed, `${stage.id}:complete`);
    const tripwireSales = stage.offerMode === 'tripwire'
      ? count(completed, pricedRate(definition.directSaleRate, stage.tripwirePrice ?? 0), input.seed, `${stage.id}:tripwire`)
      : 0;
    const mainSales = definition.kind === 'sales' && !definition.manual
      ? count(completed, definition[stage.execution].completionRate, input.seed, `${stage.id}:main-sale`)
      : 0;
    const remaining = Math.max(0, completed - tripwireSales - mainSales);
    const manualQueue = definition.manual || telegramWarmup
      ? count(remaining, telegramWarmup ? 0.55 : definition.manualRate, input.seed, `${stage.id}:manual`)
      : 0;
    const progressed = hasNext
      ? count(Math.max(0, remaining - manualQueue), telegramWarmup ? 0.75 : definition.nextStageRate, input.seed, `${stage.id}:next`)
      : 0;
    const lost = Math.max(0, entered - tripwireSales - mainSales - manualQueue - progressed);

    if (!hasNext) fallbackManualQueue += manualQueue;
    if (definition.kind === 'sales' && definition.manual) salesManualQueue += manualQueue;
    totalManualQueue += manualQueue;
    audience = progressed;
    mainProductSales += mainSales;
    tripwireRevenue += tripwireSales * (stage.tripwirePrice ?? 0);
    coldLostPeople += lost;
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

  const callHeavy = input.stages.some((stage) => stage.instrumentId === 'call');
  const actionEnergyCost = callHeavy ? V4_CALL_ENERGY_COST : V4_MANUAL_ENERGY_COST;
  const manualActions = Math.max(0, Math.floor(input.manualActions ?? 0));
  const handledManualQueue = Math.min(totalManualQueue, manualActions, Math.floor(startingEnergy / actionEnergyCost));
  const manualQueueLost = Math.max(0, totalManualQueue - handledManualQueue);
  const energySpent = handledManualQueue * actionEnergyCost;
  const energyRemaining = Math.max(0, startingEnergy - energySpent);
  const manualSalesRate = getManualSalesRate(input.stages);
  const handledSalesManualQueue = Math.min(handledManualQueue, salesManualQueue + fallbackManualQueue);
  const assistedManualSales = count(
    handledSalesManualQueue,
    manualSalesRate,
    input.seed,
    'handled-manual-sales',
  );
  if (assistedManualSales > 0) {
    const manualStageResult = [...stageResults].reverse().find((result) => {
      const definition = getV4Instrument(result.instrumentId);
      return definition.manual;
    }) ?? stageResults[stageResults.length - 1];
    if (manualStageResult) manualStageResult.mainProductSales += assistedManualSales;
  }
  mainProductSales += assistedManualSales;
  const lostPotentialRevenue = estimateLostPotentialRevenue({
    coldLostPeople,
    manualQueueLost,
    mainProductPrice: input.mainProductPrice,
  });

  const mainProductRevenue = mainProductSales * input.mainProductPrice;
  const totalRevenue = mainProductRevenue + tripwireRevenue;
  const totalMoney = bank + totalRevenue;
  const afterDream = totalMoney - input.dreamPrice;
  const endingReason = bank <= 0 ? 'budget_empty' : energyRemaining <= 0 ? 'burnout' : 'completed';
  const result = totalMoney < input.dreamPrice
    ? 'not_reached'
    : afterDream >= V4_STARTING_BANK ? 'sustainable_win' : 'dream_bought';

  return {
    valid: errors.every((error) => !error.startsWith('Первый') && !error.startsWith('Воронка')),
    errors,
    startingBank,
    spent,
    bankRemaining: bank,
    energyRemaining,
    endingReason,
    mainProductRevenue,
    tripwireRevenue,
    totalRevenue,
    totalMoney,
    afterDream,
    result,
    stageResults,
    lostPotentialRevenue,
    lostPeople: coldLostPeople + manualQueueLost,
    fallbackManualQueue,
    handledManualQueue,
    manualQueueLost,
    observations: buildObservations(errors, stageResults, {
      bank,
      energyRemaining,
      manualQueueLost,
      totalRevenue,
      spent,
    }),
    spendBreakdown,
  };
}

function validate(stages: V4FunnelStage[]): string[] {
  const errors: string[] = [];
  if (stages.length < MIN_STAGES || stages.length > MAX_STAGES) errors.push('Воронка должна содержать от 2 до 6 этапов');
  const first = stages[0];
  if (!first || getV4Instrument(first.instrumentId).kind !== 'traffic') errors.push('Первый этап — всегда реклама');
  for (const stage of stages) {
    const index = stages.indexOf(stage);
    const definition = getV4Instrument(stage.instrumentId);
    if (index > 0 && definition.kind === 'traffic' && stage.instrumentId !== 'telegram') {
      errors.push(`Реклама «${definition.title}» стоит не первым этапом и ломает поток людей`);
    }
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

function getManualSalesRate(stages: V4FunnelStage[]): number {
  const manualSalesRates = stages
    .map((stage) => ({ stage, definition: getV4Instrument(stage.instrumentId) }))
    .filter(({ definition }) => definition.kind === 'sales' && definition.manual)
    .map(({ stage, definition }) => definition[stage.execution].completionRate);
  if (manualSalesRates.length > 0) return Math.max(...manualSalesRates);
  return 0.11;
}

function estimateLostPotentialRevenue(input: {
  coldLostPeople: number;
  manualQueueLost: number;
  mainProductPrice: number;
}): number {
  const coldLostSales = input.coldLostPeople * 0.003;
  const manualLostSales = input.manualQueueLost * 0.015;
  const achievableExtraSales = Math.min(12, coldLostSales + manualLostSales);
  return Math.round(achievableExtraSales * input.mainProductPrice);
}

function buildObservations(
  errors: string[],
  stageResults: V4StageResult[],
  summary: { bank: number; energyRemaining: number; manualQueueLost: number; totalRevenue: number; spent: number },
): string[] {
  const observations: string[] = [];
  if (errors.some((error) => error.includes('Первый этап'))) observations.push('Первый этап не приводит людей в воронку: реклама должна стоять первой.');
  if (errors.some((error) => error.includes('ломает поток'))) observations.push('Один из рекламных этапов стоит внутри воронки и обнуляет поток людей.');
  if (stageResults.some((stage) => stage.instrumentId === 'paid_ads' && stage.spend > 45_000)) observations.push('Платный трафик съел слишком большую часть банка до продаж.');
  if (summary.manualQueueLost > 0) observations.push('Часть теплых заявок остыла, пока вы обрабатывали ручные действия.');
  if (summary.energyRemaining <= 0) observations.push('Ручная обработка перегрузила вас и попытка закончилась выгоранием.');
  if (summary.bank <= 0) observations.push('Бюджет закончился раньше, чем воронка успела раскрыться.');
  if (summary.totalRevenue === 0 && summary.spent > 0) observations.push('Воронка потратила деньги, но не довела людей до покупки.');
  if (observations.length === 0) observations.push('Воронка отработала без критической поломки, результат зависит от объема трафика и продажного этапа.');
  return observations.slice(0, 3);
}
