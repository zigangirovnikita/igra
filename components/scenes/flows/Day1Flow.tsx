import { useState } from 'react';
import type { GameState, GameConfig } from '@/packages/game-engine/src';
import { MultiChoiceScreen, InputScreen } from '../ui';

type FlowProps = {
  state: GameState;
  config: GameConfig;
  dispatch: (action: string, payload?: Record<string, unknown>) => Promise<void>;
  busy: boolean;
};

const saleMethodLabels: Record<string, string> = {
  manual_chat: 'в переписке',
  call: 'на созвоне',
  website_auto: 'самостоятельно на сайте',
  bot_auto: 'автоматически через бота',
  webinar_direct: 'на вебинаре',
};

const nurtureLabels: Record<string, string> = {
  none: 'без отдельного прогрева',
  guide: 'через полезный материал',
  video_lesson: 'через видеоурок',
  telegram: 'через отдельный прогрев',
  webinar: 'через вебинар',
};

const entryLabels: Record<string, string> = {
  direct_messages: 'напишут в директ',
  guide: 'получат гайд',
  video_lesson: 'посмотрят видеоурок',
  website: 'перейдут на сайт',
  webinar_registration: 'зарегистрируются на вебинар',
};

export function Day1Flow({ state, config, dispatch, busy }: FlowProps) {
  const [selectedDreams, setSelectedDreams] = useState<string[]>(state.launchPlan.dreams);
  const player = state.player.name;
  const thoughtVerb = state.player.avatarGender === 'female' ? 'придумала' : 'придумал';
  const sellVerb = state.player.avatarGender === 'female' ? 'будет продавать' : 'будет продавать';
  const productTitle = config.productTypes.find((item) => item.id === state.launchPlan.productType)?.title ?? 'продукт';
  const dreamsTotal = selectedDreams.reduce((sum, id) => sum + (config.dreams.find((dream) => dream.id === id)?.price ?? 0), 0);
  const remainingAfterDreams = state.targets.targetRevenue - dreamsTotal;

  if (state.flow.step === 'day1_product_type') {
    return (
      <MultiChoiceScreen
        title={`${player} сидит у моря и думает: что именно продавать?`}
        description="Это первая гипотеза запуска. Она может быть слабой, игра покажет последствия позже."
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
        title="Как называется продукт или какую проблему он решает?"
        description={`${player} записывает рабочее название. Его можно сформулировать просто, без идеальной упаковки.`}
        placeholder="Например: консультация по запуску, курс по питанию, наставничество"
        buttonText="Дальше"
        defaultValue={state.launchPlan.productName}
        onSubmit={(name) => dispatch('set_product_name', { productName: name })}
        busy={busy}
      />
    );
  }

  if (state.flow.step === 'day1_product_price') {
    return (
      <InputScreen
        title={`За сколько ${player} будет продавать ${productTitle.toLowerCase()}?`}
        description="Цена влияет на цель, конверсию и требования к доверию."
        placeholder="30000"
        buttonText="Дальше"
        defaultValue={state.launchPlan.productPrice ? String(state.launchPlan.productPrice) : ''}
        type="number"
        onSubmit={(price) => dispatch('set_product_price', { productPrice: Number(price) })}
        busy={busy}
      />
    );
  }

  if (state.flow.step === 'day1_sale_method') {
    return (
      <MultiChoiceScreen
        title="Как человек будет принимать окончательное решение о покупке?"
        choices={[
          { id: 'manual_chat', label: 'В переписке' },
          { id: 'call', label: 'На созвоне' },
          { id: 'webinar_direct', label: 'На вебинаре' },
          { id: 'website_auto', label: 'Самостоятельно на сайте' },
          { id: 'bot_auto', label: 'Автоматически через бота' }
        ]}
        onConfirm={(id) => dispatch('set_sale_method', { saleMethod: id })}
        busy={busy}
      />
    );
  }

  if (state.flow.step === 'day1_nurture') {
    const saleMethod = state.launchPlan.plannedSaleMethod;
    const title = saleMethod === 'call'
      ? 'Нужно ли сначала подготовить человека к приглашению на созвон?'
      : saleMethod === 'website_auto'
        ? 'Нужно ли сначала объяснить ценность перед переходом на сайт?'
        : 'Нужен ли прогрев перед продажей?';

    return (
      <MultiChoiceScreen
        title={title}
        choices={[
          { id: 'none', label: 'Нет, сразу приглашать' },
          { id: 'guide', label: 'Дать полезный материал' },
          { id: 'video_lesson', label: 'Через видеоурок' },
          { id: 'telegram', label: 'Рассказать историю и показать кейсы' },
          { id: 'webinar', label: 'Провести отдельный прогрев' },
          { id: 'uncertain', label: 'Пока не знаю' }
        ]}
        onConfirm={(id) => dispatch('set_nurture', { nurture: [id === 'uncertain' ? 'none' : id], uncertain: id === 'uncertain' })}
        busy={busy}
      />
    );
  }

  if (state.flow.step === 'day1_entry_point') {
    return (
      <MultiChoiceScreen
        title="Где человек увидит предложение и сделает следующий шаг?"
        description="Даже противоречивый маршрут можно выбрать. Игра покажет последствия в запуске."
        choices={[
          { id: 'direct_messages', label: 'Напишет в директ' },
          { id: 'guide', label: 'Получит гайд' },
          { id: 'video_lesson', label: 'Посмотрит видеоурок' },
          { id: 'website', label: 'Перейдёт на сайт' },
          { id: 'webinar_registration', label: 'Зарегистрируется на вебинар' }
        ]}
        onConfirm={(id) => dispatch('set_entry_point', { entryPoint: id })}
        busy={busy}
      />
    );
  }

  if (state.flow.step === 'day1_business_goal') {
    return (
      <div className="scene-step scene-step--center">
        <h2 className="scene-headline">Бизнес-цель</h2>
        <div className="scene-text-block">
          <p className="scene-paragraph">
            Если запуск сработает, {player} хочет сделать {state.targets.targetSales} продаж и получить {state.targets.targetRevenue.toLocaleString('ru-RU')} ₽ выручки.
          </p>
          <p className="scene-paragraph">На этом этапе цель считается автоматически от продукта и цены.</p>
        </div>
        <div className="scene-actions">
          <button className="btn-primary" disabled={busy} onClick={() => dispatch('advance_day1_goal')}>
            Цель понятна
          </button>
          <button className="btn-secondary" disabled={busy} onClick={() => dispatch('back_to_day1_price')}>
            Назад к цене
          </button>
        </div>
      </div>
    );
  }

  if (state.flow.step === 'day1_dreams') {
    return (
      <MultiChoiceScreen
        title="Представим, что всё получилось. На что пойдут деньги?"
        description={`Цель запуска: ${state.targets.targetRevenue.toLocaleString('ru-RU')} ₽. Выбрано: ${dreamsTotal.toLocaleString('ru-RU')} ₽. Останется: ${remainingAfterDreams.toLocaleString('ru-RU')} ₽. В финале покупки считаются из результата после расходов.`}
        choices={config.dreams.filter(d => d.enabled).map(d => ({
          id: d.id,
          label: d.title,
          description: `${d.price.toLocaleString('ru-RU')} ₽`
        }))}
        isMulti={true}
        selectedId={selectedDreams}
        onSelect={(ids) => setSelectedDreams(Array.isArray(ids) ? ids : [ids])}
        onConfirm={(ids) => {
          dispatch('set_dreams', { dreams: Array.isArray(ids) ? ids : [ids] });
        }}
        busy={busy}
      />
    );
  }

  const plannedNurture = state.launchPlan.nurtureUncertain
    ? 'пока без уверенного прогрева'
    : state.launchPlan.plannedNurture.map((item) => nurtureLabels[item] ?? item).join(', ');
  const selectedDreamTitles = state.launchPlan.dreams
    .map((id) => config.dreams.find((dream) => dream.id === id)?.title ?? id)
    .join(', ');
  const summaryDreamsTotal = state.launchPlan.dreams.reduce((sum, id) => sum + (config.dreams.find((dream) => dream.id === id)?.price ?? 0), 0);

  return (
    <div className="scene-step scene-step--center">
      <h2 className="scene-headline">Итог первого дня</h2>
      <div className="scene-text-block">
        <p className="scene-paragraph">Сегодня {player} {thoughtVerb} первоначальный план запуска.</p>
        <p className="scene-paragraph">
          {player} {sellVerb} {productTitle.toLowerCase()} «{state.launchPlan.productName}» по {(state.launchPlan.productPrice ?? 0).toLocaleString('ru-RU')} ₽.
        </p>
        <p className="scene-paragraph">
          Продажа будет происходить {saleMethodLabels[state.launchPlan.plannedSaleMethod ?? ''] ?? 'по выбранному маршруту'}. Люди {entryLabels[state.launchPlan.plannedEntry ?? ''] ?? 'сделают следующий шаг'}, прогрев: {plannedNurture}.
        </p>
        <p className="scene-paragraph">
          Бизнес-цель: {state.targets.targetSales} продаж и {state.targets.targetRevenue.toLocaleString('ru-RU')} ₽ выручки.
        </p>
        <p className="scene-paragraph">
          {selectedDreamTitles
            ? `Если получится, ${player} хочет: ${selectedDreamTitles}. После этих покупок от цели останется ${(state.targets.targetRevenue - summaryDreamsTotal).toLocaleString('ru-RU')} ₽.`
            : 'Личные покупки пока не выбраны.'}
        </p>
      </div>
      <div className="scene-actions">
        <button className="btn-primary" disabled={busy} onClick={() => dispatch('complete_day_one')}>
          Завершить первый день
        </button>
        <button className="btn-secondary" disabled={busy} onClick={() => dispatch('edit_day1_plan')}>
          Изменить план
        </button>
      </div>
    </div>
  );
}
