'use client';

import { useState } from 'react';
import type { DirectMiniGameScene } from '@/lib/scenes/types';

type Props = {
  scene: DirectMiniGameScene;
  onResolve: (mode: 'manual' | 'auto', processed?: number) => void;
  busy: boolean;
};

export function DirectMiniGame({ scene, onResolve, busy }: Props) {
  const [answered, setAnswered] = useState<Set<number>>(new Set());

  function handleAnswer(index: number) {
    if (answered.size >= scene.manualCapacity || answered.has(index)) return;
    setAnswered((prev) => new Set([...prev, index]));
  }

  const missed = scene.totalInbound - answered.size;

  return (
    <div className="scene-screen">
      <div className="scene-image scene-image--phone_direct" aria-hidden="true" />
      <div className="minigame-body">
        <div className="minigame-header">
          <h2 className="minigame-title">📱 Директ взорвался!</h2>
          <p className="minigame-subtitle">
            В директ написали <strong>{scene.totalInbound}</strong> человек. Ваш ручной предел — {scene.manualCapacity}.
          </p>
        </div>

        <div className="minigame-inbox">
          {scene.messages.map((msg, i) => (
            <div key={i} className={`message-card${answered.has(i) ? ' message-card--answered' : ''}`}>
              <span className="message-text">«{msg}»</span>
              <button
                className="btn-answer"
                disabled={answered.has(i) || answered.size >= scene.manualCapacity || busy}
                onClick={() => handleAnswer(i)}
              >
                {answered.has(i) ? '✓' : 'Ответить'}
              </button>
            </div>
          ))}
          {scene.totalInbound > scene.messages.length && (
            <div className="message-card message-card--overflow">
              <span className="message-text">
                …ещё {scene.totalInbound - scene.messages.length} сообщений
              </span>
            </div>
          )}
        </div>

        <div className="minigame-footer">
          <div className="minigame-counter">
            Ответили: {answered.size} / {scene.totalInbound}
            {missed > 0 && <span className="counter-missed"> · {missed} не получат ответ</span>}
          </div>
          <div className="scene-btn-row">
            <button
              className="btn-primary"
              disabled={busy}
              onClick={() => onResolve('manual', answered.size)}
            >
              Я ответила всем, кому успела
            </button>
            <button
              className="btn-secondary"
              disabled={busy}
              onClick={() => onResolve('auto')}
            >
              Рассчитать автоматически
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
