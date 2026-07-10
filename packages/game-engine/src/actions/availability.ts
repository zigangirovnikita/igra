import type { ActionConfig, GameConfig, GameState } from '../types';
import { evaluateCondition } from './dsl';

export type Availability = { available: true } | { available: false; reason: string };

export function findAction(config: GameConfig, actionId: string): ActionConfig {
  const action = config.actions.find((item) => item.id === actionId && item.enabled);
  if (!action) throw new Error(`Unknown or disabled action: ${actionId}`);
  return action;
}

export function getActionAvailability(state: GameState, action: ActionConfig, config: GameConfig): Availability {
  if (state.status === 'finished') return { available: false, reason: 'Сессия уже завершена' };
  if (state.resources.bank < action.cost) return { available: false, reason: `Не хватает ${action.cost - state.resources.bank} ₽` };
  if (state.resources.energy <= 0 && isManualEnergyAction(action.id)) {
    return { available: false, reason: 'Нет энергии для ручного действия' };
  }
  if (state.resources.day + action.days - 1 > config.totalDays) {
    return { available: false, reason: 'Не хватает игровых дней' };
  }
  if (!action.requirements.every((condition) => evaluateCondition(state, condition))) {
    return { available: false, reason: 'Не выполнены условия действия' };
  }
  if (action.repeatPolicy === 'never' && state.history.some((entry) => entry.type === 'action_started' && entry.payload?.actionId === action.id)) {
    return { available: false, reason: 'Действие уже выполнено' };
  }
  return { available: true };
}

export function isManualEnergyAction(actionId: string): boolean {
  return ['manual_chat', 'calls', 'manual_followup', 'stories_3d', 'reels_7d', 'reels_stories_7d', 'live_stream', 'webinar'].includes(actionId);
}
