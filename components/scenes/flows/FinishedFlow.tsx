import { useState } from 'react';
import type { GameState, GameConfig } from '@/packages/game-engine/src';
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

export function FinishedFlow({ state, config: _config, dispatch, busy }: FlowProps) {
  const [showLead, setShowLead] = useState(false);
  const [leadBusy, setLeadBusy] = useState(false);
  const [leadStatus, setLeadStatus] = useState<string | null>(null);

  if (state.flow.step === 'finish_confirmation') {
    return <MultiChoiceScreen title="Завершить запуск прямо сейчас?" choices={[
      { id: 'confirm', label: 'Да, завершить' },
      { id: 'cancel', label: 'Нет, продолжить' },
    ]} onConfirm={(action) => dispatch('resolve_pending_decision', { action })} busy={busy} />;
  }

  if (state.flow.step === 'final_reason') {
    return <NarrativeScreen title="Запуск завершён" paragraphs={[
      `Причина: ${state.endingReason ?? 'завершение запуска'}`,
    ]} buttonText="Посмотреть итоги" busy={busy} onNext={async () => {
      const response = await fetch(`/api/game/sessions/${state.sessionId}/finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedVersion: state.stateVersion }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Не удалось завершить игру');
      window.location.reload();
    }} />;
  }

  if (state.flow.step === 'final_diagnosis' && state.diagnostics) {
    if (showLead) {
      return <LeadForm state={state} busy={leadBusy} status={leadStatus} onBack={() => setShowLead(false)} onSubmit={async (formData) => {
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
      }} />;
    }
    return <DiagnosisScreen state={state} diagnostics={state.diagnostics} onLead={() => setShowLead(true)} onRestart={() => {
      localStorage.removeItem('launch-game-cache');
      window.location.href = '/';
    }} />;
  }

  return <NarrativeScreen title="Загрузка диагностики..." paragraphs={[]} buttonText="Обновить" onNext={() => window.location.reload()} busy={false} />;
}
