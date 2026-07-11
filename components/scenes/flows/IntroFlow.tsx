import type { GameState, GameConfig } from '@/packages/game-engine/src';
import { NarrativeScreen } from '../ui';

type FlowProps = {
  state: GameState;
  config: GameConfig;
  dispatch: (action: string, payload?: Record<string, unknown>) => Promise<void>;
  busy: boolean;
};

export function IntroFlow({ state, dispatch, busy }: FlowProps) {
  const wanted = state.player.avatarGender === 'female' ? 'хотела' : 'хотел';
  const left = state.player.avatarGender === 'female' ? 'уехала' : 'уехал';
  const postponed = state.player.avatarGender === 'female' ? 'откладывала' : 'откладывал';

  if (state.flow.step === 'intro_budget') {
    return (
      <NarrativeScreen
        title="100 000 ₽ и 30 дней"
        paragraphs={[
          `${state.player.name} давно ${wanted} запустить свой продукт, но постоянно ${postponed}.`,
          'Теперь есть 100 000 ₽, ограниченное количество сил и 30 дней. Если запуск не заработает, деньги и время будут потеряны.'
        ]}
        buttonText="Дальше →"
        onNext={() => dispatch('advance_intro')}
        busy={busy}
      />
    );
  }
  return (
    <NarrativeScreen
      title="Перед стартом"
      paragraphs={[
        `${state.player.name} ${left} на несколько дней к морю, чтобы спокойно всё обдумать.`,
        'Первый день будет полностью про первоначальную гипотезу запуска.'
      ]}
      buttonText="Начать первый день"
      onNext={() => dispatch('advance_intro')}
      busy={busy}
    />
  );
}
