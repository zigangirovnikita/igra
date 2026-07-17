import type {
  GameConfig,
  GameState,
  Superpower,
  V3AdviceCategory,
  V3AdviceEffect,
  V3AdviceOption,
  V3AdvicePrecision,
  V3AdviceResult,
  V3ActiveAdEvent,
  V3ActiveActionLogEntry,
  V3ActiveSaleOutcome,
  V3ActiveStagePlan,
  V3DreamChoice,
  V3PreparationArea,
  V3PreparationMode,
  V3PreparationPlanItem,
  V3ProductType,
  V3SelectionKind,
  V3StageReport,
} from '../types';
import { hashToUnitInterval, stochasticRound } from '../random/keyed';
import { calculateTargets } from '../state/goals';
import { clamp } from '../state/invariants';

type PrepDef = {
  area: V3PreparationArea;
  id: string;
  title: string;
  self: { cost: number; energy: number; days: number; conversion: number };
  expert: { cost: number; energy: number; days: number; conversion: number };
};

type ActiveDef = {
  key: string;
  title: string;
  area: V3SelectionKind;
  baseConversion: number;
  manualShare: number;
  autoSalesShare?: number;
  viewsBase?: number;
};

type ActiveOption = ActiveDef & { locked: boolean; known: boolean; effectiveConversion: number };
type PreparationDisplayOption = PrepDef & {
  self: PrepDef['self'] & { known: boolean; effectiveConversion: number };
  expert: PrepDef['expert'] & { known: boolean; effectiveConversion: number };
};
type V3AttemptInsight = {
  severity: 'win' | 'warning' | 'danger';
  headline: string;
  lossLabel: string;
  missedRevenue: number;
  bullets: string[];
  recommendation: string;
};
type V3AttemptInsightContext = {
  productType?: V3ProductType | null;
  productName?: string | null;
  productPrice?: number | null;
};
type V3ProductContext = {
  type: V3ProductType | null;
  label: string;
  price: number;
  band: 'low' | 'mid' | 'high';
};
type AdviceToolBundle = {
  ads: string;
  warmup: string;
  sales: string;
  reason: string;
};

const ACTIVE_STAGE_SECONDS = 60;
const CALL_DURATION_SECONDS = 6;
const CHAT_DURATION_SECONDS = 2;
const ANSWER_DURATION_SECONDS = 1;
const MESSAGE_TIMEOUT_SECONDS = 6;
const MAX_OUTCOME_SEQUENCE = 120;
const SITE_MESSAGE_CONVERSION = 0.25;
const WEBINAR_MESSAGE_CONVERSION = 0.12;
const ACTIVE_STAGE_BASE_DAYS = 1;
const ACTIVE_STAGE_AD_DAYS = 2;
const ACTIVE_STAGE_WARMUP_DAYS = 1;
const ACTIVE_STAGE_SALES_DAYS = 1;

const PRODUCT_PLACEHOLDERS: Record<V3ProductType, number> = {
  consultation: 5_000,
  service: 15_000,
  recorded_course: 3_000,
  live_course: 20_000,
  membership: 1_500,
  mentorship: 30_000,
};

export const V3_PRODUCT_TITLES: Record<V3ProductType, string> = {
  consultation: 'Консультации',
  service: 'Услуги',
  recorded_course: 'Уроки в записи',
  live_course: 'Живое обучение',
  membership: 'Клуб / подписка',
  mentorship: 'Сопровождение',
};

export const V3_PREPARATIONS: PrepDef[] = [
  prep('warmup', 'guide', 'Гайд / лендинг', 0, 18, 2, 18_000, 0, 2, 0.10, 0.15),
  prep('warmup', 'simple_bot', 'Обычный бот', 0, 22, 3, 20_000, 0, 3, 0.14, 0.18),
  prep('warmup', 'ai_bot', 'Бот с ИИ', 0, 30, 5, 35_000, 0, 3, 0.20, 0.27),
  prep('warmup', 'video_lesson', 'Видеоурок', 0, 24, 4, 28_000, 0, 3, 0.16, 0.21),
  prep('warmup', 'auto_webinar', 'Автовебинар', 0, 28, 5, 38_000, 0, 4, 0.14, 0.19),
  prep('sales', 'chat_script', 'Переписка', 0, 16, 2, 16_000, 0, 2, 0.14, 0.20),
  prep('sales', 'call_script', 'Созвон', 0, 20, 3, 22_000, 0, 2, 0.20, 0.28),
  prep('sales', 'website', 'Сайт', 0, 25, 4, 35_000, 0, 3, 0.16, 0.23),
  prep('sales', 'auto_webinar', 'Автовебинар', 0, 28, 5, 38_000, 0, 4, 0.14, 0.19),
  prep('ads', 'stories', 'Контент для сторис', 0, 14, 2, 14_000, 0, 2, 0.10, 0.14),
  prep('ads', 'reels', 'Контент для рилс', 0, 18, 3, 18_000, 0, 2, 0.01, 0.013),
  prep('ads', 'telegram', 'Контент для ТГ-канала', 0, 16, 2, 16_000, 0, 2, 0.10, 0.14),
  prep('ads', 'paid_ads', 'Внешняя реклама', 12_000, 12, 2, 28_000, 0, 2, 0.01, 0.013),
];

const BASE_ACTIVE: ActiveDef[] = [
  { key: 'ad:unprepared', title: 'Сделать рекламу без подготовки', area: 'ad', baseConversion: 0.01, manualShare: 0, viewsBase: 12_000 },
  { key: 'warmup:manual', title: 'Греть руками в переписке', area: 'warmup', baseConversion: 0.16, manualShare: 1 },
  { key: 'sales:intuition', title: 'Продавать по наитию', area: 'sales', baseConversion: 0.08, manualShare: 1 },
];

const AD_VIEW_BASE: Record<string, number> = {
  stories: 7_000,
  reels: 32_000,
  telegram: 7_000,
  paid_ads: 45_000,
};

function prep(
  area: V3PreparationArea,
  id: string,
  title: string,
  selfCost: number,
  selfEnergy: number,
  selfDays: number,
  expertCost: number,
  expertEnergy: number,
  expertDays: number,
  selfConversion: number,
  expertConversion: number,
): PrepDef {
  return {
    area,
    id,
    title,
    self: { cost: selfCost, energy: selfEnergy, days: selfDays, conversion: selfConversion },
    expert: { cost: expertCost, energy: expertEnergy, days: expertDays, conversion: expertConversion },
  };
}

export function v3ProductPlaceholder(productType: V3ProductType): number {
  return PRODUCT_PLACEHOLDERS[productType];
}

export function nextV3Step(state: GameState): GameState {
  const order = [
    'v3_story_budget',
    'v3_rules',
    'v3_story_plan',
    'v3_product',
    'v3_price',
    'v3_dream',
    'v3_goal_summary',
    'v3_reflection_intro',
    'v3_reflection',
  ] as const;
  const index = order.indexOf(state.flow.step as (typeof order)[number]);
  if (index < 0 || index === order.length - 1) return state;
  state.flow.step = order[index + 1];
  if (state.flow.step === 'v3_goal_summary') {
    state.resources.day = Math.max(state.resources.day, 2);
  }
  return state;
}

export function setV3Product(state: GameState, productType: V3ProductType): GameState {
  state.v3.productType = productType;
  state.launchPlan.productType = productType;
  state.launchPlan.productName = V3_PRODUCT_TITLES[productType];
  state.flow.step = 'v3_price';
  return state;
}

export function setV3Price(state: GameState, config: GameConfig, productPrice: number): GameState {
  if (productPrice < 1_000) throw new Error('С таким чеком нет смысла запускать продажи');
  state.v3.productPrice = productPrice;
  state.launchPlan.productPrice = productPrice;
  state.targets = calculateTargets(productPrice, state.launchPlan.dreams, config);
  state.flow.step = 'v3_dream';
  return state;
}

export function setV3Dream(
  state: GameState,
  config: GameConfig,
  dreamId: string,
  customTitle?: string,
  customPrice?: number,
): GameState {
  if (dreamId === 'custom') {
    return setV3Dreams(state, config, [], customTitle, customPrice);
  }

  const dream = config.dreams.find((item) => item.id === dreamId && item.enabled);
  return setV3Dreams(state, config, [{
    id: dreamId,
    title: dream?.title ?? dreamId,
    price: dream?.price ?? 0,
  }]);
}

export function setV3Dreams(
  state: GameState,
  config: GameConfig,
  dreams: V3DreamChoice[],
  customTitle?: string,
  customPrice?: number,
): GameState {
  const selected = sanitizeDreamChoices(dreams);
  const trimmedCustomTitle = customTitle?.trim() ?? '';
  const normalizedCustomPrice = Math.trunc(customPrice ?? 0);
  if (trimmedCustomTitle && normalizedCustomPrice >= 1_000) {
    selected.push({
      id: `custom:${trimmedCustomTitle}`,
      title: trimmedCustomTitle,
      price: normalizedCustomPrice,
      custom: true,
    });
  }
  if (selected.length === 0) throw new Error('Выберите хотя бы одно желание');

  const firstCustom = selected.find((item) => item.custom);
  state.v3.dreamId = selected.length === 1 ? selected[0].id : 'multiple';
  state.v3.dreamChoices = selected;
  state.v3.customDreamTitle = firstCustom?.title ?? null;
  state.v3.customDreamPrice = firstCustom?.price ?? null;
  state.launchPlan.dreams = selected.map((item) => item.custom ? `custom:${item.title}` : `v3:${item.id}`);

  const baseTargets = calculateTargets(state.launchPlan.productPrice || 0, [], config);
  const personalGoal = selected.reduce((sum, item) => sum + item.price, 0);
  const targetRevenue = Math.max(baseTargets.targetRevenue, personalGoal);
  state.targets = {
    targetRevenue,
    targetSales: state.launchPlan.productPrice ? Math.ceil(targetRevenue / state.launchPlan.productPrice) : baseTargets.targetSales,
    personalGoal,
  };
  state.flow.step = 'v3_goal_summary';
  return state;
}

function sanitizeDreamChoices(dreams: V3DreamChoice[]): V3DreamChoice[] {
  const seen = new Set<string>();
  const result: V3DreamChoice[] = [];
  for (const dream of dreams.slice(0, 10)) {
    const title = dream.title.trim();
    const id = dream.id.trim();
    const price = Math.trunc(dream.price);
    if (!id || !title || price < 1_000) continue;
    const key = `${id}:${title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      id: id.slice(0, 120),
      title: title.slice(0, 80),
      price,
      custom: Boolean(dream.custom),
    });
  }
  return result;
}

export function openV3Reflection(state: GameState, target: 'prepare' | 'advice' | 'rest' | 'history' | 'act'): GameState {
  const map = {
    prepare: 'v3_prepare_category',
    advice: 'v3_advice_category',
    rest: 'v3_rest',
    history: 'v3_past_runs',
    act: 'v3_pre_action_summary',
  } as const;
  state.flow.step = map[target];
  return state;
}

export function confirmV3Preparation(
  state: GameState,
  area: V3PreparationArea,
  instrumentId: string,
  mode: V3PreparationMode,
): GameState {
  const definition = getPreparation(area, instrumentId);
  const price = definition[mode === 'self' ? 'self' : 'expert'];
  if (isPreparationAlreadyReadyOrPlanned(state, area, instrumentId, mode)) {
    throw new Error('Этот инструмент уже готов');
  }
  if (state.resources.bank < price.cost) throw new Error('Не хватает денег в банке');
  if (state.resources.energy < price.energy) throw new Error('Не хватает энергии');

  const item: V3PreparationPlanItem = {
    id: `${area}:${instrumentId}:${mode}:${state.stateVersion + 1}:${state.v3.plannedPreparations.length}`,
    area,
    instrumentId,
    mode,
    title: `${definition.title} - ${mode === 'self' ? 'самостоятельно' : 'со специалистом'}`,
    cost: price.cost,
    energyCost: price.energy,
    days: price.days,
    confirmedDay: state.resources.day,
  };
  state.resources.bank -= price.cost;
  state.resources.energy -= price.energy;
  state.metrics.expenses += price.cost;
  state.v3.plannedPreparations.push(item);
  state.history.push({ day: state.resources.day, type: 'v3_preparation_planned', message: item.title, payload: { itemId: item.id } });
  state.flow.step = 'v3_prepare_category';
  return state;
}

export function requestV3Advice(state: GameState, category: V3AdviceCategory, option: V3AdviceOption): GameState {
  ensureV3AdviceState(state);
  const key = `${category}:${option}`;
  if (state.v3.loopAdviceUsed[key]) throw new Error('Вы уже использовали этот совет в текущем круге');
  const cost = option === 'consult_5k' ? 5_000 : option === 'consult_10k' ? 10_000 : 0;
  if (state.resources.bank < cost) throw new Error('Не хватает денег в банке');
  const result = buildAdviceResult(state, category, option, cost);
  state.resources.bank -= cost;
  state.metrics.expenses += cost;
  state.v3.loopAdviceUsed[key] = true;
  state.v3.lastAdvice = result;
  applyAdviceEffect(state, category, option);
  state.history.push({
    day: state.resources.day,
    type: 'v3_advice',
    message: result.title,
    payload: { category, option, cost },
  });
  state.flow.step = 'v3_advice_result';
  return state;
}

export function restV3(state: GameState, days: 1 | 2 | 3): GameState {
  const energyGain = days === 1 ? 20 : days === 2 ? 45 : 120;
  if (state.resources.day + days > 30) throw new Error('Осталось меньше времени, чем требуется для этого действия');
  state.resources.day += days;
  state.resources.energy = days === 3 ? maxEnergy(state.player.superpower) : Math.min(maxEnergy(state.player.superpower), state.resources.energy + energyGain);
  state.v3.loopRestDays += days;
  state.v3.loopRestEnergy += energyGain;
  state.flow.step = 'v3_reflection';
  finalizeV3IfTerminal(state);
  return state;
}

export function beginV3ActionPlan(state: GameState): GameState {
  const preparationDays = calculatePreparationDays(state.v3.plannedPreparations);
  if (state.resources.day + preparationDays > 30) {
    state.flow.step = 'v3_launch_time_blocked';
    return state;
  }
  state.resources.day += preparationDays;
  const unlockedTitles = unlockPlannedPreparations(state);
  state.v3.lastPreparationSummary = {
    items: state.v3.plannedPreparations,
    unlockedTitles,
    preparationDays,
    restDays: state.v3.loopRestDays,
  };
  state.v3.plannedPreparations = [];
  state.flow.step = (preparationDays > 0 || state.v3.loopRestDays > 0) ? 'v3_pre_action_summary' : 'v3_action_select';
  finalizeV3IfTerminal(state);
  return state;
}

export function ackV3PreActionSummary(state: GameState): GameState {
  state.flow.step = 'v3_action_select';
  return state;
}

export function selectV3Active(state: GameState, kind: V3SelectionKind, key: string): GameState {
  recoverPermanentToolsFromLastSummary(state);
  if (!isSelectable(state, kind, key)) throw new Error('Этот инструмент еще не готов');
  if (isConflictingWebinarSelection(state, kind, key)) {
    throw new Error('Автовебинар нельзя использовать одновременно и в прогреве, и в продажах');
  }
  state.v3.activeSelection[kind] = key;
  return state;
}

export function startV3ActiveStage(state: GameState): GameState {
  if (!state.v3.activeSelection.ad || !state.v3.activeSelection.warmup || !state.v3.activeSelection.sales) {
    throw new Error('Выберите рекламу, прогрев и продажи перед стартом');
  }
  if (!hasTimeForActiveStage(state)) {
    state.flow.step = 'v3_launch_time_blocked';
    return state;
  }
  if (!state.v3.explanationSeen.activeStage) {
    state.v3.explanationSeen.activeStage = true;
    state.flow.step = 'v3_active_intro';
    return state;
  }
  openV3ActiveStageRuntime(state);
  state.flow.step = 'v3_active_stage';
  return state;
}

export function startV3ActiveStageAfterIntro(state: GameState): GameState {
  if (!hasTimeForActiveStage(state)) {
    state.flow.step = 'v3_launch_time_blocked';
    return state;
  }
  openV3ActiveStageRuntime(state);
  state.flow.step = 'v3_active_stage';
  return state;
}

export function changeV3BlockedLaunchPlan(state: GameState): GameState {
  if (state.flow.step !== 'v3_launch_time_blocked') throw new Error('Invalid step');
  const refundCost = state.v3.plannedPreparations.reduce((sum, item) => sum + item.cost, 0);
  const refundEnergy = state.v3.plannedPreparations.reduce((sum, item) => sum + item.energyCost, 0);
  state.resources.bank += refundCost;
  state.resources.energy = Math.min(maxEnergy(state.player.superpower), state.resources.energy + refundEnergy);
  state.metrics.expenses = Math.max(0, state.metrics.expenses - refundCost);
  state.v3.plannedPreparations = [];
  state.v3.lastPreparationSummary = null;
  state.v3.activeSelection = { ad: null, warmup: null, sales: null };
  state.flow.step = 'v3_reflection';
  return state;
}

function openV3ActiveStageRuntime(state: GameState): void {
  const startedAt = new Date();
  const expiresAt = new Date(startedAt.getTime() + ACTIVE_STAGE_SECONDS * 1000);
  const stageNumber = state.v3.stageReports.length + 1;
  const plan = buildV3ActiveStagePlan(state);
  state.v3.activeStageStartedAt = startedAt.toISOString();
  state.v3.activeStage = {
    id: `stage-${stageNumber}-${state.resources.day}`,
    stageNumber,
    startedAt: startedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    startingEnergy: state.resources.energy,
    plan,
  };
}

type V3ActiveInteractions = {
  manualAnswers?: number;
  salesChats?: number;
  directSalesChats?: number;
  postCallChats?: number;
  calls?: number;
  actionLog?: V3ActiveActionLogEntry[];
} | undefined;

export function completeV3ActiveStage(state: GameState, interactions?: V3ActiveInteractions): GameState {
  ensureV3AdviceState(state);
  const report = buildStageReport(state, interactions);
  applyReport(state, report);
  markSelectionKnownAndConsumeAd(state);
  state.v3.lastStageReport = report;
  state.v3.stageReports.push(report);
  state.v3.activeSelection = { ad: null, warmup: null, sales: null };
  state.v3.loopAdviceUsed = {};
  state.v3.loopAdviceEffects = {};
  state.v3.lastAdvice = null;
  state.v3.loopRestDays = 0;
  state.v3.loopRestEnergy = 0;
  state.v3.lastPreparationSummary = null;
  state.v3.activeStageStartedAt = null;
  state.v3.activeStage = null;
  state.currentDayReport = null;
  state.flow.step = 'v3_stage_report';
  state.endingReason = v3EndingReasonAfterReport(state, report);
  return state;
}

export function returnV3Reflection(state: GameState): GameState {
  if (state.endingReason) {
    state.flow.stage = 'final';
    state.flow.step = 'final_reason';
    return state;
  }
  state.flow.step = 'v3_reflection';
  return state;
}

export function getV3PreparationDefinitions(area?: V3PreparationArea): PrepDef[] {
  return area ? V3_PREPARATIONS.filter((item) => item.area === area) : V3_PREPARATIONS;
}

export function getV3PreparationDisplayOptions(state: GameState, area: V3PreparationArea): PreparationDisplayOption[] {
  const kind = selectionKindForPreparationArea(area);
  return getV3PreparationDefinitions(area).map((item) => ({
    ...item,
    self: {
      ...item.self,
      known: isConversionKnown(state, kind, false),
      effectiveConversion: effectiveOptionConversion(state, kind, item.self.conversion),
    },
    expert: {
      ...item.expert,
      known: isConversionKnown(state, kind, false),
      effectiveConversion: effectiveOptionConversion(state, kind, item.expert.conversion),
    },
  }));
}

export function getV3AttemptInsight(
  report: V3StageReport,
  productPrice: number,
  insightContext?: V3AttemptInsightContext,
): V3AttemptInsight {
  const product = resolveProductContext(productPrice, insightContext);
  const applications = report.applications ?? report.interested;
  const readyForSales = Math.max(0, applications - report.lost);
  const salesTargetFromReady = Math.max(0, Math.round(readyForSales * 0.25));
  const missedSales = Math.max(0, salesTargetFromReady - report.salesCount);
  const missedRevenue = missedSales * Math.max(0, product.price);
  const salesActions = report.callsHeld + report.chatsHeld + report.siteVisits;
  const closeRate = readyForSales > 0 ? report.salesCount / readyForSales : 0;
  const instrumentLines = instrumentInsightLines(report);
  const productLine = productPressureLine(product);
  const viralEvents = report.viralEventsCount ?? 0;
  const viralViews = report.viralViews ?? 0;
  const capacityLoss = report.capacityLoss ?? report.lost;

  if (report.goalReached) {
    return {
      severity: 'win',
      headline: `${product.label}: связка сработала. Теперь ее надо масштабировать.`,
      lossLabel: missedRevenue > 0 ? `Еще можно было добрать ${formatEngineMoney(missedRevenue)}` : 'План закрыт',
      missedRevenue,
      bullets: [
        salesBreakdownLine(report),
        `${applications} заявок дошли до решения`,
        productLine,
        'Главная задача теперь - понять, какая часть воронки дала результат, и повторить ее.',
      ],
      recommendation: `Разберите удачную связку по продукту "${product.label}" и масштабируйте самый сильный участок: ${stripFinalPunctuation(scaleRecommendation(product))}.`,
    };
  }

  if (report.endedByBurnout) {
    return {
      severity: 'danger',
      headline: 'Вы выгорели: запуск держался на ручном труде.',
      lossLabel: missedRevenue > 0 ? `Упущено около ${formatEngineMoney(missedRevenue)}` : 'Потеряны энергия и темп запуска',
      missedRevenue,
      bullets: [
        `Энергия этапа: -${report.energySpent}`,
        `Остыли или не были обработаны: ${report.lost}`,
        productLine,
        instrumentLines.processing,
        'Без специалистов и понятной системы ручные действия съедают запуск быстрее, чем приносят продажи.',
      ],
      recommendation: `Нужен разбор воронки под "${product.label}": ${burnoutRecommendation(product)}`,
    };
  }

  if (viralEvents > 0 && capacityLoss > 0) {
    return {
      severity: 'danger',
      headline: 'Контент залетел, но система не выдержала поток заявок.',
      lossLabel: missedRevenue > 0 ? `Упущено около ${formatEngineMoney(missedRevenue)}` : 'Потеряны заявки после всплеска',
      missedRevenue,
      bullets: [
        `Залетевших событий: ${viralEvents}, дополнительных просмотров: ${viralViews.toLocaleString('ru-RU')}`,
        `Заявки с интересом: ${applications}`,
        `Остыли и ушли: ${capacityLoss}`,
        productLine,
        'Проблема не в том, что трафика мало. Проблема в том, что входящий поток некому было стабильно обработать.',
      ],
      recommendation: `Перед следующим всплеском нужно усилить обработку заявок под "${product.label}": ${warmupRecommendation(product)}`,
    };
  }

  if (report.lost > Math.max(2, applications * 0.18)) {
    return {
      severity: 'danger',
      headline: 'Заявки были, но вы не вывезли обработку.',
      lossLabel: missedRevenue > 0 ? `Упущено около ${formatEngineMoney(missedRevenue)}` : 'Потеряны горячие заявки',
      missedRevenue,
      bullets: [
        `Заявки с интересом: ${applications}`,
        `Остыли и ушли: ${report.lost}`,
        productLine,
        instrumentLines.processing,
        'Проблема не только в трафике. Дыра в обработке заявок.',
      ],
      recommendation: `Покупайте консультацию по прогреву: ${warmupRecommendation(product)}`,
    };
  }

  if (readyForSales > 0 && (report.salesCount === 0 || closeRate < 0.1)) {
    return {
      severity: 'danger',
      headline: `${product.label}: спрос был, но продажная часть не дожала оплату.`,
      lossLabel: missedRevenue > 0 ? `Упущено около ${formatEngineMoney(missedRevenue)}` : 'Заявки дошли, но денег почти нет',
      missedRevenue,
      bullets: [
        `${readyForSales} заявок дошли до продаж`,
        salesBreakdownLine(report),
        productLine,
        instrumentLines.sales,
        'Люди заинтересовались, но продажная часть не дожала оплату.',
      ],
      recommendation: `Здесь нужна консультация по продажам: ${salesRecommendation(product, report.salesTitle)}`,
    };
  }

  if (report.newLeads > 0 && applications < Math.max(2, report.newLeads * 0.12)) {
    return {
      severity: 'warning',
      headline: 'Трафик пришел, но прогрев не создал заявки.',
      lossLabel: missedRevenue > 0 ? `Недобор около ${formatEngineMoney(missedRevenue)}` : 'Большая часть лидов не созрела',
      missedRevenue,
      bullets: [
        `${report.newLeads} новых лидов`,
        `${applications} заявок после прогрева`,
        productLine,
        instrumentLines.warmup,
        'Реклама дала поток, но смыслы прогрева не довели людей до решения.',
      ],
      recommendation: `Нужен разбор прогрева для "${product.label}": ${warmupRecommendation(product)}`,
    };
  }

  if (salesActions === 0 && readyForSales > 0) {
    return {
      severity: 'warning',
      headline: 'Вы довели людей до покупки, но не начали продавать.',
      lossLabel: missedRevenue > 0 ? `На столе осталось около ${formatEngineMoney(missedRevenue)}` : 'Продажные действия не запущены',
      missedRevenue,
      bullets: [
        `${readyForSales} заявок были готовы к продаже`,
        'Продажных действий почти не было',
        productLine,
        instrumentLines.sales,
        'Без обработки даже хорошая воронка не превращается в деньги.',
      ],
      recommendation: `Сначала разберите, кто должен закрывать заявки по "${product.label}": ${salesRouteRecommendation(product)}`,
    };
  }

  return {
    severity: missedRevenue > 0 ? 'warning' : 'win',
    headline: missedRevenue > 0 ? `${product.label}: воронка работает, но деньги остаются внутри дыр.` : `${product.label}: потери небольшие, связка стала понятнее.`,
    lossLabel: missedRevenue > 0 ? `Недобор около ${formatEngineMoney(missedRevenue)}` : 'Критичных потерь нет',
    missedRevenue,
    bullets: [
      `${report.views.toLocaleString('ru-RU')} просмотров -> ${report.newLeads} лидов`,
      `${applications} заявок дошли до решения`,
      salesBreakdownLine(report),
      productLine,
      instrumentLines.sales,
      'Следующий рост даст не больше хаоса, а точечное усиление слабого этапа.',
    ],
    recommendation: `На консультации нужно найти узкое место под "${product.label}" и решить, что покупать первым: рекламу, прогрев или продажи.`,
  };
}

function salesBreakdownLine(report: V3StageReport): string {
  const autoSales = Math.max(0, report.autoSales ?? 0);
  const assistedSales = Math.max(0, report.salesCount - autoSales);
  const totalLine = `всего ${report.salesCount} оплат на ${formatEngineMoney(report.revenue)}`;

  if (autoSales > 0 && assistedSales > 0) {
    return `Продажный инструмент закрыл ${assistedSales}, автопродажи прогрева дали ${autoSales}; ${totalLine}.`;
  }
  if (autoSales > 0) {
    return `Автопродажи прогрева дали ${autoSales}; ручных оплат не было; ${totalLine}.`;
  }
  return `Продажный инструмент закрыл ${assistedSales} оплат на ${formatEngineMoney(report.revenue)}.`;
}

function resolveProductContext(productPrice: number, context?: V3AttemptInsightContext): V3ProductContext {
  const type = context?.productType ?? null;
  const fallbackPrice = type ? PRODUCT_PLACEHOLDERS[type] : productPrice;
  const rawPrice = context?.productPrice ?? productPrice;
  const price = Math.max(0, rawPrice > 0 ? rawPrice : fallbackPrice);
  const label = (context?.productName?.trim() || (type ? V3_PRODUCT_TITLES[type] : 'Продукт')).trim();
  return { type, label, price, band: priceBand(type, price) };
}

function stateProductContext(state: GameState): V3ProductContext {
  return resolveProductContext(state.launchPlan.productPrice ?? state.v3.productPrice ?? 0, {
    productType: state.v3.productType ?? asV3ProductType(state.launchPlan.productType),
    productName: state.launchPlan.productName,
    productPrice: state.launchPlan.productPrice ?? state.v3.productPrice,
  });
}

function asV3ProductType(value: string | null): V3ProductType | null {
  if (!value) return null;
  return Object.prototype.hasOwnProperty.call(V3_PRODUCT_TITLES, value) ? value as V3ProductType : null;
}

function priceBand(type: V3ProductType | null, price: number): V3ProductContext['band'] {
  const limits: Record<V3ProductType, [number, number]> = {
    consultation: [7_000, 20_000],
    service: [15_000, 60_000],
    recorded_course: [5_000, 20_000],
    live_course: [15_000, 50_000],
    membership: [2_000, 7_000],
    mentorship: [30_000, 120_000],
  };
  const [low, mid] = type ? limits[type] : [7_000, 30_000];
  if (price <= low) return 'low';
  if (price <= mid) return 'mid';
  return 'high';
}

function productPressureLine(product: V3ProductContext): string {
  const priceText = product.price > 0 ? `${product.price.toLocaleString('ru-RU')} ₽` : 'без понятного чека';
  if (product.type === 'mentorship') {
    return product.band === 'high'
      ? `Сопровождение за ${priceText} не покупают с одного касания: нужны доверие, квалификация и сильный созвон.`
      : `Сопровождение требует доказать личную ценность, иначе даже теплые заявки будут просить "подумать".`;
  }
  if (product.type === 'consultation') {
    return product.band === 'low'
      ? `Консультация за ${priceText} живет на скорости ответа: одна остывшая заявка сразу режет прибыль.`
      : `Дорогая консультация продается через диагноз боли и доверие к эксперту, а не через общую переписку.`;
  }
  if (product.type === 'service') {
    return `Услуга за ${priceText} продается, когда человек видит свой кейс и понятный следующий шаг, а не просто "мы поможем".`;
  }
  if (product.type === 'recorded_course') {
    return product.band === 'low'
      ? `Курс в записи за ${priceText} должен покупать быстро и массово: сложная ручная продажа съедает экономику.`
      : `Дорогой курс в записи требует прогрева с доказательствами, иначе люди не верят, что запись доведет до результата.`;
  }
  if (product.type === 'live_course') {
    return `Живое обучение за ${priceText} нуждается в дедлайне, доверии к программе и ясном обещании результата.`;
  }
  if (product.type === 'membership') {
    return `Подписка за ${priceText} держится на объеме и понятном первом результате, иначе лиды не видят смысла платить каждый месяц.`;
  }
  return `При чеке ${priceText} слабый этап воронки быстро превращается в недобор выручки.`;
}

function instrumentInsightLines(report: V3StageReport): { processing: string; warmup: string; sales: string } {
  const warmup = report.warmupTitle.toLowerCase();
  const sales = report.salesTitle.toLowerCase();
  const ad = report.adTitle.toLowerCase();
  const adLine = ad.includes('без подготовки')
    ? 'Реклама была запущена без подготовленной гипотезы: вы покупали шанс, а не управляемый поток.'
    : ad.includes('рилс')
      ? 'Рилсы дали охват рывками: без точного прогрева такой поток легко превращается в шум.'
      : ad.includes('сторис') || ad.includes('тг')
        ? 'Источник дал более теплые касания, поэтому особенно больно терять людей после клика.'
        : 'Трафик был, значит следующий вопрос не "где взять людей", а "почему они не дошли до денег".';
  const warmupLine = warmup.includes('руками')
    ? 'Ручной прогрев создал очередь: когда заявок больше, чем внимания, деньги начинают остывать.'
    : warmup.includes('ии')
      ? 'ИИ-бот может вести людей лучше ручного хаоса, но ему все равно нужна ясная точка заявки.'
      : warmup.includes('автовебинар')
        ? 'Автовебинар объясняет ценность, но без продажного маршрута часть теплых людей зависает.'
        : warmup.includes('гайд')
          ? 'Гайд собирает интерес, но слабый следующий шаг превращает скачивания в молчание.'
          : warmup.includes('видеоурок')
            ? 'Видеоурок греет через экспертность, но ему нужна сильная заявка в конце.'
            : adLine;
  const salesLine = sales.includes('наитию')
    ? 'Продажи по наитию не дают повторяемой конверсии: каждый лид заново проходит через хаос.'
    : sales.includes('созвон')
      ? 'Созвон дает шанс закрывать дорогие сомнения, но только если есть структура и квалификация.'
      : sales.includes('переписк')
        ? 'Переписка работает, когда сценарий быстро снимает страхи и ведет к оплате без лишней воды.'
        : sales.includes('сайт')
          ? 'Сайт снимает ручную нагрузку, но не спасает слабое доверие и неотвеченные вопросы.'
          : sales.includes('автовебинар')
            ? 'Автовебинар продает часть аудитории сам, но оставшиеся вопросы все равно надо дожимать.'
            : 'Продажный маршрут должен быть очевидным: кто закрывает, где закрывает и что говорит.';
  return { processing: warmupLine, warmup: warmupLine, sales: salesLine };
}

function warmupRecommendation(product: V3ProductContext): string {
  if (product.type === 'mentorship' || product.band === 'high') {
    return 'собрать доверительный прогрев с кейсами, квалификацией и переходом на созвон, а не просто ждать сообщений.';
  }
  if (product.type === 'membership' || product.type === 'recorded_course') {
    return 'сделать короткий прогрев, который быстро показывает первый результат и ведет на простую покупку.';
  }
  return 'упаковать оффер, последовательность сообщений и точку заявки так, чтобы лид понимал, зачем писать сейчас.';
}

function salesRecommendation(product: V3ProductContext, salesTitle: string): string {
  const sales = salesTitle.toLowerCase();
  if (product.type === 'mentorship' || product.band === 'high') {
    return sales.includes('созвон')
      ? 'разобрать сценарий созвона, квалификацию и момент оффера, потому что высокий чек не закрывается случайными аргументами.'
      : 'перевести теплые заявки в созвон со сценарием, иначе высокий чек будет проседать даже на хороших лидах.';
  }
  if (product.type === 'recorded_course' || product.type === 'membership') {
    return 'упростить путь к оплате через сайт, автовебинар или короткую переписку, чтобы низкий чек не съедался ручной работой.';
  }
  if (product.type === 'consultation') {
    return 'собрать короткий сценарий диагностики: боль, результат, формат, оплата. Без этого консультации превращаются в бесплатные советы.';
  }
  return 'подготовить сценарий переписки или созвона под реальные возражения, а не продавать одинаково всем заявкам.';
}

function salesRouteRecommendation(product: V3ProductContext): string {
  if (product.type === 'mentorship' || product.band === 'high') return 'созвон со специалистом и жесткая квалификация перед оффером.';
  if (product.type === 'recorded_course' || product.type === 'membership') return 'сайт или автовебинар плюс быстрый дожим в переписке.';
  if (product.type === 'consultation') return 'короткая переписка для квалификации и созвон/оплата без длинных объяснений.';
  return 'подготовленная переписка для простых заявок и созвон для дорогих или сомневающихся.';
}

function burnoutRecommendation(product: V3ProductContext): string {
  if (product.band === 'high') return 'оставить ручную энергию только на квалифицированные созвоны, а прогрев и первичные ответы автоматизировать.';
  if (product.type === 'membership' || product.type === 'recorded_course') return 'не продавать низкий чек вручную каждому человеку, а строить автоматический путь к оплате.';
  return 'разделить поток: бот/специалист забирает рутину, вы подключаетесь только там, где это влияет на оплату.';
}

function scaleRecommendation(product: V3ProductContext): string {
  if (product.type === 'mentorship' || product.band === 'high') return 'масштабировать только квалифицированный трафик и созвоны, иначе вырастет не выручка, а очередь сомневающихся';
  if (product.type === 'membership') return 'усилить вход и удержание, потому что прибыль подписки раскрывается через повторные платежи';
  return 'увеличить поток на сильный прогрев и не ломать тот продажный маршрут, который уже дал оплаты';
}

export function getV3ActiveOptions(state: GameState, kind: V3SelectionKind): ActiveOption[] {
  ensureV3AdviceState(state);
  const recovered = permanentToolsFromLastSummary(state);
  const enrich = (item: ActiveDef, locked: boolean, ownKnown: boolean): ActiveOption => ({
    ...item,
    locked,
    known: isConversionKnown(state, kind, ownKnown),
    effectiveConversion: effectiveOptionConversion(state, kind, item.baseConversion),
  });
  const base = BASE_ACTIVE.filter((item) => item.area === kind).map((item) => enrich(item, false, true));
  if (kind === 'ad') {
    const preparedVariants = new Set(state.v3.preparedAds.map((item) => `${item.instrumentId}:${item.mode}`));
    const prepared = state.v3.preparedAds.map((item) => enrich({
      key: item.key,
      title: item.title,
      area: 'ad',
      baseConversion: getPreparation('ads', item.instrumentId)[item.mode === 'self' ? 'self' : 'expert'].conversion,
      manualShare: 0,
      viewsBase: AD_VIEW_BASE[item.instrumentId] ?? 3_000,
    }, false, item.known));
    const locked = V3_PREPARATIONS.filter((item) => item.area === 'ads').flatMap((item) => (['self', 'expert'] as const)
      .filter((mode) => !preparedVariants.has(`${item.id}:${mode}`))
      .map((mode) => enrich({
      key: `locked:ads:${item.id}:${mode}`,
      title: `${item.title} - ${mode === 'self' ? 'самостоятельно' : 'со специалистом'}`,
      area: 'ad',
      baseConversion: item[mode].conversion,
      manualShare: 0,
      viewsBase: AD_VIEW_BASE[item.id] ?? 3_000,
    }, true, false)));
    return [...base, ...prepared, ...locked];
  }
  const area = kind === 'warmup' ? 'warmup' : 'sales';
  const prepared = [...state.v3.preparedTools, ...recovered].filter((item, index, list) =>
    item.area === area && list.findIndex((candidate) => candidate.key === item.key) === index
  );
  const preparedVariants = new Set(prepared.map((item) => `${item.instrumentId}:${item.mode}`));
  const preparedOptions = prepared.map((item) => enrich({
    key: item.key,
    title: item.title,
    area: kind,
    baseConversion: getPreparation(area, item.instrumentId)[item.mode === 'self' ? 'self' : 'expert'].conversion,
    manualShare: manualShareFor(area, item.instrumentId),
    autoSalesShare: autoSalesShareFor(area, item.instrumentId),
  }, false, item.known));
  const locked = V3_PREPARATIONS.filter((item) => item.area === area).flatMap((item) => (['self', 'expert'] as const)
    .filter((mode) => !preparedVariants.has(`${item.id}:${mode}`))
    .map((mode) => enrich({
    key: `locked:${area}:${item.id}:${mode}`,
    title: `${item.title} - ${mode === 'self' ? 'самостоятельно' : 'со специалистом'}`,
    area: kind,
    baseConversion: item[mode].conversion,
    manualShare: 0,
  }, true, false)));
  return [...base, ...preparedOptions, ...locked];
}

export function buildV3ActiveStagePlan(state: GameState): V3ActiveStagePlan {
  const context = resolveStageContext(state);
  const { stageNumber, ad, warmup, salesBonus } = context;
  const rand = (name: string) => hashToUnitInterval(state.seed, stageNumber, name, state.resources.day);
  const viewBreakdown = resolveAdViewBreakdown(state, stageNumber, ad, context.adBonus);
  const views = viewBreakdown.totalViews;
  const newLeads = Math.max(1, stochasticRound(views * ad.baseConversion * (0.9 + rand('leads') * 0.2), planKey(state, stageNumber, 'leads')));
  const interested = Math.max(0, stochasticRound(newLeads * warmup.baseConversion * context.warmupBonus, planKey(state, stageNumber, 'interested')));
  const notInterested = Math.max(0, newLeads - interested);
  const requiredAnswer = Math.min(56, Math.max(0, Math.round(interested * warmup.manualShare)));
  const warmupAutoAudience = countHiddenAutoAudience(
    newLeads,
    warmupAutoAudienceRate(state, warmup),
    planKey(state, stageNumber, 'warmup-auto-audience'),
  );
  const warmupAutoPurchaseConversion = effectiveWarmupAutoPurchaseConversion(state, warmup, context.warmupBonus);
  const autoSales = Math.min(
    interested,
    countDeterministicSuccesses(warmupAutoAudience, warmupAutoPurchaseConversion, planKey(state, stageNumber, 'warmup-auto-sales')),
  );
  const salesConversion = effectiveSalesConversion(state, context.sales.baseConversion, salesBonus);
  const salesPool = Math.max(0, interested - autoSales);
  const messageConversion = autoSalesMessageConversion(context.sales.key);
  const salesAutoAudience = countHiddenAutoAudience(
    salesPool,
    salesAutoAudienceRate(state, context.sales),
    planKey(state, stageNumber, 'sales-auto-audience'),
  );
  const salesAutoPurchaseConversion = effectiveSalesAutoPurchaseConversion(state, context.sales, salesBonus);
  const plannedSiteBuys = countDeterministicSuccesses(salesAutoAudience, salesAutoPurchaseConversion, planKey(state, stageNumber, 'site-buys'));
  const siteMessages = messageConversion > 0
    ? countDeterministicSuccesses(
      Math.max(0, salesAutoAudience - plannedSiteBuys),
      messageConversion,
      planKey(state, stageNumber, 'sales-auto-messages'),
    )
    : 0;

  return {
    durationSeconds: ACTIVE_STAGE_SECONDS,
    callDurationSeconds: CALL_DURATION_SECONDS,
    chatDurationSeconds: CHAT_DURATION_SECONDS,
    messageTimeoutSeconds: MESSAGE_TIMEOUT_SECONDS,
    adLabel: adEventLabel(ad.key),
    adEvents: buildAdEvents(state, stageNumber, ad, viewBreakdown),
    warmupMessages: buildWarmupMessages(state, stageNumber, requiredAnswer),
    callOutcomes: buildSaleOutcomes(state, stageNumber, 'call', salesConversion, true),
    chatOutcomes: buildSaleOutcomes(state, stageNumber, 'chat', salesConversion, false),
    totals: {
      views,
      newLeads,
      notInterested,
      interested,
      requiredAnswer,
      warmupAutoAudience,
      autoSales,
      salesAutoAudience,
      siteMessages,
      baseViews: viewBreakdown.baseViews,
      viralViews: viewBreakdown.viralViews,
      viralEventsCount: viewBreakdown.viralEventsCount,
    },
  };
}

function calculatePreparationDays(items: V3PreparationPlanItem[]): number {
  const selfDays = items.filter((item) => item.mode === 'self').reduce((sum, item) => sum + item.days, 0);
  const expertDays = Math.max(0, ...items.filter((item) => item.mode === 'expert').map((item) => item.days));
  return Math.max(selfDays, expertDays);
}

function unlockPlannedPreparations(state: GameState): string[] {
  const titles: string[] = [];
  for (const item of state.v3.plannedPreparations) {
    if (item.area === 'ads') {
      state.v3.preparedAds.push({
        key: `ad:${item.instrumentId}:${item.mode}:${item.id}`,
        instrumentId: item.instrumentId,
        mode: item.mode,
        title: item.title,
        known: false,
        uses: 0,
      });
      titles.push(item.title);
      continue;
    }
    if (!state.v3.preparedTools.some((prepared) =>
      prepared.area === item.area && prepared.instrumentId === item.instrumentId && prepared.mode === item.mode
    )) {
      state.v3.preparedTools.push({
        key: `${item.area}:${item.instrumentId}:${item.mode}`,
        area: item.area,
        instrumentId: item.instrumentId,
        mode: item.mode,
        title: item.title,
        known: false,
        uses: 0,
      });
      titles.push(item.title);
    }
  }
  return titles;
}

function recoverPermanentToolsFromLastSummary(state: GameState): void {
  for (const item of permanentToolsFromLastSummary(state)) {
    if (!state.v3.preparedTools.some((prepared) => prepared.key === item.key)) {
      state.v3.preparedTools.push(item);
    }
  }
}

function permanentToolsFromLastSummary(state: GameState): GameState['v3']['preparedTools'] {
  const summary = state.v3.lastPreparationSummary;
  if (!summary) return [];
  return summary.items
    .filter((item) => item.area === 'warmup' || item.area === 'sales')
    .map((item) => ({
      key: `${item.area}:${item.instrumentId}:${item.mode}`,
      area: item.area as 'warmup' | 'sales',
      instrumentId: item.instrumentId,
      mode: item.mode,
      title: item.title,
      known: false,
      uses: 0,
    }));
}

function buildStageReport(state: GameState, interactions?: V3ActiveInteractions): V3StageReport {
  ensureV3AdviceState(state);
  const context = resolveStageContext(state);
  const { stageNumber, ad, warmup, sales } = context;
  const plan = state.v3.activeStage?.plan ?? buildV3ActiveStagePlan(state);
  const { views, newLeads, notInterested, interested, requiredAnswer } = plan.totals;
  const actionSummary = summarizeV3ActionLog(plan, interactions?.actionLog);
  const hasInteractions = hasActiveInteractions(interactions);
  const handledCapacity = hasInteractions
    ? actionSummary.manualAnswers ?? Math.max(0, interactions.manualAnswers ?? 0)
    : Math.max(0, Math.floor(state.resources.energy / 3));
  const lost = Math.max(0, requiredAnswer - handledCapacity);
  const warmed = Math.max(0, interested - lost);
  const autoSales = Math.min(warmed, plan.totals.autoSales);
  const salesPool = Math.max(0, warmed - autoSales);

  let callsHeld = 0;
  let callsBuy = 0;
  let chatsHeld = 0;
  let chatsBuy = 0;
  let siteVisits = 0;
  let siteBuys = 0;
  let siteMessages = 0;
  let energySpent = (actionSummary.manualAnswers ?? Math.max(0, interactions?.manualAnswers ?? 0)) * 1;
  const requestedCalls = actionSummary.calls ?? Math.max(0, interactions?.calls ?? 0);
  const requestedChats = actionSummary.salesChats ?? Math.max(0, interactions?.salesChats ?? 0);
  const requestedDirectChats = actionSummary.directSalesChats ?? Math.max(0, interactions?.directSalesChats ?? requestedChats);
  const requestedPostCallChats = actionSummary.postCallChats ?? Math.max(0, interactions?.postCallChats ?? requestedChats);

  if (sales.key.includes('call_script')) {
    const postCallChatConversion = effectiveSalesConversion(state, sales.baseConversion, context.salesBonus);
    callsHeld = hasInteractions
      ? Math.max(0, Math.min(salesPool, requestedCalls))
      : Math.max(0, Math.min(salesPool, Math.floor((state.resources.energy - energySpent) / 5)));
    callsBuy = countOutcomeBuys(plan.callOutcomes, callsHeld);
    const postCallMessages = countPostCallMessages(plan.callOutcomes, callsHeld);
    chatsHeld = Math.max(0, Math.min(postCallMessages, requestedPostCallChats));
    chatsBuy = countDeterministicSuccesses(chatsHeld, postCallChatConversion, planKey(state, stageNumber, 'post-call-chat-buys'));
    energySpent += callsHeld * 5 + chatsHeld * 2;
  } else if (sales.key.includes('website') || sales.key.includes('auto_webinar')) {
    const autoPurchaseConversion = effectiveSalesAutoPurchaseConversion(state, sales, context.salesBonus);
    const assistedSalesConversion = effectiveSalesConversion(state, sales.baseConversion, context.salesBonus);
    const messageConversion = autoSalesMessageConversion(sales.key);
    siteVisits = Math.min(salesPool, plan.totals.salesAutoAudience ?? salesPool);
    siteBuys = countDeterministicSuccesses(siteVisits, autoPurchaseConversion, planKey(state, stageNumber, 'site-buys'));
    siteMessages = countDeterministicSuccesses(Math.max(0, siteVisits - siteBuys), messageConversion, planKey(state, stageNumber, 'sales-auto-messages'));
    chatsHeld = hasInteractions
      ? Math.max(0, Math.min(siteMessages, requestedChats))
      : Math.max(0, Math.min(siteMessages, Math.floor((state.resources.energy - energySpent) / 2)));
    chatsBuy = countDeterministicSuccesses(chatsHeld, assistedSalesConversion, planKey(state, stageNumber, 'site-chat-buys'));
    energySpent += chatsHeld * 2;
  } else if (sales.key === 'sales:intuition') {
    const postCallChatConversion = effectiveSalesConversion(state, sales.baseConversion, context.salesBonus);
    callsHeld = hasInteractions
      ? Math.max(0, Math.min(salesPool, requestedCalls))
      : Math.max(0, Math.min(salesPool, Math.floor((state.resources.energy - energySpent) / 5)));
    callsBuy = countOutcomeBuys(plan.callOutcomes, callsHeld);
    const remainingAfterCalls = Math.max(0, salesPool - callsHeld);
    const postCallMessages = countPostCallMessages(plan.callOutcomes, callsHeld);
    const directChatsHeld = Math.max(0, Math.min(remainingAfterCalls, requestedDirectChats));
    const postCallChatsHeld = Math.max(0, Math.min(postCallMessages, requestedPostCallChats));
    chatsHeld = directChatsHeld + postCallChatsHeld;
    chatsBuy = countOutcomeBuys(plan.chatOutcomes, directChatsHeld)
      + countDeterministicSuccesses(postCallChatsHeld, postCallChatConversion, planKey(state, stageNumber, 'post-call-chat-buys'));
    energySpent += callsHeld * 6 + chatsHeld * 3;
  } else {
    chatsHeld = hasInteractions
      ? Math.max(0, Math.min(salesPool, requestedChats))
      : Math.max(0, Math.min(salesPool, Math.floor((state.resources.energy - energySpent) / 2)));
    chatsBuy = countOutcomeBuys(plan.chatOutcomes, chatsHeld);
    energySpent += chatsHeld * 2;
  }

  energySpent = Math.min(state.resources.energy, Math.max(1, Math.round(energySpent)));
  const callsNoBuy = Math.max(0, callsHeld - callsBuy);
  const chatsNoBuy = Math.max(0, chatsHeld - chatsBuy);
  const salesCount = Math.max(0, autoSales + callsBuy + chatsBuy + siteBuys);
  const revenue = salesCount * (state.launchPlan.productPrice || 0);
  const workloadSeconds = requiredAnswer * ANSWER_DURATION_SECONDS
    + callsHeld * CALL_DURATION_SECONDS
    + chatsHeld * CHAT_DURATION_SECONDS;
  const handledWorkloadSeconds = Math.min(ACTIVE_STAGE_SECONDS, handledCapacity * ANSWER_DURATION_SECONDS
    + callsHeld * CALL_DURATION_SECONDS
    + chatsHeld * CHAT_DURATION_SECONDS);
  const capacityLoss = lost;
  const daysSpent = activeStageDays(state);
  const endedByBurnout = state.resources.energy - energySpent <= 0;

  return {
    id: `stage-${stageNumber}`,
    stageNumber,
    startedDay: state.resources.day,
    finishedDay: Math.min(30, state.resources.day + daysSpent),
    daysSpent,
    energySpent,
    adTitle: ad.title,
    warmupTitle: warmup.title,
    salesTitle: sales.title,
    views,
    baseViews: plan.totals.baseViews,
    viralViews: plan.totals.viralViews,
    viralEventsCount: plan.totals.viralEventsCount,
    newLeads,
    notInterested,
    interested,
    requiredAnswer,
    lost,
    workloadSeconds,
    handledWorkloadSeconds,
    capacityLoss,
    applications: interested,
    callsHeld,
    callsNoBuy,
    callsBuy,
    chatsHeld,
    chatsNoBuy,
    chatsBuy,
    siteVisits,
    siteBuys,
    siteMessages,
    autoSales,
    salesCount,
    revenue,
    goalReached: state.metrics.revenue + revenue >= state.targets.targetRevenue && state.targets.targetRevenue > 0,
    endedByBurnout,
  };
}

function applyReport(state: GameState, report: V3StageReport): void {
  state.resources.day = report.finishedDay;
  state.resources.energy = Math.max(0, state.resources.energy - report.energySpent);
  state.metrics.impressions += report.views;
  state.metrics.inbound += report.newLeads;
  state.metrics.activated += report.interested;
  state.metrics.processed += Math.max(0, report.interested - report.lost);
  state.metrics.applications += report.applications;
  state.metrics.bookedCalls += report.callsHeld;
  state.metrics.heldCalls += report.callsHeld;
  state.metrics.sales += report.salesCount;
  state.metrics.revenue += report.revenue;
  state.metrics.lostLeads += report.lost;
}

function hasActiveInteractions(interactions: V3ActiveInteractions): interactions is NonNullable<V3ActiveInteractions> {
  return Boolean(interactions && (
    typeof interactions.manualAnswers === 'number'
    || typeof interactions.salesChats === 'number'
    || typeof interactions.directSalesChats === 'number'
    || typeof interactions.postCallChats === 'number'
    || typeof interactions.calls === 'number'
    || Array.isArray(interactions.actionLog)
  ));
}

function summarizeV3ActionLog(plan: V3ActiveStagePlan, actionLog?: V3ActiveActionLogEntry[]): {
  manualAnswers?: number;
  salesChats?: number;
  directSalesChats?: number;
  postCallChats?: number;
  calls?: number;
} {
  if (!actionLog) return {};
  const unique = new Map<string, V3ActiveActionLogEntry>();
  for (const action of actionLog) {
    if (unique.has(action.id)) continue;
    unique.set(action.id, action);
  }
  const ordered = [...unique.values()].sort((left, right) => left.startedAtMs - right.startedAtMs);
  let previousCompletedAtMs = 0;
  const usedTargets = new Set<string>();
  const warmupTargets = new Map(plan.warmupMessages.map((message) => [message.id, message]));
  const callTargets = new Set(plan.callOutcomes.map((outcome) => outcome.id));
  const chatTargets = new Set(plan.chatOutcomes.map((outcome) => outcome.id));
  let manualAnswers = 0;
  let calls = 0;
  let directSalesChats = 0;
  let postCallChats = 0;
  let siteChats = 0;

  for (const action of ordered) {
    if (action.startedAtMs < previousCompletedAtMs) {
      throw new Error('Активный этап содержит пересекающиеся действия');
    }
    if (action.completedAtMs > plan.durationSeconds * 1000) {
      throw new Error('Активный этап содержит действие после окончания таймера');
    }
    const targetKey = `${action.type}:${action.targetId}`;
    if (usedTargets.has(targetKey)) {
      throw new Error('Активный этап содержит повторную обработку одной цели');
    }
    usedTargets.add(targetKey);
    previousCompletedAtMs = action.completedAtMs;

    if (action.type === 'answer') {
      const target = warmupTargets.get(action.targetId);
      if (!target) throw new Error('Активный этап содержит неизвестное сообщение прогрева');
      validateActionTiming(action, target.second, ANSWER_DURATION_SECONDS, target.expiresSecond);
      manualAnswers += 1;
      continue;
    }
    if (action.type === 'call') {
      if (!callTargets.has(action.targetId)) throw new Error('Активный этап содержит неизвестный созвон');
      validateActionTiming(action, 0, plan.callDurationSeconds, plan.durationSeconds);
      calls += 1;
      continue;
    }
    if (action.type === 'direct_chat' || action.type === 'post_call_chat') {
      const targetExists = action.type === 'post_call_chat'
        ? callTargets.has(action.targetId) || chatTargets.has(action.targetId)
        : chatTargets.has(action.targetId);
      if (!targetExists) throw new Error('Активный этап содержит неизвестную переписку');
      validateActionTiming(action, 0, plan.chatDurationSeconds, plan.durationSeconds);
      if (action.type === 'direct_chat') directSalesChats += 1;
      else postCallChats += 1;
      continue;
    }
    validateActionTiming(action, 0, plan.chatDurationSeconds, plan.durationSeconds);
    siteChats += 1;
  }

  return {
    manualAnswers,
    salesChats: directSalesChats + postCallChats + siteChats,
    directSalesChats: directSalesChats + siteChats,
    postCallChats,
    calls,
  };
}

function validateActionTiming(action: V3ActiveActionLogEntry, availableAtSecond: number, durationSeconds: number, expiresAtSecond: number): void {
  const minStartedAtMs = availableAtSecond * 1000;
  const minCompletedAtMs = action.startedAtMs + durationSeconds * 1000;
  const maxCompletedAtMs = expiresAtSecond * 1000;
  if (action.startedAtMs < minStartedAtMs || action.completedAtMs < minCompletedAtMs || action.completedAtMs > maxCompletedAtMs) {
    throw new Error('Активный этап содержит действие с некорректным временем');
  }
}

function activeStageDays(state: GameState): number {
  const adsDays = state.v3.activeSelection.ad ? ACTIVE_STAGE_AD_DAYS : 0;
  const warmupDays = state.v3.activeSelection.warmup ? ACTIVE_STAGE_WARMUP_DAYS : 0;
  const salesDays = state.v3.activeSelection.sales ? ACTIVE_STAGE_SALES_DAYS : 0;
  return ACTIVE_STAGE_BASE_DAYS + Math.max(adsDays, warmupDays, salesDays);
}

function hasTimeForActiveStage(state: GameState): boolean {
  return state.resources.day + activeStageDays(state) <= 30;
}

function resolveStageContext(state: GameState): {
  stageNumber: number;
  ad: ActiveDef;
  warmup: ActiveDef;
  sales: ActiveDef;
  adBonus: number;
  warmupBonus: number;
  salesBonus: number;
} {
  ensureV3AdviceState(state);
  const stageNumber = state.v3.stageReports.length + 1;
  return {
    stageNumber,
    ad: resolveActive(state, 'ad', state.v3.activeSelection.ad),
    warmup: resolveActive(state, 'warmup', state.v3.activeSelection.warmup),
    sales: resolveActive(state, 'sales', state.v3.activeSelection.sales),
    adBonus: superpowerMultiplier(state.player.superpower, 'ads') * adviceMultiplier(state, 'ads'),
    warmupBonus: superpowerMultiplier(state.player.superpower, 'warmup') * adviceMultiplier(state, 'warmup'),
    salesBonus: superpowerMultiplier(state.player.superpower, 'sales') * adviceMultiplier(state, 'sales'),
  };
}

function resolveAdViewBreakdown(state: GameState, stageNumber: number, ad: ActiveDef, adBonus: number): {
  baseViews: number;
  viralViews: number;
  viralEventsCount: number;
  totalViews: number;
} {
  const rand = (name: string) => hashToUnitInterval(state.seed, stageNumber, name, ad.key, state.resources.day);
  if (isLowReachHighConversionAd(ad.key)) {
    const baseViews = Array.from({ length: 20 }, (_, index) =>
      Math.round(300 + hashToUnitInterval(state.seed, stageNumber, 'low-reach-ad-views', ad.key, index) * 100)
    ).reduce((sum, value) => sum + value, 0);
    const adjustedBaseViews = Math.max(1, Math.round(baseViews * adBonus));
    return { baseViews: adjustedBaseViews, viralViews: 0, viralEventsCount: 0, totalViews: adjustedBaseViews };
  }
  const baseViews = Math.max(1_000, Math.round((ad.viewsBase ?? 12_000) * (0.82 + rand('views') * 0.48) * adBonus));
  const viralEventsCount = rand('spike') > 0.82 ? 1 : 0;
  const viralMultiplier = viralEventsCount > 0 ? 0.7 + rand('spike-size') * 1.6 : 0;
  const viralViews = Math.round(baseViews * viralMultiplier);
  return { baseViews, viralViews, viralEventsCount, totalViews: baseViews + viralViews };
}

function buildAdEvents(
  state: GameState,
  stageNumber: number,
  ad: ActiveDef,
  viewBreakdown: { baseViews: number; viralViews: number; viralEventsCount: number; totalViews: number },
): V3ActiveAdEvent[] {
  const count = 20;
  const label = adEventLabel(ad.key);
  const hotIndex = viewBreakdown.viralEventsCount > 0
    ? Math.floor(hashToUnitInterval(state.seed, stageNumber, 'viral-index', ad.key) * count)
    : -1;
  const weights = Array.from({ length: count }, (_, index) => {
    if (isLowReachHighConversionAd(ad.key)) {
      return 0.9 + hashToUnitInterval(state.seed, stageNumber, 'low-reach-ad-weight', ad.key, index) * 0.2;
    }
    const hot = index === hotIndex;
    const spread = 0.75 + hashToUnitInterval(state.seed, stageNumber, 'ad-weight', ad.key, index) * 0.8;
    return (hot ? 1.8 : 1) * spread;
  });
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let distributed = 0;
  return weights.map((weight, index) => {
    const isLast = index === weights.length - 1;
    const baseViewsDelta = isLast
      ? Math.max(0, viewBreakdown.baseViews - distributed)
      : Math.max(0, Math.round(viewBreakdown.baseViews * (weight / totalWeight)));
    const hot = index === hotIndex && !isLowReachHighConversionAd(ad.key);
    const viralViewsDelta = hot ? viewBreakdown.viralViews : 0;
    const viewsDelta = isLast
      ? Math.max(0, viewBreakdown.totalViews - distributed)
      : baseViewsDelta + viralViewsDelta;
    distributed += viewsDelta;
    return {
      id: `ad-${stageNumber}-${index}`,
      second: Math.min(ACTIVE_STAGE_SECONDS - 1, 1 + index * 3),
      label: hot && !isLowReachHighConversionAd(ad.key) ? `${label} залетел` : label,
      viewsDelta,
      hot: hot && !isLowReachHighConversionAd(ad.key),
    };
  });
}

function isLowReachHighConversionAd(key: string): boolean {
  return key.includes('stories') || key.includes('telegram');
}

function buildWarmupMessages(state: GameState, stageNumber: number, requiredAnswer: number): V3ActiveStagePlan['warmupMessages'] {
  const texts = [
    'Это подходит новичкам?',
    'А где можно посмотреть подробнее?',
    'Вы полностью даете инструкцию?',
    'А если у меня нет опыта?',
    'Сколько времени нужно в день?',
    'А можно начать без команды?',
    'Что делать, если не получится?',
    'Есть примеры результатов?',
    'А мне подойдет с маленькой аудиторией?',
    'Можно задать вопрос по моей ситуации?',
  ];
  return Array.from({ length: Math.min(requiredAnswer, 56) }, (_, index) => {
    const second = Math.min(ACTIVE_STAGE_SECONDS - MESSAGE_TIMEOUT_SECONDS, 4 + index);
    return {
      id: `warmup-${stageNumber}-${index}`,
      second,
      expiresSecond: second + MESSAGE_TIMEOUT_SECONDS,
      text: texts[index % texts.length],
    };
  });
}

function buildSaleOutcomes(
  state: GameState,
  stageNumber: number,
  kind: 'call' | 'chat',
  conversion: number,
  includeFollowup: boolean,
): V3ActiveSaleOutcome[] {
  const winners = successfulAttemptIndexes(MAX_OUTCOME_SEQUENCE, conversion, planKey(state, stageNumber, `${kind}-buys`));
  const followups = includeFollowup
    ? successfulAttemptIndexes(MAX_OUTCOME_SEQUENCE, 0.40, planKey(state, stageNumber, 'post-call-followups'))
    : new Set<number>();
  const followupBuys = includeFollowup
    ? successfulAttemptIndexes(MAX_OUTCOME_SEQUENCE, conversion, planKey(state, stageNumber, 'post-call-chat-buys'))
    : new Set<number>();
  const callTexts = [
    'Какие у вас гарантии?',
    'А что вы предлагаете отстающим?',
    'Как мы придем к результату?',
    'Будете ли помогать по ходу работы?',
    'Если у меня нестандартная ситуация?',
    'Сколько нужно времени на внедрение?',
    'Можно ли оплатить частями?',
    'Что будет после первого месяца?',
    'Какие задачи вы берете на себя?',
    'Подойдет ли мне с моим уровнем?',
  ];
  const chatTexts = [
    'А можно коротко, что входит?',
    'Почему такая цена?',
    'Чем это отличается от курса?',
    'Можно посмотреть отзывы?',
    'А если я не успею выполнять?',
    'Что будет первым шагом?',
    'Вы проверяете домашки?',
    'Можно ли стартовать на этой неделе?',
    'Мне надо подумать, но интересно',
    'А есть формат полегче?',
  ];
  return Array.from({ length: MAX_OUTCOME_SEQUENCE }, (_, index) => {
    const buy = winners.has(index);
    const followupMessage = !buy && followups.has(index);
    return {
      id: `${kind}-${stageNumber}-${index}`,
      text: kind === 'call' ? callTexts[index % callTexts.length] : chatTexts[index % chatTexts.length],
      buy,
      followupMessage,
      followupBuy: followupMessage && followupBuys.has(index),
    };
  });
}

function successfulAttemptIndexes(total: number, conversion: number, key: string): Set<number> {
  const normalized = clampConversion(conversion);
  if (normalized <= 0) return new Set();
  const phase = 0.5 + hashToUnitInterval(key, 'phase') * 0.5;
  return new Set(
    Array.from({ length: total }, (_, index) => index).filter((index) => {
      const previous = Math.floor(index * normalized + phase);
      const next = Math.floor((index + 1) * normalized + phase);
      return next > previous;
    }),
  );
}

function countOutcomeBuys(outcomes: V3ActiveSaleOutcome[], handled: number): number {
  return outcomes.slice(0, handled).filter((outcome) => outcome.buy).length;
}

function countPostCallMessages(outcomes: V3ActiveSaleOutcome[], handledCalls: number): number {
  return outcomes.slice(0, handledCalls).filter((outcome) => outcome.followupMessage).length;
}

function countDeterministicSuccesses(total: number, conversion: number, key: string): number {
  return Math.min(total, successfulAttemptIndexes(total, conversion, key).size);
}

function planKey(state: GameState, stageNumber: number, label: string): string {
  return `${state.seed}:${state.resources.day}:${stageNumber}:${label}`;
}

function clampConversion(value: number): number {
  return Math.max(0, Math.min(0.95, value));
}

function effectiveOptionConversion(state: GameState, kind: V3SelectionKind, baseConversion: number): number {
  const category = kind === 'ad' ? 'ads' : kind;
  const bonus = superpowerMultiplier(state.player.superpower, category) * adviceMultiplier(state, category);
  return kind === 'sales'
    ? effectiveSalesConversion(state, baseConversion, bonus)
    : clampConversion(baseConversion * bonus);
}

function selectionKindForPreparationArea(area: V3PreparationArea): V3SelectionKind {
  return area === 'ads' ? 'ad' : area;
}

function formatEngineMoney(value: number): string {
  return `${Math.round(value).toLocaleString('ru-RU')} ₽`;
}

function stripFinalPunctuation(value: string): string {
  return value.replace(/[.!?]+$/u, '');
}

function effectiveSalesConversion(state: GameState, baseConversion: number, bonus: number): number {
  return clampConversion(Math.max(baseConversion, minSalesConversionForPrice(state.launchPlan.productPrice ?? 0)) * bonus);
}

function v3EndingReasonAfterReport(state: GameState, report: V3StageReport): GameState['endingReason'] {
  if (state.endingReason) return state.endingReason;
  if (report.endedByBurnout || state.resources.energy <= 0) return 'resource_finished';
  if (report.finishedDay >= 30 || state.resources.day >= 30) return 'time_finished';
  if (
    (state.targets.targetRevenue > 0 && state.metrics.revenue >= state.targets.targetRevenue)
    || (state.targets.targetSales > 0 && state.metrics.sales >= state.targets.targetSales)
    || report.goalReached
  ) {
    return 'goal_finished';
  }
  return null;
}

function finalizeV3IfTerminal(state: GameState): void {
  if (state.endingReason) return;
  if (state.resources.energy <= 0) {
    state.endingReason = 'resource_finished';
  } else if (state.resources.day >= 30) {
    state.endingReason = 'time_finished';
  } else if (
    (state.targets.targetRevenue > 0 && state.metrics.revenue >= state.targets.targetRevenue)
    || (state.targets.targetSales > 0 && state.metrics.sales >= state.targets.targetSales)
  ) {
    state.endingReason = 'goal_finished';
  }
  if (state.endingReason) {
    state.flow.stage = 'final';
    state.flow.step = 'final_reason';
  }
}

function minSalesConversionForPrice(productPrice: number): number {
  if (productPrice > 0 && productPrice <= 15_000) return 0.10;
  return 0;
}

function adEventLabel(key: string): string {
  if (key.includes('stories')) return 'Сторис';
  if (key.includes('telegram')) return 'ТГ-пост';
  if (key.includes('paid_ads')) return 'Креатив';
  if (key.includes('reels')) return 'Рилс';
  return 'Реклама';
}

function markSelectionKnownAndConsumeAd(state: GameState): void {
  for (const tool of state.v3.preparedTools) {
    if (tool.key === state.v3.activeSelection.warmup || tool.key === state.v3.activeSelection.sales) {
      tool.known = true;
      tool.uses += 1;
    }
  }
  const adKey = state.v3.activeSelection.ad;
  state.v3.preparedAds = state.v3.preparedAds.filter((ad) => {
    if (ad.key !== adKey) return true;
    ad.known = true;
    ad.uses += 1;
    return false;
  });
}

function resolveActive(state: GameState, kind: V3SelectionKind, key: string | null): ActiveDef {
  const found = getV3ActiveOptions(state, kind).find((option) => option.key === key && !option.locked);
  if (!found) throw new Error('Этот инструмент еще не готов');
  return found;
}

function isSelectable(state: GameState, kind: V3SelectionKind, key: string): boolean {
  return getV3ActiveOptions(state, kind).some((option) => option.key === key && !option.locked);
}

function isConflictingWebinarSelection(state: GameState, kind: V3SelectionKind, key: string): boolean {
  if (!key.includes('auto_webinar')) return false;
  if (kind === 'warmup') return Boolean(state.v3.activeSelection.sales?.includes('auto_webinar'));
  if (kind === 'sales') return Boolean(state.v3.activeSelection.warmup?.includes('auto_webinar'));
  return false;
}

function isPermanentPrepared(state: GameState, area: V3PreparationArea, instrumentId: string, mode: V3PreparationMode): boolean {
  return state.v3.preparedTools.some((item) => item.area === area && item.instrumentId === instrumentId && item.mode === mode)
    || state.v3.plannedPreparations.some((item) => item.area === area && item.instrumentId === instrumentId && item.mode === mode);
}

function isPreparationAlreadyReadyOrPlanned(state: GameState, area: V3PreparationArea, instrumentId: string, mode: V3PreparationMode): boolean {
  if (area === 'ads') {
    return state.v3.preparedAds.some((item) => item.instrumentId === instrumentId && item.mode === mode)
      || state.v3.plannedPreparations.some((item) => item.area === area && item.instrumentId === instrumentId && item.mode === mode);
  }
  return isPermanentPrepared(state, area, instrumentId, mode);
}

function getPreparation(area: V3PreparationArea, instrumentId: string): PrepDef {
  const definition = V3_PREPARATIONS.find((item) => item.area === area && item.id === instrumentId);
  if (!definition) throw new Error('Неизвестная подготовка');
  return definition;
}

function maxEnergy(superpower: Superpower): number {
  return superpower === 'energy' ? 120 : 100;
}

function manualShareFor(area: V3PreparationArea, instrumentId: string): number {
  if (area === 'warmup' && instrumentId === 'ai_bot') return 0;
  if (area === 'warmup' && instrumentId === 'simple_bot') return 0.2;
  if (area === 'warmup' && instrumentId === 'auto_webinar') return 0.12;
  if (area === 'sales' && instrumentId === 'website') return 0.25;
  if (area === 'sales' && instrumentId === 'auto_webinar') return WEBINAR_MESSAGE_CONVERSION;
  return 0.55;
}

function autoSalesShareFor(area: V3PreparationArea, instrumentId: string): number {
  if (area === 'warmup' && instrumentId === 'auto_webinar') return 0.08;
  return 0;
}

function countHiddenAutoAudience(total: number, rate: number, key: string): number {
  if (total <= 0 || rate <= 0) return 0;
  return Math.min(total, Math.max(0, stochasticRound(total * clampConversion(rate), key)));
}

function warmupAutoAudienceRate(state: GameState, warmup: ActiveDef): number {
  if (!warmup.key.includes('auto_webinar')) return 0;
  const product = stateProductContext(state);
  if (product.type === 'mentorship' || product.band === 'high') return 0.22;
  if (product.type === 'live_course' && product.price >= 50_000) return 0.25;
  if (product.type === 'live_course') return 0.30;
  if (product.type === 'service' || product.type === 'consultation') return 0.32;
  if (product.band === 'mid') return 0.36;
  return 0.42;
}

function effectiveWarmupAutoPurchaseConversion(state: GameState, warmup: ActiveDef, bonus: number): number {
  const baseShare = Math.max(0, warmup.autoSalesShare ?? 0);
  if (baseShare <= 0 || !warmup.key.includes('auto_webinar')) return baseShare;

  const product = stateProductContext(state);
  return clampConversion(Math.min(baseShare, maxWarmupAutoPurchaseConversion(product)) * bonus);
}

function maxWarmupAutoPurchaseConversion(product: V3ProductContext): number {
  if (product.type === 'mentorship' || product.band === 'high') return 0.015;
  if (product.type === 'live_course' && product.price >= 50_000) return 0.02;
  if (product.type === 'live_course') return 0.035;
  if (product.type === 'service' || product.type === 'consultation') return 0.04;
  if (product.band === 'mid') return 0.05;
  return 0.08;
}

function salesAutoAudienceRate(state: GameState, sales: ActiveDef): number {
  const product = stateProductContext(state);
  if (sales.key.includes('website')) {
    if (product.type === 'mentorship' || product.band === 'high') return 0.38;
    if (product.type === 'live_course' && product.price >= 50_000) return 0.50;
    if (product.band === 'mid') return 0.65;
    return 0.82;
  }
  if (sales.key.includes('auto_webinar')) {
    if (product.type === 'mentorship' || product.band === 'high') return 0.25;
    if (product.type === 'live_course' && product.price >= 50_000) return 0.32;
    if (product.band === 'mid') return 0.45;
    return 0.58;
  }
  return 0;
}

function effectiveSalesAutoPurchaseConversion(state: GameState, sales: ActiveDef, bonus: number): number {
  if (!sales.key.includes('website') && !sales.key.includes('auto_webinar')) return 0;
  const baseConversion = effectiveSalesConversion(state, sales.baseConversion, bonus);
  return Math.min(baseConversion, maxSalesAutoPurchaseConversion(stateProductContext(state), sales.key));
}

function maxSalesAutoPurchaseConversion(product: V3ProductContext, key: string): number {
  const isWebinar = key.includes('auto_webinar');
  if (product.type === 'mentorship' || product.band === 'high') return isWebinar ? 0.045 : 0.04;
  if (product.type === 'live_course' && product.price >= 50_000) return isWebinar ? 0.06 : 0.055;
  if (product.type === 'live_course') return isWebinar ? 0.08 : 0.07;
  if (product.type === 'service' || product.type === 'consultation') return isWebinar ? 0.09 : 0.08;
  if (product.band === 'mid') return isWebinar ? 0.12 : 0.11;
  return 0.23;
}

function autoSalesMessageConversion(key: string): number {
  if (key.includes('website')) return SITE_MESSAGE_CONVERSION;
  if (key.includes('auto_webinar')) return WEBINAR_MESSAGE_CONVERSION;
  return 0;
}

function ensureV3AdviceState(state: GameState): void {
  state.v3.loopAdviceEffects = state.v3.loopAdviceEffects ?? {};
  state.v3.lastAdvice = state.v3.lastAdvice ?? null;
}

function applyAdviceEffect(state: GameState, category: V3AdviceCategory, option: V3AdviceOption): void {
  const precision = advicePrecision(option);
  if (!precision) return;
  const effect: V3AdviceEffect = {
    category,
    precision,
    multiplier: option === 'consult_10k' ? 1.10 : 1.05,
  };
  const current = state.v3.loopAdviceEffects[category];
  if (!current || effect.multiplier > current.multiplier) {
    state.v3.loopAdviceEffects[category] = effect;
  }
}

function advicePrecision(option: V3AdviceOption): V3AdvicePrecision | null {
  if (option === 'consult_5k') return 'rough';
  if (option === 'consult_10k') return 'exact';
  return null;
}

function adviceMultiplier(state: GameState, category: V3AdviceCategory): number {
  ensureV3AdviceState(state);
  return state.v3.loopAdviceEffects[category]?.multiplier ?? 1;
}

function isConversionKnown(state: GameState, kind: V3SelectionKind, ownKnown: boolean): boolean {
  const category = kind === 'ad' ? 'ads' : kind;
  return ownKnown || Boolean(state.v3.loopAdviceEffects[category]) || superpowerRevealsCategory(state.player.superpower, category);
}

function superpowerRevealsCategory(superpower: Superpower, category: V3AdviceCategory): boolean {
  if (superpower === 'ads') return category === 'ads';
  if (superpower === 'marketing') return category === 'warmup';
  if (superpower === 'sales') return category === 'sales';
  return false;
}

function superpowerMultiplier(superpower: Superpower, category: V3AdviceCategory): number {
  if (superpower === 'ads' && category === 'ads') return 1.16;
  if (superpower === 'marketing' && category === 'warmup') return 1.14;
  if (superpower === 'sales' && category === 'sales') return 1.14;
  return 1;
}

function buildAdviceResult(
  state: GameState,
  category: V3AdviceCategory,
  option: V3AdviceOption,
  cost: number,
): V3AdviceResult {
  const precision = advicePrecision(option);
  const topic = adviceTopic(category);
  const product = stateProductContext(state);
  return {
    category,
    option,
    cost,
    title: `${adviceOptionTitle(option)}: ${topic} по продукту "${product.label}"`,
    adviser: option === 'friend' ? 'Знакомый спец' : option === 'consult_5k' ? 'Профильный консультант' : 'Сильный стратег',
    paragraphs: adviceParagraphs(state, category, option),
    conversionRows: precision ? conversionRows(category, precision) : [],
    effectLines: adviceEffectLines(category, option),
    createdDay: state.resources.day,
  };
}

function adviceParagraphs(state: GameState, category: V3AdviceCategory, option: V3AdviceOption): string[] {
  const product = stateProductContext(state);
  const productLine = productAdviceLine(product);
  const priceLine = priceAdviceLine(product);
  const categoryLine = categoryAdviceLine(category, product);
  const selectedTool = adviceToolForCategory(product, category);
  const bundleLine = adviceBundleLine(product);
  const productGenitive = productGenitiveLabel(product);
  if (option === 'friend') {
    return [
      `Со стороны видно главное: "${product.label}" нельзя запускать как абстрактный продукт. ${productLine}`,
      `${categoryLine} Я бы начал с инструмента "${selectedTool}", но это общий совет без цифр и без точной связки.`,
      `Он дает направление, но не показывает, сколько денег вы теряете на этом участке и какой инструмент покупать первым.`,
    ];
  }
  if (option === 'consult_5k') {
    return [
      `Советую для продажи ${productGenitive} в разделе "${adviceTopic(category)}" использовать инструмент "${selectedTool}". ${productLine}`,
      `${categoryLine} Для вашего чека логика такая: ${priceLine}`,
      `Это примерная рекомендация на один участок воронки. Она помогает выбрать следующий ход, но еще не собирает всю связку рекламы, прогрева и продаж.`,
    ];
  }
  return [
    `Для продажи ${productGenitive} советую как рекламу выбрать "${adviceToolBundle(product).ads}", как прогрев - "${adviceToolBundle(product).warmup}", а как продажи - "${adviceToolBundle(product).sales}".`,
    `В выбранном разделе "${adviceTopic(category)}" главный инструмент для следующего шага - "${selectedTool}". ${adviceToolBundle(product).reason}`,
    `${productLine} ${priceLine} ${bundleLine}`,
  ];
}

function productGenitiveLabel(product: V3ProductContext): string {
  if (product.type === 'consultation') return 'ваших консультаций';
  if (product.type === 'service') return 'ваших услуг';
  if (product.type === 'recorded_course') return 'ваших уроков в записи';
  if (product.type === 'live_course') return 'вашего живого обучения';
  if (product.type === 'membership') return 'вашего клуба или подписки';
  if (product.type === 'mentorship') return 'вашего сопровождения';
  return `продукта "${product.label}"`;
}

function adviceToolBundle(product: V3ProductContext): AdviceToolBundle {
  if (product.type === 'consultation') {
    return {
      ads: 'Контент для рилс',
      warmup: 'Бот с ИИ',
      sales: 'Переписка',
      reason: 'Консультации часто покупают после узнавания боли: рилс дает поток, ИИ-бот быстро уточняет ситуацию, переписка закрывает на оплату без лишнего длинного созвона.',
    };
  }
  if (product.type === 'service') {
    return {
      ads: 'Контент для сторис',
      warmup: 'Обычный бот',
      sales: 'Созвон',
      reason: 'Услуге нужно доверие и понимание процесса: сторис дают теплое касание, бот собирает вводные, а созвон помогает показать план работы под кейс клиента.',
    };
  }
  if (product.type === 'recorded_course') {
    return {
      ads: 'Контент для сторис',
      warmup: 'Видеоурок',
      sales: 'Сайт',
      reason: 'Уроки в записи лучше продаются коротким путем: сторис дают теплый вход, видеоурок показывает первый результат, сайт быстро доводит до оплаты.',
    };
  }
  if (product.type === 'live_course') {
    return {
      ads: 'Контент для рилс',
      warmup: 'Автовебинар',
      sales: 'Созвон',
      reason: 'Живому обучению нужны охват, дедлайн и доверие: рилс приводит новых людей, автовебинар объясняет программу, созвон закрывает сомнения.',
    };
  }
  if (product.type === 'membership') {
    return {
      ads: 'Контент для ТГ-канала',
      warmup: 'Гайд / лендинг',
      sales: 'Автовебинар',
      reason: 'Подписке нужен понятный первый результат и регулярная польза: ТГ хорошо греет аудиторию, гайд дает быстрый вход, автовебинар продает формат без ручной переписки на каждого.',
    };
  }
  if (product.type === 'mentorship') {
    return {
      ads: 'Внешняя реклама',
      warmup: 'Бот с ИИ',
      sales: 'Созвон',
      reason: 'Сопровождение с высоким чеком требует квалификации: реклама дает масштаб, ИИ-бот отсекает случайных людей, созвон продает личную работу и рамки результата.',
    };
  }
  return {
    ads: 'Контент для рилс',
    warmup: 'Бот с ИИ',
    sales: 'Переписка',
    reason: 'Эта связка дает поток, быструю обработку и короткий путь до оплаты.',
  };
}

function adviceToolForCategory(product: V3ProductContext, category: V3AdviceCategory): string {
  const bundle = adviceToolBundle(product);
  if (category === 'ads') return bundle.ads;
  if (category === 'warmup') return bundle.warmup;
  return bundle.sales;
}

function adviceBundleLine(product: V3ProductContext): string {
  const bundle = adviceToolBundle(product);
  return `Итоговая связка: реклама - ${bundle.ads}; прогрев - ${bundle.warmup}; продажи - ${bundle.sales}.`;
}

function productAdviceLine(product: V3ProductContext): string {
  if (product.type === 'mentorship') return 'Сопровождение продается через доверие, разбор ситуации и ощущение, что эксперт доведет до результата лично.';
  if (product.type === 'consultation') return 'Консультация покупается, когда человек узнает свою боль и верит, что за один контакт получит ясность.';
  if (product.type === 'service') return 'Услуга покупается, когда лид видит свой кейс, понятный процесс и снижение риска.';
  if (product.type === 'recorded_course') return 'Курс в записи требует простого обещания и доказательства, что человек не останется один с уроками.';
  if (product.type === 'live_course') return 'Живое обучение держится на дедлайне, группе, программе и доверии к результату.';
  if (product.type === 'membership') return 'Подписка продается через быстрый первый результат и ощущение постоянной пользы.';
  return 'У продукта должен быть свой маршрут от первого касания до оплаты.';
}

function priceAdviceLine(product: V3ProductContext): string {
  if (product.band === 'low') {
    return `Чек ${formatEngineMoney(product.price)} требует объема и скорости: длинная ручная продажа легко съедает экономику.`;
  }
  if (product.band === 'high') {
    return `Чек ${formatEngineMoney(product.price)} требует доверия, квалификации и сильной продажи: случайные охваты без прогрева почти не конвертируются.`;
  }
  return `Чек ${formatEngineMoney(product.price)} уже достаточно заметный: нужны и понятный прогрев, и нормальная обработка возражений.`;
}

function categoryAdviceLine(category: V3AdviceCategory, product: V3ProductContext): string {
  if (category === 'ads') {
    if (product.band === 'high') return 'В рекламе важнее не максимум просмотров, а поток людей, которые узнают дорогую боль и готовы к разговору.';
    if (product.type === 'membership' || product.type === 'recorded_course') return 'В рекламе нужна простая причина кликнуть прямо сейчас: быстрый результат, пробный шаг или понятный лид-магнит.';
    return 'В рекламе нужно проверять не только охваты, а стоимость перехода в лид и качество людей после клика.';
  }
  if (category === 'warmup') {
    if (product.band === 'high') return 'В прогреве надо не развлекать, а довести человека до мысли: "мне нужен разбор, сам не вывезу".';
    if (product.type === 'membership') return 'В прогреве подписки надо показать первый результат до оплаты и объяснить, зачем оставаться дальше.';
    return 'В прогреве главная задача - превратить интерес в заявку, а не просто выдать полезный контент.';
  }
  if (product.band === 'high') return 'В продажах высокий чек требует сценария: диагностика, боль, результат, рамки работы и следующий шаг.';
  if (product.type === 'recorded_course' || product.type === 'membership') return 'В продажах низкого чека важна короткая дорога к оплате без лишних касаний.';
  return 'В продажах нельзя говорить со всеми одинаково: возражения зависят от продукта, чека и уровня доверия.';
}

function adviceEffectLines(category: V3AdviceCategory, option: V3AdviceOption): string[] {
  if (option === 'friend') return ['Вы получили общий ориентир. Бонус к конверсии не начислен.'];
  const topic = adviceTopicPrepositional(category);
  const resultTopic = adviceTopicGenitive(category);
  const precision = option === 'consult_5k' ? 'примерные' : 'более точные';
  const bonus = option === 'consult_5k' ? '5%' : '10%';
  return [
    `Теперь вам видны ${precision} конверсии по ${topic}.`,
    `Результативность ${resultTopic} стала выше на ${bonus}.`,
  ];
}

function conversionRows(category: V3AdviceCategory, precision: V3AdvicePrecision): V3AdviceResult['conversionRows'] {
  const approx = precision === 'rough';
  if (category === 'ads') {
    return [
      { label: 'Сторис -> лид', value: approx ? 'около 10-14%' : '10-14%', note: 'примерно 20 сторис по 300-400 показов' },
      { label: 'Рилс -> лид', value: approx ? 'около 1%' : '1-1,3%', note: 'может резко выстрелить по показам' },
      { label: 'ТГ-контент -> лид', value: approx ? 'около 10-14%' : '10-14%', note: 'меньше показов, выше конверсия' },
      { label: 'Внешняя реклама -> лид', value: approx ? 'около 1%' : '1-1,3%', note: 'ровнее, но дороже' },
    ];
  }
  if (category === 'warmup') {
    return [
      { label: 'Ручной прогрев -> интерес', value: approx ? 'около 16%' : '14-18%' },
      { label: 'Гайд -> интерес', value: approx ? 'около 10-15%' : '10-15%' },
      { label: 'Обычный бот -> интерес', value: approx ? 'около 14-18%' : '14-18%' },
      { label: 'ИИ-бот -> интерес', value: approx ? 'около 20-27%' : '20-27%' },
      { label: 'Видеоурок -> интерес', value: approx ? 'около 16-21%' : '16-21%' },
      { label: 'Автовебинар -> заявка', value: approx ? 'около 14-19%' : '14-19%', note: 'автопокупки считаются отдельно от скрытой группы зрителей и зависят от чека' },
    ];
  }
  return [
    { label: 'По наитию -> покупка', value: approx ? 'около 10%' : '8-12%' },
    { label: 'Переписка -> покупка', value: approx ? 'около 14%' : '14-20%' },
    { label: 'Созвон -> покупка', value: approx ? 'около 20%' : '20-28%' },
    { label: 'Сайт -> покупка', value: approx ? 'около 16%' : '16-23%', note: 'прямые покупки считаются от скрытой группы посетителей и снижаются на высоком чеке' },
    { label: 'Продажный автовебинар -> покупка', value: approx ? 'около 14%' : '14-19%', note: 'покупки считаются среди зрителей; часть не купивших пишет в переписку' },
  ];
}

function adviceTopic(category: V3AdviceCategory): string {
  if (category === 'ads') return 'реклама';
  if (category === 'warmup') return 'прогрев';
  return 'продажи';
}

function adviceTopicPrepositional(category: V3AdviceCategory): string {
  if (category === 'ads') return 'рекламе';
  if (category === 'warmup') return 'прогреву';
  return 'продажам';
}

function adviceTopicGenitive(category: V3AdviceCategory): string {
  if (category === 'ads') return 'рекламы';
  if (category === 'warmup') return 'прогрева';
  return 'продаж';
}

function adviceOptionTitle(option: V3AdviceOption): string {
  if (option === 'friend') return 'Совет знакомого спеца';
  if (option === 'consult_5k') return 'Консультация за 5 000 ₽';
  return 'Консультация за 10 000 ₽';
}

export function clampV3Energy(state: GameState): void {
  state.resources.energy = clamp(state.resources.energy, 0, maxEnergy(state.player.superpower));
}
