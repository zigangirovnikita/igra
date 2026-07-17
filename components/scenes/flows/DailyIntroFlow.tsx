import type { GameConfig, GameState } from '@/packages/game-engine/src';
import { NarrativeScreen } from '../ui';

type FlowProps = {
  state: GameState;
  config: GameConfig;
  dispatch: (action: string, payload?: Record<string, unknown>) => Promise<void>;
  busy: boolean;
};

export function DailyIntroFlow({ state, dispatch, busy }: FlowProps) {
  const previousReport = state.dayReports.at(-1);
  let introText = 'Начинается новый день запуска.';

  if (previousReport) {
    if (previousReport.outcome.salesDelta > 0) {
      introText = `Вчера пришло продаж: ${previousReport.outcome.salesDelta}. Выручка выросла на ${previousReport.outcome.revenueDelta.toLocaleString('ru-RU')} ₽.`;
    } else if (previousReport.outcome.inboundDelta > 0) {
      introText = `Вчера пришло ${previousReport.outcome.inboundDelta} входящих, но продаж пока не было.`;
    } else {
      introText = 'Вчера продаж не было. Стоит проверить спрос, маршрут или обработку заявок.';
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
