'use client';

import { useEffect, useRef, useState } from 'react';
import type { DirectMiniGameScene } from '@/lib/scenes/types';

type Props = { scene: DirectMiniGameScene; onResolve: (mode: 'manual' | 'auto', processed?: number) => void; busy: boolean };
const DURATION = 45;

export function DirectMiniGame({ scene, onResolve, busy }: Props) {
  const [answered, setAnswered] = useState<Set<number>>(new Set());
  const [visibleCount, setVisibleCount] = useState(1);
  const [seconds, setSeconds] = useState(DURATION);
  const [paused, setPaused] = useState(false);
  const resolved = useRef(false);
  const answeredRef = useRef(answered);
  answeredRef.current = answered;

  function finish(mode: 'manual' | 'auto', processed = answeredRef.current.size) {
    if (resolved.current || busy) return;
    resolved.current = true;
    onResolve(mode, processed);
  }

  function handleAnswer(index: number) {
    if (answeredRef.current.size >= scene.manualCapacity || answeredRef.current.has(index)) return;
    setAnswered((previous) => new Set([...previous, index]));
  }

  useEffect(() => {
    const onVisibility = () => setPaused(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    if (paused || resolved.current) return;
    const timer = window.setInterval(() => setSeconds((value) => {
      if (value <= 1) { window.clearInterval(timer); queueMicrotask(() => finish('manual')); return 0; }
      return value - 1;
    }), 1000);
    return () => window.clearInterval(timer);
  }, [paused]);

  useEffect(() => {
    if (paused || visibleCount >= scene.messages.length) return;
    const delay = Math.max(450, 1400 - visibleCount * 35);
    const timer = window.setTimeout(() => setVisibleCount((value) => Math.min(scene.messages.length, value + 1)), delay);
    return () => window.clearTimeout(timer);
  }, [paused, scene.messages.length, visibleCount]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'a') finish('auto');
      const index = Number(event.key) - 1;
      if (index >= 0 && index < Math.min(9, visibleCount)) handleAnswer(index);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const visibleMessages = scene.messages.slice(0, visibleCount);
  return (
    <div className="scene-screen">
      <div className="scene-image scene-image--phone_direct" aria-hidden="true" />
      <div className="minigame-body">
        <div className="minigame-header">
          <h2 className="minigame-title">📱 Директ взорвался!</h2>
          <p className="minigame-subtitle">Входящих: <strong>{scene.totalInbound}</strong> · ручной предел: {scene.manualCapacity}</p>
          <p className="minigame-timer" aria-live="polite">{paused ? 'Пауза' : `Осталось ${seconds} сек.`}</p>
        </div>
        <div className="minigame-inbox">
          {visibleMessages.map((message, index) => (
            <div key={`${message}-${index}`} className={`message-card${answered.has(index) ? ' message-card--answered' : ''}`}>
              <span className="message-text">{index < 9 && <kbd>{index + 1}</kbd>} «{message}»</span>
              <button className="btn-answer" disabled={answered.has(index) || answered.size >= scene.manualCapacity || busy} onClick={() => handleAnswer(index)}>
                {answered.has(index) ? '✓' : 'Ответить'}
              </button>
            </div>
          ))}
        </div>
        <div className="minigame-footer">
          <div className="minigame-counter">Ответили: {answered.size} · ещё тёплых: {Math.max(0, scene.totalInbound - answered.size)}</div>
          <div className="scene-btn-row">
            <button className="btn-primary" disabled={busy} onClick={() => finish('manual')}>Завершить ручную обработку</button>
            <button className="btn-secondary" disabled={busy} onClick={() => finish('auto')}>Рассчитать автоматически <kbd>A</kbd></button>
          </div>
        </div>
      </div>
    </div>
  );
}
