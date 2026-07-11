import type { GameState, GameConfig, DailyIntent, RouteSelection, ContentType } from '../types';
import { getActionAvailability, findAction } from '../actions/availability';
import { deriveNextPendingDecision } from './pending-decisions';
import { generateMiniGameSession } from '../calculations/minigame';

export function chooseIntent(state: GameState, config: GameConfig, intent: DailyIntent | null): GameState {
  if (!intent) {
    state.flow.selectedIntent = null;
    state.flow.step = 'daily_intent';
    return state;
  }
  if (state.flow.step !== 'daily_intent') throw new Error('Invalid step for intent selection');

  state.flow.selectedIntent = intent;
  if (intent === 'finish') {
    state.pendingDecision = { type: 'finish_confirmation', returnStep: state.flow.step };
    state.flow.backStep = state.flow.step;
    state.flow.step = 'finish_confirmation';
  } else if (intent === 'repeat_last') {
    const lastActionId = [...state.history]
      .reverse()
      .find((entry) => entry.type === 'action_completed' && typeof entry.payload?.actionId === 'string')
      ?.payload?.actionId;
    if (!lastActionId) throw new Error('Нет действия для повтора');
    state.flow.step = 'action_list';
    return selectAction(state, config, String(lastActionId));
  } else if (intent === 'automate') {
    state.flow.selectedIntent = 'fix_system';
    state.flow.selectedGroup = 'processing';
    state.flow.step = 'action_list';
  } else {
    state.flow.step = 'action_list';
  }
  return state;
}

export function chooseActionGroup(state: GameState, group: string | null): GameState {
  if (!group) {
    state.flow.selectedGroup = null;
    // Keep on action_list to re-select group
    return state;
  }
  if (state.flow.step !== 'action_list') throw new Error('Invalid step for action group selection');
  state.flow.selectedGroup = group;
  state.flow.step = 'action_list';
  return state;
}

export function selectAction(state: GameState, config: GameConfig, actionId: string): GameState {
  if (state.flow.step !== 'action_list') throw new Error('Invalid step for action selection');
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
  if (state.flow.step !== 'action_configuration') throw new Error('Invalid step for action configuration');
  if (!state.pendingAction) throw new Error('No pending action to configure');
  if (payload.contentType) state.pendingAction.contentType = payload.contentType;
  
  if (payload.route) {
    const assetError = validateRouteAssets(state, payload.route);
    if (assetError) throw new Error(assetError);
    state.pendingAction.temporaryRoute = payload.route;
  }
  
  if (payload.targetCohortId) state.pendingAction.targetCohortId = payload.targetCohortId;

  const actionNeedsDestination = Boolean(payload.contentType) && !payload.route;
  if (actionNeedsDestination) {
    state.flow.step = 'action_configuration';
    return state;
  }
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

  if (state.currentDayReport && !state.dayReports.some((report) => report.id === state.currentDayReport?.id)) {
    state.dayReports.push(state.currentDayReport);
  }
  state.currentDayReport = null;
  state.lastOutcome = null;

  if (state.resources.day >= config.totalDays) {
    state.endingReason = 'time_finished';
    state.flow.stage = 'final';
    state.flow.step = 'final_reason';
    return state;
  }

  state.flow.step = 'daily_intro';

  // Advance pending decisions / deferred cohorts
  for (const cohort of state.cohorts) {
    if (cohort.deferredUntilDay !== null && cohort.deferredUntilDay <= state.resources.day) {
      if (cohort.inboundDecision === 'deferred') cohort.inboundDecision = 'pending';
      if (cohort.salesDecision === 'deferred') cohort.salesDecision = 'pending';
      if (cohort.followupDecision === 'deferred') cohort.followupDecision = 'pending';
      cohort.deferredUntilDay = null;
    }
  }

  // Enforce pending decisions order at the start of the day
  state.pendingDecision = deriveNextPendingDecision(state);
  if (state.pendingDecision?.type === 'mini_game') {
    state.miniGame = generateMiniGameSession(state, state.pendingDecision.cohortId);
  }

  return state;
}

export function validateRouteAssets(state: GameState, route: RouteSelection): string | null {
  if (route.entry === 'guide' && !state.assets.guide) return 'Нет ассета: Гайд';
  if (route.entry === 'video_lesson' && !state.assets.videoLesson) return 'Нет ассета: Видеоурок';
  if (route.entry === 'website' && !state.assets.website) return 'Нет ассета: Сайт';
  
  if (route.nurture.includes('guide') && !state.assets.guide) return 'Нет ассета: Гайд';
  if (route.nurture.includes('video_lesson') && !state.assets.videoLesson) return 'Нет ассета: Видеоурок';
  
  if (route.processing === 'simple_bot' && !state.assets.simpleBot) return 'Нет ассета: Простой бот';
  if (route.processing === 'ai_bot' && !state.assets.aiBot) return 'Нет ассета: ИИ Бот';
  if (route.processing === 'manager' && !state.assets.manager) return 'Нет ассета: Менеджер';
  if (route.processing === 'website_auto' && !state.assets.website) return 'Нет ассета: Сайт';
  
  if (route.saleMethod === 'website_auto' && !state.assets.website) return 'Нет ассета: Сайт';
  
  if (route.followup === 'bot' && !state.assets.simpleBot && !state.assets.aiBot) return 'Нет ассета: Бот для дожимов';
  
  return null;
}
