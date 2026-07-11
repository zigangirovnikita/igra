import type { GameState, GameConfig, ActionConfig, ActionOutcome, DayReport, LeadCohort, ContentType, ProcessingType } from '../types';
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

  let finalCost = action.cost;

  if (action.repeatPolicy === 'upgrade' && action.upgradeCost !== undefined && action.upgradeGroup) {
    const hasPrevious = state.history.some(h => {
      if (h.type !== 'action_completed' || !h.payload?.actionId) return false;
      const prevA = config.actions.find(a => a.id === h.payload!.actionId);
      return prevA?.upgradeGroup === action.upgradeGroup;
    });
    if (hasPrevious) {
      finalCost = action.upgradeCost;
    }
  }

  state.resources.bank -= finalCost;
  state.resources.energy = Math.max(0, state.resources.energy - action.energyCost);
  state.metrics.expenses += finalCost;

  if (state.pendingAction.temporaryRoute) {
    state.activeRoute = state.pendingAction.temporaryRoute;
  }

  const startedDay = state.resources.day;
  const finishedDay = Math.min(config.totalDays, startedDay + Math.max(0, action.days - 1));

  // Spend time immediately
  state.resources.day = finishedDay;

  // Execute effects immediately
  const report = executeActionEffects(state, config, action, startedDay, finishedDay, state.pendingAction.contentType);
  state.lastOutcome = report.outcome;
  state.currentDayReport = report;

  state.history.push({
    day: finishedDay,
    type: 'action_completed',
    message: `Завершено действие: ${action.title}`,
    payload: { actionId: action.id, cohortId: state.pendingAction.targetCohortId }
  });

  state.pendingAction = null;

  if (action.days > 0) {
    state.flow.step = 'action_process'; // UI will acknowledge and go to action_result
  } else {
    state.flow.step = 'action_result'; // UI will show result immediately
  }

  return state;
}

export function executeActionEffects(
  state: GameState,
  config: GameConfig,
  action: ActionConfig,
  startedDay: number,
  finishedDay: number,
  contentType?: string
): DayReport {
  const beforeMetrics = { ...state.metrics };
  const beforeBank = state.resources.bank;
  const beforeEnergy = state.resources.energy;
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
    createdCohorts.push(runPilotOffer(state, config, finishedDay));
  }

  if (['stories_3d', 'reels_7d', 'reels_stories_7d', 'live_stream', 'webinar', 'telegram_warmup', 'contacts_outreach'].includes(action.id)) {
    let cohort = createContentCohort(state, config, action.id, (contentType || 'storytelling') as ContentType, state.cohorts.length);
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
    startedDay,
    finishedDay,

    impressionsDelta: state.metrics.impressions - beforeMetrics.impressions,
    inboundDelta: state.metrics.responses - beforeMetrics.responses,
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
    narrativeKeys: []
  };

  return {
    id: `report_${finishedDay}_${action.id}`,
    startedDay,
    finishedDay,
    actionId: action.id,
    actionTitle: action.title,
    outcome,
    decisions: []
  };
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
    const updated = { ...cohort, routeSnapshot: { ...cohort.routeSnapshot, processing: processing as ProcessingType } };
    return applyProcessing(state, config, updated, 'auto');
  });
}

function runPilotOffer(state: GameState, config: GameConfig, finishedDay: number): string {
  const id = `pilot_offer_${finishedDay}`;
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
