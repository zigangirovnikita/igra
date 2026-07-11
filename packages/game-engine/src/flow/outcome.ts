import type { ActionConfig, ActionOutcome, ContentType, DayReport, GameConfig, GameState, LeadCohort, ProcessingType, SourceType } from '../types';
import { applyEffect } from '../actions/dsl';
import { createContentCohort } from '../calculations/content';
import { applyEntry, applyFollowup, applyProcessing, applySales } from '../calculations/funnel';
import { recalculateMetrics } from '../time/ticks';

export function confirmAction(state: GameState, config: GameConfig): GameState {
  if (!state.pendingAction || !state.pendingAction.confirmed) {
    throw new Error('No confirmed pending action');
  }

  const actionId = state.pendingAction.actionId;
  const action = config.actions.find((candidate) => candidate.id === actionId);
  if (!action) throw new Error(`Action not found: ${actionId}`);

  let finalCost = action.cost;
  if (action.repeatPolicy === 'upgrade' && action.upgradeCost !== undefined && action.upgradeGroup) {
    const hasPrevious = state.history.some((historyEntry) => {
      if (historyEntry.type !== 'action_completed' || !historyEntry.payload?.actionId) return false;
      const previousAction = config.actions.find((candidate) => candidate.id === historyEntry.payload?.actionId);
      return previousAction?.upgradeGroup === action.upgradeGroup;
    });
    if (hasPrevious) finalCost = action.upgradeCost;
  }

  if (state.resources.bank < finalCost) throw new Error('Not enough money');
  if (state.resources.energy < action.energyCost) throw new Error('Not enough energy');

  const beforeBank = state.resources.bank;
  const beforeEnergy = state.resources.energy;
  const beforeMetrics = { ...state.metrics };
  const startedDay = state.resources.day;
  const finishedDay = Math.min(config.totalDays, startedDay + Math.max(0, action.days - 1));

  state.resources.bank -= finalCost;
  state.resources.energy -= action.energyCost;
  state.metrics.expenses += finalCost;

  if (state.pendingAction.temporaryRoute) {
    state.activeRoute = state.pendingAction.temporaryRoute;
  }

  state.resources.day = finishedDay;

  const report = executeActionEffects(
    state,
    config,
    action,
    startedDay,
    finishedDay,
    state.pendingAction.contentType,
    beforeBank,
    beforeEnergy,
    beforeMetrics,
  );
  state.lastOutcome = report.outcome;
  state.currentDayReport = report;

  state.history.push({
    day: finishedDay,
    type: 'action_completed',
    message: `Завершено действие: ${action.title}`,
    payload: { actionId: action.id, cohortId: state.pendingAction.targetCohortId },
  });

  state.pendingAction = null;
  state.flow.step = action.days > 0 ? 'action_process' : 'action_result';
  return state;
}

export function executeActionEffects(
  state: GameState,
  config: GameConfig,
  action: ActionConfig,
  startedDay: number,
  finishedDay: number,
  contentType: string | undefined,
  beforeBank: number,
  beforeEnergy: number,
  beforeMetrics: GameState['metrics'],
): DayReport {
  const createdCohorts: string[] = [];

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

  const resolvedContentType = (contentType || 'storytelling') as ContentType;
  if (action.id === 'reels_stories_7d') {
    appendContentCohort(state, config, action.id, resolvedContentType, 'reels', createdCohorts);
    appendContentCohort(state, config, action.id, resolvedContentType, 'stories', createdCohorts);
  } else if (['stories_3d', 'reels_7d', 'live_stream', 'webinar', 'telegram_warmup', 'contacts_outreach'].includes(action.id)) {
    appendContentCohort(state, config, action.id, resolvedContentType, undefined, createdCohorts);
  }

  if (action.id === 'manual_followup' || action.id === 'bot_followup') {
    state.cohorts = state.cohorts.map((cohort) => applyFollowup(state, config, {
      ...cohort,
      routeSnapshot: { ...cohort.routeSnapshot, followup: action.id === 'bot_followup' ? 'bot' : 'manual' },
    }));
  } else if (action.category === 'sales') {
    const saleMethod = action.id === 'calls' ? 'call' : 'manual_chat';
    for (let index = 0; index < state.cohorts.length; index += 1) {
      if (state.cohorts[index].unprocessedApplications > 0) {
        state.cohorts[index] = applySales(state, config, state.cohorts[index], saleMethod, state.cohorts[index].unprocessedApplications);
      }
    }
  }

  recalculateMetrics(state);

  const outcome: ActionOutcome = {
    actionId: action.id,
    title: action.title,
    startedDay,
    finishedDay,
    bankBefore: beforeBank,
    bankAfter: state.resources.bank,
    bankSpent: Math.max(0, beforeBank - state.resources.bank),
    energyBefore: beforeEnergy,
    energyAfter: state.resources.energy,
    energySpent: Math.max(0, beforeEnergy - state.resources.energy),
    metricsBefore: beforeMetrics,
    metricsAfter: { ...state.metrics },
    impressionsDelta: state.metrics.impressions - beforeMetrics.impressions,
    inboundDelta: state.metrics.inbound - beforeMetrics.inbound,
    processedDelta: state.metrics.processed - beforeMetrics.processed,
    applicationsDelta: state.metrics.applications - beforeMetrics.applications,
    bookedCallsDelta: state.metrics.bookedCalls - beforeMetrics.bookedCalls,
    heldCallsDelta: state.metrics.heldCalls - beforeMetrics.heldCalls,
    salesDelta: state.metrics.sales - beforeMetrics.sales,
    revenueDelta: state.metrics.revenue - beforeMetrics.revenue,
    lostDelta: state.metrics.lostLeads - beforeMetrics.lostLeads,
    createdCohortIds: createdCohorts,
    narrativeKeys: [],
  };

  return {
    id: `report_${finishedDay}_${action.id}`,
    startedDay,
    finishedDay,
    actionId: action.id,
    actionTitle: action.title,
    outcome,
    decisions: [],
  };
}

function appendContentCohort(
  state: GameState,
  config: GameConfig,
  actionId: string,
  contentType: ContentType,
  sourceType: SourceType | undefined,
  createdCohorts: string[],
): void {
  let cohort = createContentCohort(
    state,
    config,
    actionId,
    contentType,
    state.cohorts.length,
    sourceType,
  );
  if (!cohort) return;
  cohort = applyEntry(state, config, cohort);
  state.cohorts.push(cohort);
  createdCohorts.push(cohort.id);
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
  const processing: ProcessingType = actionId.startsWith('ai_bot') ? 'ai_bot' : actionId.startsWith('simple_bot') ? 'simple_bot' : 'manager';
  const recoveryRate = processing === 'ai_bot' ? 0.7 : processing === 'manager' ? 0.65 : 0.5;
  state.activeRoute = { ...state.activeRoute, processing };
  state.cohorts = state.cohorts.map((cohort) => {
    if (cohort.unprocessedInbound <= 0) return cohort;
    const routeSnapshot = cohort.routeSnapshot;
    const amount = Math.floor(cohort.unprocessedInbound * recoveryRate);
    if (amount <= 0) return cohort;
    const updated = applyProcessing(
      state,
      config,
      { ...cohort, routeSnapshot: { ...routeSnapshot, processing } },
      'auto',
      amount,
    );
    return { ...updated, routeSnapshot };
  });
}

function runPilotOffer(state: GameState, config: GameConfig, finishedDay: number): string {
  const id = `pilot_offer_${finishedDay}`;
  let cohort: LeadCohort = {
    id,
    createdDay: finishedDay,
    sourceActionId: 'demand_pilot_offer',
    sourceType: 'stories',
    contentType: 'selling',
    impressions: 3,
    inbound: 3,
    activated: 3,
    processed: 3,
    applications: 3,
    bookedCalls: 0,
    heldCalls: 0,
    sales: 0,
    unprocessedInbound: 0,
    pendingFollowup: 0,
    inboundDecision: 'resolved',
    salesDecision: 'pending',
    followupDecision: 'not_ready',
    deferredUntilDay: null,
    deferCount: 0,
    unprocessedApplications: 3,
    capacityLostLeads: 0,
    losses: { entry: 0, processing: 0, qualification: 0, callBooking: 0, callNoShow: 0, sale: 0, followup: 0, capacity: 0 },
    routeSnapshot: { ...state.activeRoute, nurture: [...state.activeRoute.nurture], capturedDay: finishedDay },
    contextSnapshot: {
      productPrice: state.launchPlan.productPrice || 0,
      productType: state.launchPlan.productType || '',
      demandConfidence: state.assets.demandConfidence,
      productQuality: state.assets.productQuality,
      energyAtCreation: state.resources.energy,
      createdDay: finishedDay,
    },
    followedUp: false,
  };
  const productPrice = cohort.contextSnapshot.productPrice;
  cohort = applySales(state, config, cohort, productPrice > 50_000 ? 'call' : 'manual_chat', 3);
  state.cohorts.push(cohort);
  return id;
}
