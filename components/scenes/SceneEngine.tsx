'use client';

import { useCallback, useRef, useState } from 'react';
import type { GameConfig, GameState, SetupInput } from '@/packages/game-engine/src';
import type { ChoiceOption, Scene, SetupDraft } from '@/lib/scenes/types';
import { buildFinalScenes, buildInitialGameScenes, buildMainChoiceScene, buildPostActionScenes } from '@/lib/scenes/script';
import { getActionStartNarrative, getDirectMiniGameResult } from '@/lib/scenes/narratives';
import { SetupScene } from './SetupScene';
import { NarrativeScreen } from './NarrativeScreen';
import { ChoiceScreen } from './ChoiceScreen';
import { ResultScreen } from './ResultScreen';
import { MetricsScreen } from './MetricsScreen';
import { DirectMiniGame } from './DirectMiniGame';
import { DiagnosisScreen } from './DiagnosisScreen';
import { CtaScene } from './CtaScene';

function commandId(prefix: string) {
  return `${prefix}-${Date.now()}`;
}

function draftToSetupInput(draft: SetupDraft): SetupInput {
  return {
    avatarGender: draft.gender,
    name: draft.name,
    niche: draft.niche,
    superpowers: draft.superpowers,
    productType: draft.productType,
    productPrice: draft.productPrice,
    averageReelViews: draft.averageReelViews,
    averageStoryViews: draft.averageStoryViews,
    telegramStatus: draft.hasTelegram ? 'known' : 'none',
    averageTelegramViews: draft.hasTelegram ? draft.averageTelegramViews : 0,
    dreams: draft.dreams,
  };
}

function defaultRouteFor(state: GameState) {
  return state.activeRoute;
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
  const prevStateRef = useRef<GameState | null>(null);

  // ── Queue helpers ────────────────────────────────────────────────

  const pushScenes = useCallback((scenes: Scene[]) => {
    setQueue((prev) => [...scenes, ...prev]);
  }, []);

  const advanceQueue = useCallback(() => {
    setQueue((prev) => prev.slice(1));
  }, []);

  // ── Setup complete: create session ───────────────────────────────

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
      const scenes = buildInitialGameScenes(newState, config);
      setQueue(scenes);
      setPhase('game');
      localStorage.setItem('launch-game-cache', JSON.stringify({ expiresAt: Date.now() + 86_400_000, state: newState }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка старта');
    } finally {
      setBusy(false);
    }
  }

  // ── Action chosen ────────────────────────────────────────────────

  async function handleActionChosen(option: ChoiceOption) {
    if (!gameState) return;

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
            contentType: 'useful',
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

  // ── Mini-game resolved ───────────────────────────────────────────

  async function handleMiniGameResolved(cohortId: string, mode: 'manual' | 'auto', processed?: number) {
    if (!gameState) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/game/sessions/${gameState.sessionId}/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commandId: commandId('mini_game'),
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

  // ── Finish game ──────────────────────────────────────────────────

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

  // ── Lead form submit ─────────────────────────────────────────────

  async function handleLeadSubmit(formData: FormData) {
    if (!gameState) return;
    setBusy(true);
    setLeadStatus(null);
    const payload = {
      sessionId: gameState.sessionId,
      name: String(formData.get('name') ?? ''),
      contact: String(formData.get('contact') ?? ''),
      product: String(formData.get('product') ?? ''),
      productPrice: Number(formData.get('productPrice') ?? gameState.player.productPrice),
      socialLink: String(formData.get('socialLink') ?? ''),
      comment: String(formData.get('comment') ?? ''),
      privacyConsent: formData.get('privacyConsent') === 'on',
      marketingConsent: formData.get('marketingConsent') === 'on',
      website: String(formData.get('website') ?? ''),
    };
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Заявка не отправлена');
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
  }

  // ── Current scene ────────────────────────────────────────────────

  const currentScene = queue[0];

  // ── Render ───────────────────────────────────────────────────────

  if (phase === 'setup') {
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
      {error && (
        <div className="scene-error" role="alert">
          {error}
          <button className="scene-error-dismiss" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {!currentScene && gameState && (
        // Fallback: show choice screen if queue is empty
        <ChoiceScreen
          scene={buildMainChoiceScene(gameState, config)}
          onChoice={handleActionChosen}
          busy={busy}
        />
      )}

      {currentScene?.type === 'narrative' && (
        <NarrativeScreen scene={currentScene} onAdvance={advanceQueue} />
      )}

      {currentScene?.type === 'choice' && (
        <ChoiceScreen scene={currentScene} onChoice={(opt) => { advanceQueue(); handleActionChosen(opt); }} busy={busy} />
      )}

      {currentScene?.type === 'result' && (
        <ResultScreen scene={currentScene} onNext={advanceQueue} />
      )}

      {currentScene?.type === 'metrics' && (
        <MetricsScreen scene={currentScene} onNext={advanceQueue} />
      )}

      {currentScene?.type === 'mini_game_direct' && (
        <DirectMiniGame
          scene={currentScene}
          onResolve={(mode, processed) => { advanceQueue(); handleMiniGameResolved(currentScene.cohortId, mode, processed); }}
          busy={busy}
        />
      )}

      {currentScene?.type === 'diagnosis' && (
        <DiagnosisScreen
          scene={currentScene}
          onCta={() => { advanceQueue(); setPhase('lead'); }}
          onRestart={() => { advanceQueue(); handleRestart(); }}
        />
      )}

      {currentScene?.type === 'cta' && (
        <CtaScene
          scene={currentScene}
          onCta={() => { advanceQueue(); setPhase('lead'); }}
          onRestart={() => { advanceQueue(); handleRestart(); }}
        />
      )}
    </main>
  );
}

// ── Lead form ────────────────────────────────────────────────────────────────

function LeadForm({
  state,
  busy,
  status,
  onSubmit,
  onBack,
}: {
  state: GameState;
  busy: boolean;
  status: string | null;
  onSubmit: (formData: FormData) => void;
  onBack: () => void;
}) {
  return (
    <div className="scene-screen">
      <div className="scene-image scene-image--character_happy" aria-hidden="true" />
      <form className="lead-form" action={onSubmit}>
        <h2 className="lead-form-title">Разобрать мой запуск</h2>
        <p className="lead-form-sub">Оставьте контакт — мы разберём вашу ситуацию и найдём, где теряются заявки.</p>
        <label className="setup-field-label">Имя <input name="name" defaultValue={state.player.name} required /></label>
        <label className="setup-field-label">Telegram / телефон <input name="contact" required placeholder="@username" /></label>
        <label className="setup-field-label">Ваш продукт <input name="product" defaultValue={state.player.niche} required /></label>
        <label className="setup-field-label">Чек <input name="productPrice" type="number" defaultValue={state.player.productPrice} required /></label>
        <label className="setup-field-label">Соцсеть / ссылка <input name="socialLink" /></label>
        <label className="setup-field-label">Комментарий <textarea name="comment" maxLength={1000} /></label>
        <input className="hidden-field" name="website" tabIndex={-1} autoComplete="off" />
        <label className="setup-checkbox">
          <input name="privacyConsent" type="checkbox" required />
          Согласен(на) на обработку персональных данных
        </label>
        <label className="setup-checkbox">
          <input name="marketingConsent" type="checkbox" />
          Согласен(на) получать полезные материалы
        </label>
        <div className="scene-btn-row">
          <button className="btn-primary" type="submit" disabled={busy}>
            {busy ? 'Отправляем…' : 'Отправить заявку'}
          </button>
          <button className="btn-secondary" type="button" onClick={onBack}>← Назад</button>
        </div>
        {status === 'success' && <p className="lead-success" role="status">✅ Заявка доставлена! Мы скоро свяжемся.</p>}
        {status && status !== 'success' && <p className="lead-error" role="alert">⚠️ {status}</p>}
      </form>
    </div>
  );
}
