import type { GameState, GameConfig } from '@/packages/game-engine/src';
import { MultiChoiceScreen, NarrativeScreen, MultiInputScreen } from '../ui';

type FlowProps = {
  state: GameState;
  config: GameConfig;
  dispatch: (action: string, payload?: Record<string, unknown>) => Promise<void>;
  busy: boolean;
};

export function Day2Flow({ state, config, dispatch, busy }: FlowProps) {
  if (state.flow.step === 'day2_intro') {
    return (
      <NarrativeScreen
        title="День 2. Охваты"
        paragraphs={['Оценим вашу аудиторию.']}
        buttonText="Дальше"
        onNext={() => dispatch('advance_day2_intro')}
        busy={busy}
      />
    );
  }

  if (state.flow.step === 'day2_channels') {
    return (
      <MultiChoiceScreen
        title="Где у вас аудитория?"
        choices={[
          { id: 'instagram', label: 'Instagram' },
          { id: 'telegram', label: 'Telegram' },
          { id: 'contacts', label: 'Телефонная книга' }
        ]}
        onConfirm={(id) => dispatch('set_channels', { channels: [id] })}
        busy={busy}
      />
    );
  }

  if (state.flow.step === 'day2_metrics') {
    return (
      <MultiInputScreen
        title="Охваты"
        fields={[
          { id: 'reels', label: 'Просмотры Reels', type: 'number' },
          { id: 'stories', label: 'Просмотры Stories', type: 'number' }
        ]}
        buttonText="Дальше"
        onSubmit={(values) => dispatch('set_audience_metrics', values)}
        busy={busy}
      />
    );
  }

  return (
    <NarrativeScreen
      title="Итог старта"
      paragraphs={['Всё готово, начинаем.']}
      buttonText="В бой"
      onNext={() => dispatch('complete_day_two')}
      busy={busy}
    />
  );
}
