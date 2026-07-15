'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  buildV3ActiveStagePlan,
  getV3AttemptInsight,
  getV3ActiveOptions,
  getV3PreparationDisplayOptions,
  type GameConfig,
  type GameState,
  type V3ActiveSaleOutcome,
  type V3AdviceCategory,
  type V3AdviceOption,
  type V3PreparationArea,
  type V3PreparationMode,
  type V3ProductType,
  type V3SelectionKind,
  V3_PRODUCT_TITLES,
  v3ProductPlaceholder,
} from '@/packages/game-engine/src';
import { PixelArtScene } from '@/components/game/PixelArtScene';

type Dispatch = (actionType: string, payload?: Record<string, unknown>) => Promise<void>;

type Props = {
  state: GameState;
  config: GameConfig;
  dispatch: Dispatch;
  busy: boolean;
};

const PRODUCT_ORDER: V3ProductType[] = ['consultation', 'service', 'live_course', 'recorded_course', 'membership', 'mentorship'];
const AREA_TITLES: Record<V3PreparationArea, string> = {
  warmup: 'Проработать прогрев',
  sales: 'Проработать продажи',
  ads: 'Проработать рекламу',
};
const KIND_TITLES: Record<V3SelectionKind, string> = {
  ad: 'рекламу',
  warmup: 'прогрев',
  sales: 'продажи',
};

export function V3Flow({ state, config: _config, dispatch, busy }: Props) {
  const [prepareArea, setPrepareArea] = useState<V3PreparationArea | null>(null);
  const [adviceCategory, setAdviceCategory] = useState<V3AdviceCategory | null>(null);
  const [choosing, setChoosing] = useState<V3SelectionKind | null>(null);
  const [price, setPrice] = useState('');
  const [customDream, setCustomDream] = useState({ title: '', price: '' });

  const step = state.flow.step;
  const name = state.player.name;
  const gender = state.player.avatarGender;

  if (step === 'v3_story_budget') {
    return (
      <V3Screen gender={gender} image="beach-talk" title={`${name}, у нас в этом месяце все уже хорошо.`} busy={busy}
        button="Далее" onClick={() => dispatch('v3_next')}>
        <p>Все вопросы с жильем, едой и жизнью решены. Давай выделим 100 000 рублей на твое дело и посвяти этому месяц.</p>
        <p>У тебя все получится.</p>
      </V3Screen>
    );
  }

  if (step === 'v3_rules') {
    return (
      <V3Screen gender={gender} title="Правила запуска" busy={busy} button="Правила ясны!" onClick={() => dispatch('v3_next')}>
        <p>Наверху всегда показаны день, банк и энергия.</p>
        <p>Банк - это остаток стартовых 100 000 рублей. Выручка от продаж в эту сумму не входит.</p>
        <p>Если энергия закончится, вы выгорели и игра закончится.</p>
        <p>Цель игры - сделать столько продаж, чтобы выполнить план и купить мечту.</p>
      </V3Screen>
    );
  }

  if (step === 'v3_story_plan') {
    return (
      <V3Screen gender={gender} image="beach-talk" title="Подумайте о продукте и мечте" busy={busy}
        button="Хорошо" onClick={() => dispatch('v3_next')}>
        <p>Я сейчас поеду по делам. А ты пока подумай, что ты хочешь продавать и что хочешь купить с продаж.</p>
      </V3Screen>
    );
  }

  if (step === 'v3_product') {
    return (
      <V3Screen gender={gender} image="notebook" title={`Выберите, что будет продавать ${name}`} busy={busy}>
        <div className="v3-grid">
          {PRODUCT_ORDER.map((id) => (
            <button key={id} className="v3-red-button" onClick={() => dispatch('v3_set_product', { productType: id })}>
              {V3_PRODUCT_TITLES[id]}
            </button>
          ))}
        </div>
      </V3Screen>
    );
  }

  if (step === 'v3_price') {
    const placeholder = state.v3.productType ? v3ProductPlaceholder(state.v3.productType) : 30000;
    return (
      <V3Screen gender={gender} image="notebook" title={`В какую стоимость ${name} будет продавать ${state.launchPlan.productName}?`} busy={busy}
        button="Готово, дальше" onClick={() => dispatch('v3_set_price', { productPrice: Number(price || placeholder) })}>
        <input className="setup-input" inputMode="numeric" value={price} onChange={(event) => setPrice(event.target.value)}
          placeholder={`Например: ${placeholder}`} />
        <p className="v3-muted">Минимально допустимый чек - 1000 ₽.</p>
      </V3Screen>
    );
  }

  if (step === 'v3_dream') {
    const dreams = approvedDreams(gender);
    return (
      <V3Screen gender={gender} image="notebook" title={`Что ${name} хочет купить, когда продажи пойдут?`} busy={busy}>
        <div className="v3-dream-list">
          {dreams.map((dream) => (
            <button key={dream.id} className="v3-dream-row" onClick={() => dispatch('v3_set_dream', {
              dreamId: 'custom',
              customTitle: dream.title,
              customPrice: dream.price,
            })}>
              <span>{dream.title}</span>
              <strong>{dream.price.toLocaleString('ru-RU')} ₽</strong>
            </button>
          ))}
          <div className="v3-text-card">
            <strong>Свой вариант</strong>
            <input className="setup-input" value={customDream.title} onChange={(e) => setCustomDream((prev) => ({ ...prev, title: e.target.value }))} placeholder="Что хотите купить?" />
            <input className="setup-input" inputMode="numeric" value={customDream.price} onChange={(e) => setCustomDream((prev) => ({ ...prev, price: e.target.value }))} placeholder="Стоимость" />
            <button className="btn-secondary" disabled={!customDream.title || Number(customDream.price) < 1000} onClick={() => dispatch('v3_set_dream', {
              dreamId: 'custom',
              customTitle: customDream.title,
              customPrice: Number(customDream.price),
            })}>Выбрать свой вариант</button>
          </div>
        </div>
      </V3Screen>
    );
  }

  if (step === 'v3_goal_summary') {
    return (
      <V3Screen gender={gender} image="summary" title="Цель запуска" busy={busy} button="Цель ясна" onClick={() => dispatch('v3_next')}>
        <p>Прошел 1 день. {name} придумал{gender === 'female' ? 'а' : ''}, что будет продавать {state.launchPlan.productName} за {(state.launchPlan.productPrice || 0).toLocaleString('ru-RU')} ₽.</p>
        <p>Для этого цель: сделать {state.targets.targetSales} продаж и заработать {state.targets.targetRevenue.toLocaleString('ru-RU')} рублей.</p>
      </V3Screen>
    );
  }

  if (step === 'v3_reflection_intro') {
    return (
      <V3Screen gender={gender} title={`${name} начинает цикл запуска`} busy={busy} button="Понятно!" onClick={() => dispatch('v3_next')}>
        <p>Каждая волна включает рефлексию, подготовку, активный этап и итоги попытки.</p>
        <p>Подготовьтесь, посоветуйтесь, восстановите энергию или переходите к действиям.</p>
      </V3Screen>
    );
  }

  if (step === 'v3_reflection') {
    return (
      <V3Screen gender={gender}
        image="cocktails"
        title="Меню рефлексии"
        busy={busy}
        button="Действовать"
        onClick={() => dispatch('v3_open_reflection', { target: 'act' })}
      >
        <div className="v3-stack">
          <button className="v3-red-button" onClick={() => dispatch('v3_open_reflection', { target: 'prepare' })}>Подготовиться</button>
          <button className="v3-red-button" onClick={() => dispatch('v3_open_reflection', { target: 'advice' })}>Посоветоваться</button>
          <button className="v3-red-button" onClick={() => dispatch('v3_open_reflection', { target: 'rest' })}>Восстановить энергию</button>
          <button className="v3-red-button" onClick={() => dispatch('v3_open_reflection', { target: 'history' })}>Прошлые попытки</button>
        </div>
      </V3Screen>
    );
  }

  if (step === 'v3_prepare_category') {
    const definitions = prepareArea ? getV3PreparationDisplayOptions(state, prepareArea) : [];
    return (
      <V3Screen gender={gender} title={prepareArea ? AREA_TITLES[prepareArea] : 'Подготовиться'} busy={busy}>
        {!prepareArea ? (
          <div className="v3-stack">
            {(['warmup', 'sales', 'ads'] as V3PreparationArea[]).map((area) => (
              <button key={area} className="v3-red-button" onClick={() => setPrepareArea(area)}>{AREA_TITLES[area]}</button>
            ))}
            <button className="btn-secondary" onClick={() => dispatch('v3_return_reflection')}>Назад</button>
          </div>
        ) : (
          <div className="v3-stack">
            {definitions.map((definition) => (
              <div key={definition.id} className="v3-text-card">
                <strong>{definition.title}</strong>
                <div className="v3-grid">
                  <PrepareButton state={state} definition={definition} area={prepareArea} mode="self" dispatch={dispatch} />
                  <PrepareButton state={state} definition={definition} area={prepareArea} mode="expert" dispatch={dispatch} />
                </div>
              </div>
            ))}
            <div className="v3-secondary-actions">
              <button className="btn-secondary" onClick={() => setPrepareArea(null)}>К категориям</button>
              <button className="btn-secondary" onClick={() => {
                setPrepareArea(null);
                void dispatch('v3_return_reflection');
              }}>В меню рефлексии</button>
            </div>
          </div>
        )}
      </V3Screen>
    );
  }

  if (step === 'v3_advice_category') {
    return (
      <V3Screen gender={gender} title={adviceCategory ? adviceTitle(adviceCategory) : 'Посоветоваться'} busy={busy}>
        {!adviceCategory ? (
          <div className="v3-stack">
            {(['ads', 'warmup', 'sales'] as V3AdviceCategory[]).map((category) => (
              <button key={category} className="v3-red-button" onClick={() => setAdviceCategory(category)}>{adviceTitle(category)}</button>
            ))}
            <button className="btn-secondary" onClick={() => dispatch('v3_return_reflection')}>Назад</button>
          </div>
        ) : (
          <div className="v3-stack">
            {(['friend', 'consult_5k', 'consult_10k'] as V3AdviceOption[]).map((option) => (
              <button
                key={option}
                className="v3-red-button"
                disabled={Boolean(state.v3.loopAdviceUsed[`${adviceCategory}:${option}`])}
                onClick={() => dispatch('v3_request_advice', { category: adviceCategory, option })}
              >
                {adviceOptionTitle(option)}
                <small>{adviceOptionDescription(option, adviceCategory)}</small>
              </button>
            ))}
            <div className="v3-secondary-actions">
              <button className="btn-secondary" onClick={() => setAdviceCategory(null)}>К советам</button>
              <button className="btn-secondary" onClick={() => {
                setAdviceCategory(null);
                void dispatch('v3_return_reflection');
              }}>В меню рефлексии</button>
            </div>
          </div>
        )}
      </V3Screen>
    );
  }

  if (step === 'v3_advice_result') {
    const advice = state.v3.lastAdvice;
    return (
      <V3Screen gender={gender} image="notebook" title="Совет получен" busy={busy} button="Вернуться к рефлексии" onClick={() => dispatch('v3_return_reflection')}>
        {advice ? (
          <div className="v3-advice-result">
            <div className="v3-report-section">
              <strong>{advice.title}</strong>
              <p>{advice.adviser}</p>
              {advice.cost > 0 && <p>Списано из банка: {advice.cost.toLocaleString('ru-RU')} ₽</p>}
            </div>
            <div className="v3-report-section">
              {advice.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </div>
            {advice.conversionRows.length > 0 && (
              <dl className="v3-report-list">
                {advice.conversionRows.map((row) => (
                  <div key={row.label}>
                    <dt>{row.label}</dt>
                    <dd>{row.value}{row.note ? ` · ${row.note}` : ''}</dd>
                  </div>
                ))}
              </dl>
            )}
            <div className="v3-report-total">
              {advice.effectLines.map((line) => <span key={line}>{line}</span>)}
            </div>
          </div>
        ) : <p>Совет не найден.</p>}
      </V3Screen>
    );
  }

  if (step === 'v3_rest') {
    return (
      <V3Screen gender={gender} title="Восстановить энергию" busy={busy}>
        <div className="v3-stack">
          <button className="v3-red-button" onClick={() => dispatch('v3_rest', { days: 1 })}>Отдохнуть 1 день (+20 энергии)</button>
          <button className="v3-red-button" onClick={() => dispatch('v3_rest', { days: 2 })}>Отдохнуть 2 дня (+45 энергии)</button>
          <button className="v3-red-button" onClick={() => dispatch('v3_rest', { days: 3 })}>Отдохнуть 3 дня (полное восстановление)</button>
          <button className="btn-secondary" onClick={() => dispatch('v3_return_reflection')}>Назад</button>
        </div>
      </V3Screen>
    );
  }

  if (step === 'v3_past_runs') {
    return (
      <V3Screen gender={gender} title="Прошлые попытки" busy={busy} button="Вернуться к рефлексии" onClick={() => dispatch('v3_return_reflection')}>
        {state.v3.stageReports.length === 0 ? <p>Активных этапов еще не было.</p> : (
          <div className="v3-attempt-list">
            {state.v3.stageReports.map((report) => (
              <PastAttemptCard key={report.id} report={report} productPrice={state.launchPlan.productPrice ?? 0} />
            ))}
          </div>
        )}
      </V3Screen>
    );
  }

  if (step === 'v3_pre_action_summary') {
    if (!state.v3.lastPreparationSummary && (state.v3.plannedPreparations.length > 0 || state.v3.loopRestDays > 0)) {
      return (
        <V3Screen gender={gender} image="laptop" title="Готовим активный этап" busy={busy} button="Посчитать подготовку" onClick={() => dispatch('v3_begin_action_plan')}>
          <p>Сейчас посчитаем, сколько дней заняли подготовка и отдых.</p>
        </V3Screen>
      );
    }
    const summary = state.v3.lastPreparationSummary;
    if (summary) {
      return (
        <V3Screen gender={gender} image="laptop" title="Подготовка завершена" busy={busy} button="Да, начать активный этап" onClick={() => dispatch('v3_ack_pre_action_summary')}>
          <p>Во время подготовки вы решили сделать:</p>
          <ul>{summary.items.map((item) => <li key={item.id}>{item.title}</li>)}</ul>
          <p>Теперь вам доступны:</p>
          <ul>{summary.unlockedTitles.map((title) => <li key={title}>{title}</li>)}</ul>
          <p>Подготовка заняла {summary.preparationDays} дней. Отдых занял {summary.restDays} дней.</p>
        </V3Screen>
      );
    }
    return (
      <V3Screen gender={gender} image="laptop" title="Переходим к действиям" busy={busy} button="Выбрать инструменты" onClick={() => dispatch('v3_begin_action_plan')}>
        <p>Подготовки в этом круге нет. Можно сразу выбрать рекламу, прогрев и продажи.</p>
      </V3Screen>
    );
  }

  if (step === 'v3_action_select') {
    return (
      <V3Screen gender={gender} image="cocktails" title={`Решите, что ${name} будет делать в этот раз`} busy={busy}>
        <div className="v3-stack">
          {(['ad', 'warmup', 'sales'] as V3SelectionKind[]).map((kind) => {
            const isSelected = Boolean(state.v3.activeSelection[kind]);
            return (
              <button
                key={kind}
                className={`v3-red-button v3-select-button${isSelected ? ' v3-select-button--selected' : ''}`}
                onClick={() => setChoosing(kind)}
              >
                <span>{isSelected ? '✓ ' : ''}Выбрать {KIND_TITLES[kind]}</span>
                <small>{selectedOptionSummary(state, kind)}</small>
              </button>
            );
          })}
          <button className="btn-primary" disabled={!state.v3.activeSelection.ad || !state.v3.activeSelection.warmup || !state.v3.activeSelection.sales || busy}
            onClick={() => dispatch('v3_start_active_stage')}>
            Начать активный этап
          </button>
          <button className="btn-secondary" disabled={busy} onClick={() => dispatch('v3_return_reflection')}>Вернуться к рефлексии</button>
        </div>
        {choosing && <ActiveChoiceModal state={state} kind={choosing} dispatch={dispatch} onClose={() => setChoosing(null)} />}
      </V3Screen>
    );
  }

  if (step === 'v3_active_intro') {
    return (
      <V3Screen gender={gender} title="Сейчас начнется активный этап" busy={busy} button="Понятно!" onClick={() => dispatch('v3_next')}>
        <p>Вы будете видеть, какие результаты дают реклама, прогрев и продажи.</p>
        <p>Если нужно отвечать на сообщения или созвоны, старайтесь успевать. Это тратит энергию.</p>
        <p>Если энергия закончится, необработанные обращения будут потеряны.</p>
      </V3Screen>
    );
  }

  if (step === 'v3_active_stage') {
    return <ActiveStage state={state} dispatch={dispatch} busy={busy} />;
  }

  if (step === 'v3_stage_report') {
    const report = state.v3.lastStageReport;
    return (
      <V3Screen gender={gender} image="summary" title={`Активный этап №${report?.stageNumber ?? ''} завершен`} busy={busy}
        button={state.endingReason ? 'Смотреть итог запуска' : 'Перейти к рефлексии'} onClick={() => dispatch('v3_return_reflection')}>
        {report ? <ReportCard report={report} productPrice={state.launchPlan.productPrice ?? 0} full /> : <p>Отчет не найден.</p>}
      </V3Screen>
    );
  }

  return (
    <V3Screen gender={gender} title="Неизвестный экран v3" busy={busy}>
      <pre>{JSON.stringify(state.flow, null, 2)}</pre>
    </V3Screen>
  );
}

function V3Screen({
  image,
  gender,
  title,
  children,
  button,
  onClick,
  busy,
}: {
  image?: Parameters<typeof PixelArtScene>[0]['variant'];
  gender: GameState['player']['avatarGender'];
  title: string;
  children: ReactNode;
  button?: string;
  onClick?: () => void;
  busy: boolean;
}) {
  return (
    <section className="v3-screen">
      {image && <PixelArtScene variant={image} gender={gender} />}
      <div className="v3-panel">
        <h1>{title}</h1>
        <div className="v3-copy">{children}</div>
      </div>
      {button && <div className="scene-btn-row"><button className="btn-primary" disabled={busy} onClick={onClick}>{button}</button></div>}
    </section>
  );
}

function PrepareButton({
  state,
  definition,
  area,
  mode,
  dispatch,
}: {
  state: GameState;
  definition: ReturnType<typeof getV3PreparationDisplayOptions>[number];
  area: V3PreparationArea;
  mode: V3PreparationMode;
  dispatch: Dispatch;
}) {
  const price = definition[mode === 'self' ? 'self' : 'expert'];
  const purchased = isPreparationPurchased(state, area, definition.id, mode);
  const permanentPurchased = purchased && area !== 'ads';
  const conversionLine = price.known ? ` · конверсия ${formatConversion(price.effectiveConversion)}` : '';
  return (
    <button className={`v3-red-button${purchased ? ' v3-red-button--owned' : ''}`} disabled={permanentPurchased} onClick={() => {
      if (confirm(`${definition.title}: подтвердить вариант "${mode === 'self' ? 'самостоятельно' : 'со специалистом'}"?`)) {
        void dispatch('v3_confirm_preparation', { area, instrumentId: definition.id, mode });
      }
    }}>
      {purchased ? area === 'ads' ? 'Куплено · купить еще' : 'Куплено' : `Сделать ${mode === 'self' ? 'самостоятельно' : 'со специалистом'}`}
      <small>{price.cost > 0 ? `${price.cost.toLocaleString('ru-RU')} ₽` : 'без денег'} · {price.energy} энергии · {price.days} дн.{conversionLine}</small>
    </button>
  );
}

function isPreparationPurchased(state: GameState, area: V3PreparationArea, instrumentId: string, mode: V3PreparationMode): boolean {
  return state.v3.plannedPreparations.some((item) => item.area === area && item.instrumentId === instrumentId && item.mode === mode)
    || state.v3.lastPreparationSummary?.items.some((item) => item.area === area && item.instrumentId === instrumentId && item.mode === mode) === true
    || (area === 'ads'
      ? state.v3.preparedAds.some((item) => item.instrumentId === instrumentId && item.mode === mode)
      : state.v3.preparedTools.some((item) => item.area === area && item.instrumentId === instrumentId && item.mode === mode));
}

function ActiveChoiceModal({ state, kind, dispatch, onClose }: { state: GameState; kind: V3SelectionKind; dispatch: Dispatch; onClose: () => void }) {
  const options = getV3ActiveOptions(state, kind);
  const selectedKey = state.v3.activeSelection[kind];
  return (
    <div className="v3-modal">
      <div className="v3-modal__panel">
        <h2>Выбрать {KIND_TITLES[kind]}</h2>
        <div className="v3-stack">
          {options.map((option) => {
            const isSelected = selectedKey === option.key;
            return (
              <button
                key={option.key}
                className={`choice-card${option.locked ? ' choice-card--disabled' : ''}${isSelected ? ' choice-card--selected' : ''}`}
                disabled={option.locked}
                onClick={() => {
                  void dispatch('v3_select_active', { kind, key: option.key });
                  onClose();
                }}
              >
                <span className="choice-content">
                  <strong className="choice-title">{option.locked ? 'ЗАКРЫТО · ' : ''}{isSelected ? '✓ ' : ''}{option.title}</strong>
                  <span className="choice-desc">{activeOptionDescription(option, isSelected)}</span>
                </span>
              </button>
            );
          })}
          <button className="btn-secondary" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  );
}

function ActiveStage({ state, dispatch, busy: _busy }: { state: GameState; dispatch: Dispatch; busy: boolean }) {
  const plan = useMemo(() => buildV3ActiveStagePlan(state), [state]);
  const [seconds, setSeconds] = useState<number>(plan.durationSeconds);
  const [answeredIds, setAnsweredIds] = useState<string[]>([]);
  const [calls, setCalls] = useState({ held: 0, buy: 0, noBuy: 0 });
  const [chats, setChats] = useState({ held: 0, direct: 0, postCall: 0, buy: 0, noBuy: 0 });
  const [postCallQueue, setPostCallQueue] = useState<V3ActiveSaleOutcome[]>([]);
  const [lastResult, setLastResult] = useState<{ kind: 'call' | 'chat'; buy: boolean } | null>(null);
  const [blockedUntil, setBlockedUntil] = useState(0);
  const [blockLabel, setBlockLabel] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const completedRef = useRef(false);
  const timeoutRef = useRef<number | null>(null);
  useEffect(() => {
    if (seconds <= 0 && !completedRef.current) {
      completedRef.current = true;
      void dispatch('v3_complete_active_stage', {
        manualAnswers: answeredIds.length,
        salesChats: chats.held,
        directSalesChats: chats.direct,
        postCallChats: chats.postCall,
        calls: calls.held,
      });
      return;
    }
    const id = window.setTimeout(() => setSeconds((prev) => prev - 1), 1000);
    return () => window.clearTimeout(id);
  }, [seconds, dispatch, answeredIds.length, chats.held, calls.held]);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => () => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
  }, []);

  const elapsed = plan.durationSeconds - seconds;
  const progress = Math.round((elapsed / plan.durationSeconds) * 100);
  const views = plan.adEvents.filter((event) => event.second <= elapsed).reduce((sum, event) => sum + event.viewsDelta, 0);
  const leadProgress = plan.totals.views > 0 ? views / plan.totals.views : elapsed / plan.durationSeconds;
  const newLeads = Math.min(plan.totals.newLeads, Math.round(plan.totals.newLeads * leadProgress));
  const notInterested = Math.min(plan.totals.notInterested, Math.round(plan.totals.notInterested * leadProgress));
  const interestedNow = Math.min(plan.totals.interested, Math.round(plan.totals.interested * leadProgress));
  const answeredSet = new Set(answeredIds);
  const visibleMessages = plan.warmupMessages.filter((message) => message.second <= elapsed && message.expiresSecond > elapsed && !answeredSet.has(message.id));
  const expiredMessages = plan.warmupMessages.filter((message) => message.expiresSecond <= elapsed && !answeredSet.has(message.id)).length;
  const requiredAnswerNow = Math.min(plan.totals.requiredAnswer, Math.round(plan.totals.requiredAnswer * leadProgress));
  const blocked = now < blockedUntil;
  const blockLeft = Math.max(0, Math.ceil((blockedUntil - now) / 1000));
  const warmedNow = Math.max(0, interestedNow - expiredMessages);
  const autoSalesNow = Math.min(
    warmedNow,
    Math.round(plan.totals.autoSales * (warmedNow / Math.max(1, plan.totals.interested))),
  );
  const readyForSalesNow = Math.max(0, warmedNow - autoSalesNow);
  const salesMode = activeSalesMode(state.v3.activeSelection.sales);
  const availableCallCount = salesMode === 'chat' || salesMode === 'site' || salesMode === 'webinar'
    ? 0
    : Math.max(0, readyForSalesNow - calls.held);
  const siteMessageLimit = salesMode === 'site' || salesMode === 'webinar'
    ? Math.min(
      plan.totals.siteMessages,
      Math.round(plan.totals.siteMessages * (readyForSalesNow / Math.max(1, plan.totals.interested - plan.totals.autoSales))),
    )
    : 0;
  const availableChatCount = salesMode === 'call'
    ? Math.max(0, postCallQueue.length - chats.postCall)
    : salesMode === 'site' || salesMode === 'webinar'
      ? Math.max(0, siteMessageLimit - chats.held)
      : Math.max(0, readyForSalesNow + postCallQueue.length - calls.held - chats.direct - chats.postCall);
  const currentWarmupText = visibleMessages[0]?.text ?? (plan.totals.requiredAnswer > 0 ? 'Сообщений для ответа пока нет' : 'Прогрев работает без ручных ответов');
  const currentCall = plan.callOutcomes[calls.held];
  const currentPostCallChat = postCallQueue[chats.postCall];
  const currentDirectChat = plan.chatOutcomes[chats.direct];
  const currentChat = currentPostCallChat ?? currentDirectChat;
  const currentSales = calls.buy + chats.buy + autoSalesNow;
  const productPrice = state.launchPlan.productPrice ?? 0;
  const salesMessage = lastResult?.buy
    ? 'Купили!'
    : salesMode === 'call'
      ? currentCall?.text
      : salesMode === 'webinar'
        ? currentChat?.text ?? 'Автовебинар продает автоматически'
        : salesMode === 'site'
          ? currentChat?.text ?? 'Сайт продает автоматически'
          : currentChat?.text;
  const hotAdVisible = plan.adEvents.some((event) => event.hot && event.second <= elapsed);
  const stageAlert = lastResult?.buy
    ? `ОПЛАТА! +${productPrice.toLocaleString('ru-RU')} ₽`
    : expiredMessages > 0
      ? `ГОРИТ ОЧЕРЕДЬ: ${expiredMessages} заявок остыли`
      : hotAdVisible
        ? 'КОНТЕНТ ЗАЛЕТЕЛ: поток лидов ускорился'
        : currentSales > 0
          ? `Уже ${currentSales} продаж. Дожимайте заявки.`
          : readyForSalesNow > 0
            ? `${readyForSalesNow} заявок готовы к продаже`
            : 'Идет трафик. Следите за узким местом.';

  const runAction = (durationSeconds: number, label: string, update: () => void) => {
    if (blocked || seconds <= 0) return;
    setBlockLabel(label);
    setBlockedUntil(Date.now() + durationSeconds * 1000);
    timeoutRef.current = window.setTimeout(() => {
      update();
      setBlockLabel(null);
      timeoutRef.current = null;
    }, durationSeconds * 1000);
  };
  const answerMessage = () => {
    const message = visibleMessages[0];
    if (!message) return;
    runAction(1, 'отвечаете на сообщение', () => {
      setAnsweredIds((value) => value.includes(message.id) ? value : [...value, message.id]);
      setLastResult(null);
    });
  };
  const runCall = () => {
    if (availableCallCount <= 0 || !currentCall) return;
    runAction(plan.callDurationSeconds, 'идет созвон', () => {
      setCalls((value) => ({
        held: value.held + 1,
        buy: value.buy + (currentCall.buy ? 1 : 0),
        noBuy: value.noBuy + (currentCall.buy ? 0 : 1),
      }));
      if (!currentCall.buy && currentCall.followupMessage) {
        setPostCallQueue((value) => [...value, currentCall]);
      }
      setLastResult({ kind: 'call', buy: currentCall.buy });
    });
  };
  const runChat = () => {
    if (availableChatCount <= 0 || !currentChat) return;
    const isPostCall = Boolean(currentPostCallChat);
    const buy = isPostCall ? currentChat.followupBuy : currentChat.buy;
    runAction(plan.chatDurationSeconds, 'продаете в переписке', () => {
      setChats((value) => ({
        held: value.held + 1,
        direct: value.direct + (isPostCall ? 0 : 1),
        postCall: value.postCall + (isPostCall ? 1 : 0),
        buy: value.buy + (buy ? 1 : 0),
        noBuy: value.noBuy + (buy ? 0 : 1),
      }));
      setLastResult({ kind: 'chat', buy });
    });
  };
  return (
    <section className="v3-screen">
      <div className="v3-panel">
        <h1>Время активного этапа №{state.v3.stageReports.length + 1}</h1>
        <div className="v3-timer"><span style={{ width: `${progress}%` }} /></div>
        <div className="v3-active-board">
          <div className={`v3-stage-alert${lastResult?.buy ? ' is-win' : expiredMessages > 0 ? ' is-danger' : hotAdVisible ? ' is-hot' : ''}`}>
            {stageAlert}
          </div>
          <h2>Реклама</h2>
          <div className="v3-runner">
            {plan.adEvents.map((event) => (
              <span key={event.id} className={event.hot && event.second <= elapsed ? 'is-hot' : undefined}>
                {event.label}
              </span>
            ))}
          </div>
          <b>Количество показов {views.toLocaleString('ru-RU')}</b>
          <h2>Прогрев</h2>
          <div className="v3-message">{currentWarmupText}</div>
          <div className="v3-action-row">
            <button disabled={blocked || !visibleMessages[0]} onClick={answerMessage}>Ответить</button>
            <span>{blocked ? `${blockLabel ?? 'занято'}: ${blockLeft} сек.` : `в очереди: ${visibleMessages.length}`}</span>
          </div>
          <div className="v3-counter-grid">
            <b>Новых лидов {newLeads}</b>
            <b>Требуют ответа {Math.max(0, requiredAnswerNow - answeredIds.length - expiredMessages)}</b>
            <b>Не оставили заявку {notInterested}</b>
            <b>Остыли и ушли {expiredMessages}</b>
            <b>Оставили заявку {interestedNow}</b>
            {plan.totals.autoSales > 0 && <b>Купили автоматически {autoSalesNow}</b>}
            <b>Готовы к продаже {readyForSalesNow}</b>
          </div>
          <h2>Продажи</h2>
          <div className={`v3-message ${lastResult?.buy ? 'is-sale' : lastResult && !lastResult.buy ? 'is-no-sale' : ''}`}>
            {salesMessage}
            {lastResult?.buy && <span className="v3-money-burst">+{productPrice.toLocaleString('ru-RU')} ₽</span>}
            {lastResult && !lastResult.buy && <span className="v3-loss-burst">не закрыли</span>}
          </div>
          <div className="v3-grid">
            {salesMode !== 'chat' && salesMode !== 'site' && salesMode !== 'webinar' && (
              <button disabled={blocked || availableCallCount <= 0} onClick={runCall}>Провести созвон</button>
            )}
            {salesMode !== 'call' || postCallQueue.length > chats.postCall ? (
              <button disabled={blocked || availableChatCount <= 0} onClick={runChat}>Продать в переписке</button>
            ) : null}
          </div>
          <div className="v3-counter-grid">
            <b>Созвоны: {calls.held}</b>
            <b>Купили: {calls.buy}</b>
            <b>Не купили: {calls.noBuy}</b>
            <b>Переписки: {chats.held}</b>
            <b>Купили: {chats.buy}</b>
            <b>Не купили: {chats.noBuy}</b>
          </div>
        </div>
      </div>
      <div className="scene-btn-row">
        <button className="btn-secondary" disabled>До отчета: {seconds} сек.</button>
      </div>
    </section>
  );
}

function activeSalesMode(key: string | null): 'intuition' | 'call' | 'chat' | 'site' | 'webinar' {
  if (!key) return 'intuition';
  if (key.includes('call_script')) return 'call';
  if (key.includes('chat_script')) return 'chat';
  if (key.includes('auto_webinar')) return 'webinar';
  if (key.includes('website')) return 'site';
  return 'intuition';
}

function PastAttemptCard({ report, productPrice }: { report: NonNullable<GameState['v3']['lastStageReport']>; productPrice: number }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`v3-attempt${expanded ? ' v3-attempt--open' : ''}`}>
      <button
        type="button"
        className="v3-attempt-toggle"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        <span>Попытка №{report.stageNumber}</span>
        <span aria-hidden="true">{expanded ? 'Свернуть' : 'Развернуть'}</span>
      </button>
      {expanded && <ReportCard report={report} productPrice={productPrice} full />}
    </div>
  );
}

function ReportCard({
  report,
  productPrice,
  full = false,
  showAttemptTitle = false,
}: {
  report: NonNullable<GameState['v3']['lastStageReport']>;
  productPrice: number;
  full?: boolean;
  showAttemptTitle?: boolean;
}) {
  const applications = report.applications ?? report.interested;
  const insight = getV3AttemptInsight(report, productPrice);
  return (
    <div className="v3-report">
      {showAttemptTitle && <h2 className="v3-report-title">Попытка №{report.stageNumber}</h2>}
      <div className={`v3-attempt-diagnosis v3-attempt-diagnosis--${insight.severity}`}>
        <strong>{insight.headline}</strong>
        <span>{insight.lossLabel}</span>
        <ul>
          {insight.bullets.map((item) => <li key={item}>{item}</li>)}
        </ul>
        <p>{insight.recommendation}</p>
      </div>
      <dl className="v3-report-list">
        <div>
          <dt>Длительность</dt>
          <dd>{report.daysSpent} дней</dd>
        </div>
        <div>
          <dt>Энергия</dt>
          <dd>потрачено {report.energySpent}</dd>
        </div>
        <div>
          <dt>Реклама</dt>
          <dd>{report.adTitle}</dd>
        </div>
        <div>
          <dt>Прогрев</dt>
          <dd>{report.warmupTitle}</dd>
        </div>
        <div>
          <dt>Продажи</dt>
          <dd>{report.salesTitle}</dd>
        </div>
      </dl>
      <div className="v3-report-section">
        <strong>Поток заявок</strong>
        <p>{report.views.toLocaleString('ru-RU')} просмотров</p>
        <p>{report.newLeads} новых лидов</p>
        <p>{applications} оставили заявку</p>
        <p>{report.lost} заявок остыли и ушли</p>
        <p>{Math.max(0, applications - report.lost)} дошли до продаж</p>
      </div>
      {full && (
        <>
          <div className="v3-report-section">
            <strong>Созвоны</strong>
            <p>Проведено: {report.callsHeld}</p>
            <p>Купили: {report.callsBuy}</p>
            <p>Не купили: {report.callsNoBuy}</p>
          </div>
          <div className="v3-report-section">
            <strong>Переписка</strong>
            <p>Проведено: {report.chatsHeld}</p>
            <p>Купили: {report.chatsBuy}</p>
            <p>Не купили: {report.chatsNoBuy}</p>
          </div>
          {(report.autoSales ?? 0) > 0 && (
            <div className="v3-report-section">
              <strong>Автопродажи</strong>
              <p>Купили без ручной обработки: {report.autoSales}</p>
            </div>
          )}
          {report.siteVisits > 0 && (
            <div className="v3-report-section">
              <strong>{report.salesTitle.includes('Автовебинар') ? 'Автовебинар' : 'Сайт'}</strong>
              <p>Посетителей: {report.siteVisits}</p>
              <p>Купили: {report.siteBuys}</p>
              <p>Написали: {report.siteMessages}</p>
            </div>
          )}
        </>
      )}
      <div className="v3-report-total">
        <span>Всего продаж: {report.salesCount}</span>
        <span>Выручка: {report.revenue.toLocaleString('ru-RU')} ₽</span>
      </div>
    </div>
  );
}

function selectedOptionSummary(state: GameState, kind: V3SelectionKind): string {
  const key = state.v3.activeSelection[kind];
  if (!key) return 'Не выбрано';
  const option = getV3ActiveOptions(state, kind).find((item) => item.key === key);
  if (!option) return 'Не выбрано';
  return option.known
    ? `${option.title} · ${formatConversion(option.effectiveConversion)}`
    : `${option.title} · конверсия скрыта`;
}

function approvedDreams(gender: GameState['player']['avatarGender']) {
  const female = [
    { id: 'iphone', title: 'Новый айфон', price: 150_000 },
    { id: 'tsum', title: 'Поход в ЦУМ', price: 300_000 },
    { id: 'vacation', title: 'Отпуск', price: 300_000 },
    { id: 'stylist_wardrobe', title: 'Гардероб со стилистом', price: 200_000 },
    { id: 'debts', title: 'Закрыть долги', price: 250_000 },
    { id: 'safety_cushion', title: 'Накопить подушку', price: 400_000 },
  ];
  const male = [
    { id: 'playstation', title: 'PlayStation / техника', price: 150_000 },
    { id: 'iphone_gadget', title: 'Новый айфон / гаджет', price: 300_000 },
    { id: 'vacation', title: 'Отпуск', price: 300_000 },
    { id: 'wardrobe', title: 'Обновить гардероб', price: 200_000 },
    { id: 'debts', title: 'Закрыть долги', price: 250_000 },
    { id: 'safety_cushion', title: 'Накопить подушку', price: 400_000 },
  ];
  return gender === 'male' ? male : female;
}

function adviceTitle(category: V3AdviceCategory): string {
  if (category === 'ads') return 'Совет по рекламе';
  if (category === 'warmup') return 'Совет по прогреву';
  return 'Совет по продажам';
}

function adviceOptionTitle(option: V3AdviceOption): string {
  if (option === 'friend') return 'Совет знакомого спеца';
  if (option === 'consult_5k') return 'Купить консультацию за 5к';
  return 'Купить консультацию за 10к';
}

function adviceOptionDescription(option: V3AdviceOption, category: V3AdviceCategory): string {
  const topic = category === 'ads' ? 'рекламы' : category === 'warmup' ? 'прогрева' : 'продаж';
  if (option === 'friend') return 'Общий совет без бонуса';
  if (option === 'consult_5k') return `Примерные конверсии ${topic} + результативность x1.05`;
  return `Точная связка ${topic} + результативность x1.10`;
}

function activeOptionDescription(
  option: { locked: boolean; known: boolean; effectiveConversion: number },
  isSelected: boolean,
): string {
  if (option.locked) return option.known ? `Не готово · ${formatConversion(option.effectiveConversion)}` : 'Не готово';
  const prefix = isSelected ? 'Выбрано сейчас' : option.known ? 'Конверсия видна' : 'Конверсия пока скрыта';
  if (!option.known) return prefix;
  return `${prefix} · ${formatConversion(option.effectiveConversion)}`;
}

function formatConversion(value: number): string {
  return `${(value * 100).toLocaleString('ru-RU', { maximumFractionDigits: 1 })}%`;
}
