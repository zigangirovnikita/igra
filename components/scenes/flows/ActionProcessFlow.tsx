import type { GameState, GameConfig } from '@/packages/game-engine/src';

import { useEffect } from 'react';

type FlowProps = {
  state: GameState;
  config: GameConfig;
  dispatch: (action: string, payload?: Record<string, unknown>) => Promise<void>;
  busy: boolean;
};

export function ActionProcessFlow({ state: _state, dispatch, busy }: FlowProps) {
  useEffect(() => {
    // Automatically acknowledge process and move to result after a short delay
    const timer = setTimeout(() => {
      if (!busy) {
        dispatch('acknowledge_action_process');
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [dispatch, busy]);

  return (
    <div style={{ padding: '20px', color: 'white', textAlign: 'center' }}>
      <h2>Выполняем действие...</h2>
      <p>Пожалуйста, подождите.</p>
    </div>
  );
}
