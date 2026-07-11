import type { GameConfig, GameState, LeadCohort, SaleMethod } from '../types';
import { keyedRandomMultiplier, stochasticRound } from '../random/keyed';
import { clamp } from '../state/invariants';
import { baseSaleRate, demandMultiplier, lowEnergyManualMultiplier, nurtureMultiplier, processingQuality, saleModifier } from './modifiers';

export function applyEntry(state: GameState, config: GameConfig, cohort: LeadCohort): LeadCohort {
  if (cohort.sourceType === 'webinar') {
    return processWebinar(state, config, cohort);
  }
  const next = { ...cohort };
  const route = next.routeSnapshot;
  const entryRate = route.entry === 'direct_messages' ? 1 : route.entry === 'website' ? 0.6 : 0.7;
  next.activated = stochasticRound(next.responses * entryRate, `${state.seed}|${next.id}|activated`);
  next.unprocessedInbound = next.activated;

  if (route.processing !== 'manual') {
    return applyProcessing(state, config, next, 'auto');
  }
  return next;
}

export function applyProcessing(
  state: GameState, 
  config: GameConfig, 
  cohort: LeadCohort, 
  mode: 'auto' | 'manual', 
  manualAmount?: number
): LeadCohort {
  if (cohort.unprocessedInbound <= 0) return cohort;
  const next = { ...cohort };
  const route = next.routeSnapshot;
  
  let toProcess = 0;
  if (mode === 'auto') {
    toProcess = next.unprocessedInbound;
  } else {
    toProcess = Math.min(next.unprocessedInbound, (manualAmount ?? 0) * lowEnergyManualMultiplier(state));
  }
  
  const processingRate = route.processing === 'simple_bot' ? 0.8 : route.processing === 'ai_bot' ? 0.99 : route.processing === 'manager' ? 0.95 : 1;
  
  const successfullyProcessed = stochasticRound(toProcess * processingRate, `${state.seed}|${next.id}|processed_${state.resources.day}`);
  
  next.unprocessedInbound = Math.max(0, next.unprocessedInbound - toProcess);
  next.processed += successfullyProcessed;
  
  const applicationRate = clamp(
    0.075 *
      nurtureMultiplier(route.nurture) *
      processingQuality(route.processing) *
      demandMultiplier(state) *
      keyedRandomMultiplier(state.seed, config, next.id, `app_${state.resources.day}`),
    0,
    0.45
  );
  
  const newApplications = stochasticRound(successfullyProcessed * applicationRate, `${state.seed}|${next.id}|apps_${state.resources.day}`);
  next.applications += newApplications;
  next.unprocessedApplications += newApplications;
  
  if (route.saleMethod !== 'manual_chat' && route.saleMethod !== 'call') {
    return applySales(state, config, next, route.saleMethod, newApplications);
  }
  
  return next;
}

export function applySales(
  state: GameState, 
  config: GameConfig, 
  cohort: LeadCohort, 
  method: SaleMethod, 
  applicationsToProcess: number
): LeadCohort {
  if (applicationsToProcess <= 0) return cohort;
  const next = { ...cohort };
  const productPrice = state.launchPlan.productPrice || 0;
  const rate = clamp(
    baseSaleRate(productPrice, method) *
      saleModifier(state, method) *
      keyedRandomMultiplier(state.seed, config, cohort.id, `sale_${method}_${state.resources.day}`),
    0,
    0.6
  );
  
  next.unprocessedApplications = Math.max(0, next.unprocessedApplications - applicationsToProcess);

  if (method === 'call') {
    const booked = stochasticRound(applicationsToProcess * 0.75, `${state.seed}|${next.id}|booked_${state.resources.day}`);
    const held = stochasticRound(booked * 0.75, `${state.seed}|${next.id}|held_${state.resources.day}`);
    next.bookedCalls += booked;
    next.heldCalls += held;
    const sales = stochasticRound(held * rate, `${state.seed}|${next.id}|round_call_sales_${state.resources.day}`);
    next.sales += sales;
    next.pendingFollowup += Math.max(0, held - sales) * 0.35;
  } else {
    const sales = stochasticRound(applicationsToProcess * rate, `${state.seed}|${next.id}|round_${method}_sales_${state.resources.day}`);
    next.sales += sales;
    next.pendingFollowup += Math.max(0, applicationsToProcess - sales) * 0.35;
  }
  return applyCapacity(state, config, next);
}

export function applyFollowup(state: GameState, config: GameConfig, cohort: LeadCohort): LeadCohort {
  if (cohort.followedUp || cohort.pendingFollowup <= 0 || cohort.routeSnapshot.followup === 'none') return cohort;
  const next = { ...cohort, followedUp: true };
  const returnRate =
    next.routeSnapshot.followup === 'manual' ? 0.1 :
    next.routeSnapshot.followup === 'bot' ? 0.15 :
    0.01;
  const returned = next.pendingFollowup * returnRate;
  const before = next.sales;
  const method = next.routeSnapshot.saleMethod;
  const productPrice = state.launchPlan.productPrice || 0;
  const rate = clamp(baseSaleRate(productPrice, method) * saleModifier(state, method) * 1.25, 0, 0.6);
  next.sales += stochasticRound(returned * rate, `${state.seed}|${next.id}|followup_sales`);
  if (next.sales > before) {
    next.pendingFollowup = Math.max(0, next.pendingFollowup - returned);
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
  const newApplications = stochasticRound(remainingAttendees * 0.2 * keyedRandomMultiplier(state.seed, config, next.id, 'webinar_application'), `${state.seed}|${next.id}|webinar_app`);
  next.applications = newApplications;
  next.unprocessedApplications = newApplications;
  next.sales = directSales;
  next.pendingFollowup = Math.max(0, remainingAttendees - next.applications) * 0.35;
  return applyCapacity(state, config, next);
}

function applyCapacity(state: GameState, config: GameConfig, cohort: LeadCohort): LeadCohort {
  const product = config.productTypes.find((item) => item.id === state.launchPlan.productType);
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
