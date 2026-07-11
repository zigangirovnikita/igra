'use client';

import { useState } from 'react';
import type { GameConfig } from '@/packages/game-engine/src';
import { defaultDraft, SETUP_STEPS, type SetupDraft, type SetupStep } from '@/lib/scenes/setupCopy';

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
    const i = SETUP_STEPS.indexOf(step);
    if (i < SETUP_STEPS.length - 1) setStep(SETUP_STEPS[i + 1]);
    else onComplete(draft);
  };

  const back = () => {
    const i = SETUP_STEPS.indexOf(step);
    if (i > 0) setStep(SETUP_STEPS[i - 1]);
  };

  return (
    <div className="scene-screen scene-screen--setup">
      {step !== 'welcome' && (
        <button className="setup-back-btn" onClick={back} aria-label="Назад">
          ←
        </button>
      )}

      {/* ── WELCOME ── */}
      {step === 'welcome' && (
        <div className="setup-step setup-step--center">
          <div className="scene-image scene-image--welcome" aria-hidden="true" />
          <h1 className="setup-headline">Проживи 30 дней запуска за 10 минут</h1>
          <p className="setup-subtext">
            Собери персонажа, выбери продукт — и посмотри, что получится из вашего запуска.
          </p>
          <p className="setup-subtext">
            Принимайте решения. Смотрите на последствия. Узнайте, где теряются деньги.
          </p>
          <button className="btn-primary setup-start-btn" onClick={next}>
            Начать →
          </button>
        </div>
      )}

      {/* ── GENDER ── */}
      {step === 'gender' && (
        <div className="setup-step">
          <div className="scene-image scene-image--character_thinking" aria-hidden="true" />
          <h2 className="setup-question">Ваша задача сейчас — собрать персонажа, максимально похожего на вас.</h2>
          <p className="setup-label">Вы:</p>
          <div className="setup-grid-2">
            {(['female', 'male'] as const).map((g) => (
              <button
                key={g}
                className={`setup-choice-btn${draft.gender === g ? ' setup-choice-btn--selected' : ''}`}
                onClick={() => { set('gender', g); next(); }}
              >
                {g === 'female' ? '👩 Женщина' : '👨 Мужчина'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── NAME ── */}
      {step === 'name' && (
        <div className="setup-step">
          <div className="scene-image scene-image--character_thinking" aria-hidden="true" />
          <h2 className="setup-question">Введите имя персонажа:</h2>
          <input
            className="setup-input"
            value={draft.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder={draft.gender === 'female' ? 'Например: Марина' : 'Например: Андрей'}
            autoFocus
          />
          <button className="btn-primary" disabled={!draft.name.trim()} onClick={next}>
            Дальше →
          </button>
        </div>
      )}

      {/* ── NICHE ── */}
      {step === 'niche' && (
        <div className="setup-step">
          <div className="scene-image scene-image--office" aria-hidden="true" />
          <h2 className="setup-question">{draft.name}, чем вы занимаетесь?</h2>
          <input
            className="setup-input"
            value={draft.niche}
            onChange={(e) => set('niche', e.target.value)}
            placeholder="Психолог, нутрициолог, дизайнер, коуч, мастер по вышивке…"
          />
          <button className="btn-primary" disabled={!draft.niche.trim() || busy} onClick={next}>
            {busy ? 'Создаём игру...' : 'Начать историю →'}
          </button>
        </div>
      )}
    </div>
  );
}
