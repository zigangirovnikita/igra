import type { GameState, GameConfig } from '@/packages/game-engine/src';
import { MultiChoiceScreen, NarrativeScreen, MultiInputScreen } from '../ui';

type FlowProps = {
  state: GameState;
  config: GameConfig;
  dispatch: (action: string, payload?: Record<string, unknown>) => Promise<void>;
  busy: boolean;
};

export function Day2Flow({ state, config: _config, dispatch, busy }: FlowProps) {
  if (state.flow.step === 'day2_intro') {
    return (
      <NarrativeScreen
        title="День 2. Стартовые ресурсы"
        paragraphs={[
          `${state.player.name} проснулась и подумала: «План есть. Теперь нужно понять, с чего я начинаю».`,
          'Сейчас игра зафиксирует только те площадки, которые уже есть.'
        ]}
        buttonText="Посмотреть свои ресурсы"
        onNext={() => dispatch('advance_day2_intro')}
        busy={busy}
      />
    );
  }

  if (state.flow.step === 'day2_channels') {
    return (
      <MultiChoiceScreen
        title="Какие площадки уже есть?"
        choices={[
          { id: 'instagram', label: 'Instagram' },
          { id: 'telegram', label: 'Telegram' },
          { id: 'contacts', label: 'База клиентов / контактов' },
          { id: 'none', label: 'Пока ничего нет' }
        ]}
        isMulti={true}
        onConfirm={(ids) => {
          const selected = Array.isArray(ids) ? ids : [ids];
          dispatch('set_channels', { channels: selected.includes('none') ? [] : selected });
        }}
        busy={busy}
      />
    );
  }

  if (state.flow.step === 'day2_metrics') {
    const fields: { id: string; label: string; type: 'number' | 'text' | 'select' }[] = [];
    if (state.audience.channels.includes('instagram')) {
      fields.push({ id: 'reels', label: 'Просмотры Reels', type: 'number' });
      fields.push({ id: 'stories', label: 'Просмотры Stories', type: 'number' });
    }
    if (state.audience.channels.includes('telegram')) {
      fields.push({ id: 'telegram', label: 'Просмотры Telegram', type: 'number' });
    }
    if (state.audience.channels.includes('contacts')) {
      fields.push({ id: 'contacts', label: 'Количество контактов', type: 'number' });
    }

    if (fields.length === 0) {
      return (
        <NarrativeScreen
          title="Площадок пока нет"
          paragraphs={[
            'Это допустимый старт. В игре будут доступны бесплатные способы получить первые контакты и проверить спрос.',
          ]}
          buttonText="Продолжить"
          onNext={() => dispatch('set_audience_metrics', {})}
          busy={busy}
        />
      );
    }

    return (
      <MultiInputScreen
        title="Размер текущей аудитории"
        description="Можно ввести ноль, если площадка есть, но стабильных просмотров пока нет."
        fields={fields}
        buttonText="Дальше"
        onSubmit={(values) => dispatch('set_audience_metrics', values)}
        busy={busy}
      />
    );
  }

  const summary: string[] = [];
  if (state.audience.channels.includes('instagram')) {
    summary.push(`Instagram: рилсы в среднем ${state.audience.averageReelViews.toLocaleString('ru-RU')} просмотров, сторис ${state.audience.averageStoryViews.toLocaleString('ru-RU')}.`);
  }
  if (state.audience.channels.includes('telegram')) {
    summary.push(`Telegram: около ${state.audience.averageTelegramViews.toLocaleString('ru-RU')} просмотров публикации.`);
  }
  if (state.audience.channels.includes('contacts')) {
    summary.push(`База контактов: ${state.audience.contactsCount.toLocaleString('ru-RU')} человек.`);
  }
  if (summary.length === 0) summary.push('Готовых площадок и базы пока нет. Запуск начнётся с поиска первых контактов.');

  return (
    <div className="scene-step scene-step--center">
      <h2 className="scene-headline">Итог стартовых условий</h2>
      <div className="scene-text-block">
        {summary.map((line) => <p className="scene-paragraph" key={line}>{line}</p>)}
      </div>
      <div className="scene-actions">
        <button className="btn-primary" disabled={busy} onClick={() => dispatch('complete_day_two')}>
          Начать запуск
        </button>
        <button className="btn-secondary" disabled={busy} onClick={() => dispatch('edit_day2_resources')}>
          Изменить данные
        </button>
      </div>
    </div>
  );
}
