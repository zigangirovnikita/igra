import type { GameState, GameConfig } from '@/packages/game-engine/src';
import { MultiChoiceScreen } from '../ui';

type FlowProps = {
  state: GameState;
  config: GameConfig;
  dispatch: (action: string, payload?: Record<string, unknown>) => Promise<void>;
  busy: boolean;
};

export function PendingDecisionFlow({ state, dispatch, busy }: FlowProps) {
  const pending = state.pendingDecision;
  if (!pending) return null;

  if (pending.type === 'goal_reached') {
    return <MultiChoiceScreen title="Бизнес-цель достигнута" choices={[
      { id: 'cancel', label: 'Продолжить запуск' },
      { id: 'confirm', label: 'Завершить и посмотреть итоги' },
    ]} onConfirm={(action) => dispatch('resolve_pending_decision', { action })} busy={busy} />;
  }

  if (pending.type === 'budget_notice') {
    return <MultiChoiceScreen title="Бюджет закончился" choices={[
      { id: 'continue_without_budget', label: 'Продолжить без бюджета' },
      { id: 'confirm', label: 'Завершить запуск' },
    ]} onConfirm={(action) => dispatch('resolve_pending_decision', { action })} busy={busy} />;
  }

  if (pending.type === 'inbound') {
    const cohort = state.cohorts.find((item) => item.id === pending.cohortId);
    const count = Math.round(cohort?.unprocessedInbound ?? 0);

    return (
      <MultiChoiceScreen
        title="Что делать с сообщениями?"
        description={`Новых сообщений: ${count}. Если оставить их без ответа, часть людей будет потеряна.`}
        choices={[
          { id: 'process_all', label: 'Ответить всем' },
          { id: 'process_available', label: 'Ответить доступному количеству' },
          { id: 'process_selected', label: 'Выбрать часть сообщений' },
          { id: 'defer', label: 'Ответить завтра', disabled: Boolean(cohort && cohort.deferCount >= 1) },
          { id: 'connect_manager', label: 'Подключить менеджера', disabled: state.resources.bank < 30_000 },
          { id: 'connect_bot', label: 'Срочно сделать бота' },
          { id: 'ignore', label: 'Оставить без ответа' },
        ]}
        onConfirm={(action) => dispatch('resolve_pending_decision', {
          cohortId: pending.cohortId,
          action,
          amount: action === 'process_selected' ? Math.max(1, Math.ceil(count / 2)) : undefined
        })}
        busy={busy}
        layout="list"
      />
    );
  }

  if (pending.type === 'sales') {
    return (
      <MultiChoiceScreen
        title="Как продавать текущим заявкам?"
        description="Можно сохранить первоначальный способ или поменять его прямо сейчас."
        choices={[
          { id: 'sell_chat', label: 'Продать в переписке' },
          { id: 'sell_call', label: 'Позвать на созвон' },
          { id: 'sell_website', label: 'Отправить на сайт' },
          { id: 'sell_bot', label: 'Отправить в бота' },
          { id: 'sell_webinar', label: 'Позвать на вебинар' },
          { id: 'defer', label: 'Вернуться завтра' },
          { id: 'ignore', label: 'Не продавать этим заявкам' },
        ]}
        onConfirm={(action) => dispatch('resolve_pending_decision', { cohortId: pending.cohortId, action })}
        busy={busy}
        layout="list"
      />
    );
  }

  if (pending.type === 'followup') {
    return (
      <MultiChoiceScreen
        title="Что делать с сомневающимися?"
        choices={[
          { id: 'followup_message', label: 'Написать ещё раз' },
          { id: 'followup_call', label: 'Предложить созвон' },
          { id: 'followup_case', label: 'Дать кейс' },
          { id: 'followup_discount', label: 'Предложить скидку' },
          { id: 'followup_bot', label: 'Настроить автоматический дожим' },
          { id: 'ignore', label: 'Оставить человека в покое' },
        ]}
        onConfirm={(action) => dispatch('resolve_pending_decision', { cohortId: pending.cohortId, action })}
        busy={busy}
        layout="list"
      />
    );
  }

  return (
    <MultiChoiceScreen
      title="Нужно ваше решение"
      description={`Тип решения: ${pending.type}`}
      choices={[
        { id: 'process', label: 'Обработать' },
        { id: 'defer', label: 'Отложить на потом' },
        { id: 'ignore', label: 'Игнорировать' },
      ]}
      onConfirm={(id) => dispatch('resolve_pending_decision', { 
        cohortId: 'cohortId' in pending ? pending.cohortId : '', 
        action: id 
      })}
      busy={busy}
    />
  );
}
