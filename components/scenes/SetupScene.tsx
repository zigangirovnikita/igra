'use client';

import { useState } from 'react';
import type { GameConfig } from '@/packages/game-engine/src';
import { defaultDraft, SETUP_STEPS, type SetupDraft, type SetupStep } from '@/lib/scenes/setupCopy';
import { PixelArtScene } from '@/components/game/PixelArtScene';

type Props = {
  config: GameConfig;
  onComplete: (draft: SetupDraft) => void;
  busy: boolean;
  initialDraft?: SetupDraft;
};

export function SetupScene({ config: _config, onComplete, busy, initialDraft }: Props) {
  const [step, setStep] = useState<SetupStep>('welcome');
  const [draft, setDraft] = useState<SetupDraft>(initialDraft ?? defaultDraft);

  const set = <K extends keyof SetupDraft>(key: K, value: SetupDraft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const next = () => {
    const index = SETUP_STEPS.indexOf(step);
    if (index < SETUP_STEPS.length - 1) setStep(SETUP_STEPS[index + 1]);
    else onComplete(draft);
  };

  const back = () => {
    const index = SETUP_STEPS.indexOf(step);
    if (index > 0) setStep(SETUP_STEPS[index - 1]);
  };

  return (
    <div className="scene-screen scene-screen--setup">
      {step !== 'welcome' && (
        <button className="setup-back-btn" onClick={back} aria-label="Назад">
          ←
        </button>
      )}

      {step === 'welcome' && (
        <div className="setup-step setup-step--center setup-step--welcome">
          <PixelArtScene variant="sunset-duo" gender={draft.gender} />
          <h1 className="setup-headline">Проверьте, какая воронка заработает на вашу мечту</h1>
          <p className="setup-subtext">
            Соберите воронку, запустите мини-игру и посмотрите, где деньги приходят, а где сгорают заявки.
          </p>
          <button className="btn-primary setup-start-btn" onClick={next}>
            Начать
          </button>
        </div>
      )}

      {step === 'gender' && (
        <div className="setup-step">
          <h2 className="setup-question">Выберите персонажа</h2>
          <div className="setup-grid-2">
            {(['female', 'male'] as const).map((gender) => (
              <button
                key={gender}
                className={`setup-choice-btn${draft.gender === gender ? ' setup-choice-btn--selected' : ''}`}
                onClick={() => {
                  set('gender', gender);
                  setStep('name');
                }}
              >
                <span className={`v3-avatar v3-avatar--${gender}`} />
                {gender === 'female' ? 'Девочка' : 'Мальчик'}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 'name' && (
        <div className="setup-step setup-step--back-spaced">
          <div className="v3-setup-summary">
            <span className={`v3-avatar v3-avatar--${draft.gender}`} />
            <dl>
              <dt>Персонаж</dt>
              <dd>{draft.gender === 'female' ? 'Девочка' : 'Мальчик'}</dd>
              <dt>Имя</dt>
              <dd>{draft.name || 'Не указано'}</dd>
            </dl>
          </div>
          <h2 className="setup-question">Как зовут персонажа?</h2>
          <input
            className="setup-input"
            value={draft.name}
            onChange={(event) => set('name', event.target.value)}
            placeholder={draft.gender === 'female' ? 'Например: Марина' : 'Например: Андрей'}
            autoFocus
          />
          <button className="btn-primary" disabled={busy || draft.name.trim().length < 2} onClick={() => onComplete(draft)}>
            {busy ? 'Создаем игру...' : 'Дальше'}
          </button>
        </div>
      )}
    </div>
  );
}
