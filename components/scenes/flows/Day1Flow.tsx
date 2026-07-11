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
        choices={config.productTypes.filter(pt => pt.enabled).map(pt => ({
          id: pt.id,
          label: pt.title,
          description: pt.description
        }))}
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
        type="number"
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
          { id: 'call', label: 'Через созвоны' },
          { id: 'website_auto', label: 'Автоматически через сайт' },
          { id: 'bot_auto', label: 'Через бота' },
          { id: 'webinar_direct', label: 'Через вебинар' }
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
          { id: 'none', label: 'Без прогрева (сразу оффер)' },
          { id: 'guide', label: 'Через статью/гайд' },
          { id: 'video_lesson', label: 'Через видеоурок' },
          { id: 'telegram', label: 'Через Telegram канал' },
          { id: 'webinar', label: 'Через вебинар' }
        ]}
        onConfirm={(id) => dispatch('set_nurture', { nurture: [id] })}
        busy={busy}
      />
    );
  }

  if (state.flow.step === 'day1_entry_point') {
    return (
      <MultiChoiceScreen
        title="Откуда к вам придут лиды?"
        choices={[
          { id: 'direct_messages', label: 'В директ/личку' },
          { id: 'guide', label: 'За лид-магнитом' },
          { id: 'video_lesson', label: 'На видеоурок' },
          { id: 'website', label: 'Сразу на сайт' },
          { id: 'webinar_registration', label: 'Регистрация на вебинар' }
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
        paragraphs={[
          `Цель по продажам: ${state.targets.targetSales} шт.`,
          `План выручки: ${state.targets.targetRevenue.toLocaleString('ru-RU')} ₽`
        ]}
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
        choices={config.dreams.filter(d => d.enabled).map(d => ({
          id: d.id,
          label: d.title,
          description: `${d.price.toLocaleString('ru-RU')} ₽`
        }))}
        isMulti={true}
        onConfirm={(ids) => {
          // If MultiChoiceScreen uses array for isMulti, we pass array
          dispatch('set_dreams', { dreams: Array.isArray(ids) ? ids : [ids] });
        }}
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
