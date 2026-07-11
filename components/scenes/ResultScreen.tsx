'use client';

import type { ResultScene } from '@/lib/scenes/types';

type Props = {
  scene: ResultScene;
  onNext: () => void;
};

export function ResultScreen({ scene, onNext }: Props) {
  return (
    <div className="scene-screen">
      <div className={`scene-image scene-image--${scene.image}`} aria-hidden="true" />
      <div className="result-body">
        <h2 className="result-headline">{scene.headline}</h2>
        {scene.lines.map((line, i) => (
          <p key={i} className="result-line">{line}</p>
        ))}
        {scene.deltas.length > 0 && (
          <div className="result-deltas">
            {scene.deltas.map((delta, i) => (
              <div key={i} className={`delta-card delta-card--${delta.direction ?? 'neutral'}`}>
                <span className="delta-card-label">{delta.label}</span>
                <span className="delta-card-value">{delta.value}</span>
              </div>
            ))}
          </div>
        )}
        <div className="scene-btn-row">
          <button className="btn-primary" onClick={onNext}>
            Продолжить →
          </button>
        </div>
      </div>
    </div>
  );
}
