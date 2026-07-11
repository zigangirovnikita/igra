'use client';

import { useCallback, useEffect, useState } from 'react';
import type { GameConfig, GameState } from '@/packages/game-engine/src';
import type { AiReport } from '@/lib/ai/report';
import { MultiChoiceScreen, NarrativeScreen } from '../ui';
import { LeadForm } from '../LeadForm';
import { DiagnosisScreen } from '../DiagnosisScreen';
import { submitLead } from '@/lib/game/leadClient';

type FlowProps = {
  state: GameState;
  config: GameConfig;
  dispatch: (action: string, payload?: Record<string, unknown>) => Promise<void>;
  busy: boolean;
};

export function FinishedFlow({ state, dispatch, busy }: FlowProps) {
  const [finalState, setFinalState] = useState(state);
  const [report, setReport] = useState<AiReport | null>(null);
  const [reportSource, setReportSource] = useState<'ai' | 'fallback' | null>(null);
  const [finishBusy, setFinishBusy] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  const [showLead, setShowLead] = useState(false);
  const [leadBusy, setLeadBusy] = useState(false);
  const [leadStatus, setLeadStatus] = useState<string | null>(null);

  const loadFinalReport = useCallback(async () => {
    if (finishBusy || report) return;
    setFinishBusy(true);
    setFinishError(null);
    try {
      const response = await fetch(`/api/game/sessions/${finalState.sessionId}/finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedVersion: finalState.stateVersion }),
      });
      const data = await response.json();
      if (response.status === 409 && data.state) {
        setFinalState(data.state);
        throw new Error('Состояние обновилось. Запросите отчёт ещё раз.');
      }
      if (!response.ok) throw new Error(data.error ?? 'Не удалось завершить игру');
      setFinalState(data.state);
      setReport(data.report);
      setReportSource(data.reportSource);
    } catch (error) {
      setFinishError(error instanceof Error ? error.message : 'Не удалось получить диагностику');
    } finally {
      setFinishBusy(false);
    }
  }, [finalState.sessionId, finalState.stateVersion, finishBusy, report]);

  useEffect(() => {
    if (finalState.flow.step === 'final_diagnosis' && !report && !finishBusy && !finishError) {
      void loadFinalReport();
    }
  }, [finalState.flow.step, finishBusy, finishError, loadFinalReport, report]);

  if (finalState.flow.step === 'finish_confirmation') {
    return <MultiChoiceScreen title="Завершить запуск прямо сейчас?" choices={[
      { id: 'confirm', label: 'Да, завершить' },
      { id: 'cancel', label: 'Нет, продолжить' },
    ]} onConfirm={(action) => dispatch('resolve_pending_decision', { action })} busy={busy} />;
  }

  if (finalState.flow.step === 'final_reason') {
    return (
      <>
        {finishError && <div className="scene-error" role="alert">{finishError}</div>}
        <NarrativeScreen
          title="Запуск завершён"
          paragraphs={[`Причина: ${endingReasonLabel(finalState.endingReason)}`]}
          buttonText={finishBusy ? 'Считаем итог…' : 'Посмотреть итоги'}
          busy={finishBusy}
          onNext={loadFinalReport}
        />
      </>
    );
  }

  if (finalState.flow.step === 'final_diagnosis' && finalState.diagnostics) {
    if (!report) {
      return (
        <NarrativeScreen
          title={finishError ? 'Не удалось загрузить диагностику' : 'Считаем диагностику'}
          paragraphs={finishError ? [finishError] : ['Проверяем воронку, деньги, потери и альтернативные решения.']}
          buttonText={finishError ? 'Повторить' : 'Загрузка…'}
          onNext={loadFinalReport}
          busy={finishBusy}
        />
      );
    }

    if (showLead) {
      return <LeadForm state={finalState} busy={leadBusy} status={leadStatus} onBack={() => setShowLead(false)} onSubmit={async (formData) => {
        setLeadBusy(true);
        setLeadStatus(null);
        try {
          await submitLead(finalState, formData);
          setLeadStatus('success');
        } catch (error) {
          setLeadStatus(error instanceof Error ? error.message : 'Заявка не отправлена');
        } finally {
          setLeadBusy(false);
        }
      }} />;
    }

    return (
      <DiagnosisScreen
        state={finalState}
        diagnostics={finalState.diagnostics}
        aiReport={report}
        reportSource={reportSource ?? 'fallback'}
        onLead={() => setShowLead(true)}
        onRestart={() => {
          localStorage.removeItem('launch-game-cache');
          window.location.href = '/';
        }}
      />
    );
  }

  return <NarrativeScreen title="Диагностика недоступна" paragraphs={[]} buttonText="Обновить" onNext={loadFinalReport} busy={finishBusy} />;
}

function endingReasonLabel(reason: GameState['endingReason']): string {
  if (reason === 'time_finished') return 'закончились 30 игровых дней';
  if (reason === 'goal_finished') return 'бизнес-цель достигнута';
  if (reason === 'resource_finished') return 'закончился критический ресурс';
  if (reason === 'manual_finished') return 'вы завершили запуск досрочно';
  return 'завершение запуска';
}
