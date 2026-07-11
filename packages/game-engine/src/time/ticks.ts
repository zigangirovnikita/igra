import type { ContentType, GameConfig, GameState, ProcessingType, ScheduledAction } from '../types';
import { applyEffect } from '../actions/dsl';
import { createContentCohort } from '../calculations/content';
import { applyFollowup, applyEntry, applyProcessing, applySales } from '../calculations/funnel';
import { assertStateInvariants, clamp } from '../state/invariants';

export function advanceDays(input: GameState, config: GameConfig, targetDay: number): GameState {
  let state = structuredClone(input);
  const boundedTarget = Math.min(config.totalDays, Math.max(state.resources.day, targetDay));
  while (state.resources.day < boundedTarget) {
    state = runDailyTick(state, config);
    state.resources.day += 1;
  }
  assertStateInvariants(state, config);
  return state;
}

export function runDailyTick(input: GameState, config: GameConfig): GameState {
  let state = structuredClone(input);
  state = completeDueActions(state, config);
  state.cohorts = state.cohorts.map((cohort) => decayCohort(state, config, cohort));
  recalculateMetrics(state);
  if (state.metrics.sales >= state.targets.targetSales && state.status === 'active') {
    state.status = 'goal_reached';
  }
  assertStateInvariants(state, config);
  return state;
}

export function completeDueActions(input: GameState, config: GameConfig): GameState {
  let state = structuredClone(input);
  const completedIds = new Set<string>();
  for (const scheduled of state.scheduledActions) {
    if (!scheduled.completed && scheduled.completesDay <= state.resources.day) {
      state = completeAction(state, config, scheduled);
      completedIds.add(scheduled.id);
    }
  }
  state.scheduledActions = state.scheduledActions.map((item) => ({
    ...item,
    completed: item.completed || completedIds.has(item.id)
  }));
  return state;
}

export function completeAction(input: GameState, config: GameConfig, scheduled: ScheduledAction): GameState {
  let state = structuredClone(input);
  const action = config.actions.find((item) => item.id === scheduled.actionId);
  if (!action) return state;

  for (const effect of action.effects) {
    state = applyEffect(state, effect);
  }
  if (['simple_bot_self', 'simple_bot_specialist', 'ai_bot_self', 'ai_bot_specialist', 'hire_manager'].includes(action.id)) {
    state = pickUpWarmBacklog(state, config, action.id);
  }
  state = activateRouteTool(state, action.id);
  if (action.id === 'demand_pilot_offer') {
    state = runPilotOffer(state, config);
  }
  if (isContentAction(action.id)) {
    const contentType = (scheduled.payload.contentType ?? 'storytelling') as ContentType;
    let cohort = createContentCohort(state, config, action.id, contentType, state.cohorts.length);
    if (cohort) {
      cohort = applyEntry(state, config, cohort);
      state.cohorts.push(cohort);
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
  state.history.push({
    day: state.resources.day,
    type: 'action_completed',
    message: `Завершено действие: ${action.title}`,
    payload: { actionId: action.id }
  });
  recalculateMetrics(state);
  return state;
}

function activateRouteTool(state: GameState, actionId: string): GameState {
  if (actionId.startsWith('guide_')) state.activeRoute = { ...state.activeRoute, entry: 'guide', nurture: ['guide'] };
  if (actionId.startsWith('video_')) state.activeRoute = { ...state.activeRoute, entry: 'video_lesson', nurture: ['video_lesson'] };
  if (actionId.startsWith('website_')) state.activeRoute = { ...state.activeRoute, entry: 'website', processing: 'website_auto', saleMethod: 'website_auto' };
  if (actionId === 'manual_chat') state.activeRoute = { ...state.activeRoute, saleMethod: 'manual_chat' };
  if (actionId === 'calls') state.activeRoute = { ...state.activeRoute, saleMethod: 'call' };
  if (actionId === 'manual_followup') state.activeRoute = { ...state.activeRoute, followup: 'manual' };
  if (actionId === 'bot_followup') state.activeRoute = { ...state.activeRoute, followup: 'bot' };
  return state;
}

function pickUpWarmBacklog(state: GameState, config: GameConfig, actionId: string): GameState {
  const processing: ProcessingType = actionId.startsWith('ai_bot') ? 'ai_bot' : actionId.startsWith('simple_bot') ? 'simple_bot' : 'manager';
  state.activeRoute = { ...state.activeRoute, processing };
  state.cohorts = state.cohorts.map((cohort) => {
    if (cohort.unprocessedWarm <= 0 || cohort.temperature <= 0) return cohort;
    const updated = { ...cohort, routeSnapshot: { ...cohort.routeSnapshot, processing } };
    return applyProcessing(state, config, updated, 'auto');
  });
  return state;
}

function runPilotOffer(state: GameState, config: GameConfig): GameState {
  const id = `pilot_offer_${state.resources.day}`;
  let cohort: GameState['cohorts'][number] = {
    id, createdDay: state.resources.day, sourceActionId: 'demand_pilot_offer', sourceType: 'stories', contentType: 'selling',
    impressions: 3, responses: 3, activated: 3, processed: 3, applications: 3, bookedCalls: 0, heldCalls: 0, sales: 0,
    considering: 0, unprocessedWarm: 0, unprocessedApplications: 3, lost: 0, capacityLostLeads: 0, temperature: 1,
    routeSnapshot: { ...state.activeRoute, capturedDay: state.resources.day }, followedUp: false,
  };
  cohort = applySales(state, config, cohort, state.player.productPrice > 50_000 ? 'call' : 'manual_chat', 3);
  state.cohorts.push(cohort);
  return state;
}

export function recalculateMetrics(state: GameState): void {
  const expenses = 100_000 - state.resources.bank;
  state.metrics = {
    ...state.metrics,
    impressions: sum(state.cohorts, 'impressions'),
    responses: sum(state.cohorts, 'responses'),
    activated: sum(state.cohorts, 'activated'),
    processed: sum(state.cohorts, 'processed'),
    applications: sum(state.cohorts, 'applications'),
    bookedCalls: sum(state.cohorts, 'bookedCalls'),
    heldCalls: sum(state.cohorts, 'heldCalls'),
    sales: sum(state.cohorts, 'sales'),
    revenue: sum(state.cohorts, 'sales') * state.player.productPrice,
    expenses,
    capacityLostLeads: sum(state.cohorts, 'capacityLostLeads'),
    lostLeads: sum(state.cohorts, 'lost'),
    expectedLostRevenue: sum(state.cohorts, 'lost') * expectedDownstreamSaleProbability(state) * state.player.productPrice
  };
}

function decayCohort(state: GameState, config: GameConfig, cohort: GameState['cohorts'][number]): GameState['cohorts'][number] {
  const age = state.resources.day - cohort.createdDay;
  const temperature = config.decay[Math.min(age, config.decay.length - 1)] ?? 0;
  const cooled = { ...cohort, temperature };
  
  if (temperature <= 0 && cooled.unprocessedWarm > 0) {
    cooled.lost += cooled.unprocessedWarm;
    cooled.unprocessedWarm = 0;
  } else {
    const newUnprocessed = Math.round(cooled.unprocessedWarm * temperature);
    const lost = cooled.unprocessedWarm - newUnprocessed;
    cooled.lost += lost;
    cooled.unprocessedWarm = newUnprocessed;
  }
  
  // Followups can be scheduled during tick? Actually old ticks did not do applyFollowup in decay.
  // We should do applyFollowup in runDailyTick maybe? Or keep it manual? 
  // Wait, old ticks did applyFollowup in completeAction, right after processCohort.
  // We can do it in decayCohort if it hasn't been done.
  // But wait, applyFollowup needs config and state. Let's just return cooled for now.
  
  return cooled;
}

function expectedDownstreamSaleProbability(state: GameState): number {
  const processed = Math.max(1, state.metrics.processed);
  return clamp(state.metrics.sales / processed, 0.001, 0.6);
}

function isContentAction(actionId: string): boolean {
  return ['stories_3d', 'reels_7d', 'reels_stories_7d', 'live_stream', 'webinar', 'telegram_warmup'].includes(actionId);
}

function sum(items: GameState['cohorts'], key: keyof GameState['cohorts'][number]): number {
  return items.reduce((total, item) => total + Number(item[key] ?? 0), 0);
}
