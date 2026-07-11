'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GameState } from '@/packages/game-engine/src';

type Props = {
  state: GameState;
  dispatch: (action: string, payload?: Record<string, unknown>) => Promise<void>;
  busy: boolean;
};

export function DirectMiniGame({ state, dispatch, busy }: Props) {
  const miniGame = state.miniGame;
  const [cursor, setCursor] = useState(0);
  const [processed, setProcessed] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(() => secondsUntil(miniGame?.expiresAt));
  const submittedRef = useRef(false);

  const messages = useMemo(() => miniGame?.messages ?? [], [miniGame]);
  const current = messages[cursor];
  const energyRemaining = Math.max(0, state.resources.energy - processed * 0.3);

  const submit = useCallback(async (mode: 'manual' | 'auto') => {
    if (!miniGame || submittedRef.current) return;
    submittedRef.current = true;
    await dispatch('resolve_mini_game', {
      cohortId: miniGame.cohortId,
      mode,
      processed: mode === 'manual' ? processed : undefined,
    });
  }, [dispatch, miniGame, processed]);

  useEffect(() => {
    if (!miniGame) return;
    const update = () => setRemainingSeconds(secondsUntil(miniGame.expiresAt));
    update();
    const timer = window.setInterval(update, 250);
    return () => window.clearInterval(timer);
  }, [miniGame]);

  useEffect(() => {
    if (!miniGame || submittedRef.current) return;
    if (remainingSeconds <= 0 || cursor >= messages.length) void submit('manual');
  }, [cursor, messages.length, miniGame, remainingSeconds, submit]);

  if (!miniGame) return null;

  const answerCurrent = () => {
    if (!current || busy || energyRemaining < 0.3) return;
    setProcessed((value) => value + 1);
    setCursor((value) => value + 1);
  };

  const skipCurrent = () => {
    if (!current || busy) return;
    setCursor((value) => value + 1);
  };

  return (
    <section className="scene-screen" aria-labelledby="mini-game-title">
      <div className="scene-text-block">
        <h1 id="mini-game-title">Входящие завалили директ</h1>
        <p className="scene-paragraph">За 60 секунд ответьте на самые перспективные сообщения. Каждый ответ стоит 0,3 энергии.</p>
        <p className="scene-paragraph" aria-live="polite">
          Осталось: {remainingSeconds} сек. · Ответов: {processed} · Энергия: {energyRemaining.toFixed(1)}
        </p>
      </div>

      {current && remainingSeconds > 0 ? (
        <div className="scene-card" aria-live="polite">
          <p className="scene-paragraph"><strong>{current.text}</strong></p>
          <p className="scene-paragraph">Сообщение {cursor + 1} из {messages.length}</p>
          <div className="scene-actions">
            <button
              className="btn-primary"
              type="button"
              onClick={answerCurrent}
              disabled={busy || energyRemaining < 0.3}
              aria-disabled={busy || energyRemaining < 0.3}
            >
              Ответить
            </button>
            <button className="btn-secondary" type="button" onClick={skipCurrent} disabled={busy}>
              Пропустить сообщение
            </button>
          </div>
        </div>
      ) : (
        <p className="scene-paragraph">Результат отправляется на сервер…</p>
      )}

      <button className="btn-secondary" type="button" onClick={() => void submit('auto')} disabled={busy}>
        Пропустить мини-игру
      </button>
    </section>
  );
}

function secondsUntil(expiresAt?: string): number {
  if (!expiresAt) return 0;
  return Math.max(0, Math.ceil((Date.parse(expiresAt) - Date.now()) / 1000));
}
