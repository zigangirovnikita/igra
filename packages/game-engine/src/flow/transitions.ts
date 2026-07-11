import type { GameState, GameConfig, RouteSelection, AudienceChannel } from '../types';
import { calculateTargets } from '../state/goals';

function requireStep(state: GameState, step: GameState['flow']['step']): void {
  if (state.flow.step !== step) throw new Error(`Invalid flow step: expected ${step}, got ${state.flow.step}`);
}

export function advanceIntro(state: GameState): GameState {
  if (state.flow.step === 'intro_budget') {
    state.flow.step = 'intro_beach';
  } else if (state.flow.step === 'intro_beach') {
    state.flow.stage = 'day1_plan';
    state.flow.step = 'day1_product_type';
  } else throw new Error(`Invalid flow step: ${state.flow.step}`);
  return state;
}

export function setProductType(state: GameState, config: GameConfig, productType: string): GameState {
  requireStep(state, 'day1_product_type');
  state.launchPlan.productType = productType;
  state.flow.step = 'day1_product_name';
  return state;
}

export function setProductName(state: GameState, productName: string): GameState {
  requireStep(state, 'day1_product_name');
  state.launchPlan.productName = productName;
  state.flow.step = 'day1_product_price';
  return state;
}

export function setProductPrice(state: GameState, config: GameConfig, productPrice: number): GameState {
  requireStep(state, 'day1_product_price');
  state.launchPlan.productPrice = productPrice;
  state.targets = calculateTargets(productPrice, state.launchPlan.dreams, config);
  state.flow.step = 'day1_sale_method';
  return state;
}

export function setSaleMethod(state: GameState, saleMethod: RouteSelection['saleMethod']): GameState {
  requireStep(state, 'day1_sale_method');
  state.launchPlan.plannedSaleMethod = saleMethod;
  state.flow.step = 'day1_nurture';
  return state;
}

export function setNurture(state: GameState, nurture: RouteSelection['nurture'], uncertain?: boolean): GameState {
  requireStep(state, 'day1_nurture');
  state.launchPlan.plannedNurture = nurture;
  state.launchPlan.nurtureUncertain = !!uncertain;
  state.flow.step = 'day1_entry_point';
  return state;
}

export function setEntryPoint(state: GameState, entryPoint: RouteSelection['entry']): GameState {
  requireStep(state, 'day1_entry_point');
  state.launchPlan.plannedEntry = entryPoint;
  state.flow.step = 'day1_business_goal';
  return state;
}

export function advanceDay1Goal(state: GameState): GameState {
  requireStep(state, 'day1_business_goal');
  state.flow.step = 'day1_dreams';
  return state;
}

export function backToDay1Price(state: GameState): GameState {
  requireStep(state, 'day1_business_goal');
  state.flow.step = 'day1_product_price';
  return state;
}

export function setDreams(state: GameState, config: GameConfig, dreams: string[]): GameState {
  requireStep(state, 'day1_dreams');
  state.launchPlan.dreams = dreams;
  state.targets = calculateTargets(state.launchPlan.productPrice || 0, dreams, config);
  state.flow.step = 'day1_summary';
  return state;
}

export function editDay1Plan(state: GameState): GameState {
  requireStep(state, 'day1_summary');
  state.launchPlan.confirmed = false;
  state.flow.step = 'day1_product_type';
  return state;
}

export function completeDayOne(state: GameState): GameState {
  requireStep(state, 'day1_summary');
  state.launchPlan.confirmed = true;
  state.activeRoute = {
    entry: state.launchPlan.plannedEntry || 'direct_messages',
    nurture: state.launchPlan.plannedNurture,
    processing: 'manual',
    saleMethod: state.launchPlan.plannedSaleMethod || 'manual_chat',
    followup: 'none'
  };
  state.initialRoute = state.activeRoute;

  state.flow.stage = 'day2_resources';
  state.flow.step = 'day2_intro';
  state.resources.day = 2;
  return state;
}

export function advanceDay2Intro(state: GameState): GameState {
  requireStep(state, 'day2_intro');
  state.flow.step = 'day2_channels';
  return state;
}

export function setChannels(state: GameState, channels: AudienceChannel[]): GameState {
  requireStep(state, 'day2_channels');
  state.audience.channels = channels.filter((channel, index, arr) => arr.indexOf(channel) === index);
  state.flow.step = 'day2_metrics';
  return state;
}

export function setAudienceMetrics(state: GameState, metrics: { reels?: number; stories?: number; telegram?: number; contacts?: number }): GameState {
  requireStep(state, 'day2_metrics');
  if (metrics.reels !== undefined) state.audience.averageReelViews = metrics.reels;
  if (metrics.stories !== undefined) state.audience.averageStoryViews = metrics.stories;
  if (metrics.telegram !== undefined) state.audience.averageTelegramViews = metrics.telegram;
  if (metrics.contacts !== undefined) state.audience.contactsCount = metrics.contacts;
  state.flow.step = 'day2_summary';
  return state;
}

export function editDay2Resources(state: GameState): GameState {
  requireStep(state, 'day2_summary');
  state.audience.confirmed = false;
  state.flow.step = 'day2_channels';
  return state;
}

export function completeDayTwo(state: GameState): GameState {
  requireStep(state, 'day2_summary');
  state.audience.confirmed = true;
  state.flow.stage = 'daily';
  state.flow.step = 'daily_intro';
  state.resources.day = 3;
  return state;
}
