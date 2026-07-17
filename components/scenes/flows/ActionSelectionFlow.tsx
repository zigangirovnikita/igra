import type { GameState, GameConfig, ActionConfig } from '@/packages/game-engine/src';
import { MultiChoiceScreen } from '../ui';
import { getActionAvailability } from '@/packages/game-engine/src/actions/availability';

type FlowProps = {
  state: GameState;
  config: GameConfig;
  dispatch: (action: string, payload?: Record<string, unknown>) => Promise<void>;
  busy: boolean;
};

const GROUP_LABELS: Record<string, string> = {
  demand: 'Проверить спрос',
  product: 'Изменить продукт',
  nurture: 'Добавить прогрев',
  route: 'Изменить путь клиента',
  processing: 'Улучшить обработку входящих',
  followup: 'Добавить дожим',
  sale_method: 'Изменить способ продажи',
};

export function ActionSelectionFlow({ state, config, dispatch, busy }: FlowProps) {
  const intent = state.flow.selectedIntent;

  if (intent === 'fix_system' && !state.flow.selectedGroup) {
    const groups = ['demand', 'product', 'nurture', 'route', 'processing', 'followup', 'sale_method'];

    return (
      <MultiChoiceScreen
        title="Что именно будем исправлять?"
        description="Выберите часть системы, которую хотите изменить сегодня."
        choices={groups.map((group) => ({
          id: group,
          label: GROUP_LABELS[group] || group,
          icon: groupIcon(group),
        }))}
        onConfirm={(id) => dispatch('choose_action_group', { group: id })}
        secondaryText="← Назад"
        onSecondary={() => dispatch('choose_intent', { intent: null })}
        busy={busy}
        layout="list"
      />
    );
  }

  const actions = config.actions.filter((action) => {
    if (action.intent !== intent) return false;
    if (intent === 'fix_system' && !belongsToFixGroup(action.group, state.flow.selectedGroup)) return false;
    if (action.uiVisible === false) return false;
    return true;
  });
  const actionPool = intent === 'get_sales' ? availableSalesActionsOrFallback(state, config, actions) : actions;

  return (
    <MultiChoiceScreen
      title={titleForIntent(intent, state.flow.selectedGroup)}
      description="Варианты отличаются ценой, сроком и расходом энергии. Более дорогой вариант не требует сначала выполнять дешёвый."
      choices={actionPool.map((action) => {
        const availability = getActionAvailability(state, action as ActionConfig, config);
        const finalCost = getDisplayedCost(state, config, action);

        return {
          id: action.id,
          label: action.title,
          icon: actionIcon(action.id),
          description: `Время: ${action.days} дн. · Энергия: ${action.energyCost} · Цена: ${finalCost.toLocaleString('ru-RU')} ₽`,
          disabled: !availability.available,
          disabledReason: availability.available ? undefined : availability.reason,
        };
      })}
      onConfirm={(id) => dispatch('select_action', { actionId: id })}
      secondaryText="← Назад"
      onSecondary={() => {
        if (intent === 'fix_system') {
          void dispatch('choose_action_group', { group: null });
        } else {
          void dispatch('choose_intent', { intent: null });
        }
      }}
      busy={busy}
      layout="list"
    />
  );
}

function getDisplayedCost(state: GameState, config: GameConfig, action: ActionConfig): number {
  if (action.upgradeCost === undefined || !action.upgradeGroup) return action.cost;
  const hasPrevious = state.history.some((historyEntry) => {
    if (historyEntry.type !== 'action_completed' || !historyEntry.payload?.actionId) return false;
    const previousAction = config.actions.find((candidate) => candidate.id === historyEntry.payload?.actionId);
    return previousAction?.upgradeGroup === action.upgradeGroup;
  });
  return hasPrevious ? action.upgradeCost : action.cost;
}

function belongsToFixGroup(actionGroup: string, selectedGroup: string | null): boolean {
  if (!selectedGroup) return false;
  if (selectedGroup === 'route') return ['website', 'nurture'].includes(actionGroup);
  if (selectedGroup === 'followup') return actionGroup === 'followup';
  if (selectedGroup === 'sale_method') return ['sales', 'website', 'bot', 'webinar_sale'].includes(actionGroup);
  return actionGroup === selectedGroup;
}

function availableSalesActionsOrFallback(state: GameState, config: GameConfig, actions: ActionConfig[]): ActionConfig[] {
  const visible = actions.filter((action) => getActionAvailability(state, action, config).available);
  if (visible.length > 0) return visible;
  const fallbackIds = ['demand_poll', 'demand_interviews', 'demand_pilot_offer'];
  return config.actions.filter((action) => fallbackIds.includes(action.id) && action.enabled && action.uiVisible !== false);
}

function titleForIntent(intent: string | null, selectedGroup: string | null): string {
  if (intent === 'get_sales') return 'Каким способом привлекать людей?';
  if (intent === 'get_advice') return 'С кем посоветоваться?';
  if (intent === 'restore_energy') return 'Как отдохнуть?';
  if (intent === 'fix_system' && selectedGroup) return GROUP_LABELS[selectedGroup] ?? 'Что изменить?';
  return 'Выберите действие';
}

function groupIcon(group: string): string {
  if (group === 'demand') return '🔎';
  if (group === 'product') return '📦';
  if (group === 'nurture') return '🔥';
  if (group === 'route') return '🧭';
  if (group === 'processing') return '⚙️';
  if (group === 'followup') return '🔁';
  return '💳';
}

function actionIcon(actionId: string): string {
  if (actionId.includes('guide')) return '📘';
  if (actionId.includes('video')) return '🎬';
  if (actionId.includes('bot')) return '🤖';
  if (actionId.includes('website')) return '🌐';
  if (actionId.includes('consultation') || actionId.includes('advice')) return '💬';
  if (actionId.includes('demand') || actionId.includes('poll') || actionId.includes('interviews')) return '🔎';
  if (actionId.includes('product')) return '📦';
  if (actionId.includes('reels') || actionId.includes('stories')) return '📱';
  if (actionId.includes('webinar') || actionId.includes('live')) return '🎙️';
  if (actionId.includes('manager')) return '👤';
  return '⚡';
}
