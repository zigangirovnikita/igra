import type { GameState, GameConfig } from '@/packages/game-engine/src';
import { MultiChoiceScreen } from '../ui';

type FlowProps = {
  state: GameState;
  config: GameConfig;
  dispatch: (action: string, payload?: Record<string, unknown>) => Promise<void>;
  busy: boolean;
};

export function PendingDecisionFlow({ state, dispatch, busy }: FlowProps) {
  const pending = state.pendingDecision;
  if (!pending) return null;
  
  // Here we would match on pending.type
  // For now just basic stub to resolve any decision
  return (
    <MultiChoiceScreen
      title="Нужно ваше решение"
      description={`Тип решения: ${pending.type}`}
      choices={[
        { id: 'process', label: 'Обработать' },
        { id: 'defer', label: 'Отложить на потом' },
        { id: 'ignore', label: 'Игнорировать' },
      ]}
      onConfirm={(id) => dispatch('resolve_pending_decision', { 
        cohortId: 'cohortId' in pending ? pending.cohortId : '', 
        action: id 
      })}
      busy={busy}
    />
  );
}
