import type { ActionConfig, GameCommand, GameConfig, GameState, ScheduledAction } from '../types';
import { assertStateInvariants } from '../state/invariants';
import { calculateDiagnostics } from '../diagnostics/report';
import { advanceDays, completeAction, recalculateMetrics } from '../time/ticks';
import { applyProcessing } from '../calculations/funnel';
import { findAction, getActionAvailability } from './availability';

export function applyCommand(input: GameState, config: GameConfig, command: GameCommand): GameState {
  if (input.appliedCommandIds.includes(command.commandId)) return input;
  if (input.status === 'finished' && command.type !== 'finish_game') {
    throw new Error('Finished session does not accept game commands');
  }

  let state = structuredClone(input);
  if (command.type === 'start_action') {
    state = startAction(state, config, findAction(config, command.payload.actionId), command.payload);
  } else if (command.type === 'set_route') {
    state.activeRoute = command.payload;
    state.history.push({ day: state.resources.day, type: 'route_changed', message: 'Маршрут обновлён' });
  } else if (command.type === 'set_plan') {
    state.initialPlan = command.payload;
    state.history.push({ day: state.resources.day, type: 'initial_plan_set', message: 'Первоначальный план запуска сохранён' });
  } else if (command.type === 'start_parallel') {
    state = startParallel(state, config, command.payload.actionAId, command.payload.actionBId, command.payload);
  } else if (command.type === 'resolve_mini_game') {
    state = resolveMiniGame(state, config, command.payload.cohortId, command.payload.mode, command.payload.processed);
  } else if (command.type === 'finish_game') {
    state = finishGame(state, config);
  }

  state.appliedCommandIds.push(command.commandId);
  state.stateVersion += 1;
  assertStateInvariants(state, config);
  return state;
}

export function finishGame(input: GameState, config: GameConfig): GameState {
  const state = advanceDays(input, config, config.totalDays);
  recalculateMetrics(state);
  state.status = 'finished';
  state.diagnostics = calculateDiagnostics(state, config);
  return state;
}

function startAction(
  input: GameState,
  config: GameConfig,
  action: ActionConfig,
  payload: Record<string, unknown>
): GameState {
  const availability = getActionAvailability(input, action, config);
  if (!availability.available) throw new Error(availability.reason);
  let state = structuredClone(input);
  state.resources.bank -= action.cost;
  state.resources.energy = Math.max(0, state.resources.energy - action.energyCost);
  state.metrics.expenses += action.cost;
  if (payload.route && typeof payload.route === 'object') {
    state.activeRoute = payload.route as GameState['activeRoute'];
  }
  state.scheduledActions.push(toScheduledAction(state, action, payload));
  if (action.days === 0) {
    state = completeAction(state, config, state.scheduledActions[state.scheduledActions.length - 1]);
    state.scheduledActions[state.scheduledActions.length - 1].completed = true;
  }
  state.history.push({
    day: state.resources.day,
    type: 'action_started',
    message: `Начато действие: ${action.title}`,
    payload: { actionId: action.id }
  });
  const target = Math.min(config.totalDays, state.resources.day + Math.max(0, action.days));
  return advanceDays(state, config, target);
}

function startParallel(
  input: GameState,
  config: GameConfig,
  actionAId: string,
  actionBId: string,
  payload: Record<string, unknown>
): GameState {
  if (input.resources.energy < 15) throw new Error('Параллельные ручные действия запрещены при энергии ниже 15');
  const actionA = findAction(config, actionAId);
  const actionB = findAction(config, actionBId);
  const allowed = isAllowedParallel(actionA.id, actionB.id);
  if (!allowed) throw new Error('Эта параллельная комбинация не разрешена');
  for (const action of [actionA, actionB]) {
    const availability = getActionAvailability(input, action, config);
    if (!availability.available) throw new Error(availability.reason);
  }
  const state = structuredClone(input);
  state.resources.bank -= actionA.cost + actionB.cost;
  state.resources.energy = Math.max(0, state.resources.energy - Math.ceil((actionA.energyCost + actionB.energyCost) * 1.15));
  if (payload.route && typeof payload.route === 'object') {
    state.activeRoute = payload.route as GameState['activeRoute'];
  }
  state.scheduledActions.push(toScheduledAction(state, actionA, payload, actionA.days));
  state.scheduledActions.push(toScheduledAction(state, actionB, payload, actionB.days));
  state.history.push({
    day: state.resources.day,
    type: 'action_started',
    message: `Начата параллельная связка: ${actionA.title} + ${actionB.title}`,
    payload: { actionAId, actionBId }
  });
  return advanceDays(state, config, Math.min(config.totalDays, state.resources.day + Math.max(actionA.days, actionB.days) + 1));
}

function resolveMiniGame(input: GameState, config: GameConfig, cohortId: string, mode: 'manual' | 'auto', processed?: number): GameState {
  const state = structuredClone(input);
  const cohortIndex = state.cohorts.findIndex((item) => item.id === cohortId);
  if (cohortIndex === -1) throw new Error(`Unknown cohort: ${cohortId}`);
  
  if (mode === 'auto') {
    const capacity = (state.player.superpowers.includes('energy') ? 25 : 15) * 1.0; 
    state.cohorts[cohortIndex] = applyProcessing(state, config, state.cohorts[cohortIndex], 'manual', capacity);
  } else {
    state.cohorts[cohortIndex] = applyProcessing(state, config, state.cohorts[cohortIndex], 'manual', processed);
    if (processed && processed > 0) {
      state.resources.energy = Math.max(0, state.resources.energy - processed * 0.3); // 0.3 energy per response
    }
  }
  
  state.metrics.miniGameCount += 1;
  recalculateMetrics(state);
  return state;
}

function toScheduledAction(
  state: GameState,
  action: ActionConfig,
  payload: Record<string, unknown>,
  daysOverride?: number
): ScheduledAction {
  const days = daysOverride ?? action.days;
  return {
    id: `${action.id}_${state.resources.day}_${state.scheduledActions.length}`,
    actionId: action.id,
    startedDay: state.resources.day,
    completesDay: Math.min(30, state.resources.day + Math.max(0, days - 1)),
    payload,
    completed: days === 0
  };
}

function isAllowedParallel(actionAId: string, actionBId: string): boolean {
  const pair = new Set([actionAId, actionBId]);
  const hasContent = ['stories_3d', 'reels_7d', 'live_stream', 'webinar'].some((id) => pair.has(id));
  const hasBot = ['simple_bot_self', 'simple_bot_specialist', 'ai_bot_self', 'ai_bot_specialist'].some((id) => pair.has(id));
  const hasGuideVideo = ['guide_self', 'guide_specialist', 'video_self', 'video_specialist'].some((id) => pair.has(id));
  if (hasContent && (hasBot || hasGuideVideo)) return true;
  if (pair.has('calls') && pair.has('manual_followup')) return true;
  if (pair.has('telegram_warmup') && pair.has('reels_7d')) return true;
  return false;
}
