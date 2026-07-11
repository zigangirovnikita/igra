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

  return (
    <ActionConfirmationScreen
      title={action.title}
      description={action.description || 'Вы уверены, что хотите запустить это действие?'}
      cost={action.cost}
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
