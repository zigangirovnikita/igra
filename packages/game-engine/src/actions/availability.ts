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

  const executedUpgradeLevels = action.upgradeGroup
    ? getExecutedUpgradeLevels(state, config, action.upgradeGroup)
    : [];
  const maxExecutedLevel = executedUpgradeLevels.length > 0 ? Math.max(...executedUpgradeLevels) : 0;

  let finalCost = action.cost;
  if (action.upgradeCost !== undefined && action.upgradeGroup && maxExecutedLevel > 0) {
    finalCost = action.upgradeCost;
  }

  if (state.resources.bank < finalCost) {
    return { available: false, reason: `Не хватает ${finalCost - state.resources.bank} ₽` };
  }
  if (state.resources.energy < action.energyCost) {
    return { available: false, reason: `Не хватает ${Math.ceil(action.energyCost - state.resources.energy)} энергии` };
  }
  if (state.resources.day + action.days - 1 > config.totalDays) {
    return { available: false, reason: 'Не хватает игровых дней' };
  }
  if (action.group === 'instagram' && !state.audience.channels.includes('instagram')) {
    return { available: false, reason: 'Нет Instagram' };
  }
  if (action.group === 'telegram' && !state.audience.channels.includes('telegram')) {
    return { available: false, reason: 'Нет Telegram' };
  }
  if (action.group === 'contacts' && !state.audience.channels.includes('contacts')) {
    return { available: false, reason: 'Нет базы контактов' };
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
    const eligibleCohorts = state.cohorts.filter((cohort) => !state.history.some((historyEntry) =>
      historyEntry.type === 'action_completed' &&
      historyEntry.payload?.actionId === action.id &&
      historyEntry.payload?.cohortId === cohort.id
    ));
    if (eligibleCohorts.length === 0) {
      return { available: false, reason: 'Нет доступных когорт для этого действия' };
    }
  }

  if (action.upgradeGroup && action.upgradeLevel !== undefined) {
    if (maxExecutedLevel >= action.upgradeLevel) {
      return { available: false, reason: 'Уже выполнено или есть уровень выше' };
    }
    if (action.upgradeLevel > maxExecutedLevel + 1) {
      return { available: false, reason: 'Сначала выполните предыдущий уровень' };
    }
  }

  return { available: true };
}

function getExecutedUpgradeLevels(state: GameState, config: GameConfig, upgradeGroup: string): number[] {
  return state.history
    .filter((historyEntry) => historyEntry.type === 'action_completed' && historyEntry.payload?.actionId)
    .map((historyEntry) => {
      const executedAction = config.actions.find((candidate) => candidate.id === historyEntry.payload?.actionId);
      return executedAction?.upgradeGroup === upgradeGroup ? (executedAction.upgradeLevel ?? null) : null;
    })
    .filter((level): level is number => typeof level === 'number');
}

export function isManualEnergyAction(actionId: string): boolean {
  return ['manual_chat', 'calls', 'manual_followup', 'stories_3d', 'reels_7d', 'reels_stories_7d', 'live_stream', 'webinar'].includes(actionId);
}
