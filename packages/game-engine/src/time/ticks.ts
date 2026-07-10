import type { ContentType, GameConfig, GameState, ScheduledAction } from '../types';
import { applyEffect } from '../actions/dsl';
import { createContentCohort } from '../calculations/content';
import { applyFollowup, processCohort } from '../calculations/funnel';
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
  if (isContentAction(action.id)) {
    const contentType = (scheduled.payload.contentType ?? 'storytelling') as ContentType;
    const cohort = createContentCohort(state, config, action.id, contentType, state.cohorts.length);
    if (cohort) {
      const processed = applyFollowup(state, config, processCohort(state, config, cohort));
      state.cohorts.push(processed);
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
    cooled.unprocessedWarm *= temperature;
  }
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
