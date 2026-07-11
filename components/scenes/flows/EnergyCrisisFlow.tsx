import type { GameState, GameConfig } from '@/packages/game-engine/src';
import { CrisisScreen } from '../ui';

type FlowProps = {
  state: GameState;
  config: GameConfig;
  dispatch: (action: string, payload?: Record<string, unknown>) => Promise<void>;
  busy: boolean;
};

export function EnergyCrisisFlow({ state, dispatch, busy }: FlowProps) {
  const pending = state.pendingDecision;
  
  // Note: if pending === goal_reached, that's not energy crisis. But let's assume this handles energy crisis for now.
  
  return (
    <CrisisScreen
      title="Выгорание!"
      description="Энергия на нуле. Вы не можете продолжать работать в таком темпе."
      crisisType="energy"
      onAction={(id) => dispatch('resolve_pending_decision', { 
        cohortId: '', 
        action: id 
      })}
      busy={busy}
    />
  );
}
