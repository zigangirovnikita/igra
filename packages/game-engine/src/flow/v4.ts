import type {
  GameConfig,
  GameState,
  V4ProductType,
} from '../types';
import type { V4Execution, V4InstrumentId, V4OfferMode } from '../v4/types';
import {
  getV4Instrument,
  makeV4Stage,
  tutorialV4Funnel,
  V4_STARTING_BANK,
  V4_STARTING_ENERGY,
} from '../v4/config';
import { simulateV4Attempt } from '../v4/simulate';

const PRODUCT_TYPES: V4ProductType[] = ['consultation', 'service', 'recorded_course', 'live_course', 'mentorship', 'membership'];

export function setV4Dream(state: GameState, dream: { dreamId: string; title: string; price: number; custom?: boolean }): GameState {
  ensureV4(state);
  if (!dream.title.trim() || dream.price < 1_000) throw new Error('Некорректная мечта');
  state.v4.dream = { id: dream.dreamId, title: dream.title.trim(), price: Math.floor(dream.price), custom: dream.custom };
  state.targets.personalGoal = state.v4.dream.price;
  state.flow.step = 'v4_product';
  return state;
}

export function setV4Product(state: GameState, productType: V4ProductType): GameState {
  ensureV4(state);
  if (!PRODUCT_TYPES.includes(productType)) throw new Error('Некорректный продукт');
  state.v4.productType = productType;
  state.launchPlan.productType = productType;
  state.flow.step = 'v4_price';
  return state;
}

export function setV4Price(state: GameState, config: GameConfig, productPrice: number): GameState {
  ensureV4(state);
  if (!Number.isInteger(productPrice) || productPrice < 1_000 || productPrice > 5_000_000) {
    throw new Error('Некорректная цена продукта');
  }
  state.v4.productPrice = productPrice;
  state.launchPlan.productPrice = productPrice;
  state.targets.targetRevenue = Math.max(config.goals.lowTicketMinimumRevenue, state.v4.dream?.price ?? 0);
  state.flow.step = state.v4.tutorialCompleted ? 'v4_builder' : 'v4_tutorial_intro';
  return state;
}

export function startV4Tutorial(state: GameState): GameState {
  ensureReadyForAttempt(state);
  state.v4.activeAttempt = makeAttempt(state, 'tutorial', tutorialV4Funnel());
  state.flow.step = 'v4_minigame';
  return state;
}

export function setV4FunnelLength(state: GameState, length: number): GameState {
  ensureV4(state);
  const safeLength = Math.max(2, Math.min(6, Math.floor(length)));
  const next = state.v4.funnel.slice(0, safeLength);
  while (next.length < safeLength) {
    next.push(makeV4Stage(`stage-${next.length + 1}`, 'guide', 'self', 'free', null, 1));
  }
  state.v4.funnel = next.map((stage, index) => ({ ...stage, id: `stage-${index + 1}` }));
  return state;
}

export function configureV4FunnelStage(
  state: GameState,
  payload: { index: number; instrumentId: V4InstrumentId; execution: V4Execution; offerMode: V4OfferMode; tripwirePrice?: number | null; volume?: number },
): GameState {
  ensureV4(state);
  const index = Math.floor(payload.index);
  if (index < 0 || index >= state.v4.funnel.length) throw new Error('Некорректный номер этапа');
  const instrument = getV4Instrument(payload.instrumentId);
  if (index === 0 && instrument.kind !== 'traffic') {
    throw new Error('А как люди узнают, что вы это делаете? Первый шаг — всегда реклама.');
  }
  const execution = payload.execution;
  const limits = instrument[execution];
  const volume = Math.max(1, Math.min(payload.volume ?? 1, payload.instrumentId === 'paid_ads' ? V4_STARTING_BANK : limits.maxVolume));
  const offerMode = instrument.kind === 'sales'
    ? 'main_product'
    : instrument.supportsTripwire
      ? payload.offerMode
      : 'free';
  const tripwirePrice = offerMode === 'tripwire' ? Math.max(100, Math.floor(payload.tripwirePrice ?? 1_000)) : null;
  state.v4.funnel[index] = makeV4Stage(`stage-${index + 1}`, payload.instrumentId, execution, offerMode, tripwirePrice, Math.floor(volume));
  return state;
}

export function startV4Attempt(state: GameState): GameState {
  ensureReadyForAttempt(state);
  state.v4.activeAttempt = makeAttempt(state, 'custom', state.v4.funnel);
  state.flow.step = 'v4_minigame';
  return state;
}

export function finishV4Attempt(state: GameState, manualActions = 0): GameState {
  ensureReadyForAttempt(state);
  const active = state.v4.activeAttempt;
  if (!active) throw new Error('Нет активной попытки');
  const report = simulateV4Attempt({
    seed: active.seed,
    mainProductPrice: state.v4.productPrice ?? 0,
    dreamPrice: state.v4.dream?.price ?? 0,
    stages: active.stages,
    startingBank: active.startingBank,
    startingEnergy: active.startingEnergy,
    manualActions,
  });
  state.v4.lastReport = report;
  state.v4.reportHistory.push(report);
  state.v4.activeAttempt = null;
  state.v4.tutorialCompleted = true;
  state.v4.attemptNumber += 1;
  state.resources.bank = Math.max(0, Math.min(V4_STARTING_BANK, report.bankRemaining));
  state.resources.energy = report.energyRemaining;
  state.metrics.expenses = V4_STARTING_BANK - state.resources.bank;
  state.flow.step = 'v4_result';
  return state;
}

export function startNextV4Attempt(state: GameState, changeProduct = false): GameState {
  ensureV4(state);
  state.resources.bank = V4_STARTING_BANK;
  state.resources.energy = V4_STARTING_ENERGY;
  state.metrics.expenses = 0;
  state.v4.activeAttempt = null;
  state.v4.lastReport = null;
  state.v4.detailsOpen = false;
  state.flow.step = changeProduct ? 'v4_product' : 'v4_builder';
  return state;
}

export function toggleV4Details(state: GameState): GameState {
  ensureV4(state);
  state.v4.detailsOpen = !state.v4.detailsOpen;
  return state;
}

function makeAttempt(state: GameState, mode: 'tutorial' | 'custom', stages: GameState['v4']['funnel']): GameState['v4']['activeAttempt'] {
  const now = new Date().toISOString();
  return {
    id: `${mode}-${state.v4.attemptNumber + 1}`,
    mode,
    seed: `${state.seed}:${mode}:${state.v4.attemptNumber + 1}`,
    startedAt: now,
    expiresAt: new Date(Date.parse(now) + 60_000).toISOString(),
    durationSeconds: 60,
    startingBank: V4_STARTING_BANK,
    startingEnergy: V4_STARTING_ENERGY,
    stages: structuredClone(stages),
  };
}

function ensureV4(state: GameState): void {
  if (state.flow.stage !== 'v4') throw new Error('Команда доступна только в v4');
}

function ensureReadyForAttempt(state: GameState): void {
  ensureV4(state);
  if (!state.v4.dream || !state.v4.productType || !state.v4.productPrice) {
    throw new Error('Сначала выберите мечту, продукт и цену');
  }
}
