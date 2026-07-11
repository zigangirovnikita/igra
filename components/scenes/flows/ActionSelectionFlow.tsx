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
  website: 'Сайт и путь клиента',
  processing: 'Улучшить обработку входящих'
};

export function ActionSelectionFlow({ state, config, dispatch, busy }: FlowProps) {
  const intent = state.flow.selectedIntent;

  if (intent === 'fix_system' && !state.flow.selectedGroup) {
    const groups = ['demand', 'product', 'nurture', 'website', 'processing'];

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
    if (intent === 'fix_system' && a.group !== state.flow.selectedGroup) return false;
    if (a.uiVisible === false) return false;
    return true;
  });

  return (
    <MultiChoiceScreen
      title="Выберите действие"
      choices={[
        ...actions.map(a => {
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
