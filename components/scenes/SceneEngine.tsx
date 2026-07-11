'use client';

import { useEffect, useState } from 'react';
import type { GameConfig, GameState } from '@/packages/game-engine/src';
import { SetupScene } from './SetupScene';
import { resolveCurrentScene } from '@/lib/game/resolve-current-scene';
import type { SetupDraft } from '@/lib/scenes/setupCopy';
import { draftToSetupInput, readCachedGame } from '@/lib/scenes/setupMapping';

// These components will be implemented next
import { IntroFlow } from './flows/IntroFlow';
import { Day1Flow } from './flows/Day1Flow';
import { Day2Flow } from './flows/Day2Flow';
import { DailyIntentFlow } from './flows/DailyIntentFlow';
import { ActionSelectionFlow } from './flows/ActionSelectionFlow';
import { ActionConfigurationFlow } from './flows/ActionConfigurationFlow';
import { ActionConfirmationFlow } from './flows/ActionConfirmationFlow';
import { PendingDecisionFlow } from './flows/PendingDecisionFlow';
import { DayCompletionFlow } from './flows/DayCompletionFlow';
import { EnergyCrisisFlow } from './flows/EnergyCrisisFlow';
import { FinishedFlow } from './flows/FinishedFlow';

type Props = { config: GameConfig };

export function SceneEngine({ config }: Props) {
  const [phase, setPhase] = useState<'setup' | 'game' | 'lead'>('setup');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cached = readCachedGame();
    if (cached) {
      setGameState(cached.state);
      setPhase('game');
    }
  }, []);

  async function handleSetupComplete(draft: SetupDraft) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/game/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draftToSetupInput(draft)),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Не удалось начать игру');
      
      const newState: GameState = data.state;
      setGameState(newState);
      setPhase('game');
      localStorage.setItem('launch-game-cache', JSON.stringify({ expiresAt: Date.now() + 86_400_000, state: newState }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка старта');
    } finally {
      setBusy(false);
    }
  }

  // To be passed to flows to dispatch commands
  const dispatch = async (actionType: string, payload: Record<string, unknown> = {}) => {
    if (!gameState || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/game/commands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: gameState.sessionId,
          commandId: `${actionType}_${Date.now()}`,
          expectedVersion: gameState.stateVersion,
          type: actionType,
          payload
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Ошибка команды');
      setGameState(data.state);
      localStorage.setItem('launch-game-cache', JSON.stringify({ expiresAt: Date.now() + 86_400_000, state: data.state }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка связи');
    } finally {
      setBusy(false);
    }
  };

  if (phase === 'setup' || !gameState) {
    return (
      <main className="scene-shell">
        {error && <div className="scene-error" role="alert">{error}</div>}
        <SetupScene config={config} onComplete={handleSetupComplete} busy={busy} />
      </main>
    );
  }

  const { scene } = resolveCurrentScene(gameState);
  
  const commonProps = { state: gameState, config, dispatch, busy };

  return (
    <main className="scene-shell">
      {error && <div className="scene-error" role="alert">{error}</div>}
      
      {scene === 'intro' && <IntroFlow {...commonProps} />}
      {scene === 'day_1' && <Day1Flow {...commonProps} />}
      {scene === 'day_2' && <Day2Flow {...commonProps} />}
      
      {scene === 'daily_intent' && <DailyIntentFlow {...commonProps} />}
      {scene === 'action_selection' && <ActionSelectionFlow {...commonProps} />}
      {scene === 'action_configuration' && <ActionConfigurationFlow {...commonProps} />}
      {scene === 'action_confirmation' && <ActionConfirmationFlow {...commonProps} />}
      
      {scene === 'pending_decision' && <PendingDecisionFlow {...commonProps} />}
      {scene === 'day_completion' && <DayCompletionFlow {...commonProps} />}
      
      {scene === 'energy_crisis' && <EnergyCrisisFlow {...commonProps} />}
      {scene === 'finished' && <FinishedFlow {...commonProps} />}
      
      {scene === 'unknown' && (
        <div style={{ padding: '20px', color: 'white' }}>
          <h2>Неизвестный экран</h2>
          <pre>{JSON.stringify(gameState.status, null, 2)}</pre>
          <button className="btn-primary" onClick={() => {
            setGameState(null);
            setPhase('setup');
            localStorage.removeItem('launch-game-cache');
          }}>Сброс</button>
        </div>
      )}
    </main>
  );
}
