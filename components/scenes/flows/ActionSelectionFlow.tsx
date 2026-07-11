import type { GameState, GameConfig } from '@/packages/game-engine/src';
import { MultiChoiceScreen } from '../ui';

type FlowProps = {
  state: GameState;
  config: GameConfig;
  dispatch: (action: string, payload?: Record<string, unknown>) => Promise<void>;
  busy: boolean;
};

export function ActionSelectionFlow({ state, config, dispatch, busy }: FlowProps) {
  const intent = state.flow.selectedIntent;
  const actions = config.actions.filter(a => a.intent === intent && a.uiVisible !== false);

  return (
    <MultiChoiceScreen
      title="Выберите действие"
      choices={actions.map(a => ({
        id: a.id,
        label: a.title,
        description: `Время: ${a.days} дн. | Энергия: ${a.energyCost} | Цена: ${a.cost} ₽`
      }))}
      onConfirm={(id) => dispatch('select_action', { actionId: id })}
      busy={busy}
    />
  );
}
