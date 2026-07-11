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
  
  const paragraphs = outcome ? [
    `Результат действия: ${outcome.title}`,
    `Затрачено дней: ${outcome.finishedDay - outcome.startedDay}`,
    `Охваты: ${outcome.impressionsDelta > 0 ? '+' : ''}${outcome.impressionsDelta}`,
    `Продажи: ${outcome.salesDelta > 0 ? '+' : ''}${outcome.salesDelta}`,
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
