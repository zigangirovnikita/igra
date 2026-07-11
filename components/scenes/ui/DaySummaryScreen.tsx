import type { ReactNode } from 'react';

type Props = {
  day: number;
  title: string;
  summaryText?: ReactNode;
  metrics: {
    impressionsDelta: number;
    inboundDelta: number;
    salesDelta: number;
    revenueDelta: number;
    bankDelta: number;
    energyDelta: number;
  };
  onNext: () => void;
  busy?: boolean;
};

export function DaySummaryScreen({ day, title, summaryText, metrics, onNext, busy }: Props) {
  return (
    <div className="scene-step scene-step--center">
      <div className="scene-image scene-image--sunset" aria-hidden="true" />
      <h2 className="scene-headline">День {day} завершён</h2>
      <h3 className="scene-subheadline">{title}</h3>
      
      {summaryText && (
        <div className="scene-description">
          {summaryText}
        </div>
      )}

      <div className="scene-metrics-grid">
        {metrics.impressionsDelta > 0 && (
          <div className="metric-box">
            <span className="metric-value">+{metrics.impressionsDelta}</span>
            <span className="metric-label">Охватов</span>
          </div>
        )}
        {metrics.inboundDelta > 0 && (
          <div className="metric-box">
            <span className="metric-value">+{metrics.inboundDelta}</span>
            <span className="metric-label">Лидов</span>
          </div>
        )}
        {metrics.salesDelta > 0 && (
          <div className="metric-box">
            <span className="metric-value">+{metrics.salesDelta}</span>
            <span className="metric-label">Продаж</span>
          </div>
        )}
        {metrics.revenueDelta !== 0 && (
          <div className="metric-box">
            <span className="metric-value">{metrics.revenueDelta > 0 ? '+' : ''}{metrics.revenueDelta.toLocaleString('ru-RU')} ₽</span>
            <span className="metric-label">Выручка</span>
          </div>
        )}
        {metrics.bankDelta < 0 && (
          <div className="metric-box">
            <span className="metric-value">{metrics.bankDelta.toLocaleString('ru-RU')} ₽</span>
            <span className="metric-label">Расходы</span>
          </div>
        )}
        <div className="metric-box">
          <span className="metric-value">{metrics.energyDelta > 0 ? '+' : ''}{metrics.energyDelta} ⚡</span>
          <span className="metric-label">Энергии</span>
        </div>
      </div>

      <button className="btn-primary scene-next-btn" onClick={onNext} disabled={busy}>
        {busy ? 'Загрузка...' : 'Начать новый день →'}
      </button>
    </div>
  );
}
