import type { GameState, GameConfig } from '@/packages/game-engine/src';
import { MultiChoiceScreen } from '../ui';

type FlowProps = {
  state: GameState;
  config: GameConfig;
  dispatch: (action: string, payload?: Record<string, unknown>) => Promise<void>;
  busy: boolean;
};

export function DailyIntentFlow({ state, dispatch, busy }: FlowProps) {
  return (
    <MultiChoiceScreen
      title={`День ${state.resources.day}. Что будем делать?`}
      choices={[
        { id: 'get_sales', label: 'Продавать' },
        { id: 'fix_system', label: 'Чинить систему' },
      ]}
      onConfirm={(id) => dispatch('choose_intent', { intent: id })}
      busy={busy}
    />
  );
}
