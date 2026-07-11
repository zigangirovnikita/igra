import type { GameState, GameConfig, RouteSelection, ContentType, AudienceChannel } from '../types';
import { calculateTargets } from '../state/goals';

export function advanceIntro(state: GameState): GameState {
  if (state.flow.step === 'intro_budget') {
    state.flow.step = 'intro_beach';
  } else if (state.flow.step === 'intro_beach') {
    state.flow.stage = 'day1_plan';
    state.flow.step = 'day1_product_type';
  }
  return state;
}

export function setProductType(state: GameState, config: GameConfig, productType: string): GameState {
  state.launchPlan.productType = productType;
  state.flow.step = 'day1_product_name';
  return state;
}

export function setProductName(state: GameState, productName: string): GameState {
  state.launchPlan.productName = productName;
  state.flow.step = 'day1_product_price';
  return state;
}

export function setProductPrice(state: GameState, config: GameConfig, productPrice: number): GameState {
  state.launchPlan.productPrice = productPrice;
  state.targets = calculateTargets(productPrice, state.launchPlan.dreams, config);
  state.flow.step = 'day1_sale_method';
  return state;
}

export function setSaleMethod(state: GameState, saleMethod: RouteSelection['saleMethod']): GameState {
  state.launchPlan.plannedSaleMethod = saleMethod;
  state.flow.step = 'day1_nurture';
  return state;
}

export function setNurture(state: GameState, nurture: RouteSelection['nurture'], uncertain?: boolean): GameState {
  state.launchPlan.plannedNurture = nurture;
  state.launchPlan.nurtureUncertain = !!uncertain;
  state.flow.step = 'day1_entry_point';
  return state;
}

export function setEntryPoint(state: GameState, entryPoint: RouteSelection['entry']): GameState {
  state.launchPlan.plannedEntry = entryPoint;
  state.flow.step = 'day1_business_goal';
  return state;
}

export function advanceDay1Goal(state: GameState): GameState {
  state.flow.step = 'day1_dreams';
  return state;
}

export function setDreams(state: GameState, config: GameConfig, dreams: string[]): GameState {
  state.launchPlan.dreams = dreams;
  state.targets = calculateTargets(state.launchPlan.productPrice || 0, dreams, config);
  state.flow.step = 'day1_summary';
  return state;
}

export function completeDayOne(state: GameState): GameState {
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
  state.flow.step = 'day2_channels';
  return state;
}

export function setChannels(state: GameState, channels: AudienceChannel[]): GameState {
  state.audience.channels = channels;
  state.flow.step = 'day2_metrics';
  return state;
}

export function setAudienceMetrics(state: GameState, metrics: { reels?: number; stories?: number; telegram?: number; contacts?: number }): GameState {
  if (metrics.reels !== undefined) state.audience.averageReelViews = metrics.reels;
  if (metrics.stories !== undefined) state.audience.averageStoryViews = metrics.stories;
  if (metrics.telegram !== undefined) state.audience.averageTelegramViews = metrics.telegram;
  if (metrics.contacts !== undefined) state.audience.contactsCount = metrics.contacts;
  state.flow.step = 'day2_summary';
  return state;
}

export function completeDayTwo(state: GameState): GameState {
  state.audience.confirmed = true;
  state.flow.stage = 'daily';
  state.flow.step = 'daily_intro';
  state.resources.day = 3;
  return state;
}
