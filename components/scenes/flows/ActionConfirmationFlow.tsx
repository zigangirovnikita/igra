import type { GameState, GameConfig } from '@/packages/game-engine/src';
import { ActionConfirmationScreen } from '../ui';

type FlowProps = {
  state: GameState;
  config: GameConfig;
  dispatch: (action: string, payload?: Record<string, unknown>) => Promise<void>;
  busy: boolean;
};

export function ActionConfirmationFlow({ state, config, dispatch, busy }: FlowProps) {
  const pending = state.pendingAction;
  if (!pending) return null;
  
  const action = config.actions.find(a => a.id === pending.actionId);
  if (!action) return null;
  let displayedCost = action.cost;
  if (action.repeatPolicy === 'upgrade' && action.upgradeCost !== undefined && action.upgradeGroup) {
    const hasPrevious = state.history.some((entry) => entry.type === 'action_completed' && config.actions.some((candidate) =>
      candidate.id === entry.payload?.actionId && candidate.upgradeGroup === action.upgradeGroup));
    if (hasPrevious) displayedCost = action.upgradeCost;
  }

  return (
    <ActionConfirmationScreen
      title={action.title}
      description={action.description || 'Вы уверены, что хотите запустить это действие?'}
      cost={displayedCost}
      energyCost={action.energyCost}
      days={action.days}
      currentBank={state.resources.bank}
      currentEnergy={state.resources.energy}
      onConfirm={() => dispatch('confirm_action')}
      onCancel={() => dispatch('cancel_pending_action')}
      busy={busy}
    />
  );
}
