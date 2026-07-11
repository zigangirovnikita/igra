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
  const activated = stochasticRound(next.inbound * entryRate, `${state.seed}|${next.id}|activated`);
  next.activated = Math.min(Math.floor(next.inbound), activated);
  next.losses.entry += (next.inbound - next.activated);
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
  
  const processedR = stochasticRound(toProcess * processingRate, `${state.seed}|${next.id}|processed_${state.resources.day}`);
  const successfullyProcessed = Math.min(Math.floor(toProcess), processedR);
  
  next.unprocessedInbound = Math.max(0, next.unprocessedInbound - toProcess);
  next.processed += successfullyProcessed;
  next.losses.processing += (toProcess - successfullyProcessed);
  
  const applicationRate = clamp(
    0.075 *
      nurtureMultiplier(route.nurture) *
      processingQuality(route.processing) *
      demandMultiplier(state) *
      keyedRandomMultiplier(state.seed, config, next.id, `app_${state.resources.day}`),
    0,
    0.45
  );
  
  const appsR = stochasticRound(successfullyProcessed * applicationRate, `${state.seed}|${next.id}|apps_${state.resources.day}`);
  const newApplications = Math.min(successfullyProcessed, appsR);
  next.applications += newApplications;
  next.unprocessedApplications += newApplications;
  next.losses.qualification += (successfullyProcessed - newApplications);
  if (newApplications > 0 && ['manual_chat', 'call'].includes(route.saleMethod)) {
    next.salesDecision = 'pending';
  }
  
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
    const bookedR = stochasticRound(applicationsToProcess * 0.75, `${state.seed}|${next.id}|booked_${state.resources.day}`);
    const booked = Math.min(applicationsToProcess, bookedR);
    next.losses.callBooking += (applicationsToProcess - booked);
    
    const heldR = stochasticRound(booked * 0.75, `${state.seed}|${next.id}|held_${state.resources.day}`);
    const held = Math.min(booked, heldR);
    next.losses.callNoShow += (booked - held);
    
    next.bookedCalls += booked;
    next.heldCalls += held;
    
    const salesR = stochasticRound(held * rate, `${state.seed}|${next.id}|round_call_sales_${state.resources.day}`);
    const sales = Math.min(held, salesR);
    next.sales += sales;
    
    const failed = held - sales;
    const toFollowupR = stochasticRound(failed * 0.35, `${state.seed}|${next.id}|to_followup_${state.resources.day}`);
    const toFollowup = Math.min(failed, toFollowupR);
    next.pendingFollowup += toFollowup;
    next.losses.sale += (failed - toFollowup);
  } else {
    const salesR = stochasticRound(applicationsToProcess * rate, `${state.seed}|${next.id}|round_${method}_sales_${state.resources.day}`);
    const sales = Math.min(applicationsToProcess, salesR);
    next.sales += sales;
    
    const failed = applicationsToProcess - sales;
    const toFollowupR = stochasticRound(failed * 0.35, `${state.seed}|${next.id}|to_followup_${state.resources.day}`);
    const toFollowup = Math.min(failed, toFollowupR);
    next.pendingFollowup += toFollowup;
    next.losses.sale += (failed - toFollowup);
  }
  if (next.pendingFollowup > 0) next.followupDecision = 'pending';
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
  const method = next.routeSnapshot.saleMethod;
  const productPrice = state.launchPlan.productPrice || 0;
  const rate = clamp(baseSaleRate(productPrice, method) * saleModifier(state, method) * 1.25, 0, 0.6);
  const followupSalesR = stochasticRound(returned * rate, `${state.seed}|${next.id}|followup_sales`);
  const followupSales = Math.min(next.pendingFollowup, followupSalesR);
  next.sales += followupSales;
  next.losses.followup += (next.pendingFollowup - followupSales);
  next.pendingFollowup = 0;
  return applyCapacity(state, config, next);
}

function processWebinar(state: GameState, config: GameConfig, cohort: LeadCohort): LeadCohort {
  const next = { ...cohort };
  const registrationsR = stochasticRound(next.impressions * 0.035 * demandMultiplier(state), `${state.seed}|${next.id}|webinar_reg`);
  const registrations = Math.min(Math.floor(next.impressions), registrationsR);
  
  const attendeesR = stochasticRound(registrations * 0.45, `${state.seed}|${next.id}|webinar_att`);
  const attendees = Math.min(registrations, attendeesR);
  
  const directRate = clamp(0.05 * saleModifier(state, 'webinar_direct') * keyedRandomMultiplier(state.seed, config, next.id, 'webinar_sale'), 0, 0.6);
  const directSalesR = stochasticRound(attendees * directRate, `${state.seed}|${next.id}|round_webinar_direct`);
  const directSales = Math.min(attendees, directSalesR);
  
  const remainingAttendees = Math.max(0, attendees - directSales);
  next.activated = registrations;
  next.processed = attendees;
  
  const newApplicationsR = stochasticRound(remainingAttendees * 0.2 * keyedRandomMultiplier(state.seed, config, next.id, 'webinar_application'), `${state.seed}|${next.id}|webinar_app`);
  const newApplications = Math.min(remainingAttendees, newApplicationsR);
  
  next.applications = newApplications;
  next.unprocessedApplications = newApplications;
  next.sales = directSales;
  
  const failedApps = remainingAttendees - newApplications;
  const toFollowupR = stochasticRound(failedApps * 0.35, `${state.seed}|${next.id}|webinar_to_followup`);
  const toFollowup = Math.min(failedApps, toFollowupR);
  next.pendingFollowup = toFollowup;
  
  next.losses.entry += (registrations - attendees);
  next.losses.processing += 0; // Handled in webinar context as entry loss mostly
  next.losses.qualification += (failedApps - toFollowup);
  
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
