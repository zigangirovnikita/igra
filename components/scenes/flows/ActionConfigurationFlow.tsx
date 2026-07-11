import type { GameState, GameConfig } from '@/packages/game-engine/src';
import { MultiChoiceScreen } from '../ui';

type FlowProps = {
  state: GameState;
  config: GameConfig;
  dispatch: (action: string, payload?: Record<string, unknown>) => Promise<void>;
  busy: boolean;
};

export function ActionConfigurationFlow({ state: _state, dispatch, busy }: FlowProps) {
  // In a real implementation we would check `action.configurationSteps` and show different screens
  // For now just configure standard route/content type

  return (
    <MultiChoiceScreen
      title="Настройка действия"
      choices={[
        { id: 'useful', label: 'Полезный контент' },
        { id: 'storytelling', label: 'Сторителлинг' },
        { id: 'selling', label: 'Продающий контент' },
      ]}
      onConfirm={(id) => dispatch('configure_action', { contentType: id })}
      busy={busy}
    />
  );
}
