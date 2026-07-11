import type { GameState, Diagnostics } from '@/packages/game-engine/src';

type Props = {
  state: GameState;
  diagnostics: Diagnostics;
  onRestart: () => void;
  onLead: () => void;
};

export function DiagnosisScreen({ state, diagnostics, onRestart, onLead }: Props) {
  const formatMoney = (val: number) => val.toLocaleString('ru-RU') + ' ₽';
  
  return (
    <div className="scene-screen scrollable" style={{ padding: '20px', color: 'white', maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '24px', marginBottom: '16px' }}>Итоги запуска</h1>
      
      <div style={{ marginBottom: '24px', background: 'rgba(255,255,255,0.1)', padding: '16px', borderRadius: '8px' }}>
        <h2 style={{ fontSize: '18px', marginBottom: '8px', color: '#ffb' }}>Финансы</h2>
        <p>Стартовый банк: {formatMoney(100_000)}</p>
        <p>Выручка: {formatMoney(diagnostics.financials.revenue)}</p>
        <p>Расходы: {formatMoney(diagnostics.financials.expenses)}</p>
        <p>Прибыль с запуска: {formatMoney(diagnostics.financials.launchProfit)}</p>
        <p>Накопления (с учётом трат на жизнь): {formatMoney(diagnostics.financials.totalLiquidity)}</p>
        <p>Остаток на балансе: {formatMoney(diagnostics.financials.bankRemaining)}</p>
        <p>Продажи: {state.metrics.sales}</p>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '18px', marginBottom: '8px', color: '#ffb' }}>Мечты</h2>
        {diagnostics.dreams.length === 0 ? (
          <p>Покупки на старте не выбирались.</p>
        ) : (
          <ul style={{ paddingLeft: '20px' }}>
            {diagnostics.dreams.map((dream) => (
              <li key={dream.id}>{dream.affordable ? '✓' : '×'} {dream.title}: {formatMoney(dream.price)}</li>
            ))}
          </ul>
        )}
      </div>

      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '18px', marginBottom: '8px', color: '#8cf' }}>Путь запуска</h2>
        <p>Продукт: {state.launchPlan.productName || 'не указан'} за {formatMoney(state.launchPlan.productPrice ?? 0)}</p>
        <p>Вход: {labelEntry(state.activeRoute.entry)} → прогрев: {state.activeRoute.nurture.map(labelNurture).join(', ')} → обработка: {labelProcessing(state.activeRoute.processing)} → продажа: {labelSale(state.activeRoute.saleMethod)} → дожим: {labelFollowup(state.activeRoute.followup)}</p>
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

      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '18px', marginBottom: '8px', color: '#f88' }}>Ошибки</h2>
        {diagnostics.mistakes.length === 0 ? (
          <p>Критичных ошибок диагностика не нашла.</p>
        ) : (
          <ul style={{ paddingLeft: '20px' }}>
            {diagnostics.mistakes.map((mistake, i) => <li key={i}>День {mistake.day}: {mistake.message}</li>)}
          </ul>
        )}
      </div>

      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '18px', marginBottom: '8px', color: '#8cf' }}>Что могло быть иначе</h2>
        {diagnostics.counterfactuals.length === 0 ? (
          <p>Сильных альтернатив с расчётной выгодой не найдено.</p>
        ) : (
          <ul style={{ paddingLeft: '20px' }}>
            {diagnostics.counterfactuals.map((item, i) => <li key={i}>{item.change}: потенциально {formatMoney(item.expectedProfitDelta)}</li>)}
          </ul>
        )}
      </div>

      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '18px', marginBottom: '8px', color: '#ddd' }}>История решений</h2>
        {state.dayReports.length === 0 ? (
          <p>История действий пустая.</p>
        ) : (
          <ul style={{ paddingLeft: '20px' }}>
            {state.dayReports.map((report) => (
              <li key={report.id}>День {report.finishedDay}: {report.actionTitle}, продажи {report.outcome.salesDelta}, выручка {formatMoney(report.outcome.revenueDelta)}</li>
            ))}
          </ul>
        )}
      </div>

      <div style={{ marginTop: '32px', textAlign: 'center' }}>
        <button className="btn-primary" onClick={onLead}>Получить разбор</button>
        <button className="btn-primary" onClick={onRestart}>
          Начать заново
        </button>
      </div>
    </div>
  );
}

function labelEntry(value: string): string {
  if (value === 'direct_messages') return 'директ';
  if (value === 'guide') return 'гайд';
  if (value === 'video_lesson') return 'видеоурок';
  if (value === 'website') return 'сайт';
  if (value === 'webinar_registration') return 'вебинар';
  return value;
}

function labelNurture(value: string): string {
  if (value === 'none') return 'нет';
  if (value === 'guide') return 'гайд';
  if (value === 'video_lesson') return 'видеоурок';
  if (value === 'telegram') return 'история и кейсы';
  if (value === 'webinar') return 'вебинар';
  return value;
}

function labelProcessing(value: string): string {
  if (value === 'manual') return 'вручную';
  if (value === 'simple_bot') return 'простой бот';
  if (value === 'ai_bot') return 'ИИ-бот';
  if (value === 'manager') return 'менеджер';
  if (value === 'website_auto') return 'сайт';
  return value;
}

function labelSale(value: string): string {
  if (value === 'manual_chat') return 'переписка';
  if (value === 'call') return 'созвон';
  if (value === 'website_auto') return 'сайт';
  if (value === 'bot_auto') return 'бот';
  if (value === 'webinar_direct') return 'вебинар';
  return value;
}

function labelFollowup(value: string): string {
  if (value === 'none') return 'нет';
  if (value === 'manual') return 'ручной';
  if (value === 'bot') return 'бот';
  return value;
}
