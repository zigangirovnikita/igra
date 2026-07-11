import type { GameState, NurtureType, ProcessingType, SaleMethod } from '../types';
import { clamp } from '../state/invariants';

export function demandMultiplier(state: GameState): number {
  return 0.8 + 0.35 * state.assets.demandConfidence;
}

export function lowEnergyContentMultiplier(state: GameState): number {
  return state.resources.energy < 30 ? 0.85 : 1;
}

export function lowEnergyManualMultiplier(state: GameState): number {
  return state.resources.energy < 30 ? 0.8 : 1;
}

export function nurtureMultiplier(nurture: NurtureType[]): number {
  const values = nurture.map((item) => {
    if (item === 'guide') return 1.47;
    if (item === 'video_lesson') return 2.13;
    if (item === 'telegram') return 1.6;
    if (item === 'webinar') return 2.2;
    return 1;
  });
  const strongest = Math.max(...values);
  const extras = values.filter((value) => value !== strongest).reduce((sum, value) => sum + (value - 1) * 0.3, 0);
  return Math.min(strongest + extras, 2.6);
}

export function processingQuality(processing: ProcessingType): number {
  if (processing === 'simple_bot') return 1.15;
  if (processing === 'ai_bot') return 1.45;
  if (processing === 'manager') return 1.2;
  if (processing === 'website_auto') return 0.9;
  return 1;
}

export function baseSaleRate(price: number, method: SaleMethod): number {
  const bucket =
    price <= 10_000 ? [0.05, 0.075, 0.115, 0.25, 0.085] :
    price <= 30_000 ? [0.035, 0.05, 0.075, 0.23, 0.07] :
    price <= 100_000 ? [0.02, 0.035, 0.05, 0.18, 0.055] :
    price <= 200_000 ? [0.009, 0.0165, 0.02, 0.13, 0.035] :
    [0.004, 0.0075, 0.009, 0.08, 0.02];
  const index = method === 'website_auto' ? 0 : method === 'bot_auto' ? 1 : method === 'manual_chat' ? 2 : method === 'call' ? 3 : 4;
  return bucket[index];
}

export function saleModifier(state: GameState, method: SaleMethod): number {
  let multiplier = state.assets.productQuality || 1;
  const productPrice = state.launchPlan.productPrice || 0;
  
  if (!state.activeRoute.nurture.length || state.activeRoute.nurture.includes('none')) {
    if (productPrice > 30_000) multiplier *= 0.8;
  }
  
  if (state.activeRoute.nurture.includes('guide')) multiplier *= 1.05;
  if (state.activeRoute.nurture.includes('video_lesson')) multiplier *= 1.15;
  if (state.activeRoute.nurture.includes('webinar')) multiplier *= 1.25;
  if (state.activeRoute.processing === 'ai_bot') multiplier *= 1.2;
  
  if (method === 'website_auto' && productPrice > 200_000) multiplier *= 0.4;
  else if (method === 'website_auto' && productPrice > 100_000) multiplier *= 0.6;
  
  if (state.resources.energy < 30 && (method === 'call' || method === 'manual_chat')) multiplier *= 0.8;
  
  return clamp(multiplier, 0, 8);
}
