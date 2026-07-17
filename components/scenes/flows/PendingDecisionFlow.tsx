import type { GameConfig, GameState } from '@/packages/game-engine/src';
import { MultiChoiceScreen } from '../ui';
import { DirectMiniGame } from '../DirectMiniGame';

type FlowProps = {
  state: GameState;
  config: GameConfig;
  dispatch: (action: string, payload?: Record<string, unknown>) => Promise<void>;
  busy: boolean;
};

export function PendingDecisionFlow({ state, dispatch, busy }: FlowProps) {
  const pending = state.pendingDecision;
  if (!pending) return null;

  if (pending.type === 'mini_game') {
    return <DirectMiniGame state={state} dispatch={dispatch} busy={busy} />;
  }

  if (pending.type === 'goal_reached') {
    return <MultiChoiceScreen title="Бизнес-цель достигнута" choices={[
      { id: 'cancel', label: 'Продолжить запуск' },
      { id: 'confirm', label: 'Завершить и посмотреть итоги' },
    ]} onConfirm={(action) => dispatch('resolve_pending_decision', { action })} busy={busy} />;
  }

  if (pending.type === 'budget_notice') {
    return <MultiChoiceScreen title="Бюджет закончился" choices={[
      { id: 'continue_without_budget', label: 'Продолжить бесплатными действиями' },
      { id: 'confirm', label: 'Завершить запуск' },
    ]} onConfirm={(action) => dispatch('resolve_pending_decision', { action })} busy={busy} />;
  }

  if (pending.type === 'inbound') {
    const cohort = state.cohorts.find((item) => item.id === pending.cohortId);
    const count = Math.round(cohort?.unprocessedInbound ?? 0);
    const available = Math.max(0, Math.floor(state.resources.energy / 0.3));

    return (
      <MultiChoiceScreen
        title="Что делать с сообщениями?"
        description={`Новых сообщений: ${count}. С текущей энергией можно ответить максимум на ${available}.`}
        choices={[
          { id: 'process_all', label: 'Ответить всем', disabled: available < count },
          { id: 'process_available', label: `Ответить на ${Math.min(count, available)}`, disabled: available <= 0 },
          { id: 'process_selected', label: 'Ответить на половину', disabled: available <= 0 },
          { id: 'defer', label: 'Ответить завтра', disabled: Boolean(cohort && cohort.deferCount >= 1) },
          { id: 'ignore', label: 'Оставить без ответа' },
        ]}
        onConfirm={(action) => dispatch('resolve_pending_decision', {
          cohortId: pending.cohortId,
          action,
          amount: action === 'process_selected' ? Math.min(available, Math.max(1, Math.ceil(count / 2))) : undefined,
        })}
        busy={busy}
        layout="list"
      />
    );
  }

  if (pending.type === 'sales') {
    const hasWebsite = Boolean(state.assets.website);
    const hasBot = Boolean(state.assets.simpleBot || state.assets.aiBot);
    return (
      <MultiChoiceScreen
        title="Как продавать текущим заявкам?"
        description="Способ продажи меняется только для этой группы заявок. Несуществующие инструменты недоступны."
        choices={[
          { id: 'sell_chat', label: 'Продать в переписке' },
          { id: 'sell_call', label: 'Позвать на созвон' },
          { id: 'sell_website', label: 'Отправить на сайт', disabled: !hasWebsite },
          { id: 'sell_bot', label: 'Отправить в бота', disabled: !hasBot },
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
    const hasBot = Boolean(state.assets.simpleBot || state.assets.aiBot);
    return (
      <MultiChoiceScreen
        title="Что делать с сомневающимися?"
        choices={[
          { id: 'followup_message', label: 'Написать ещё раз', disabled: state.resources.energy < 5 },
          { id: 'followup_call', label: 'Предложить созвон', disabled: state.resources.energy < 5 },
          { id: 'followup_case', label: 'Дать кейс', disabled: state.resources.energy < 5 },
          { id: 'followup_discount', label: 'Предложить скидку', disabled: state.resources.energy < 5 },
          { id: 'followup_bot', label: 'Запустить автоматический дожим', disabled: !hasBot },
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
        { id: 'defer', label: 'Отложить на завтра' },
        { id: 'ignore', label: 'Игнорировать' },
      ]}
      onConfirm={(id) => dispatch('resolve_pending_decision', {
        cohortId: 'cohortId' in pending ? pending.cohortId : '',
        action: id,
      })}
      busy={busy}
    />
  );
}
