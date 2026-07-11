import type { GameState, GameConfig } from '@/packages/game-engine/src';
import { MultiChoiceScreen } from '../ui';

type FlowProps = {
  state: GameState;
  config: GameConfig;
  dispatch: (action: string, payload?: Record<string, unknown>) => Promise<void>;
  busy: boolean;
};

export function BudgetCrisisFlow({ state, dispatch, busy }: FlowProps) {
  return (
    <MultiChoiceScreen
      title="Бюджет закончился"
      description={`${state.player.name} больше не может оплачивать платные действия. Бесплатные шаги остаются доступными, но дорогие инструменты будут заблокированы.`}
      choices={[
        { id: 'continue_without_budget', label: 'Продолжить без бюджета' },
        { id: 'confirm', label: 'Завершить запуск' },
      ]}
      onConfirm={(action) => dispatch('resolve_pending_decision', { action })}
      busy={busy}
      layout="list"
    />
  );
}
