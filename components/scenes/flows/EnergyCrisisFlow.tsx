import type { GameState, GameConfig } from '@/packages/game-engine/src';
import { CrisisScreen } from '../ui';

type FlowProps = {
  state: GameState;
  config: GameConfig;
  dispatch: (action: string, payload?: Record<string, unknown>) => Promise<void>;
  busy: boolean;
};

export function EnergyCrisisFlow({ state: _state, dispatch, busy }: FlowProps) {
  return (
    <CrisisScreen
      title="Выгорание!"
      description="Энергия на нуле. Вы не можете продолжать работать в таком темпе."
      crisisType="energy"
      onAction={(id) => dispatch('resolve_pending_decision', {
        action: id
      })}
      busy={busy}
    />
  );
}
