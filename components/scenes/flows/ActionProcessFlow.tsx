import type { GameState, GameConfig } from '@/packages/game-engine/src';
import { NarrativeScreen } from '../ui';

type FlowProps = {
  state: GameState;
  config: GameConfig;
  dispatch: (action: string, payload?: Record<string, unknown>) => Promise<void>;
  busy: boolean;
};

export function ActionProcessFlow({ state, config, dispatch, busy }: FlowProps) {
  const action = config.actions.find((item) => item.id === state.lastOutcome?.actionId);

  return (
    <NarrativeScreen
      title="Действие в процессе"
      paragraphs={[
        `${state.player.name} весь день занимается задачей: ${state.lastOutcome?.title ?? action?.title ?? 'действие'}.`,
        action?.description ?? 'Сейчас станет понятно, что это принесло запуску.'
      ]}
      buttonText="Посмотреть результат"
      onNext={() => dispatch('acknowledge_action_process')}
      busy={busy}
    />
  );
}
