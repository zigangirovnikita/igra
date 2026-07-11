import type { ActionConfig, ContentType, GameState, RouteSelection } from '@/packages/game-engine/src';
import type { ChoiceOption, ChoiceScene } from './types';

export type DecisionCategory = 'demand' | 'product' | 'content' | 'route' | 'sales' | 'recovery';

const ACTIONS: Record<DecisionCategory, string[]> = {
  demand: ['demand_pilot_offer', 'demand_interviews', 'demand_poll', 'consultation_basic', 'consultation_detailed'],
  product: ['product_pilot', 'product_self', 'product_home', 'product_studio'],
  content: ['stories_3d', 'reels_7d', 'reels_stories_7d', 'live_stream', 'webinar', 'telegram_warmup'],
  route: ['guide_self', 'guide_specialist', 'video_self', 'video_specialist', 'simple_bot_self', 'simple_bot_specialist', 'ai_bot_self', 'ai_bot_specialist', 'website_basic', 'website_beautiful', 'hire_manager'],
  sales: ['manual_chat', 'calls', 'manual_followup', 'bot_followup'],
  recovery: ['rest_one_day', 'rest_two_days'],
};

export const CONTENT_ACTIONS = new Set(ACTIONS.content);

const COPY: Record<DecisionCategory, { icon: string; title: string; description: string; question: string }> = {
  demand: { icon: '🔎', title: 'Проверить спрос', description: 'Понять, нужен ли людям продукт, прежде чем вкладываться.', question: 'Как будете проверять спрос?' },
  product: { icon: '🎬', title: 'Собрать продукт', description: 'Решить, сколько времени и денег вложить в создание.', question: 'Как будете собирать продукт?' },
  content: { icon: '📣', title: 'Привлечь людей', description: 'Запустить контент и привести новую группу входящих.', question: 'Какой контент запустите?' },
  route: { icon: '🧩', title: 'Собрать воронку', description: 'Усилить вход, прогрев или обработку сообщений.', question: 'Какой участок маршрута усилите?' },
  sales: { icon: '💬', title: 'Поработать с лидами', description: 'Продать, провести созвоны или вернуть сомневающихся.', question: 'Как будете работать с текущими лидами?' },
  recovery: { icon: '🌿', title: 'Восстановиться', description: 'Вернуть энергию, пожертвовав игровым временем.', question: 'Сколько времени выделите на отдых?' },
};

const CONTENT_TYPES: Array<{ id: ContentType; icon: string; title: string; description: string }> = [
  { id: 'useful', icon: '🧠', title: 'Дам полезный контент', description: 'Практические советы без прямой продажи.' },
  { id: 'storytelling', icon: '📖', title: 'Расскажу свою историю', description: 'Личный контекст и путь к продукту.' },
  { id: 'selling', icon: '🏷️', title: 'Сразу начну продавать', description: 'Прямой оффер без прогрева.' },
  { id: 'chaotic', icon: '🎲', title: 'По настроению', description: 'Публикации без единой линии.' },
];

export function buildCategoryOptions(available: ActionConfig[], energy: number): ChoiceOption[] {
  const ids = new Set(available.map((action) => action.id));
  const order: DecisionCategory[] = energy < 35 ? ['recovery', 'demand', 'product', 'content', 'route', 'sales'] : ['demand', 'product', 'content', 'route', 'sales', 'recovery'];
  return order.filter((category) => ACTIONS[category].some((id) => ids.has(id))).slice(0, 5)
    .map((category) => ({ id: `__category:${category}`, ...COPY[category] }));
}

export function buildCategoryScene(state: GameState, available: ActionConfig[], category: DecisionCategory, toChoice: (action: ActionConfig) => ChoiceOption): ChoiceScene {
  const allowed = new Set(ACTIONS[category]);
  return { type: 'choice', image: 'character_thinking', question: COPY[category].question,
    subtext: `День ${state.resources.day}/30 · Банк ${state.resources.bank.toLocaleString('ru-RU')} ₽ · Энергия ${Math.round(state.resources.energy)}%`,
    options: available.filter((action) => allowed.has(action.id)).slice(0, 5).map(toChoice) };
}

export function buildContentTypeScene(action: ChoiceOption): ChoiceScene {
  return { type: 'choice', image: 'character_thinking', question: 'О чём будете говорить?', subtext: `${action.title}. Содержание повлияет на отклик.`,
    options: CONTENT_TYPES.map((content) => ({ ...content, id: `__content:${content.id}`, payload: { actionId: action.id, contentType: content.id } })) };
}

export function buildInitialPlanScenes(): ChoiceScene[] {
  return [
    planScene('source', 'Где будете брать людей?', [['reels', '🎥', 'Рилсы'], ['stories', '📱', 'Сторис'], ['telegram', '✈️', 'Telegram']]),
    planScene('entry', 'Куда поведёте заинтересованных?', [['direct_messages', '💬', 'В директ'], ['guide', '📄', 'На гайд'], ['website', '🌐', 'На сайт']]),
    planScene('sale', 'Как будете продавать?', [['manual_chat', '⌨️', 'В переписке'], ['call', '📞', 'На созвоне'], ['website_auto', '🛒', 'Через сайт']]),
    planScene('processing', 'Кто будет отвечать людям?', [['manual', '🙋', 'Я сама / сам'], ['manager', '👩‍💼', 'Менеджер'], ['simple_bot', '🤖', 'Бот']]),
    planScene('followup', 'Что делать с теми, кто не купил сразу?', [['none', '🚪', 'Ничего'], ['manual', '🔁', 'Написать вручную'], ['bot', '⚙️', 'Настроить дожим']]),
  ];
}

function planScene(key: string, question: string, rows: string[][]): ChoiceScene {
  return { type: 'choice', image: 'character_beach', question, subtext: 'Это первоначальный план. Его можно менять по ходу запуска.',
    options: rows.map(([value, icon, title]) => ({ id: `__plan:${key}:${value}`, icon, title, description: 'Выбрать этот вариант для первоначального плана.' })) };
}

export function routeFromPlan(plan: Record<string, string>): RouteSelection {
  const entry = (plan.entry ?? 'direct_messages') as RouteSelection['entry'];
  return { entry, nurture: entry === 'guide' ? ['guide'] : ['none'], processing: (plan.processing ?? 'manual') as RouteSelection['processing'],
    saleMethod: (plan.sale ?? 'manual_chat') as RouteSelection['saleMethod'], followup: (plan.followup ?? 'none') as RouteSelection['followup'] };
}

export function operationalRoute(state: GameState): RouteSelection {
  const planned = state.initialPlan ?? state.activeRoute;
  const entry = planned.entry === 'guide' && state.assets.guide ? 'guide'
    : planned.entry === 'video_lesson' && state.assets.videoLesson ? 'video_lesson'
      : planned.entry === 'website' && state.assets.website ? 'website' : 'direct_messages';
  const processing = planned.processing === 'ai_bot' && state.assets.aiBot ? 'ai_bot'
    : planned.processing === 'simple_bot' && state.assets.simpleBot ? 'simple_bot'
      : planned.processing === 'manager' && state.assets.manager ? 'manager'
        : planned.processing === 'website_auto' && state.assets.website ? 'website_auto' : 'manual';
  const saleMethod = planned.saleMethod === 'website_auto' && state.assets.website ? 'website_auto'
    : planned.saleMethod === 'bot_auto' && (state.assets.aiBot || state.assets.simpleBot) ? 'bot_auto'
      : planned.saleMethod;
  const followup = planned.followup === 'bot' && !(state.assets.aiBot || state.assets.simpleBot) ? 'none' : planned.followup;
  const nurture = entry === 'guide' ? ['guide'] as const : entry === 'video_lesson' ? ['video_lesson'] as const : ['none'] as const;
  return { entry, processing, saleMethod, followup, nurture: [...nurture] };
}
