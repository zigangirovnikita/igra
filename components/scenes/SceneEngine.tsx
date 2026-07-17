'use client';

import { useEffect, useRef, useState } from 'react';
import type { GameConfig, GameState } from '@/packages/game-engine/src';
import { SetupScene } from './SetupScene';
import { ResumePrompt } from './ResumePrompt';
import { GameHud } from './GameHud';
import { resolveCurrentScene } from '@/lib/game/resolve-current-scene';
import type { SetupDraft } from '@/lib/scenes/setupCopy';
import { cacheSessionPointer, draftToSetupInput, readCachedGame } from '@/lib/scenes/setupMapping';
import { IntroFlow } from './flows/IntroFlow';
import { Day1Flow } from './flows/Day1Flow';
import { Day2Flow } from './flows/Day2Flow';
import { DailyIntroFlow } from './flows/DailyIntroFlow';
import { DailyIntentFlow } from './flows/DailyIntentFlow';
import { ActionSelectionFlow } from './flows/ActionSelectionFlow';
import { ActionConfigurationFlow } from './flows/ActionConfigurationFlow';
import { ActionConfirmationFlow } from './flows/ActionConfirmationFlow';
import { ActionProcessFlow } from './flows/ActionProcessFlow';
import { ActionResultFlow } from './flows/ActionResultFlow';
import { PendingDecisionFlow } from './flows/PendingDecisionFlow';
import { DayCompletionFlow } from './flows/DayCompletionFlow';
import { EnergyCrisisFlow } from './flows/EnergyCrisisFlow';
import { BudgetCrisisFlow } from './flows/BudgetCrisisFlow';
import { FinishedFlow } from './flows/FinishedFlow';
import { EventFlow } from './flows/EventFlow';
import { V3Flow } from './flows/V3Flow';

type Props = { config: GameConfig };

export function SceneEngine({ config }: Props) {
  const [phase, setPhase] = useState<'setup' | 'game' | 'lead' | 'resume'>('setup');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const commandInFlightRef = useRef(false);

  useEffect(() => {
    const cached = readCachedGame();
    if (!cached) return;
    setBusy(true);
    fetch(`/api/game/sessions/${cached.sessionId}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? 'Не удалось загрузить сохранение');
        if (data.state?.schemaVersion !== 2) throw new Error('Сохранение несовместимо с новой версией игры');
        setGameState(data.state);
        setPhase('resume');
      })
      .catch((reason: unknown) => {
        localStorage.removeItem('launch-game-cache');
        setError(reason instanceof Error ? reason.message : 'Не удалось загрузить сохранение');
      })
      .finally(() => setBusy(false));
  }, []);

  useEffect(() => {
    if (!error) return;
    const timeoutId = window.setTimeout(() => setError(null), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [error]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [phase, gameState?.sessionId, gameState?.flow.step]);

  async function handleSetupComplete(draft: SetupDraft) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/game/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draftToSetupInput(draft)),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Не удалось начать игру');
      const newState: GameState = data.state;
      setGameState(newState);
      setPhase('game');
      cacheSessionPointer(newState.sessionId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Ошибка старта');
    } finally {
      setBusy(false);
    }
  }

  const dispatch = async (actionType: string, payload: Record<string, unknown> = {}) => {
    if (!gameState) return false;
    if (commandInFlightRef.current) {
      setError('Действие уже выполняется. Подождите секунду.');
      return false;
    }
    commandInFlightRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/game/sessions/${gameState.sessionId}/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: gameState.sessionId,
          commandId: `${actionType}_${crypto.randomUUID()}`,
          expectedVersion: gameState.stateVersion,
          type: actionType,
          payload,
        }),
      });
      const data = await response.json();
      if (response.status === 409 && data.state) {
        setGameState(data.state);
        cacheSessionPointer(data.state.sessionId);
        setError(data.error === 'version_conflict'
          ? 'Состояние игры обновлено. Повторите действие.'
          : 'Действие уже обработано. Показано актуальное состояние игры.');
        return false;
      }
      if (!response.ok) throw new Error(data.message ?? data.error ?? 'Ошибка команды');
      setGameState(data.state);
      cacheSessionPointer(data.state.sessionId);
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Ошибка связи');
      return false;
    } finally {
      commandInFlightRef.current = false;
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

  if (phase === 'resume') {
    return (
      <main className="scene-shell">
        {error && <div className="scene-error" role="alert">{error}</div>}
        <ResumePrompt
          state={gameState}
          onResume={() => setPhase('game')}
          onRestart={() => {
            setGameState(null);
            setPhase('setup');
            localStorage.removeItem('launch-game-cache');
          }}
        />
      </main>
    );
  }

  const { scene } = resolveCurrentScene(gameState);
  const legacyDispatch = async (actionType: string, payload: Record<string, unknown> = {}) => {
    await dispatch(actionType, payload);
  };
  const commonProps = { state: gameState, config, dispatch: legacyDispatch, busy };
  const v3Props = { state: gameState, config, dispatch, busy };

  return (
    <main className="scene-shell">
      {error && <div className="scene-error" role="alert">{error}</div>}
      {scene !== 'finished' && <GameHud state={gameState} />}
      {scene === 'event' && <EventFlow {...commonProps} />}
      {scene === 'v3' && <V3Flow {...v3Props} />}
      {scene === 'intro' && <IntroFlow {...commonProps} />}
      {scene === 'day_1' && <Day1Flow {...commonProps} />}
      {scene === 'day_2' && <Day2Flow {...commonProps} />}
      {scene === 'daily_intro' && <DailyIntroFlow {...commonProps} />}
      {scene === 'daily_intent' && <DailyIntentFlow {...commonProps} />}
      {scene === 'action_selection' && <ActionSelectionFlow {...commonProps} />}
      {scene === 'action_configuration' && <ActionConfigurationFlow {...commonProps} />}
      {scene === 'action_confirmation' && <ActionConfirmationFlow {...commonProps} />}
      {scene === 'action_process' && <ActionProcessFlow {...commonProps} />}
      {scene === 'action_result' && <ActionResultFlow {...commonProps} />}
      {scene === 'pending_decision' && <PendingDecisionFlow {...commonProps} />}
      {scene === 'day_completion' && <DayCompletionFlow {...commonProps} />}
      {scene === 'energy_crisis' && <EnergyCrisisFlow {...commonProps} />}
      {scene === 'budget_notice' && <BudgetCrisisFlow {...commonProps} />}
      {scene === 'finished' && <FinishedFlow {...commonProps} />}
      {scene === 'unknown' && (
        <div style={{ padding: '20px', color: 'white' }}>
          <h2>Неизвестный экран</h2>
          <pre>{JSON.stringify({ status: gameState.status, flow: gameState.flow }, null, 2)}</pre>
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
