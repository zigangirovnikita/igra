import type { GameConfig, GameState, LeadCohort, SaleMethod } from '../types';
import { keyedRandomMultiplier, stochasticRound } from '../random/keyed';
import { clamp } from '../state/invariants';
import { baseSaleRate, demandMultiplier, lowEnergyManualMultiplier, nurtureMultiplier, processingQuality, saleModifier } from './modifiers';

export function processCohort(state: GameState, config: GameConfig, cohort: LeadCohort): LeadCohort {
  if (cohort.sourceType === 'webinar') {
    return processWebinar(state, config, cohort);
  }
  const next = { ...cohort };
  const route = next.routeSnapshot;
  const entryRate = route.entry === 'direct_messages' ? 1 : route.entry === 'website' ? 0.6 : 0.7;
  next.activated = next.responses * entryRate;

  const processingRate = route.processing === 'simple_bot' ? 0.8 : route.processing === 'ai_bot' ? 0.99 : route.processing === 'manager' ? 0.95 : 1;
  if (route.processing === 'manual') {
    const capacity = (state.player.superpowers.includes('energy') ? 25 : 15) * lowEnergyManualMultiplier(state);
    next.processed = Math.min(next.activated, capacity);
  } else {
    next.processed = next.activated * processingRate;
  }
  next.unprocessedWarm = Math.max(0, next.activated - next.processed);

  const applicationRate = clamp(
    0.075 *
      nurtureMultiplier(route.nurture) *
      processingQuality(route.processing) *
      demandMultiplier(state) *
      keyedRandomMultiplier(state.seed, config, next.id, 'application'),
    0,
    0.45
  );
  next.applications = next.processed * applicationRate;
  applySales(state, config, next, route.saleMethod);
  return applyCapacity(state, config, next);
}

export function applySales(state: GameState, config: GameConfig, cohort: LeadCohort, method: SaleMethod): void {
  const rate = clamp(
    baseSaleRate(state.player.productPrice, method) *
      saleModifier(state, method) *
      keyedRandomMultiplier(state.seed, config, cohort.id, `sale_${method}`),
    0,
    0.6
  );
  if (method === 'call') {
    cohort.bookedCalls = cohort.applications * 0.75;
    cohort.heldCalls = cohort.bookedCalls * 0.75;
    cohort.sales = stochasticRound(cohort.heldCalls * rate, `${state.seed}|${cohort.id}|round_call_sales`);
    cohort.considering = Math.max(0, cohort.heldCalls - cohort.sales) * 0.35;
  } else {
    const eligible = method === 'manual_chat' ? cohort.processed : cohort.applications;
    cohort.sales = stochasticRound(eligible * rate, `${state.seed}|${cohort.id}|round_${method}_sales`);
    cohort.considering = Math.max(0, eligible - cohort.sales) * 0.35;
  }
}

export function applyFollowup(state: GameState, config: GameConfig, cohort: LeadCohort): LeadCohort {
  if (cohort.followedUp || cohort.considering <= 0 || cohort.routeSnapshot.followup === 'none') return cohort;
  const next = { ...cohort, followedUp: true };
  const returnRate =
    next.routeSnapshot.followup === 'manual' && state.player.superpowers.includes('sales') ? 0.13 :
    next.routeSnapshot.followup === 'manual' ? 0.1 :
    next.routeSnapshot.followup === 'bot' ? 0.15 :
    0.01;
  const returned = next.considering * returnRate;
  const before = next.sales;
  const method = next.routeSnapshot.saleMethod;
  const rate = clamp(baseSaleRate(state.player.productPrice, method) * saleModifier(state, method) * 1.25, 0, 0.6);
  next.sales += stochasticRound(returned * rate, `${state.seed}|${next.id}|followup_sales`);
  if (next.sales > before) {
    next.considering = Math.max(0, next.considering - returned);
  }
  return applyCapacity(state, config, next);
}

function processWebinar(state: GameState, config: GameConfig, cohort: LeadCohort): LeadCohort {
  const next = { ...cohort };
  const registrations = next.impressions * 0.035 * demandMultiplier(state);
  const attendees = registrations * 0.45;
  const directRate = clamp(0.05 * saleModifier(state, 'webinar_direct') * keyedRandomMultiplier(state.seed, config, next.id, 'webinar_sale'), 0, 0.6);
  const directSales = stochasticRound(attendees * directRate, `${state.seed}|${next.id}|round_webinar_direct`);
  const remainingAttendees = Math.max(0, attendees - directSales);
  next.activated = registrations;
  next.processed = attendees;
  next.applications = remainingAttendees * 0.2 * keyedRandomMultiplier(state.seed, config, next.id, 'webinar_application');
  next.sales = directSales;
  next.considering = Math.max(0, remainingAttendees - next.applications) * 0.35;
  return applyCapacity(state, config, next);
}

function applyCapacity(state: GameState, config: GameConfig, cohort: LeadCohort): LeadCohort {
  const product = config.productTypes.find((item) => item.id === state.player.productType);
  const capacity = product?.capacity ?? null;
  if (capacity === null) return cohort;
  const existingSales = state.cohorts.filter((item) => item.id !== cohort.id).reduce((sum, item) => sum + item.sales, 0);
  const remaining = Math.max(0, capacity - existingSales);
  if (cohort.sales > remaining) {
    cohort.capacityLostLeads += cohort.sales - remaining;
    cohort.sales = remaining;
  }
  return cohort;
}
