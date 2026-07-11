import type { GameState, GameConfig } from '@/packages/game-engine/src';
import { NarrativeScreen } from '../ui';

type FlowProps = {
  state: GameState;
  config: GameConfig;
  dispatch: (action: string, payload?: Record<string, unknown>) => Promise<void>;
  busy: boolean;
};

export function ActionResultFlow({ state, dispatch, busy }: FlowProps) {
  const outcome = state.lastOutcome;
  if (outcome && ['friend_advice', 'smm_advice', 'consultation_basic', 'consultation_detailed'].includes(outcome.actionId)) {
    return (
      <div className="scene-step scene-step--center">
        <h2 className="scene-headline">Совет получен</h2>
        <div className="scene-text-block">
          {adviceParagraphs(outcome.actionId).map((line) => <p className="scene-paragraph" key={line}>{line}</p>)}
          <p className="scene-paragraph">
            Потрачено: {outcome.finishedDay - outcome.startedDay + 1} дн., {Math.abs(outcome.bankDelta).toLocaleString('ru-RU')} ₽, {Math.abs(outcome.energyDelta)} энергии.
          </p>
        </div>
        <div className="scene-actions">
          <button className="btn-primary" disabled={busy} onClick={() => dispatch('follow_advice')}>
            Последовать совету
          </button>
          <button className="btn-secondary" disabled={busy} onClick={() => dispatch('acknowledge_action_result')}>
            Сохранить вывод и выбрать другое
          </button>
        </div>
      </div>
    );
  }
  
  const paragraphs = outcome ? [
    `Результат действия: ${outcome.title}`,
    `Затрачено дней: ${outcome.finishedDay - outcome.startedDay + 1}`,
    `Охваты: ${formatDelta(outcome.impressionsDelta)}`,
    `Входящие: ${formatDelta(outcome.inboundDelta)}`,
    `Обработано: ${formatDelta(outcome.processedDelta)}`,
    `Заявки: ${formatDelta(outcome.applicationsDelta)}`,
    `Записи на созвон: ${formatDelta(outcome.bookedCallsDelta)}`,
    `Проведённые созвоны: ${formatDelta(outcome.heldCallsDelta)}`,
    `Продажи: ${formatDelta(outcome.salesDelta)}`,
    `Выручка: ${formatMoney(outcome.revenueDelta)}`,
    `Потеряно входящих/заявок: ${formatDelta(outcome.lostDelta)}`,
    `Деньги: ${formatMoney(outcome.bankDelta)}`,
    `Энергия: ${formatDelta(outcome.energyDelta)}`,
  ] : ['Действие завершено.'];

  return (
    <NarrativeScreen
      title="Действие завершено"
      paragraphs={paragraphs}
      buttonText="Продолжить"
      onNext={() => dispatch('acknowledge_action_result')}
      busy={busy}
    />
  );
}

function adviceParagraphs(actionId: string): string[] {
  if (actionId === 'friend_advice') {
    return ['Подруга поддержала эмоционально, но совет получился общим.', 'Главный риск: можно снова делать контент без проверки спроса.'];
  }
  if (actionId === 'smm_advice') {
    return ['Знакомый SMM смотрит прежде всего на контент и охваты.', 'Рекомендация: усилить маршрут из контента в следующий шаг, а не просто публиковать чаще.'];
  }
  if (actionId === 'consultation_basic') {
    return ['Специалист видит один главный риск: люди не понимают, зачем им идти дальше.', 'Рекомендация: добавить прогрев или понятный вход перед продажей.'];
  }
  return ['Подробная диагностика показала узкое место, вторичную проблему и порядок исправлений.', 'Рекомендация: сначала усилить обработку входящих, затем добавить дожим и только потом масштабировать охваты.'];
}

function formatDelta(value: number): string {
  const rounded = Math.round(value);
  return `${rounded > 0 ? '+' : ''}${rounded.toLocaleString('ru-RU')}`;
}

function formatMoney(value: number): string {
  const rounded = Math.round(value);
  return `${rounded > 0 ? '+' : ''}${rounded.toLocaleString('ru-RU')} ₽`;
}
