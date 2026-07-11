import { useState } from 'react';
import type { GameState, GameConfig } from '@/packages/game-engine/src';
import { MultiChoiceScreen, NarrativeScreen } from '../ui';
import { LeadForm } from '../LeadForm';
import { DiagnosisScreen } from '../DiagnosisScreen';

type FlowProps = {
  state: GameState;
  config: GameConfig;
  dispatch: (action: string, payload?: Record<string, unknown>) => Promise<void>;
  busy: boolean;
};

export function FinishedFlow({ state, config: _config, dispatch, busy: parentBusy }: FlowProps) {
  const [leadBusy, setLeadBusy] = useState(false);
  const [leadStatus, setLeadStatus] = useState<string | null>(null);

  if (state.flow.step === 'finish_confirmation') {
    return (
      <MultiChoiceScreen
        title="Завершить запуск прямо сейчас?"
        choices={[
          { id: 'confirm', label: 'Да, завершить' },
          { id: 'cancel', label: 'Нет, продолжить' }
        ]}
        onConfirm={(id) => dispatch('resolve_pending_decision', { action: id })}
        busy={parentBusy}
      />
    );
  }

  if (state.flow.step === 'final_reason') {
    return (
      <LeadForm
        state={state}
        busy={parentBusy || leadBusy}
        status={leadStatus}
        onBack={() => {
          // Can't go back from final_reason easily unless it was manual finish?
          // If it's manual finish, they were on finish_confirmation.
          // But final_reason is set by completeDay if time's up, so no back.
        }}
        onSubmit={async (formData) => {
          setLeadBusy(true);
          setLeadStatus(null);
          try {
            const payload = Object.fromEntries(formData.entries());
            const res = await fetch(`/api/game/sessions/${state.sessionId}/finish`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                expectedVersion: state.stateVersion,
                lead: payload
              })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? 'Ошибка при отправке');

            // The route returns the new state with final_diagnosis
            // We should ideally use dispatch or just reload, but since SceneEngine
            // controls state, we can just trigger a reload which will fetch the new state
            // from the backend, or we can use a callback.
            // Since we can't easily set state from here without a prop,
            // the easiest is to reload. The session is saved on backend.
            if (typeof window !== 'undefined') {
              window.location.reload();
            }
          } catch (err) {
            setLeadStatus(err instanceof Error ? err.message : 'Ошибка');
          } finally {
            setLeadBusy(false);
          }
        }}
      />
    );
  }

  if (state.flow.step === 'final_diagnosis') {
    if (!state.diagnostics) {
      return (
        <NarrativeScreen
          title="Загрузка диагностики..."
          paragraphs={[]}
          buttonText="Обновить"
          onNext={() => window.location.reload()}
          busy={false}
        />
      );
    }

    return (
      <DiagnosisScreen
        state={state}
        diagnostics={state.diagnostics}
        onRestart={() => {
          if (typeof window !== 'undefined') {
            window.location.href = '/';
          }
        }}
      />
    );
  }

  return (
    <NarrativeScreen
      title="Конец игры"
      paragraphs={[
        `Причина завершения: ${state.endingReason || 'Неизвестно'}`,
        `Выручка: ${state.metrics.revenue.toLocaleString('ru-RU')} ₽`
      ]}
      buttonText="Начать заново"
      onNext={() => {
        if (typeof window !== 'undefined') {
          window.location.href = '/';
        }
      }}
      busy={false}
    />
  );
}
