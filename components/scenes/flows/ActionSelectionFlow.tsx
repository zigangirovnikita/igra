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
  sale_method: 'Изменить способ продажи'
};

export function ActionSelectionFlow({ state, config, dispatch, busy }: FlowProps) {
  const intent = state.flow.selectedIntent;

  if (intent === 'fix_system' && !state.flow.selectedGroup) {
    const groups = ['demand', 'product', 'nurture', 'route', 'processing', 'followup', 'sale_method'];

    return (
      <MultiChoiceScreen
        title="Что именно будем исправлять?"
        choices={[
          ...groups.map(g => ({
            id: g,
            label: GROUP_LABELS[g] || g
          })),
          { id: 'back', label: '← Назад' }
        ]}
        onConfirm={(id) => {
          if (id === 'back') {
            dispatch('choose_intent', { intent: null });
          } else {
            dispatch('choose_action_group', { group: id });
          }
        }}
        busy={busy}
        layout="list"
      />
    );
  }

  const actions = config.actions.filter(a => {
    if (a.intent !== intent) return false;
    if (intent === 'fix_system' && !belongsToFixGroup(a.group, state.flow.selectedGroup)) return false;
    if (a.uiVisible === false) return false;
    return true;
  });
  const actionPool = intent === 'get_sales' ? availableSalesActionsOrFallback(state, config, actions) : actions;

  return (
    <MultiChoiceScreen
      title={titleForIntent(intent, state.flow.selectedGroup)}
      choices={[
        ...actionPool.map(a => {
          const availability = getActionAvailability(state, a as ActionConfig, config);

          let finalCost = a.cost;
          if (a.repeatPolicy === 'upgrade' && a.upgradeCost !== undefined && a.upgradeGroup) {
            const hasPrevious = state.history.some(h => {
              if (h.type !== 'action_completed' || !h.payload?.actionId) return false;
              const prevA = config.actions.find(act => act.id === h.payload!.actionId);
              return prevA?.upgradeGroup === a.upgradeGroup;
            });
            if (hasPrevious) finalCost = a.upgradeCost;
          }

          return {
            id: a.id,
            label: a.title,
            description: `Время: ${a.days} дн. | Энергия: ${a.energyCost} | Цена: ${finalCost} ₽${availability.available ? '' : ` (${availability.reason})`}`,
            disabled: !availability.available
          };
        }),
        { id: 'back', label: '← Назад' }
      ]}
      onConfirm={(id) => {
        if (id === 'back') {
          if (intent === 'fix_system') {
            dispatch('choose_action_group', { group: null });
          } else {
            dispatch('choose_intent', { intent: null });
          }
        } else {
          dispatch('select_action', { actionId: id });
        }
      }}
      busy={busy}
      layout="list"
    />
  );
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
