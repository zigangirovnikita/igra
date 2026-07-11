'use client';

import { useState } from 'react';
import type { Diagnostics, GameState } from '@/packages/game-engine/src';
import type { AiReport } from '@/lib/ai/report';

type Props = {
  state: GameState;
  diagnostics: Diagnostics;
  aiReport: AiReport;
  reportSource: 'ai' | 'fallback';
  onRestart: () => void;
  onLead: () => void;
};

type Tab = 'summary' | 'diagnosis' | 'actions';

export function DiagnosisScreen({ state, diagnostics, aiReport, reportSource, onRestart, onLead }: Props) {
  const [tab, setTab] = useState<Tab>('summary');
  const formatMoney = (value: number) => `${value.toLocaleString('ru-RU')} ₽`;
  const startingBank = diagnostics.financials.bankRemaining + diagnostics.financials.expenses;

  return (
    <div className="scene-screen scrollable" style={{ padding: '20px', color: 'white', maxWidth: '720px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '24px', marginBottom: '8px' }}>{aiReport.headline}</h1>
      <p className="scene-paragraph">{aiReport.resultSummary}</p>
      <p className="scene-paragraph" style={{ opacity: 0.7 }}>
        Источник объяснения: {reportSource === 'ai' ? 'ИИ по рассчитанным данным игры' : 'детерминированный резервный отчёт'}.
      </p>

      <div role="tablist" aria-label="Разделы диагностики" className="scene-actions" style={{ marginBottom: '20px' }}>
        <button className={tab === 'summary' ? 'btn-primary' : 'btn-secondary'} role="tab" aria-selected={tab === 'summary'} onClick={() => setTab('summary')}>Итог</button>
        <button className={tab === 'diagnosis' ? 'btn-primary' : 'btn-secondary'} role="tab" aria-selected={tab === 'diagnosis'} onClick={() => setTab('diagnosis')}>Диагностика</button>
        <button className={tab === 'actions' ? 'btn-primary' : 'btn-secondary'} role="tab" aria-selected={tab === 'actions'} onClick={() => setTab('actions')}>Что делать</button>
      </div>

      {tab === 'summary' && (
        <section role="tabpanel">
          <Card title="Финансы">
            <p>Стартовый банк: {formatMoney(startingBank)}</p>
            <p>Потрачено из банка: {formatMoney(diagnostics.financials.expenses)}</p>
            <p>Остаток банка: {formatMoney(diagnostics.financials.bankRemaining)}</p>
            <p>Выручка: {formatMoney(diagnostics.financials.revenue)}</p>
            <p>Прибыль запуска: {formatMoney(diagnostics.financials.launchProfit)}</p>
            <p><strong>Всего доступно после запуска: {formatMoney(diagnostics.financials.totalLiquidity)}</strong></p>
            <p>Продажи: {state.metrics.sales} из цели {state.targets.targetSales}</p>
          </Card>

          <Card title="Комментарий к цели"><p>{aiReport.goalComment}</p></Card>
          <Card title="Энергия"><p>{aiReport.energyComment}</p></Card>

          <Card title="Мечты">
            {diagnostics.dreams.length === 0 ? <p>Покупки на старте не выбирались.</p> : (
              <ul>
                {diagnostics.dreams.map((dream) => (
                  <li key={dream.id}>{dream.affordable ? '✓' : '×'} {dream.title}: {formatMoney(dream.price)}</li>
                ))}
              </ul>
            )}
          </Card>
        </section>
      )}

      {tab === 'diagnosis' && (
        <section role="tabpanel">
          <Card title="Сильные решения">
            {aiReport.strongDecisions.length === 0 ? <p>Выраженных сильных решений не найдено.</p> : (
              <ul>{aiReport.strongDecisions.map((item) => <li key={item.title}><strong>{item.title}.</strong> {item.explanation}</li>)}</ul>
            )}
          </Card>

          <Card title="Узкие места">
            {aiReport.bottlenecks.length === 0 ? <p>Крупных узких мест не найдено.</p> : (
              <ul>{aiReport.bottlenecks.map((item) => <li key={item.title}><strong>{item.title}.</strong> {item.explanation} {item.estimatedLoss ?? ''}</li>)}</ul>
            )}
          </Card>

          <Card title="Ошибки">
            {diagnostics.mistakes.length === 0 ? <p>Критичных ошибок модель не нашла.</p> : (
              <ul>{diagnostics.mistakes.map((mistake, index) => <li key={`${mistake.day}-${index}`}>День {mistake.day}: {mistake.message}</li>)}</ul>
            )}
          </Card>

          <Card title="Путь запуска">
            <p>Продукт: {state.launchPlan.productName || 'не указан'} за {formatMoney(state.launchPlan.productPrice ?? 0)}</p>
            <p>{labelEntry(state.activeRoute.entry)} → {state.activeRoute.nurture.map(labelNurture).join(', ')} → {labelProcessing(state.activeRoute.processing)} → {labelSale(state.activeRoute.saleMethod)} → {labelFollowup(state.activeRoute.followup)}</p>
          </Card>
        </section>
      )}

      {tab === 'actions' && (
        <section role="tabpanel">
          <Card title="Что могло быть иначе">
            <p>{aiReport.counterfactualSummary}</p>
            {diagnostics.counterfactuals.length === 0 ? <p>Положительных альтернатив при повторном прогоне не найдено.</p> : (
              <ul>{diagnostics.counterfactuals.map((item) => <li key={item.change}>{item.change}: прирост прибыли {formatMoney(item.expectedProfitDelta)}</li>)}</ul>
            )}
          </Card>

          <Card title="Следующие действия">
            <ul>{aiReport.alternativeActions.map((item) => <li key={item.change}><strong>{item.change}.</strong> {item.potentialResult} {item.why}</li>)}</ul>
          </Card>
          <Card title="Главный вывод"><p>{aiReport.finalInsight}</p></Card>
        </section>
      )}

      <div style={{ marginTop: '32px' }}>
        <p className="scene-paragraph">{aiReport.ctaBridge}</p>
        <div className="scene-actions">
          <button className="btn-primary" onClick={onLead}>Получить разбор</button>
          <button className="btn-secondary" onClick={onRestart}>Начать заново</button>
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '20px', background: 'rgba(255,255,255,0.08)', padding: '16px', borderRadius: '8px' }}>
      <h2 style={{ fontSize: '18px', marginBottom: '8px' }}>{title}</h2>
      {children}
    </div>
  );
}

function labelEntry(value: string): string {
  return ({ direct_messages: 'директ', guide: 'гайд', video_lesson: 'видеоурок', website: 'сайт', webinar_registration: 'регистрация на вебинар' } as Record<string, string>)[value] ?? value;
}
function labelNurture(value: string): string {
  return ({ none: 'без прогрева', guide: 'гайд', video_lesson: 'видеоурок', telegram: 'Telegram-прогрев', webinar: 'вебинар' } as Record<string, string>)[value] ?? value;
}
function labelProcessing(value: string): string {
  return ({ manual: 'ручная обработка', simple_bot: 'простой бот', ai_bot: 'ИИ-бот', manager: 'менеджер', website_auto: 'сайт' } as Record<string, string>)[value] ?? value;
}
function labelSale(value: string): string {
  return ({ manual_chat: 'переписка', call: 'созвон', website_auto: 'сайт', bot_auto: 'бот', webinar_direct: 'вебинар' } as Record<string, string>)[value] ?? value;
}
function labelFollowup(value: string): string {
  return ({ none: 'без дожима', manual: 'ручной дожим', bot: 'дожим ботом' } as Record<string, string>)[value] ?? value;
}
