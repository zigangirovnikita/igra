'use client';

import type { GameConfig, GameState } from '@/packages/game-engine/src';
import { V4Builder } from './v4/V4Builder';
import { V4MiniGame } from './v4/V4MiniGame';
import { V4Result } from './v4/V4Result';
import { V4SetupFlow } from './v4/V4SetupFlow';
import { V4Screen } from './v4/v4Ui';

type Dispatch = (actionType: string, payload?: Record<string, unknown>) => Promise<boolean>;

export function V4Flow({ state, config, dispatch, busy }: { state: GameState; config: GameConfig; dispatch: Dispatch; busy: boolean }) {
  if (state.flow.step === 'v4_dream' || state.flow.step === 'v4_product' || state.flow.step === 'v4_price') {
    return <V4SetupFlow state={state} config={config} dispatch={dispatch} busy={busy} />;
  }

  if (state.flow.step === 'v4_tutorial_intro') {
    return (
      <V4Screen title="Сначала короткая пробная попытка">
        <div className="v4-tutorial-card">
          <p>Сейчас игра запустит плохую связку: внешняя реклама, Telegram-канал и созвоны.</p>
          <p>Ваша задача простая: нажимайте основную кнопку, пока заявки приходят. После этого увидите, где сгорели деньги и энергия.</p>
          <div className="v4-funnel-line">
            <span>Внешняя реклама</span>
            <span>Telegram</span>
            <span>Созвоны</span>
          </div>
          <button className="btn-primary" disabled={busy} onClick={() => dispatch('v4_start_tutorial')}>Запустить пробу</button>
        </div>
      </V4Screen>
    );
  }

  if (state.flow.step === 'v4_builder') {
    return <V4Builder state={state} dispatch={dispatch} busy={busy} />;
  }

  if (state.flow.step === 'v4_minigame') {
    return <V4MiniGame state={state} dispatch={dispatch} busy={busy} />;
  }

  if (state.flow.step === 'v4_result') {
    return <V4Result state={state} dispatch={dispatch} busy={busy} />;
  }

  return (
    <V4Screen title="Экран v4 не найден">
      <button className="btn-primary" disabled={busy} onClick={() => dispatch('v4_start_next_attempt')}>В конструктор</button>
    </V4Screen>
  );
}
