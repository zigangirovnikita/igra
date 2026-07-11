import type { GameState, GameConfig } from '@/packages/game-engine/src';
import { NarrativeScreen } from '../ui';

type FlowProps = {
  state: GameState;
  config: GameConfig;
  dispatch: (action: string, payload?: Record<string, unknown>) => Promise<void>;
  busy: boolean;
};

export function DailyIntroFlow({ state, dispatch, busy }: FlowProps) {
  let introText = `Начинается новый день запуска.`;
  
  if (state.lastOutcome) {
    if (state.lastOutcome.salesDelta > 0) {
      introText = 'Вчера пришли оплаты. Что будем делать сегодня?';
    } else {
      introText = 'Вчера продаж не было. Нужно что-то менять.';
    }
  }

  return (
    <NarrativeScreen
      title={`День ${state.resources.day}`}
      paragraphs={[introText]}
      buttonText="Что будем делать?"
      onNext={() => dispatch('advance_daily_intro')}
      busy={busy}
    />
  );
}
