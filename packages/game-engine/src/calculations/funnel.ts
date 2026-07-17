import type { GameConfig, GameState, LeadCohort, SaleMethod } from '../types';
import { keyedRandomMultiplier, stochasticRound } from '../random/keyed';
import { clamp } from '../state/invariants';
import { baseSaleRate, lowEnergyManualMultiplier, nurtureMultiplier, processingQuality } from './modifiers';

export function applyEntry(state: GameState, config: GameConfig, cohort: LeadCohort): LeadCohort {
  if (cohort.sourceType === 'webinar') {
    return processWebinar(state, config, cohort);
  }
  const next = { ...cohort };
  const route = next.routeSnapshot;
  const entryRate = route.entry === 'direct_messages' ? 1 : route.entry === 'website' ? 0.6 : 0.7;
  const activated = stochasticRound(next.inbound * entryRate, `${state.seed}|${next.id}|activated`);
  next.activated = Math.min(Math.floor(next.inbound), activated);
  next.losses.entry += next.inbound - next.activated;
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
  requestedAmount?: number,
): LeadCohort {
  if (cohort.unprocessedInbound <= 0) return cohort;
  const next = { ...cohort, losses: { ...cohort.losses } };
  const route = next.routeSnapshot;

  const requested = Math.max(0, Math.floor(requestedAmount ?? next.unprocessedInbound));
  const toProcess = mode === 'auto'
    ? Math.min(next.unprocessedInbound, requested)
    : Math.min(next.unprocessedInbound, Math.floor(requested * lowEnergyManualMultiplier(state)));
  if (toProcess <= 0) return next;

  const processingRate = route.processing === 'simple_bot' ? 0.8 : route.processing === 'ai_bot' ? 0.99 : route.processing === 'manager' ? 0.95 : 1;
  const processedRounded = stochasticRound(toProcess * processingRate, `${state.seed}|${next.id}|processed_${state.resources.day}_${next.processed}`);
  const successfullyProcessed = Math.min(toProcess, processedRounded);

  next.unprocessedInbound = Math.max(0, next.unprocessedInbound - toProcess);
  next.processed += successfullyProcessed;
  next.losses.processing += toProcess - successfullyProcessed;

  const demandAtCreation = 0.8 + 0.35 * next.contextSnapshot.demandConfidence;
  const applicationRate = clamp(
    0.075 *
      nurtureMultiplier(route.nurture) *
      processingQuality(route.processing) *
      demandAtCreation *
      keyedRandomMultiplier(state.seed, config, next.id, `app_${state.resources.day}_${next.processed}`),
    0,
    0.45,
  );

  const applicationsRounded = stochasticRound(successfullyProcessed * applicationRate, `${state.seed}|${next.id}|apps_${state.resources.day}_${next.processed}`);
  const newApplications = Math.min(successfullyProcessed, applicationsRounded);
  next.applications += newApplications;
  next.unprocessedApplications += newApplications;
  next.losses.qualification += successfullyProcessed - newApplications;

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
  applicationsToProcess: number,
): LeadCohort {
  if (applicationsToProcess <= 0) return cohort;
  const next = { ...cohort, losses: { ...cohort.losses } };
  const count = Math.min(next.unprocessedApplications, Math.max(0, Math.floor(applicationsToProcess)));
  if (count <= 0) return next;

  const productPrice = next.contextSnapshot.productPrice;
  const rate = clamp(
    baseSaleRate(productPrice, method) *
      cohortSaleModifier(state, next, method) *
      keyedRandomMultiplier(state.seed, config, next.id, `sale_${method}_${state.resources.day}_${next.sales}`),
    0,
    0.6,
  );

  next.unprocessedApplications = Math.max(0, next.unprocessedApplications - count);

  if (method === 'call') {
    const bookedRounded = stochasticRound(count * 0.75, `${state.seed}|${next.id}|booked_${state.resources.day}_${next.bookedCalls}`);
    const booked = Math.min(count, bookedRounded);
    next.losses.callBooking += count - booked;

    const heldRounded = stochasticRound(booked * 0.75, `${state.seed}|${next.id}|held_${state.resources.day}_${next.heldCalls}`);
    const held = Math.min(booked, heldRounded);
    next.losses.callNoShow += booked - held;
    next.bookedCalls += booked;
    next.heldCalls += held;

    const salesRounded = stochasticRound(held * rate, `${state.seed}|${next.id}|round_call_sales_${state.resources.day}_${next.sales}`);
    const sales = Math.min(held, salesRounded);
    next.sales += sales;

    const failed = held - sales;
    const followupRounded = stochasticRound(failed * 0.35, `${state.seed}|${next.id}|to_followup_${state.resources.day}_${next.pendingFollowup}`);
    const toFollowup = Math.min(failed, followupRounded);
    next.pendingFollowup += toFollowup;
    next.losses.sale += failed - toFollowup;
  } else {
    const salesRounded = stochasticRound(count * rate, `${state.seed}|${next.id}|round_${method}_sales_${state.resources.day}_${next.sales}`);
    const sales = Math.min(count, salesRounded);
    next.sales += sales;

    const failed = count - sales;
    const followupRounded = stochasticRound(failed * 0.35, `${state.seed}|${next.id}|to_followup_${state.resources.day}_${next.pendingFollowup}`);
    const toFollowup = Math.min(failed, followupRounded);
    next.pendingFollowup += toFollowup;
    next.losses.sale += failed - toFollowup;
  }

  if (next.pendingFollowup > 0) next.followupDecision = 'pending';
  return applyCapacity(state, config, next);
}

export function applyFollowup(state: GameState, config: GameConfig, cohort: LeadCohort): LeadCohort {
  if (cohort.followedUp || cohort.pendingFollowup <= 0 || cohort.routeSnapshot.followup === 'none') return cohort;
  const next = { ...cohort, losses: { ...cohort.losses }, followedUp: true };
  const returnRate = next.routeSnapshot.followup === 'manual' ? 0.1 : next.routeSnapshot.followup === 'bot' ? 0.15 : 0.01;
  const returned = next.pendingFollowup * returnRate;
  const method = next.routeSnapshot.saleMethod;
  const productPrice = next.contextSnapshot.productPrice;
  const rate = clamp(baseSaleRate(productPrice, method) * cohortSaleModifier(state, next, method) * 1.25, 0, 0.6);
  const followupSalesRounded = stochasticRound(returned * rate, `${state.seed}|${next.id}|followup_sales`);
  const followupSales = Math.min(next.pendingFollowup, followupSalesRounded);
  next.sales += followupSales;
  next.losses.followup += next.pendingFollowup - followupSales;
  next.pendingFollowup = 0;
  return applyCapacity(state, config, next);
}

function processWebinar(state: GameState, config: GameConfig, cohort: LeadCohort): LeadCohort {
  const next = { ...cohort, losses: { ...cohort.losses } };
  const demandAtCreation = 0.8 + 0.35 * next.contextSnapshot.demandConfidence;
  const registrationsRounded = stochasticRound(next.impressions * 0.035 * demandAtCreation, `${state.seed}|${next.id}|webinar_reg`);
  const registrations = Math.min(Math.floor(next.impressions), registrationsRounded);

  const attendeesRounded = stochasticRound(registrations * 0.45, `${state.seed}|${next.id}|webinar_att`);
  const attendees = Math.min(registrations, attendeesRounded);

  const directRate = clamp(
    0.05 * cohortSaleModifier(state, next, 'webinar_direct') * keyedRandomMultiplier(state.seed, config, next.id, 'webinar_sale'),
    0,
    0.6,
  );
  const directSalesRounded = stochasticRound(attendees * directRate, `${state.seed}|${next.id}|round_webinar_direct`);
  const directSales = Math.min(attendees, directSalesRounded);

  const remainingAttendees = Math.max(0, attendees - directSales);
  next.activated = registrations;
  next.processed = attendees;

  const applicationsRounded = stochasticRound(remainingAttendees * 0.2 * keyedRandomMultiplier(state.seed, config, next.id, 'webinar_application'), `${state.seed}|${next.id}|webinar_app`);
  const newApplications = Math.min(remainingAttendees, applicationsRounded);
  next.applications = newApplications;
  next.unprocessedApplications = newApplications;
  next.sales = directSales;

  const failedApps = remainingAttendees - newApplications;
  const followupRounded = stochasticRound(failedApps * 0.35, `${state.seed}|${next.id}|webinar_to_followup`);
  const toFollowup = Math.min(failedApps, followupRounded);
  next.pendingFollowup = toFollowup;
  next.losses.entry += registrations - attendees;
  next.losses.qualification += failedApps - toFollowup;
  return applyCapacity(state, config, next);
}

function applyCapacity(state: GameState, config: GameConfig, cohort: LeadCohort): LeadCohort {
  const product = config.productTypes.find((item) => item.id === cohort.contextSnapshot.productType);
  const capacity = product?.capacity ?? null;
  if (capacity === null) return cohort;
  const existingSales = state.cohorts.filter((item) => item.id !== cohort.id).reduce((sum, item) => sum + item.sales, 0);
  const remaining = Math.max(0, capacity - existingSales);
  if (cohort.sales > remaining) {
    const lost = cohort.sales - remaining;
    cohort.capacityLostLeads += lost;
    cohort.losses.capacity += lost;
    cohort.sales = remaining;
  }
  return cohort;
}

function cohortSaleModifier(state: GameState, cohort: LeadCohort, method: SaleMethod): number {
  let multiplier = cohort.contextSnapshot.productQuality || 1;
  const productPrice = cohort.contextSnapshot.productPrice;
  const route = cohort.routeSnapshot;

  if (!route.nurture.length || route.nurture.includes('none')) {
    if (productPrice > 30_000) multiplier *= 0.8;
  }
  if (route.nurture.includes('guide')) multiplier *= 1.05;
  if (route.nurture.includes('video_lesson')) multiplier *= 1.15;
  if (route.nurture.includes('webinar')) multiplier *= 1.25;
  if (route.processing === 'ai_bot') multiplier *= 1.2;
  if (method === 'website_auto' && productPrice > 200_000) multiplier *= 0.4;
  else if (method === 'website_auto' && productPrice > 100_000) multiplier *= 0.6;
  if (state.resources.energy < 30 && (method === 'call' || method === 'manual_chat')) multiplier *= 0.8;

  return clamp(multiplier, 0, 8);
}
