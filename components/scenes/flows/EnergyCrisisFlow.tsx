import type { GameState, GameConfig } from '@/packages/game-engine/src';
import { MultiChoiceScreen } from '../ui';

type FlowProps = {
  state: GameState;
  config: GameConfig;
  dispatch: (action: string, payload?: Record<string, unknown>) => Promise<void>;
  busy: boolean;
};

export function EnergyCrisisFlow({ state, config, dispatch, busy }: FlowProps) {
  const choices = [];
  if (state.resources.day + 1 <= config.totalDays) choices.push({ id: 'rest_day', label: 'Отдохнуть один день' });
  if (state.resources.day + 2 <= config.totalDays) choices.push({ id: 'rest_two_days', label: 'Отдохнуть два дня' });
  if (state.resources.bank >= 5_000) choices.push({ id: 'delegate', label: 'Делегировать за 5 000 ₽' });
  choices.push({ id: 'confirm', label: 'Завершить запуск' });
  return <MultiChoiceScreen title="Энергия закончилась" description="Выберите, как восстановить возможность продолжить запуск."
    choices={choices} onConfirm={(action) => dispatch('resolve_pending_decision', { action })} busy={busy} />;
}
