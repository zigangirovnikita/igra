'use client';

import { useCallback, useEffect, useState } from 'react';
import type { GameConfig, GameState } from '@/packages/game-engine/src';
import { SetupScene } from './SetupScene';
import { resolveCurrentScene } from '@/lib/game/resolve-current-scene';
import type { SetupDraft } from '@/lib/scenes/setupCopy';
import { draftToSetupInput, readCachedGame } from '@/lib/scenes/setupMapping';

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

  function handleRestart() {
    setGameState(null);
    setPhase('setup');
    setError(null);
    localStorage.removeItem('launch-game-cache');
  }

  if (phase === 'setup' || !gameState) {
    return (
      <main className="scene-shell">
        {error && <div className="scene-error" role="alert">{error}</div>}
        <SetupScene config={config} onComplete={handleSetupComplete} busy={busy} />
      </main>
    );
  }

  const resolved = resolveCurrentScene(gameState);

  return (
    <main className="scene-shell">
      <div style={{ padding: '20px', color: 'white' }}>
        <h2>Текущий экран: {resolved.scene}</h2>
        <pre>{JSON.stringify(gameState.status, null, 2)}</pre>
        <button className="btn-primary" onClick={handleRestart}>Начать заново</button>
      </div>
    </main>
  );
}
