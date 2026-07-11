import type { GameState, GameConfig, DailyIntent, RouteSelection, ContentType } from '../types';
import { getActionAvailability, findAction } from '../actions/availability';

export function chooseIntent(state: GameState, intent: DailyIntent): GameState {
  state.flow.selectedIntent = intent;
  if (intent === 'finish') {
    state.pendingDecision = { type: 'finish_confirmation' };
    state.flow.backStep = state.flow.step;
    state.flow.step = 'finish_confirmation';
  } else {
    state.flow.step = 'action_list';
  }
  return state;
}

export function chooseActionGroup(state: GameState, group: string): GameState {
  state.flow.selectedGroup = group;
  state.flow.step = 'action_list';
  return state;
}

export function selectAction(state: GameState, config: GameConfig, actionId: string): GameState {
  const action = findAction(config, actionId);
  const availability = getActionAvailability(state, action, config);
  if (!availability.available) throw new Error(availability.reason);

  if (action.configurationSteps && action.configurationSteps.length > 0) {
    state.pendingAction = {
      actionId,
      selectedAtDay: state.resources.day,
      confirmed: false
    };
    state.flow.step = 'action_configuration';
  } else {
    state.pendingAction = {
      actionId,
      selectedAtDay: state.resources.day,
      confirmed: true
    };
    state.flow.step = 'action_confirmation';
  }
  return state;
}

export function configureAction(
  state: GameState, 
  payload: { contentType?: ContentType; route?: RouteSelection; targetCohortId?: string }
): GameState {
  if (!state.pendingAction) throw new Error('No pending action to configure');
  if (payload.contentType) state.pendingAction.contentType = payload.contentType;
  if (payload.route) state.pendingAction.temporaryRoute = payload.route;
  if (payload.targetCohortId) state.pendingAction.targetCohortId = payload.targetCohortId;
  
  state.pendingAction.confirmed = true;
  state.flow.step = 'action_confirmation';
  return state;
}

export function cancelPendingAction(state: GameState): GameState {
  state.pendingAction = null;
  state.flow.step = 'action_list';
  return state;
}

// confirmAction, process action, result are in outcome.ts and engine.ts

export function completeDay(state: GameState, config: GameConfig): GameState {
  if (state.flow.step !== 'day_summary') {
    throw new Error('Cannot complete day outside of day_summary');
  }
  
  state.currentDayReport = null;
  state.lastOutcome = null;
  
  if (state.resources.day >= config.totalDays) {
    state.status = 'finished';
    state.flow.stage = 'final';
    state.flow.step = 'final_diagnosis';
    return state;
  }
  
  state.resources.day += 1;
  state.flow.step = 'daily_intro';
  
  // Advance pending decisions / deferred cohorts
  for (const cohort of state.cohorts) {
    if (cohort.deferredUntilDay === state.resources.day) {
      if (cohort.inboundDecision === 'deferred') cohort.inboundDecision = 'pending';
      if (cohort.salesDecision === 'deferred') cohort.salesDecision = 'pending';
      if (cohort.followupDecision === 'deferred') cohort.followupDecision = 'pending';
      cohort.deferredUntilDay = null;
    }
  }
  
  // Process scheduled actions that complete today
  for (const action of state.scheduledActions) {
    if (!action.completed && action.completesDay === state.resources.day) {
      action.completed = true;
      // Effects for scheduled actions are already applied on confirm (cost, cohorts).
      // If there are end-of-action effects, they'd go here.
    }
  }
  
  return state;
}
