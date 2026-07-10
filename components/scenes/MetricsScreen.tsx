'use client';

import type { MetricsScene } from '@/lib/scenes/types';

const rub = (n: number) =>
  n.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 });

type Props = {
  scene: MetricsScene;
  onNext: () => void;
};

export function MetricsScreen({ scene, onNext }: Props) {
  const energyColor = scene.energy < 20 ? 'var(--color-red)' : scene.energy < 40 ? 'var(--color-orange)' : 'var(--color-green)';

  return (
    <div className="scene-screen scene-screen--metrics">
      <div className="metrics-day-banner">
        <span className="metrics-day-label">День</span>
        <span className="metrics-day-number">{scene.day}</span>
        <span className="metrics-day-total">/30</span>
      </div>

      <div className="metrics-grid">
        <div className="metrics-card">
          <span className="metrics-label">Банк</span>
          <span className="metrics-value">{rub(scene.bank)}</span>
          {scene.bankDelta !== 0 && (
            <span className={`metrics-delta ${scene.bankDelta > 0 ? 'delta-up' : 'delta-down'}`}>
              {scene.bankDelta > 0 ? '+' : ''}{rub(scene.bankDelta)}
            </span>
          )}
        </div>

        <div className="metrics-card">
          <span className="metrics-label">Выручка</span>
          <span className="metrics-value">{rub(scene.revenue)}</span>
          {scene.sales > 0 && (
            <span className="metrics-delta delta-up">{scene.sales} {scene.sales === 1 ? 'продажа' : scene.sales < 5 ? 'продажи' : 'продаж'}</span>
          )}
        </div>

        <div className="metrics-card metrics-card--wide">
          <span className="metrics-label">Энергия</span>
          <div className="energy-bar-wrap">
            <div className="energy-bar" style={{ width: `${Math.max(0, scene.energy)}%`, backgroundColor: energyColor }} />
          </div>
          <span className="metrics-value">{Math.round(scene.energy)}%</span>
        </div>
      </div>

      <div className="scene-btn-row">
        <button className="btn-primary" onClick={onNext}>
          Продолжить
        </button>
      </div>
    </div>
  );
}
