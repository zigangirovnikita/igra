import type { GameState, GameConfig } from '@/packages/game-engine/src';
import { MultiChoiceScreen } from '../ui';

type FlowProps = {
  state: GameState;
  config: GameConfig;
  dispatch: (action: string, payload?: Record<string, unknown>) => Promise<void>;
  busy: boolean;
};

export function DailyIntentFlow({ state, dispatch, busy }: FlowProps) {
  let introText = `День ${state.resources.day}. Что будем делать?`;
  const previousReport = state.dayReports.at(-1);
  const hadRecentSales = previousReport ? previousReport.outcome.salesDelta > 0 : false;

  if (previousReport) {
    if (previousReport.outcome.salesDelta > 0) {
      introText = 'Вчера пришли оплаты. Продолжить эту схему или усилить её?';
    } else if (previousReport.outcome.lostDelta > 0) {
      introText = 'Часть людей ушла без ответа. Нужно решить, как не повторить это.';
    } else {
      introText = 'Вчера продаж не было. Что попробовать теперь?';
    }
  }

  return (
    <MultiChoiceScreen
      title={introText}
      choices={[
        ...(hadRecentSales ? [
          { id: 'repeat_last', label: 'Повторить успешное действие' },
          { id: 'automate', label: 'Автоматизировать процесс' },
        ] : []),
        { id: 'get_sales', label: 'Попробовать получить продажи' },
        { id: 'fix_system', label: 'Исправить систему запуска' },
        { id: 'get_advice', label: 'Получить совет' },
        { id: 'restore_energy', label: 'Восстановить силы' },
        { id: 'finish', label: 'Завершить запуск' },
      ]}
      onConfirm={(id) => dispatch('choose_intent', { intent: id })}
      busy={busy}
      layout="list"
    />
  );
}
