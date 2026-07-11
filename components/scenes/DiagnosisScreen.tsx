import type { GameState, Diagnostics } from '@/packages/game-engine/src';

type Props = {
  state: GameState;
  diagnostics: Diagnostics;
  onRestart: () => void;
};

export function DiagnosisScreen({ state: _state, diagnostics, onRestart }: Props) {
  const formatMoney = (val: number) => val.toLocaleString('ru-RU') + ' ₽';
  
  return (
    <div className="scene-screen scrollable" style={{ padding: '20px', color: 'white', maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '24px', marginBottom: '16px' }}>Итоги запуска</h1>
      
      <div style={{ marginBottom: '24px', background: 'rgba(255,255,255,0.1)', padding: '16px', borderRadius: '8px' }}>
        <h2 style={{ fontSize: '18px', marginBottom: '8px', color: '#ffb' }}>Финансы</h2>
        <p>Выручка: {formatMoney(diagnostics.financials.revenue)}</p>
        <p>Расходы: {formatMoney(diagnostics.financials.expenses)}</p>
        <p>Прибыль с запуска: {formatMoney(diagnostics.financials.launchProfit)}</p>
        <p>Накопления (с учётом трат на жизнь): {formatMoney(diagnostics.financials.totalLiquidity)}</p>
        <p>Остаток на балансе: {formatMoney(diagnostics.financials.bankRemaining)}</p>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '18px', marginBottom: '8px', color: '#f88' }}>Узкие места (Bottlenecks)</h2>
        {diagnostics.bottlenecks.length === 0 ? (
          <p>Всё работало отлично!</p>
        ) : (
          <ul style={{ paddingLeft: '20px' }}>
            {diagnostics.bottlenecks.map((b, i) => (
              <li key={i} style={{ marginBottom: '8px' }}>
                <strong>{b.category}</strong>: Потенциальные потери {formatMoney(b.expectedLoss)}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '18px', marginBottom: '8px', color: '#8f8' }}>Сильные решения</h2>
        {diagnostics.strongDecisions.length === 0 ? (
          <p>Нет особых решений</p>
        ) : (
          <ul style={{ paddingLeft: '20px' }}>
            {diagnostics.strongDecisions.map((d, i) => (
              <li key={i} style={{ marginBottom: '8px' }}>{d}</li>
            ))}
          </ul>
        )}
      </div>

      <div style={{ marginTop: '32px', textAlign: 'center' }}>
        <button className="btn-primary" onClick={onRestart}>
          Начать заново
        </button>
      </div>
    </div>
  );
}
