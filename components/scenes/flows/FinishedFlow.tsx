import type { GameState, GameConfig } from '@/packages/game-engine/src';
import { NarrativeScreen } from '../ui';

type FlowProps = {
  state: GameState;
  config: GameConfig;
  dispatch: (action: string, payload?: Record<string, unknown>) => Promise<void>;
  busy: boolean;
};

export function FinishedFlow({ state, dispatch, busy }: FlowProps) {
  return (
    <NarrativeScreen
      title="Конец игры"
      paragraphs={[
        `Причина завершения: ${state.endingReason || 'Неизвестно'}`,
        `Выручка: ${state.metrics.revenue.toLocaleString('ru-RU')} ₽`
      ]}
      buttonText="Начать заново"
      onNext={() => {
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      }}
      busy={busy}
    />
  );
}
