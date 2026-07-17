'use client';

import { useState } from 'react';
import type { GameConfig, Superpower } from '@/packages/game-engine/src';
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
    if (step === 'superpower' && !draft.superpower) return;
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
        <div className="setup-step setup-step--center setup-step--welcome">
          <PixelArtScene variant="sunset-duo" gender={draft.gender} />
          <h1 className="setup-headline">Проживи 30 дней запуска<br />за 10 минут</h1>
          <p className="setup-subtext">
            Первая игра в продажи своего онлайн-продукта.
          </p>
          <p className="setup-subtext">
            Принимайте решения. Смотрите на последствия. Посмотрим, сколько вы сможете заработать и какую мечту реализуете.
          </p>
          <button className="btn-primary setup-start-btn" onClick={next}>
            Начать игру
          </button>
        </div>
      )}

      {step === 'setup_intro' && (
        <div className="setup-step setup-step--center">
          <SetupVisual variant="sunset-duo" gender={draft.gender} />
          <div className="v3-text-card">
            Сначала создадим игрового персонажа, после приступим к сюжету.
          </div>
          <button className="btn-primary" onClick={next}>Далее</button>
        </div>
      )}

      {/* ── GENDER ── */}
      {step === 'gender' && (
        <div className="setup-step">
          <h2 className="setup-question">Выберите пол вашего персонажа</h2>
          <div className="setup-grid-2">
            {(['female', 'male'] as const).map((g) => (
              <button
                key={g}
                className={`setup-choice-btn${draft.gender === g ? ' setup-choice-btn--selected' : ''}`}
                onClick={() => { set('gender', g); next(); }}
              >
                <span className={`v3-avatar v3-avatar--${g}`} />
                {g === 'female' ? 'Женщина' : 'Мужчина'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── NAME ── */}
      {step === 'name' && (
        <div className="setup-step setup-step--back-spaced">
          <SetupSummary draft={draft} />
          <h2 className="setup-question">Введите имя персонажа:</h2>
          <input
            className="setup-input"
            value={draft.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder={draft.gender === 'female' ? 'Например: Марина' : 'Например: Андрей'}
            autoFocus
          />
          <button className="btn-primary" disabled={!draft.name.trim()} onClick={next}>
            Готово, дальше
          </button>
        </div>
      )}

      {/* ── NICHE ── */}
      {step === 'niche' && (
        <div className="setup-step setup-step--back-spaced">
          <SetupSummary draft={draft} />
          <h2 className="setup-question">Введите какая ниша или чем занимается {draft.name || 'персонаж'}</h2>
          <input
            className="setup-input"
            value={draft.niche}
            onChange={(e) => set('niche', e.target.value)}
            placeholder="Например: Психолог"
          />
          <button className="btn-primary" disabled={!draft.niche.trim()} onClick={next}>
            Готово, дальше
          </button>
        </div>
      )}

      {step === 'superpower' && (
        <div className="setup-step setup-step--back-spaced setup-step--compact">
          <SetupSummary draft={draft} />
          <h2 className="setup-question">Выберите одну суперсилу на игру</h2>
          <div className="v3-power-list">
            {SUPERPOWERS.map((power) => (
              <button
                key={power.id}
                className={`choice-card${draft.superpower === power.id ? ' choice-card--selected' : ''}`}
                onClick={() => set('superpower', power.id)}
              >
                <span className="choice-content">
                  <strong className="choice-title">{power.title}</strong>
                  <span className="choice-desc">{power.description}</span>
                </span>
              </button>
            ))}
          </div>
          <button className="btn-primary" disabled={!draft.superpower} onClick={next}>Готово, дальше</button>
        </div>
      )}

      {step === 'created' && (
        <div className="setup-step setup-step--back-spaced">
          <SetupSummary draft={draft} />
          <h2 className="setup-question">Поздравляем! Персонаж создан!</h2>
          <div className="v3-text-card v3-text-card--copy">{draft.superpower ? superpowerText(draft.superpower) : 'Суперсила пока не выбрана.'}</div>
          <button className="btn-primary" disabled={busy} onClick={() => onComplete(draft)}>
            {busy ? 'Создаём игру...' : 'Начать сюжет!'}
          </button>
        </div>
      )}
    </div>
  );
}

const SUPERPOWERS: Array<{ id: Superpower; title: string; description: string }> = [
  { id: 'sales', title: 'Продажи', description: 'Помогает чаще доводить заявки до оплаты.' },
  { id: 'marketing', title: 'Маркетинг', description: 'Помогает сильнее прогревать людей перед покупкой.' },
  { id: 'energy', title: 'Энергичность', description: 'Дает больше энергии на старте игры.' },
  { id: 'ads', title: 'Реклама', description: 'Помогает получать больше внимания из рекламы.' },
];

function SetupVisual({
  variant,
  gender,
}: {
  variant: Parameters<typeof PixelArtScene>[0]['variant'];
  gender: SetupDraft['gender'];
}) {
  return (
    <div className="setup-visual">
      <PixelArtScene variant={variant} gender={gender} />
    </div>
  );
}

function SetupSummary({ draft }: { draft: SetupDraft }) {
  return (
    <div className="v3-setup-summary">
      <span className={`v3-avatar v3-avatar--${draft.gender}`} />
      <dl>
        <dt>Имя</dt><dd>{draft.name || 'Не указано'}</dd>
        <dt>Пол</dt><dd>{draft.gender === 'female' ? 'Женщина' : 'Мужчина'}</dd>
        <dt>Ниша</dt><dd>{draft.niche || 'Не указана'}</dd>
        <dt>Сила</dt><dd>{SUPERPOWERS.find((item) => item.id === draft.superpower)?.title || 'Не выбрано'}</dd>
      </dl>
    </div>
  );
}

function superpowerText(superpower: Superpower): string {
  if (superpower === 'marketing') {
    return 'Вы выбрали суперсилу "Маркетинг"!\n\nОна повышает конверсию прогрева и показывает результативность инструментов прогрева.';
  }
  if (superpower === 'sales') return 'Вы выбрали суперсилу "Продажи"!\n\nОна повышает конверсию в продажу и показывает результативность инструментов продаж.';
  if (superpower === 'ads') return 'Вы выбрали суперсилу "Реклама"!\n\nОна усиливает рекламу и показывает примерные просмотры.';
  return 'Вы выбрали суперсилу "Энергичность"!\n\nНа старте у персонажа 120 единиц энергии вместо 100.';
}
