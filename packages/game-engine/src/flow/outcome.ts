import type { GameState, GameConfig, ActionConfig, ActionOutcome, DayReport, LeadCohort } from '../types';
import { applyEffect } from '../actions/dsl';
import { createContentCohort } from '../calculations/content';
import { applyEntry, applyFollowup, applyProcessing, applySales } from '../calculations/funnel';
import { recalculateMetrics } from '../time/ticks';

export function confirmAction(state: GameState, config: GameConfig): GameState {
  if (!state.pendingAction || !state.pendingAction.confirmed) {
    throw new Error('No confirmed pending action');
  }
  
  const actionId = state.pendingAction.actionId;
  const action = config.actions.find(a => a.id === actionId);
  if (!action) throw new Error(`Action not found: ${actionId}`);
  
  state.resources.bank -= action.cost;
  state.resources.energy = Math.max(0, state.resources.energy - action.energyCost);
  state.metrics.expenses += action.cost;
  
  if (state.pendingAction.temporaryRoute) {
    state.activeRoute = state.pendingAction.temporaryRoute;
  }
  
  // Calculate baseline metrics before action
  const beforeMetrics = { ...state.metrics };
  const beforeBank = state.resources.bank + action.cost;
  const beforeEnergy = state.resources.energy + action.energyCost;
  const createdCohorts: string[] = [];
  
  // Apply immediate effects
  for (const effect of action.effects) {
    applyEffect(state, effect);
  }
  
  if (['simple_bot_self', 'simple_bot_specialist', 'ai_bot_self', 'ai_bot_specialist', 'hire_manager'].includes(action.id)) {
    pickUpWarmBacklog(state, config, action.id);
  }
  
  activateRouteTool(state, action.id);
  
  if (action.id === 'demand_pilot_offer') {
    createdCohorts.push(runPilotOffer(state, config));
  }
  
  if (['stories_3d', 'reels_7d', 'reels_stories_7d', 'live_stream', 'webinar', 'telegram_warmup', 'contacts_outreach'].includes(action.id)) {
    const contentType = state.pendingAction.contentType || 'storytelling';
    let cohort = createContentCohort(state, config, action.id, contentType, state.cohorts.length);
    if (cohort) {
      cohort = applyEntry(state, config, cohort);
      state.cohorts.push(cohort);
      createdCohorts.push(cohort.id);
    }
  }
  
  if (action.id === 'manual_followup' || action.id === 'bot_followup') {
    state.cohorts = state.cohorts.map((cohort) => applyFollowup(state, config, {
      ...cohort,
      routeSnapshot: { ...cohort.routeSnapshot, followup: action.id === 'bot_followup' ? 'bot' : 'manual' },
    }));
  } else if (action.category === 'sales') {
    const saleMethod = action.id === 'calls' ? 'call' : 'manual_chat';
    for (let i = 0; i < state.cohorts.length; i++) {
      if (state.cohorts[i].unprocessedApplications > 0) {
        state.cohorts[i] = applySales(state, config, state.cohorts[i], saleMethod, state.cohorts[i].unprocessedApplications);
      }
    }
  }
  
  recalculateMetrics(state);
  
  const outcome: ActionOutcome = {
    actionId: action.id,
    title: action.title,
    startedDay: state.resources.day,
    finishedDay: state.resources.day + action.days,
    
    impressionsDelta: state.metrics.impressions - beforeMetrics.impressions,
    inboundDelta: state.metrics.responses - beforeMetrics.responses, // responses = inbound
    processedDelta: state.metrics.processed - beforeMetrics.processed,
    applicationsDelta: state.metrics.applications - beforeMetrics.applications,
    bookedCallsDelta: state.metrics.bookedCalls - beforeMetrics.bookedCalls,
    heldCallsDelta: state.metrics.heldCalls - beforeMetrics.heldCalls,
    salesDelta: state.metrics.sales - beforeMetrics.sales,
    revenueDelta: state.metrics.revenue - beforeMetrics.revenue,
    lostDelta: state.metrics.lostLeads - beforeMetrics.lostLeads,
    
    bankDelta: state.resources.bank - beforeBank,
    energyDelta: state.resources.energy - beforeEnergy,
    
    createdCohortIds: createdCohorts,
    narrativeKeys: [] // To be filled by narrative system
  };
  
  state.lastOutcome = outcome;
  state.currentDayReport = {
    id: `report_${state.resources.day}_${action.id}`,
    startedDay: state.resources.day,
    finishedDay: state.resources.day + action.days,
    actionId: action.id,
    actionTitle: action.title,
    outcome,
    decisions: []
  };
  
  if (action.days > 0) {
    state.scheduledActions.push({
      id: `${action.id}_${state.resources.day}`,
      actionId: action.id,
      startedDay: state.resources.day,
      completesDay: state.resources.day + action.days,
      payload: {},
      completed: false
    });
  } else {
    state.history.push({
      day: state.resources.day,
      type: 'action_completed',
      message: `Завершено действие: ${action.title}`,
      payload: { actionId: action.id }
    });
  }
  
  state.pendingAction = null;
  state.flow.step = 'action_process';
  return state;
}

function activateRouteTool(state: GameState, actionId: string): void {
  if (actionId.startsWith('guide_')) state.activeRoute = { ...state.activeRoute, entry: 'guide', nurture: ['guide'] };
  if (actionId.startsWith('video_')) state.activeRoute = { ...state.activeRoute, entry: 'video_lesson', nurture: ['video_lesson'] };
  if (actionId.startsWith('website_')) state.activeRoute = { ...state.activeRoute, entry: 'website', processing: 'website_auto', saleMethod: 'website_auto' };
  if (actionId === 'manual_chat') state.activeRoute = { ...state.activeRoute, saleMethod: 'manual_chat' };
  if (actionId === 'calls') state.activeRoute = { ...state.activeRoute, saleMethod: 'call' };
  if (actionId === 'manual_followup') state.activeRoute = { ...state.activeRoute, followup: 'manual' };
  if (actionId === 'bot_followup') state.activeRoute = { ...state.activeRoute, followup: 'bot' };
}

function pickUpWarmBacklog(state: GameState, config: GameConfig, actionId: string): void {
  const processing = actionId.startsWith('ai_bot') ? 'ai_bot' : actionId.startsWith('simple_bot') ? 'simple_bot' : 'manager';
  state.activeRoute = { ...state.activeRoute, processing };
  state.cohorts = state.cohorts.map((cohort) => {
    if (cohort.unprocessedInbound <= 0) return cohort;
    const updated = { ...cohort, routeSnapshot: { ...cohort.routeSnapshot, processing: processing as any } };
    return applyProcessing(state, config, updated, 'auto');
  });
}

function runPilotOffer(state: GameState, config: GameConfig): string {
  const id = `pilot_offer_${state.resources.day}`;
  let cohort: LeadCohort = {
    id, createdDay: state.resources.day, sourceActionId: 'demand_pilot_offer', sourceType: 'stories', contentType: 'selling',
    impressions: 3, responses: 3, activated: 3, processed: 3, applications: 3, bookedCalls: 0, heldCalls: 0, sales: 0,
    unprocessedInbound: 0, pendingFollowup: 0, inboundDecision: 'resolved', salesDecision: 'pending', followupDecision: 'not_ready',
    deferredUntilDay: null, deferCount: 0, unprocessedApplications: 3, lost: 0, capacityLostLeads: 0,
    routeSnapshot: { ...state.activeRoute, capturedDay: state.resources.day }, followedUp: false,
  };
  const productPrice = state.launchPlan.productPrice || 0;
  cohort = applySales(state, config, cohort, productPrice > 50_000 ? 'call' : 'manual_chat', 3);
  state.cohorts.push(cohort);
  return id;
}
