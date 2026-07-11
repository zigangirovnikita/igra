import type { GameState, GameConfig } from '@/packages/game-engine/src';
import { NarrativeScreen } from '../ui';

type FlowProps = {
  state: GameState;
  config: GameConfig;
  dispatch: (action: string, payload?: Record<string, unknown>) => Promise<void>;
  busy: boolean;
};

export function IntroFlow({ state, dispatch, busy }: FlowProps) {
  if (state.flow.step === 'intro_budget') {
    return (
      <NarrativeScreen
        title="Ваш бюджет"
        paragraphs={['У вас есть 100 000 ₽ на запуск.']}
        buttonText="Дальше →"
        onNext={() => dispatch('advance_intro')}
        busy={busy}
      />
    );
  }
  return (
    <NarrativeScreen
      title="Пора начинать"
      paragraphs={['Время не ждет!']}
      buttonText="Создать продукт →"
      onNext={() => dispatch('advance_intro')}
      busy={busy}
    />
  );
}
