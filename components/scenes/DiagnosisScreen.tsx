'use client';

import type { DiagnosisScene } from '@/lib/scenes/types';

const rub = (n: number) =>
  n.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 });

type Props = {
  scene: DiagnosisScene;
  onCta: () => void;
  onRestart: () => void;
};

type Stage = { label: string; ok: boolean; detail: string };

const bottleneckLabels: Record<string, string> = {
  processing: 'Обработка входящих',
  traffic: 'Трафик',
  capacity: 'Ёмкость продукта',
  energy: 'Энергия',
};

export function DiagnosisScreen({ scene, onCta, onRestart }: Props) {
  const { diagnostics: diag, metrics, productPrice, personalGoal, targetRevenue, dreamsMet } = scene;

  const topBottleneck = diag.bottlenecks[0];
  const profit = diag.financials.launchProfit;

  const stages: Stage[] = [
    {
      label: 'Трафик',
      ok: metrics.impressions > 500,
      detail: metrics.impressions > 0 ? `${Math.round(metrics.impressions).toLocaleString('ru-RU')} просмотров` : 'Охвата почти не было',
    },
    {
      label: 'Прогрев',
      ok: !diag.bottlenecks.find((b) => b.category === 'traffic'),
      detail: metrics.responses > 0 ? `${Math.round(metrics.responses)} входящих` : 'Никто не написал',
    },
    {
      label: 'Обработка входящих',
      ok: diag.bottlenecks.find((b) => b.category === 'processing')?.expectedLoss === 0 || !diag.bottlenecks.find((b) => b.category === 'processing'),
      detail: metrics.processed > 0
        ? `Обработано ${Math.round(metrics.processed)} из ${Math.round(metrics.responses)}`
        : 'Входящих не было',
    },
    {
      label: 'Продажа',
      ok: metrics.sales > 0,
      detail: metrics.sales > 0 ? `${metrics.sales} продаж` : 'Продаж не было',
    },
    {
      label: 'Дожим',
      ok: !diag.counterfactuals.find((c) => c.change.includes('дожим') && c.expectedProfitDelta > 0),
      detail: metrics.sales > 0 ? 'Дожим использовался' : 'Дожим не использовался',
    },
  ];

  return (
    <div className="scene-screen scene-screen--diagnosis">
      <div className="scene-image scene-image--final" aria-hidden="true" />
      <div className="diagnosis-body">
        <h2 className="diagnosis-title">Итоги 30 дней</h2>

        {/* Funnel stages */}
        <div className="diagnosis-stages">
          {stages.map((stage) => (
            <div key={stage.label} className={`stage-item${stage.ok ? ' stage-item--ok' : ' stage-item--fail'}`}>
              <span className="stage-icon">{stage.ok ? '✅' : '❌'}</span>
              <div className="stage-info">
                <span className="stage-label">{stage.label}</span>
                <span className="stage-detail">{stage.detail}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Top bottleneck */}
        {topBottleneck && topBottleneck.expectedLoss > 0 && (
          <div className="bottleneck-box">
            <span className="bottleneck-icon">⚠️</span>
            <div>
              <strong>Главное узкое место: {bottleneckLabels[topBottleneck.category] ?? topBottleneck.category}</strong>
              <p>Потенциальные потери: ~{rub(topBottleneck.expectedLoss)}</p>
            </div>
          </div>
        )}

        {/* Financials */}
        <div className="financials-grid">
          <div className="financial-card">
            <span className="financial-label">Выручка</span>
            <span className="financial-value">{rub(diag.financials.revenue)}</span>
          </div>
          <div className="financial-card">
            <span className="financial-label">Расходы</span>
            <span className="financial-value financial-value--down">{rub(diag.financials.expenses)}</span>
          </div>
          <div className={`financial-card financial-card--wide`}>
            <span className="financial-label">Прибыль</span>
            <span className={`financial-value ${profit >= 0 ? 'financial-value--up' : 'financial-value--down'}`}>
              {rub(profit)}
            </span>
          </div>
        </div>

        {/* Personal goal */}
        <div className={`dream-status${dreamsMet ? ' dream-status--met' : ' dream-status--missed'}`}>
          {dreamsMet ? '🎯 Личная цель достигнута!' : `📍 До личной цели не хватило ${rub(personalGoal - diag.financials.revenue)}`}
        </div>

        {/* CTA */}
        <div className="scene-btn-row">
          <button className="btn-primary" onClick={onCta}>
            Разобрать мой запуск
          </button>
          <button className="btn-secondary" onClick={onRestart}>
            Пройти заново
          </button>
        </div>
      </div>
    </div>
  );
}
