'use client';

import { useState } from 'react';
import type { NarrativeScene } from '@/lib/scenes/types';

type Props = {
  scene: NarrativeScene;
  onAdvance: () => void;
};

export function NarrativeScreen({ scene, onAdvance }: Props) {
  const [lineIndex, setLineIndex] = useState(0);
  const isLast = lineIndex >= scene.lines.length - 1;

  function handleTap() {
    if (isLast) {
      onAdvance();
      setLineIndex(0);
    } else {
      setLineIndex((i) => i + 1);
    }
  }

  return (
    <div className="scene-screen">
      <div className={`scene-image scene-image--${scene.image}`} aria-hidden="true" />
      <div className="narrative-body" onClick={handleTap} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && handleTap()}>
        <div className="narrative-text">
          {scene.lines.slice(0, lineIndex + 1).map((line, i) => (
            <p key={i} className={`narrative-line${i === lineIndex ? ' narrative-line--current' : ''}`}>
              {line}
            </p>
          ))}
        </div>
        <div className="narrative-hint">
          {isLast ? (
            <button className="btn-primary" onClick={(e) => { e.stopPropagation(); onAdvance(); setLineIndex(0); }}>
              Дальше →
            </button>
          ) : (
            <span className="tap-hint">Нажмите, чтобы продолжить…</span>
          )}
        </div>
      </div>
      <div className="scene-dots">
        {scene.lines.map((_, i) => (
          <span key={i} className={`scene-dot${i <= lineIndex ? ' scene-dot--active' : ''}`} />
        ))}
      </div>
    </div>
  );
}
