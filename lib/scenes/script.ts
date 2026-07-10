/**
 * script.ts — "мозг" нарративного движка.
 * По текущему GameState решает: какие сцены показать следующими.
 * Чистая функция, без React, без API-вызовов.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */
import type { ChoiceOption, ChoiceScene, MetricDelta, MetricsScene, NarrativeScene, ResultScene, Scene } from './types';
import { getActionAvailability, type ActionConfig, type GameState, type GameConfig } from '@/packages/game-engine/src';
import {
  beachReflection,
  days,
  getActionResultNarrative,
  getActionStartNarrative,
  getDirectOverflowWarning,
  getFinalHeadline,
  getFinalInsight,
  getLowEnergyWarning,
  rub,
} from './narratives';

// ─── After setup: initial game scenes ────────────────────────────────────────

export function buildInitialGameScenes(state: GameState, config: GameConfig): Scene[] {
  return [
    {
      type: 'narrative',
      image: 'character_thinking',
      lines: beachReflection(state),
    },
    buildMainChoiceScene(state, config),
  ];
}

// ─── After an action completes ────────────────────────────────────────────────

export function buildPostActionScenes(
  newState: GameState,
  prevState: GameState,
  actionId: string,
  config: GameConfig,
): Scene[] {
  const scenes: Scene[] = [];

  // 1. Narrative reaction to the result
  const resultLines = getActionResultNarrative(newState, actionId, prevState);
  const resultDeltas = buildResultDeltas(newState, prevState);
  scenes.push({
    type: 'result',
    image: getResultImage(newState, prevState),
    headline: getResultHeadline(newState, prevState, actionId),
    lines: resultLines,
    deltas: resultDeltas,
  });

  // 2. Metrics screen
  scenes.push(buildMetricsScene(newState, prevState));

  // 3. Low energy warning (once per threshold)
  if (newState.resources.energy < 30 && prevState.resources.energy >= 30) {
    scenes.push({
      type: 'narrative',
      image: 'character_tired',
      lines: getLowEnergyWarning(newState.player.name),
    });
  }

  // 4. Inbound overflow → mini game
  const newCohort = newState.cohorts.find((c) => !prevState.cohorts.find((p) => p.id === c.id));
  if (
    newCohort &&
    newCohort.responses >= 30 &&
    newState.activeRoute.processing === 'manual' &&
    !newState.assets.simpleBot &&
    !newState.assets.aiBot
  ) {
    scenes.push({
      type: 'narrative',
      image: 'phone_direct',
      lines: getDirectOverflowWarning(newState.player.name, Math.round(newCohort.responses)),
    });
    scenes.push({
      type: 'mini_game_direct',
      cohortId: newCohort.id,
      totalInbound: Math.round(newCohort.responses),
      messages: buildInboundMessages(Math.min(12, Math.round(newCohort.responses))),
    });
  }

  // 5. First sale celebration
  if (newState.metrics.sales > 0 && prevState.metrics.sales === 0) {
    scenes.push({
      type: 'narrative',
      image: 'phone_payment',
      lines: [
        '🎉 Первая оплата!',
        `На счёт пришло ${rub(newState.player.productPrice)}.`,
        'Это доказательство: спрос есть, продукт покупают.',
        'Теперь задача — повторить это снова.',
      ],
    });
  }

  // 6. Next choice (if game not finished)
  if (newState.status !== 'finished' && newState.status !== 'goal_reached') {
    scenes.push(buildMainChoiceScene(newState, config));
  } else if (newState.status === 'goal_reached') {
    scenes.push({
      type: 'narrative',
      image: 'character_happy',
      lines: [
        `🏆 ${newState.player.name}, вы достигли бизнес-цели досрочно!`,
        'Можно продолжать и зарабатывать ещё — или завершить и посмотреть итоги.',
      ],
    });
    scenes.push(buildMainChoiceScene(newState, config, true));
  }

  return scenes;
}

// ─── Main choice scene ────────────────────────────────────────────────────────

export function buildMainChoiceScene(state: GameState, config: GameConfig, earlyFinish = false): ChoiceScene {
  const available = config.actions.filter((a) => a.enabled && isActionAvailableForChoice(state, a, config));
  const phase = detectPhase(state);
  const options = buildChoiceOptions(state, available, phase, config);

  const questions: Record<string, string> = {
    demand: 'Продукт ещё не проверен. С чего начнёте?',
    product: 'Продукт нужно создать. Что выберете?',
    content: 'Пора привлекать аудиторию. Что делаете?',
    route: 'Нужно выстроить маршрут для входящих. Что ставите?',
    mixed: `У вас ${state.resources.day}/30 дней. Что делаете дальше?`,
  };

  const baseOptions = options;
  baseOptions.push({
    id: '__finish__',
    icon: '🏁',
    title: earlyFinish ? 'Завершить и посмотреть итоги' : 'Завершить запуск досрочно',
    description: earlyFinish ? 'Цель достигнута. Посмотрите финальный разбор запуска.' : 'Остановить запуск и перейти к итогам.',
  });

  return {
    type: 'choice',
    image: 'character_thinking',
    question: questions[phase] ?? questions.mixed,
    subtext: `День ${state.resources.day}/30 · Банк ${rub(state.resources.bank)} · Энергия ${Math.round(state.resources.energy)}%`,
    options: baseOptions,
  };
}

// ─── Phase detection ──────────────────────────────────────────────────────────

type Phase = 'demand' | 'product' | 'content' | 'route' | 'mixed';

function detectPhase(state: GameState): Phase {
  if (state.assets.demandConfidence === 0 && state.resources.day <= 7) return 'demand';
  if (!state.assets.productQuality && state.assets.demandConfidence > 0) return 'product';
  const hasContent = state.cohorts.length > 0;
  if (!hasContent) return 'content';
  if (state.activeRoute.processing === 'manual' && state.metrics.responses > 20) return 'route';
  return 'mixed';
}

// ─── Choice options builder ───────────────────────────────────────────────────

function buildChoiceOptions(
  state: GameState,
  available: ActionConfig[],
  phase: Phase,
  config: GameConfig,
): ChoiceOption[] {
  const priorities: Record<Phase, string[]> = {
    demand: ['demand_pilot_offer', 'demand_interviews', 'demand_poll', 'consultation_basic', 'reels_7d'],
    product: ['product_pilot', 'product_self', 'product_home', 'product_studio', 'consultation_basic'],
    content: ['reels_7d', 'reels_stories_7d', 'stories_3d', 'webinar', 'telegram_warmup'],
    route: ['ai_bot_specialist', 'simple_bot_specialist', 'guide_specialist', 'hire_manager', 'video_specialist'],
    mixed: [],
  };

  const priorityIds = priorities[phase];

  // Sort: prioritized actions first, then rest
  const sorted = [
    ...priorityIds.map((id) => available.find((a) => a.id === id)).filter(Boolean),
    ...available.filter((a) => !priorityIds.includes(a.id)),
  ].filter(Boolean) as ActionConfig[];

  // Deduplicate and exclude rest if energy is fine
  const energyOk = state.resources.energy >= 35;
  const filtered = sorted.filter((a) => {
    if ((a.id === 'rest_one_day' || a.id === 'rest_two_days') && energyOk) return false;
    return true;
  });

  // If energy low, force rest to top
  if (!energyOk) {
    const restAction = available.find((a) => a.id === 'rest_one_day');
    if (restAction && !filtered.find((a) => a.id === 'rest_one_day')) {
      filtered.unshift(restAction);
    }
  }

  return filtered.map((action) => actionToChoice(state, action));
}

function actionToChoice(state: GameState, action: ActionConfig): ChoiceOption {
  const canAfford = state.resources.bank >= action.cost;
  const hasEnough = state.resources.energy >= action.energyCost;

  return {
    id: action.id,
    icon: getActionIcon(action.id),
    title: action.title,
    description: getActionDescription(action.id),
    costLabel: action.cost > 0 ? rub(action.cost) : 'бесплатно',
    daysLabel: action.days > 0 ? days(action.days) : 'сразу',
    energyLabel: action.energyCost > 0 ? `-${action.energyCost} ⚡` : undefined,
    disabled: !canAfford || !hasEnough,
    disabledReason: !canAfford
      ? `Не хватает бюджета (нужно ${rub(action.cost)})`
      : !hasEnough
        ? 'Слишком мало энергии'
        : undefined,
    payload: { actionId: action.id },
  };
}

// ─── Result deltas ────────────────────────────────────────────────────────────

function buildResultDeltas(newState: GameState, prevState: GameState): MetricDelta[] {
  const deltas: MetricDelta[] = [];

  const impressionsDelta = newState.metrics.impressions - prevState.metrics.impressions;
  if (impressionsDelta > 0) {
    deltas.push({ label: 'Охват', value: `+${Math.round(impressionsDelta).toLocaleString('ru-RU')}`, direction: 'up' });
  }

  const responsesDelta = newState.metrics.responses - prevState.metrics.responses;
  if (responsesDelta > 0) {
    deltas.push({ label: 'Входящих', value: `+${Math.round(responsesDelta)}`, direction: 'up' });
  }

  const applicationsDelta = newState.metrics.applications - prevState.metrics.applications;
  if (applicationsDelta > 0) {
    deltas.push({ label: 'Заявок', value: `+${Math.round(applicationsDelta)}`, direction: 'up' });
  }

  const salesDelta = newState.metrics.sales - prevState.metrics.sales;
  if (salesDelta > 0) {
    deltas.push({ label: 'Продаж', value: `+${salesDelta}`, direction: 'up' });
    deltas.push({
      label: 'Выручка',
      value: `+${rub(salesDelta * newState.player.productPrice)}`,
      direction: 'up',
    });
  }

  const expensesDelta = newState.metrics.expenses - prevState.metrics.expenses;
  if (expensesDelta > 0) {
    deltas.push({ label: 'Расходы', value: `-${rub(expensesDelta)}`, direction: 'down' });
  }

  const lostDelta = newState.metrics.lostLeads - prevState.metrics.lostLeads;
  if (lostDelta > 0) {
    deltas.push({ label: 'Потеряно лидов', value: `+${Math.round(lostDelta)}`, direction: 'down' });
  }

  return deltas;
}

function buildMetricsScene(newState: GameState, prevState: GameState): MetricsScene {
  return {
    type: 'metrics',
    day: newState.resources.day,
    bank: newState.resources.bank,
    bankDelta: newState.resources.bank - prevState.resources.bank,
    energy: newState.resources.energy,
    revenue: newState.metrics.revenue,
    sales: newState.metrics.sales,
  };
}

// ─── Final scenes ─────────────────────────────────────────────────────────────

export function buildFinalScenes(state: GameState, config: GameConfig): Scene[] {
  if (!state.diagnostics) return [];
  const scenes: Scene[] = [];

  scenes.push({
    type: 'narrative',
    image: 'final',
    lines: [getFinalHeadline(state), ...getFinalInsight(state)],
  });

  scenes.push({
    type: 'diagnosis',
    diagnostics: state.diagnostics,
    metrics: state.metrics,
    productPrice: state.player.productPrice,
    personalGoal: state.targets.personalGoal,
    targetRevenue: state.targets.targetRevenue,
    dreamsMet: state.metrics.revenue >= state.targets.personalGoal,
    resources: { bank: state.resources.bank, energy: state.resources.energy, day: state.resources.day },
  });

  scenes.push({
    type: 'cta',
    won: state.metrics.sales >= state.targets.targetSales,
    revenue: state.metrics.revenue,
    personalGoal: state.targets.personalGoal,
  });

  return scenes;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isActionAvailableForChoice(state: GameState, action: ActionConfig, config: GameConfig): boolean {
  const availability = getActionAvailability(state, action, config);
  if (!availability.available) {
    // Show (but disable later) if the only reason is lack of resources
    if (availability.reason.startsWith('Не хватает') || availability.reason.includes('энергии')) {
      return true;
    }
    return false;
  }
  return true;
}

function getResultImage(newState: GameState, prevState: GameState): import('./types').SceneImage {
  const salesDelta = newState.metrics.sales - prevState.metrics.sales;
  if (salesDelta > 0) return 'phone_payment';
  const responsesDelta = newState.metrics.responses - prevState.metrics.responses;
  if (responsesDelta > 20) return 'phone_notification';
  if (newState.resources.energy < 30) return 'character_tired';
  if (newState.metrics.revenue > 0) return 'character_happy';
  return 'character_thinking';
}

function getResultHeadline(newState: GameState, prevState: GameState, actionId: string): string {
  const salesDelta = newState.metrics.sales - prevState.metrics.sales;
  if (salesDelta > 0) return `+${salesDelta} ${salesDelta === 1 ? 'продажа' : 'продажи'}!`;
  const responsesDelta = newState.metrics.responses - prevState.metrics.responses;
  if (responsesDelta > 20) return 'Поток входящих!';
  if (responsesDelta > 0) return 'Есть отклики';

  const actionTitles: Record<string, string> = {
    demand_poll: 'Спрос проверен базово',
    demand_interviews: 'Спрос проверен глубоко',
    demand_pilot_offer: 'Спрос подтверждён продажей',
    product_pilot: 'Пилот готов',
    product_self: 'Продукт создан',
    product_home: 'Продукт готов',
    product_studio: 'Продукт снят профессионально',
    guide_self: 'Гайд готов',
    guide_specialist: 'Гайд готов',
    video_self: 'Видеоурок готов',
    video_specialist: 'Видеоурок готов',
    simple_bot_self: 'Бот настроен',
    simple_bot_specialist: 'Бот настроен',
    ai_bot_self: 'ИИ-бот настроен',
    ai_bot_specialist: 'ИИ-бот настроен',
    website_basic: 'Сайт готов',
    website_beautiful: 'Сайт готов',
    hire_manager: 'Менеджер нанят',
    consultation_basic: 'Диагностика пройдена',
    consultation_detailed: 'Диагностика пройдена',
    rest_one_day: 'Выходной',
    rest_two_days: 'Два дня отдыха',
  };

  return actionTitles[actionId] ?? 'Этап завершён';
}

function getActionIcon(actionId: string): string {
  const icons: Record<string, string> = {
    demand_poll: '🗳️',
    demand_interviews: '💬',
    demand_pilot_offer: '🚀',
    product_pilot: '⚡',
    product_self: '🎬',
    product_home: '🎥',
    product_studio: '🎞️',
    stories_3d: '📱',
    reels_7d: '🎵',
    reels_stories_7d: '🔥',
    live_stream: '📡',
    webinar: '🎤',
    telegram_warmup: '✈️',
    guide_self: '📄',
    guide_specialist: '📋',
    video_self: '🎓',
    video_specialist: '🎓',
    simple_bot_self: '🤖',
    simple_bot_specialist: '🤖',
    ai_bot_self: '🧠',
    ai_bot_specialist: '🧠',
    website_basic: '🌐',
    website_beautiful: '✨',
    hire_manager: '👤',
    manual_chat: '💌',
    calls: '📞',
    manual_followup: '🔄',
    bot_followup: '🔄',
    consultation_basic: '📊',
    consultation_detailed: '🔍',
    rest_one_day: '☀️',
    rest_two_days: '🌴',
  };
  return icons[actionId] ?? '▶️';
}

function getActionDescription(actionId: string): string {
  const desc: Record<string, string> = {
    demand_poll: 'Опросить аудиторию — хотят ли они продукт',
    demand_interviews: 'Провести 10 живых диалогов, узнать возражения',
    demand_pilot_offer: 'Продать первым 3 клиентам до запуска — максимальная уверенность',
    product_pilot: 'Быстро собрать MVP — главное начать продавать',
    product_self: 'Записать продукт самостоятельно дома',
    product_home: 'Снять дома с хорошим светом и микрофоном',
    product_studio: 'Студия, оператор, монтаж — максимальное качество',
    stories_3d: 'Три дня активных сторис для текущей аудитории',
    reels_7d: 'Неделя рилсов — охват новых людей',
    reels_stories_7d: 'Рилсы + сторис параллельно — максимум охвата',
    live_stream: 'Живой эфир — доверие и живые вопросы',
    webinar: 'Структурированный вебинар с продажей в конце',
    telegram_warmup: 'Прогрев постами в Telegram-канале',
    guide_self: 'Создать полезный гайд как вход в воронку',
    guide_specialist: 'Гайд под ключ со специалистом — быстро и правильно',
    video_self: 'Записать видеоурок — прогревает лучше текста',
    video_specialist: 'Видеоурок со специалистом — экономит время',
    simple_bot_self: 'Бот на кодовое слово — закрывает 80% запросов',
    simple_bot_specialist: 'Простой бот под ключ за 2 дня',
    ai_bot_self: 'ИИ-бот понимает любые сообщения — 99% обработки',
    ai_bot_specialist: 'ИИ-бот под ключ — разгружает входящие полностью',
    website_basic: 'Простой сайт с описанием продукта',
    website_beautiful: 'Красивый лендинг с дизайном',
    hire_manager: 'Менеджер ведёт переписку и созвоны вместо вас',
    consultation_basic: 'Диагностика показывает основные риски запуска',
    consultation_detailed: 'Детальная карта рисков с вероятностями',
    rest_one_day: 'Восстановить 12 единиц энергии',
    rest_two_days: 'Восстановить 25 единиц энергии',
  };
  return desc[actionId] ?? 'Следующий шаг в запуске';
}

function buildInboundMessages(count: number): string[] {
  const pool = [
    'А сколько стоит?',
    'А мне подойдёт, если я новичок?',
    'А можно подробнее про программу?',
    'А есть рассрочка?',
    'А где посмотреть отзывы?',
    'Я давно хотела, но боюсь',
    'А вы делаете личный разбор?',
    'Можно оплатить завтра?',
    'А это точно мне поможет?',
    'Как проходит обучение?',
    'Сколько времени в неделю нужно?',
    'А есть обратная связь от вас?',
  ];
  return pool.slice(0, Math.min(count, pool.length));
}
