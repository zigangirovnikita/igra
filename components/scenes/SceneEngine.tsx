'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getActionAvailability, type GameConfig, type GameState } from '@/packages/game-engine/src';
import type { ChoiceOption, Scene, SetupDraft } from '@/lib/scenes/types';
import { actionToChoice, buildFinalScenes, buildInitialGameScenes, buildMainChoiceScene, buildPostActionScenes } from '@/lib/scenes/script';
import { buildCategoryScene, buildContentTypeScene, buildInitialPlanScenes, buildParallelContentTypeScene, buildParallelScene, CONTENT_ACTIONS, initialPlanSummary, operationalRoute, routeFromPlan, type DecisionCategory } from '@/lib/scenes/decisionFlow';
import { getActionStartNarrative, getDirectMiniGameResult } from '@/lib/scenes/narratives';
import { SetupScene } from './SetupScene';
import { GameHud } from './GameHud';
import { ResumePrompt } from './ResumePrompt';
import { LeadForm } from './LeadForm';
import { SceneContent } from './SceneContent';
import { commandId, draftToSetupInput, readCachedGame } from '@/lib/scenes/setupMapping';
import { submitLead } from '@/lib/game/leadClient';

function defaultRouteFor(state: GameState) {
  return operationalRoute(state);
}

type Props = { config: GameConfig };

export function SceneEngine({ config }: Props) {
  const [phase, setPhase] = useState<'setup' | 'game' | 'lead'>('setup');
  const [queue, setQueue] = useState<Scene[]>([]);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [setupDraft, setSetupDraft] = useState<SetupDraft | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leadStatus, setLeadStatus] = useState<string | null>(null);
  const [resumeCandidate, setResumeCandidate] = useState<GameState | null>(null);
  const prevStateRef = useRef<GameState | null>(null);
  const planRef = useRef<Record<string, string>>({});

  useEffect(() => {
    const cached = readCachedGame();
    if (!cached) return;
    fetch(`/api/game/sessions/${cached.state.sessionId}`).then(async (response) => {
      if (!response.ok) throw new Error('resume_unavailable');
      const data = await response.json() as { state: GameState };
      setResumeCandidate(data.state);
    }).catch(() => setResumeCandidate(cached.state));
  }, []);

  const pushScenes = useCallback((scenes: Scene[]) => {
    setQueue((prev) => [...scenes, ...prev]);
  }, []);

  const advanceQueue = useCallback(() => {
    setQueue((prev) => prev.slice(1));
  }, []);

  async function handleSetupComplete(draft: SetupDraft) {
    setSetupDraft(draft);
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
      prevStateRef.current = newState;
      const scenes = buildInitialPlanScenes(newState);
      setQueue(scenes);
      setPhase('game');
      localStorage.setItem('launch-game-cache', JSON.stringify({ expiresAt: Date.now() + 86_400_000, state: newState }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка старта');
    } finally {
      setBusy(false);
    }
  }

  async function handleActionChosen(option: ChoiceOption) {
    if (!gameState) return;

    if (option.id.startsWith('__plan:')) {
      const [, key, value] = option.id.split(':');
      planRef.current[key] = value;
      if (key === 'followup') await saveInitialPlan(gameState);
      return;
    }

    if (option.id.startsWith('__category:')) {
      const category = option.id.split(':')[1] as DecisionCategory;
      const available = config.actions.filter((action) => action.enabled && getActionAvailability(gameState, action, config).available);
      pushScenes([buildCategoryScene(gameState, available, category, (action) => actionToChoice(gameState, action))]);
      return;
    }

    if (option.id === '__parallel_menu') {
      const available = config.actions.filter((action) => action.enabled && getActionAvailability(gameState, action, config).available);
      pushScenes([buildParallelScene(gameState, available)]);
      return;
    }

    if (option.id.startsWith('__parallel:')) {
      const [, actionAId, actionBId] = option.id.split(':');
      pushScenes([buildParallelContentTypeScene(actionAId, actionBId)]);
      return;
    }

    if (option.id.startsWith('__parallel_run:')) {
      const [, contentType, actionAId, actionBId] = option.id.split(':');
      await startParallel(gameState, actionAId, actionBId, contentType);
      return;
    }

    if (CONTENT_ACTIONS.has(option.id) && !option.payload?.contentType) {
      pushScenes([buildContentTypeScene(option)]);
      return;
    }

    if (option.id.startsWith('__content:')) {
      option = { ...option, id: String(option.payload?.actionId ?? '') };
    }

    if (option.id.startsWith('__inbound:')) {
      const [, cohortId, amount] = option.id.split(':');
      await processInbound(gameState, cohortId, Number(amount));
      return;
    }

    if (option.id.startsWith('__reflection:')) {
      const [, eventId, answer] = option.id.split(':');
      await recordReflection(gameState, eventId, answer);
      return;
    }

    if (option.id === '__finish__') {
      await finishGame(gameState);
      return;
    }

    setBusy(true);
    setError(null);

    // Immediately push a narrative "starting" screen
    const startLines = getActionStartNarrative(gameState, option.id);
    pushScenes([{ type: 'narrative', image: 'character_working', lines: startLines }]);

    try {
      const res = await fetch(`/api/game/sessions/${gameState.sessionId}/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commandId: commandId(option.id),
          expectedVersion: gameState.stateVersion,
          type: 'start_action',
          payload: {
            actionId: option.id,
            contentType: option.payload?.contentType ?? 'useful',
            route: defaultRouteFor(gameState),
            ...(option.payload ?? {}),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? 'Действие отклонено');

      const newState: GameState = data.state;
      const prev = prevStateRef.current ?? gameState;
      prevStateRef.current = newState;
      setGameState(newState);

      const resultScenes = buildPostActionScenes(newState, prev, option.id, config);
      setQueue((q) => [...q, ...resultScenes]);

      localStorage.setItem('launch-game-cache', JSON.stringify({ expiresAt: Date.now() + 86_400_000, state: newState }));

      if (newState.status === 'finished' || newState.resources.day >= config.totalDays) {
        await finishGame(newState);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка действия');
      // Push back to choice screen if action failed
      if (gameState) {
        setQueue((q) => [...q, buildMainChoiceScene(gameState, config)]);
      }
    } finally {
      setBusy(false);
    }
  }

  async function startParallel(state: GameState, actionAId: string, actionBId: string, contentType: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/game/sessions/${state.sessionId}/commands`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commandId: commandId('parallel'), expectedVersion: state.stateVersion, type: 'start_parallel', payload: { actionAId, actionBId, contentType, route: defaultRouteFor(state) } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? 'Не удалось запустить задачи');
      const newState: GameState = data.state;
      const prev = prevStateRef.current ?? state;
      setGameState(newState); prevStateRef.current = newState;
      setQueue((current) => [...current, ...buildPostActionScenes(newState, prev, `${actionAId}+${actionBId}`, config)]);
    } catch (err) { setError(err instanceof Error ? err.message : 'Ошибка параллельного действия'); }
    finally { setBusy(false); }
  }

  async function recordReflection(state: GameState, eventId: string, answer: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/game/sessions/${state.sessionId}/commands`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commandId: commandId('reflection'), expectedVersion: state.stateVersion, type: 'record_reflection', payload: { eventId, answer } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? 'Не удалось сохранить ответ');
      const newState: GameState = data.state;
      setGameState(newState); prevStateRef.current = newState;
    } catch (err) { setError(err instanceof Error ? err.message : 'Ошибка сохранения ответа'); }
    finally { setBusy(false); }
  }

  async function processInbound(state: GameState, cohortId: string, amount: number) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/game/sessions/${state.sessionId}/commands`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commandId: commandId('process-inbound'), expectedVersion: state.stateVersion, type: 'process_inbound', payload: { cohortId, amount } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? 'Не удалось обработать входящие');
      const newState: GameState = data.state;
      setGameState(newState);
      prevStateRef.current = newState;
      setQueue((current) => [...current, buildMainChoiceScene(newState, config)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка обработки входящих');
    } finally { setBusy(false); }
  }

  async function saveInitialPlan(state: GameState) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/game/sessions/${state.sessionId}/commands`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commandId: commandId('initial-plan'), expectedVersion: state.stateVersion, type: 'set_plan', payload: routeFromPlan(planRef.current) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? 'Не удалось сохранить план');
      const newState: GameState = data.state;
      setGameState(newState);
      prevStateRef.current = newState;
      setQueue((current) => [...current, { type: 'narrative', image: 'character_thinking', lines: initialPlanSummary(newState.player.name, planRef.current) }, ...buildInitialGameScenes(newState, config)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения плана');
    } finally {
      setBusy(false);
    }
  }

  async function handleMiniGameResolved(cohortId: string, mode: 'manual' | 'auto', processed?: number) {
    if (!gameState) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/game/sessions/${gameState.sessionId}/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commandId: `mini-game-${cohortId}`,
          expectedVersion: gameState.stateVersion,
          type: 'resolve_mini_game',
          payload: { cohortId, mode, processed },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? 'Ошибка мини-игры');
      const newState: GameState = data.state;
      const prev = prevStateRef.current ?? gameState;
      prevStateRef.current = newState;
      setGameState(newState);

      const cohort = prev.cohorts.find((c) => c.id === cohortId);
      const lostRevenue = cohort
        ? (Math.round(cohort.responses) - (processed ?? 0)) * gameState.player.productPrice * 0.1
        : 0;

      const resultLines = getDirectMiniGameResult(
        processed ?? 0,
        cohort ? Math.round(cohort.responses) : 0,
        lostRevenue,
        gameState.player.name,
      );

      setQueue((q) => [
        ...q,
        { type: 'narrative', image: 'character_thinking', lines: resultLines },
        buildMainChoiceScene(newState, config),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка мини-игры');
    } finally {
      setBusy(false);
    }
  }

  async function finishGame(state: GameState) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/game/sessions/${state.sessionId}/finish`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Не удалось завершить');
      const newState: GameState = data.state;
      setGameState(newState);
      prevStateRef.current = newState;
      localStorage.removeItem('launch-game-cache');
      const finalScenes = buildFinalScenes(newState, config);
      setQueue((q) => [...q, ...finalScenes]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка финала');
    } finally {
      setBusy(false);
    }
  }

  async function handleLeadSubmit(formData: FormData) {
    if (!gameState) return;
    setBusy(true);
    setLeadStatus(null);
    try {
      await submitLead(gameState, formData);
      setLeadStatus('success');
    } catch (err) {
      setLeadStatus(err instanceof Error ? err.message : 'Ошибка отправки');
    } finally {
      setBusy(false);
    }
  }

  function handleRestart() {
    setGameState(null);
    prevStateRef.current = null;
    setQueue([]);
    setPhase('setup');
    setError(null);
    localStorage.removeItem('launch-game-cache');
    setResumeCandidate(null);
  }

  function handleResume() {
    if (!resumeCandidate) return;
    setGameState(resumeCandidate);
    prevStateRef.current = resumeCandidate;
    setQueue([buildMainChoiceScene(resumeCandidate, config)]);
    setPhase('game');
    setResumeCandidate(null);
  }

  const currentScene = queue[0];

  if (phase === 'setup') {
    if (resumeCandidate) return <main className="scene-shell"><ResumePrompt state={resumeCandidate} onResume={handleResume} onRestart={handleRestart} /></main>;
    return (
      <main className="scene-shell">
        {error && <div className="scene-error" role="alert">{error}</div>}
        <SetupScene config={config} onComplete={handleSetupComplete} busy={busy} initialDraft={setupDraft} />
      </main>
    );
  }

  if (phase === 'lead' && gameState) {
    return (
      <main className="scene-shell">
        <LeadForm
          state={gameState}
          busy={busy}
          status={leadStatus}
          onSubmit={handleLeadSubmit}
          onBack={() => setPhase('game')}
        />
      </main>
    );
  }

  return (
    <main className="scene-shell">
      {gameState && <GameHud state={gameState} />}
      {error && (
        <div className="scene-error" role="alert">
          {error}
          <button className="scene-error-dismiss" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {gameState && <SceneContent scene={currentScene} fallback={buildMainChoiceScene(gameState, config)} busy={busy} advance={advanceQueue}
        choose={handleActionChosen} miniGame={handleMiniGameResolved} cta={() => setPhase('lead')} restart={handleRestart} />}
    </main>
  );
}
