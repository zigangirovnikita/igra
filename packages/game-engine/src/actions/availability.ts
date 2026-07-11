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
  let finalCost = action.cost;
  if (action.repeatPolicy === 'upgrade' && action.upgradeCost !== undefined && action.upgradeGroup) {
    const hasPrevious = state.history.some(h => {
      if (h.type !== 'action_completed' || !h.payload?.actionId) return false;
      const prevA = config.actions.find(a => a.id === h.payload!.actionId);
      return prevA?.upgradeGroup === action.upgradeGroup;
    });
    if (hasPrevious) finalCost = action.upgradeCost;
  }

  if (state.resources.bank < finalCost) return { available: false, reason: `Не хватает ${finalCost - state.resources.bank} ₽` };
  if (state.resources.energy <= 0 && isManualEnergyAction(action.id)) {
    return { available: false, reason: 'Нет энергии для ручного действия' };
  }
  if (state.resources.day + action.days - 1 > config.totalDays) {
    return { available: false, reason: 'Не хватает игровых дней' };
  }
  if (!action.requirements.every((condition) => evaluateCondition(state, condition))) {
    return { available: false, reason: 'Не выполнены условия действия' };
  }
  if (action.repeatPolicy === 'never' && state.history.some((entry) => entry.type === 'action_completed' && entry.payload?.actionId === action.id)) {
    return { available: false, reason: 'Действие уже выполнено' };
  }

  if (action.repeatPolicy === 'once_per_cohort') {
    if (state.cohorts.length === 0) {
      return { available: false, reason: 'Нет запущенных когорт' };
    }
    // We check this fully during selection/configuration if targetCohortId is present.
    // For general availability, it's available if there's AT LEAST ONE cohort that hasn't had this action yet.
    const eligibleCohorts = state.cohorts.filter(c => {
      return !state.history.some(h =>
        h.type === 'action_completed' &&
        h.payload?.actionId === action.id &&
        h.payload?.cohortId === c.id
      );
    });
    if (eligibleCohorts.length === 0) {
      return { available: false, reason: 'Нет доступных когорт для этого действия' };
    }
  }

  if (action.repeatPolicy === 'upgrade' && action.upgradeGroup) {
    const executedUpgrades = state.history
      .filter(h => h.type === 'action_completed' && h.payload?.actionId)
      .map(h => {
        const a = config.actions.find(act => act.id === h.payload!.actionId);
        return a?.upgradeGroup === action.upgradeGroup ? (a?.upgradeLevel ?? null) : null;
      })
      .filter((level): level is number => typeof level === 'number');

    const maxExecutedLevel = executedUpgrades.length > 0 ? Math.max(...executedUpgrades) : 0;

    if (action.upgradeLevel !== undefined && maxExecutedLevel >= action.upgradeLevel) {
      return { available: false, reason: 'Уже выполнено или есть уровень выше' };
    }
  }
  return { available: true };
}

export function isManualEnergyAction(actionId: string): boolean {
  return ['manual_chat', 'calls', 'manual_followup', 'stories_3d', 'reels_7d', 'reels_stories_7d', 'live_stream', 'webinar'].includes(actionId);
}
