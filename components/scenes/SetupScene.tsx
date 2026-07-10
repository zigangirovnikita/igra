'use client';

import { useState } from 'react';
import type { GameConfig } from '@/packages/game-engine/src';
import type { FamilyType, SetupDraft } from '@/lib/scenes/types';

type Props = {
  config: GameConfig;
  onComplete: (draft: SetupDraft) => void;
  busy: boolean;
};

type Step =
  | 'welcome'
  | 'gender'
  | 'name'
  | 'niche'
  | 'superpowers'
  | 'product'
  | 'price'
  | 'family'
  | 'legend'
  | 'dreams'
  | 'channels'
  | 'reach'
  | 'summary';

const STEPS: Step[] = [
  'welcome', 'gender', 'name', 'niche', 'superpowers',
  'product', 'price', 'family', 'legend', 'dreams',
  'channels', 'reach', 'summary',
];

const defaultDraft: SetupDraft = {
  gender: 'female',
  name: '',
  niche: '',
  superpowers: [],
  productType: 'recorded_course',
  productPrice: 30000,
  familyType: 'couple_no_kids',
  dreams: [],
  hasTelegram: false,
  averageReelViews: 1500,
  averageStoryViews: 200,
  averageTelegramViews: 150,
};

const productTypeLabels: Record<string, string> = {
  consultation: 'Консультации',
  service: 'Услуга',
  recorded_course: 'Обучение в записи',
  live_course: 'Живое обучение',
  mentorship: 'Наставничество',
  membership: 'Клуб / подписка',
};

const familyOptions: { id: FamilyType; label: string }[] = [
  { id: 'couple_no_kids', label: 'Детей нет, партнёр есть' },
  { id: 'couple_kids', label: 'Дети есть, партнёр есть' },
  { id: 'single_no_kids', label: 'Детей нет, без партнёра' },
  { id: 'single_kids', label: 'Дети есть, без партнёра' },
];

const professionalDreams = [
  { id: 'quit_job', title: 'Уйти с постоянной работы', price: 300000 },
  { id: 'stop_referrals', title: 'Перестать зависеть от сарафана', price: 200000 },
  { id: 'hire_assistant', title: 'Нанять ассистента', price: 150000 },
  { id: 'first_launch', title: 'Запустить первый поток', price: 100000 },
  { id: 'income_300k', title: 'Выйти на 300 000 ₽/мес', price: 300000 },
  { id: 'stop_manual_sales', title: 'Перестать продавать вручную', price: 200000 },
];

const rub = (n: number) =>
  n.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 });

function getLegendText(draft: SetupDraft): string[] {
  const { name, gender, familyType, productType } = draft;
  const productWord = productTypeLabels[productType]?.toLowerCase() ?? 'свой продукт';

  if (familyType === 'couple_no_kids' || familyType === 'couple_kids') {
    if (gender === 'female') {
      return [
        `${name}, поздравляем — у вас отличные стартовые условия!`,
        `Муж подарил вам 100 000 ₽ и уехал на вахту на целый месяц.`,
        `Перед отъездом он сказал:`,
        `«Ты давно хотела продавать ${productWord}. У тебя как раз есть месяц. Жильё, еда и расходы закрыты. Попробуй!»`,
        `И вот вы остались одна с идеей, деньгами и месяцем свободы.`,
      ];
    }
    return [
      `${name}, поздравляем — у вас отличные стартовые условия!`,
      `Жена поддержала вашу идею и выделила 100 000 ₽ на запуск.`,
      `Она сказала: «Ты давно хотел продавать ${productWord}. Бытовые расходы я беру на себя. Есть целый месяц — попробуй!»`,
      `Сейчас всё зависит только от вас.`,
    ];
  }
  return [
    `${name}, поздравляем — у вас отличные стартовые условия!`,
    `У вас есть 100 000 ₽, которые вы готовы вложить в запуск.`,
    `Бытовые расходы закрыты. Впереди 30 дней, чтобы превратить ${productWord} в систему продаж.`,
    `Сейчас всё зависит только от вас.`,
  ];
}

export function SetupScene({ config, onComplete, busy }: Props) {
  const [step, setStep] = useState<Step>('welcome');
  const [draft, setDraft] = useState<SetupDraft>(defaultDraft);
  const [legendLine, setLegendLine] = useState(0);

  const set = <K extends keyof SetupDraft>(key: K, value: SetupDraft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const toggleList = (field: 'superpowers' | 'dreams', id: string, max?: number) => {
    const current = draft[field] as string[];
    const isSelected = current.includes(id);
    if (isSelected) {
      set(field, current.filter((x) => x !== id) as SetupDraft[typeof field]);
    } else {
      if (max && current.length >= max) return;
      set(field, [...current, id] as SetupDraft[typeof field]);
    }
  };

  const next = () => {
    const i = STEPS.indexOf(step);
    if (i < STEPS.length - 1) setStep(STEPS[i + 1]);
  };

  const back = () => {
    const i = STEPS.indexOf(step);
    if (i > 0) setStep(STEPS[i - 1]);
  };

  const legendLines = getLegendText(draft);
  const personalGoal = draft.dreams.reduce((sum, id) => {
    const dream = [...professionalDreams].find((d) => d.id === id);
    if (dream) return sum + dream.price;
    const configDream = config.dreams.find((d) => d.id === id);
    return sum + (configDream?.price ?? 0);
  }, 0);

  const allDreams = [
    ...config.dreams.filter((d) => d.enabled && !d.custom),
    ...professionalDreams.map((d) => ({ ...d, enabled: true, custom: false })),
  ];

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
          <button className="btn-primary" disabled={!draft.niche.trim()} onClick={next}>
            Дальше →
          </button>
        </div>
      )}

      {/* ── SUPERPOWERS ── */}
      {step === 'superpowers' && (
        <div className="setup-step">
          <div className="scene-image scene-image--character_happy" aria-hidden="true" />
          <h2 className="setup-question">{draft.name}, выберите 2 суперсилы:</h2>
          <div className="setup-grid-2">
            {config.superpowers.filter((s) => s.enabled).map((sp) => (
              <button
                key={sp.id}
                className={`setup-choice-btn${draft.superpowers.includes(sp.id) ? ' setup-choice-btn--selected' : ''}`}
                onClick={() => toggleList('superpowers', sp.id, 2)}
              >
                {sp.id === 'expertise' && '⭐ '}
                {sp.id === 'sales' && '💰 '}
                {sp.id === 'marketing' && '📣 '}
                {sp.id === 'energy' && '⚡ '}
                {sp.title}
              </button>
            ))}
          </div>
          <p className="setup-hint">Выбрано: {draft.superpowers.length}/2</p>
          <button className="btn-primary" disabled={draft.superpowers.length !== 2} onClick={next}>
            Дальше →
          </button>
        </div>
      )}

      {/* ── PRODUCT ── */}
      {step === 'product' && (
        <div className="setup-step">
          <div className="scene-image scene-image--character_working" aria-hidden="true" />
          <h2 className="setup-question">Выберите стартовые условия. Ваш продукт:</h2>
          <div className="setup-grid-2">
            {config.productTypes.filter((p) => p.enabled).map((pt) => (
              <button
                key={pt.id}
                className={`setup-choice-btn${draft.productType === pt.id ? ' setup-choice-btn--selected' : ''}`}
                onClick={() => { set('productType', pt.id); next(); }}
              >
                {pt.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── PRICE ── */}
      {step === 'price' && (
        <div className="setup-step">
          <div className="scene-image scene-image--character_working" aria-hidden="true" />
          <h2 className="setup-question">Введите стоимость {productTypeLabels[draft.productType]?.toLowerCase() ?? 'продукта'}:</h2>
          <div className="setup-price-wrap">
            <input
              className="setup-input"
              type="number"
              value={draft.productPrice}
              min={1000}
              step={1000}
              onChange={(e) => set('productPrice', Number(e.target.value))}
            />
            <span className="setup-price-currency">₽</span>
          </div>
          {draft.productPrice > 200000 && (
            <p className="setup-hint setup-hint--warn">
              ⚠️ Для чека выше 200 000 ₽ важен сильный прогрев и личная продажа — просто рилсы или сайт дают очень низкую конверсию.
            </p>
          )}
          {draft.productPrice < 2000 && (
            <p className="setup-hint setup-hint--warn">
              ⚠️ При чеке {rub(draft.productPrice)} нужно сделать сотни продаж, чтобы получить значимую выручку.
            </p>
          )}
          <button className="btn-primary" disabled={!draft.productPrice || draft.productPrice < 100} onClick={next}>
            Дальше →
          </button>
        </div>
      )}

      {/* ── FAMILY ── */}
      {step === 'family' && (
        <div className="setup-step">
          <div className="scene-image scene-image--character_happy" aria-hidden="true" />
          <h2 className="setup-question">Ваша ситуация:</h2>
          <div className="setup-grid-2">
            {familyOptions.map((opt) => (
              <button
                key={opt.id}
                className={`setup-choice-btn${draft.familyType === opt.id ? ' setup-choice-btn--selected' : ''}`}
                onClick={() => { set('familyType', opt.id); next(); }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── LEGEND ── */}
      {step === 'legend' && (
        <div className="setup-step setup-step--legend" onClick={() => {
          if (legendLine < legendLines.length - 1) {
            setLegendLine((l) => l + 1);
          } else {
            setLegendLine(0);
            next();
          }
        }}>
          <div className="scene-image scene-image--character_beach" aria-hidden="true" />
          <div className="narrative-text">
            {legendLines.slice(0, legendLine + 1).map((line, i) => (
              <p key={i} className={`narrative-line${i === legendLine ? ' narrative-line--current' : ''}`}>
                {line}
              </p>
            ))}
          </div>
          <div className="narrative-hint">
            {legendLine < legendLines.length - 1
              ? <span className="tap-hint">Нажмите, чтобы продолжить…</span>
              : <button className="btn-primary" onClick={(e) => { e.stopPropagation(); setLegendLine(0); next(); }}>Понятно! →</button>
            }
          </div>
        </div>
      )}

      {/* ── DREAMS ── */}
      {step === 'dreams' && (
        <div className="setup-step">
          <div className="scene-image scene-image--character_beach" aria-hidden="true" />
          <h2 className="setup-question">
            «Если получится… я бы купила себе…»
          </h2>
          <p className="setup-subtext">Выберите одну или несколько целей:</p>
          <div className="setup-dreams-list">
            {allDreams.map((dream) => (
              <button
                key={dream.id}
                className={`setup-dream-btn${draft.dreams.includes(dream.id) ? ' setup-dream-btn--selected' : ''}`}
                onClick={() => toggleList('dreams', dream.id)}
              >
                <span className="dream-title">{dream.title}</span>
                <span className="dream-price">{rub(dream.price)}</span>
              </button>
            ))}
          </div>
          {personalGoal > 0 && (
            <p className="setup-goal-total">
              Ваша личная цель: <strong>{rub(personalGoal)}</strong>
            </p>
          )}
          <button className="btn-primary" disabled={draft.dreams.length === 0} onClick={next}>
            Дальше →
          </button>
        </div>
      )}

      {/* ── CHANNELS ── */}
      {step === 'channels' && (
        <div className="setup-step">
          <div className="scene-image scene-image--character_thinking" aria-hidden="true" />
          <h2 className="setup-question">Где вы уже присутствуете?</h2>
          <div className="setup-grid-2">
            <button
              className={`setup-choice-btn${!draft.hasTelegram ? ' setup-choice-btn--selected' : ''}`}
              onClick={() => set('hasTelegram', false)}
            >
              📱 Только Instagram
            </button>
            <button
              className={`setup-choice-btn${draft.hasTelegram ? ' setup-choice-btn--selected' : ''}`}
              onClick={() => set('hasTelegram', true)}
            >
              📱 + ✈️ Instagram + Telegram
            </button>
          </div>
          <button className="btn-primary" onClick={next}>
            Дальше →
          </button>
        </div>
      )}

      {/* ── REACH ── */}
      {step === 'reach' && (
        <div className="setup-step">
          <div className="scene-image scene-image--phone_notification" aria-hidden="true" />
          <h2 className="setup-question">Сколько у вас в среднем набирают?</h2>
          <label className="setup-field-label">
            🎵 Рилсы (просмотры):
            <input
              className="setup-input"
              type="number"
              value={draft.averageReelViews}
              min={0}
              step={100}
              onChange={(e) => set('averageReelViews', Number(e.target.value))}
            />
          </label>
          <label className="setup-field-label">
            📱 Сторис (просмотры):
            <input
              className="setup-input"
              type="number"
              value={draft.averageStoryViews}
              min={0}
              step={10}
              onChange={(e) => set('averageStoryViews', Number(e.target.value))}
            />
          </label>
          {draft.hasTelegram && (
            <label className="setup-field-label">
              ✈️ Telegram (просмотры):
              <input
                className="setup-input"
                type="number"
                value={draft.averageTelegramViews}
                min={0}
                step={10}
                onChange={(e) => set('averageTelegramViews', Number(e.target.value))}
              />
            </label>
          )}
          <button className="btn-primary" onClick={next}>
            Дальше →
          </button>
        </div>
      )}

      {/* ── SUMMARY ── */}
      {step === 'summary' && (
        <div className="setup-step">
          <div className="scene-image scene-image--character_beach" aria-hidden="true" />
          <h2 className="setup-question">Вы готовы!</h2>
          <div className="setup-summary-card">
            <div className="summary-row"><span>Имя:</span> <strong>{draft.name}</strong></div>
            <div className="summary-row"><span>Ниша:</span> <strong>{draft.niche}</strong></div>
            <div className="summary-row"><span>Продукт:</span> <strong>{productTypeLabels[draft.productType]}</strong></div>
            <div className="summary-row"><span>Чек:</span> <strong>{rub(draft.productPrice)}</strong></div>
            <div className="summary-row"><span>Суперсилы:</span> <strong>{draft.superpowers.join(', ')}</strong></div>
            <div className="summary-row"><span>Рилсы:</span> <strong>{draft.averageReelViews.toLocaleString('ru-RU')} просм.</strong></div>
            <div className="summary-row"><span>Банк:</span> <strong>100 000 ₽</strong></div>
            <div className="summary-row"><span>Дней:</span> <strong>30</strong></div>
          </div>
          <button className="btn-primary" disabled={busy} onClick={() => onComplete(draft)}>
            {busy ? 'Запускаем…' : 'Начать запуск →'}
          </button>
        </div>
      )}
    </div>
  );
}
