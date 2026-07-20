'use client';

import { useState } from 'react';
import { getV4Instrument, type GameState } from '@/packages/game-engine/src';
import { submitLead } from '@/lib/game/leadClient';
import { LeadForm } from '../../LeadForm';
import { rub, V4Screen } from './v4Ui';

type Dispatch = (actionType: string, payload?: Record<string, unknown>) => Promise<boolean>;

export function V4Result({ state, dispatch, busy }: { state: GameState; dispatch: Dispatch; busy: boolean }) {
  const [showLead, setShowLead] = useState(false);
  const [leadBusy, setLeadBusy] = useState(false);
  const [leadStatus, setLeadStatus] = useState<string | null>(null);
  const report = state.v4.lastReport;
  const dream = state.v4.dream;

  if (!report || !dream) {
    return (
      <V4Screen title="Результат не найден">
        <button className="btn-primary btn-compact" onClick={() => dispatch('v4_start_next_attempt')}>Вернуться в конструктор</button>
      </V4Screen>
    );
  }

  const reached = report.result !== 'not_reached';
  const verdict = report.result === 'sustainable_win'
    ? 'Вы купили мечту и вернули бюджет на следующий запуск'
    : report.result === 'dream_bought'
      ? 'Мечту купить можно, но денег на новый запуск не осталось'
      : 'На мечту пока не заработали';

  if (showLead) {
    return (
      <LeadForm
        state={state}
        busy={leadBusy}
        status={leadStatus}
        onBack={() => setShowLead(false)}
        onRestart={() => {
          localStorage.removeItem('launch-game-cache');
          window.location.href = '/';
        }}
        onSubmit={async (formData) => {
          setLeadBusy(true);
          setLeadStatus(null);
          try {
            await submitLead(state, formData);
            setLeadStatus('success');
          } catch (error) {
            setLeadStatus(error instanceof Error ? error.message : 'Заявка не отправлена');
          } finally {
            setLeadBusy(false);
          }
        }}
      />
    );
  }

  return (
    <V4Screen title={verdict}>
      <div className="v4-result-grid">
        <Metric title="Потратили" value={rub(report.spent)} detail={report.spendBreakdown.map((item) => `${item.label}: ${rub(item.amount)}`).join(' · ') || 'Без расходов'} />
        <Metric title="Заработали" value={rub(report.totalRevenue)} detail={`Основной продукт: ${rub(report.mainProductRevenue)} · Трипваеры: ${rub(report.tripwireRevenue)}`} />
        <Metric title="Потеряли потенциально" value={rub(report.lostPotentialRevenue)} detail={`Остыло/ушло людей: ${report.lostPeople}`} />
        <Metric title="Итог в банке" value={rub(report.totalMoney)} detail={`После мечты: ${rub(report.afterDream)}`} />
      </div>
      <div className="v4-observations">
        {report.observations.map((line) => <p key={line}>{line}</p>)}
      </div>
      <button className="btn-secondary btn-compact" onClick={() => dispatch('v4_toggle_details')}>
        {state.v4.detailsOpen ? 'Скрыть детали расчета' : 'Посмотреть детали расчета'}
      </button>
      {state.v4.detailsOpen && (
        <div className="v4-details">
          {report.stageResults.map((stage, index) => (
            <div key={stage.stageId}>
              <strong>{index + 1}. {getV4Instrument(stage.instrumentId).title}</strong>
              <span>Вход: {stage.entered} · Дальше: {stage.progressed} · Продажи: {stage.mainProductSales + stage.tripwireSales} · Потери: {stage.lost}</span>
            </div>
          ))}
        </div>
      )}
      <div className="v4-footer-actions">
        <button className="btn-primary" disabled={busy} onClick={() => reached ? setShowLead(true) : dispatch('v4_start_next_attempt')}>
          {reached ? 'Хочу такую воронку себе' : 'Сыграть еще раз'}
        </button>
        <button className="btn-secondary" disabled={busy} onClick={() => reached ? dispatch('v4_start_next_attempt') : setShowLead(true)}>
          {reached ? 'Сыграть еще раз' : 'Хочу на живую консультацию'}
        </button>
      </div>
    </V4Screen>
  );
}

function Metric({ title, value, detail }: { title: string; value: string; detail: string }) {
  return (
    <article className="v4-metric">
      <span>{title}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}
