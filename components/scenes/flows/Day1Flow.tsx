import type { GameState, GameConfig } from '@/packages/game-engine/src';
import { MultiChoiceScreen, InputScreen, NarrativeScreen } from '../ui';

type FlowProps = {
  state: GameState;
  config: GameConfig;
  dispatch: (action: string, payload?: Record<string, unknown>) => Promise<void>;
  busy: boolean;
};

export function Day1Flow({ state, config, dispatch, busy }: FlowProps) {
  if (state.flow.step === 'day1_product_type') {
    return (
      <MultiChoiceScreen
        title="Какой продукт будем запускать?"
        choices={[
          { id: 'consultation', label: 'Консультации' },
          { id: 'recorded_course', label: 'Обучение в записи' },
        ]}
        onConfirm={(id) => dispatch('set_product_type', { productType: id })}
        busy={busy}
      />
    );
  }

  if (state.flow.step === 'day1_product_name') {
    return (
      <InputScreen
        title="Как называется ваш продукт?"
        buttonText="Дальше"
        onSubmit={(name) => dispatch('set_product_name', { productName: name })}
        busy={busy}
      />
    );
  }

  if (state.flow.step === 'day1_product_price') {
    return (
      <InputScreen
        title="Сколько он будет стоить?"
        buttonText="Дальше"
        onSubmit={(price) => dispatch('set_product_price', { productPrice: Number(price) })}
        busy={busy}
      />
    );
  }

  if (state.flow.step === 'day1_sale_method') {
    return (
      <MultiChoiceScreen
        title="Как вы планируете продавать?"
        choices={[
          { id: 'manual_chat', label: 'В переписке лично' },
          { id: 'call', label: 'Через созвоны' }
        ]}
        onConfirm={(id) => dispatch('set_sale_method', { saleMethod: id })}
        busy={busy}
      />
    );
  }

  if (state.flow.step === 'day1_nurture') {
    return (
      <MultiChoiceScreen
        title="Как будете прогревать?"
        choices={[
          { id: 'none', label: 'Без прогрева' },
          { id: 'guide', label: 'Через лид-магнит' }
        ]}
        onConfirm={(id) => dispatch('set_nurture', { nurture: [id] })}
        busy={busy}
      />
    );
  }

  if (state.flow.step === 'day1_entry_point') {
    return (
      <MultiChoiceScreen
        title="Точка входа?"
        choices={[
          { id: 'direct_messages', label: 'Сразу в директ' },
        ]}
        onConfirm={(id) => dispatch('set_entry_point', { entryPoint: id })}
        busy={busy}
      />
    );
  }

  if (state.flow.step === 'day1_business_goal') {
    return (
      <NarrativeScreen
        title="Бизнес-цель"
        paragraphs={['Ваша цель рассчитана автоматически.']}
        buttonText="Понятно"
        onNext={() => dispatch('advance_day1_goal')}
        busy={busy}
      />
    );
  }

  if (state.flow.step === 'day1_dreams') {
    return (
      <MultiChoiceScreen
        title="На что потратите прибыль?"
        choices={[
          { id: 'macbook', label: 'MacBook' },
        ]}
        onConfirm={(id) => dispatch('set_dreams', { dreams: [id] })}
        busy={busy}
      />
    );
  }

  return (
    <NarrativeScreen
      title="План готов"
      paragraphs={['Переходим к ресурсам.']}
      buttonText="Завершить день"
      onNext={() => dispatch('complete_day_one')}
      busy={busy}
    />
  );
}
