import type { GameConfig, GameState, RouteSelection } from '@/packages/game-engine/src';
import { MultiChoiceScreen } from '../ui';

type FlowProps = {
  state: GameState;
  config: GameConfig;
  dispatch: (action: string, payload?: Record<string, unknown>) => Promise<void>;
  busy: boolean;
};

type RouteChoice = {
  id: string;
  label: string;
  description: string;
  icon: string;
  route: RouteSelection;
  disabled?: boolean;
  disabledReason?: string;
};

export function ActionConfigurationFlow({ state, config, dispatch, busy }: FlowProps) {
  const pending = state.pendingAction;
  const action = config.actions.find((candidate) => candidate.id === pending?.actionId);
  if (!pending || !action) return null;

  const goBack = () => dispatch('cancel_pending_action');

  if (action.configurationSteps.includes('content_type') && !pending.contentType) {
    return (
      <MultiChoiceScreen
        title="Какой контент сделать?"
        description="Выберите подход. На следующем шаге можно будет выбрать маршрут или вернуться к списку действий."
        choices={[
          { id: 'useful', label: 'Полезный контент', description: 'Инструкция, разбор или практический совет', icon: '💡' },
          { id: 'storytelling', label: 'Сторителлинг', description: 'История, кейс или личный опыт', icon: '📖' },
          { id: 'selling', label: 'Продающий контент', description: 'Оффер и прямой призыв к действию', icon: '🛍️' },
          { id: 'chaotic', label: 'По настроению', description: 'Без единой системы и заранее выбранной цели', icon: '🎲' },
        ]}
        onConfirm={(contentType) => dispatch('configure_action', { contentType })}
        secondaryText="← Назад к выбору действий"
        onSecondary={goBack}
        busy={busy}
      />
    );
  }

  const current = state.activeRoute;
  const direct: RouteSelection = {
    ...current,
    entry: 'direct_messages',
    nurture: current.nurture.filter((item) => item === 'none' || nurtureAvailable(state, item)),
    processing: routeProcessingAvailable(state, current.processing) ? current.processing : 'manual',
    saleMethod: saleMethodAvailable(state, current.saleMethod) ? current.saleMethod : 'manual_chat',
    followup: current.followup === 'bot' && !state.assets.simpleBot && !state.assets.aiBot ? 'none' : current.followup,
  };
  if (direct.nurture.length === 0) direct.nurture = ['none'];

  const currentError = routeUnavailableReason(state, current);
  const routes: RouteChoice[] = [
    {
      id: 'current',
      label: 'Использовать текущий маршрут',
      description: describeRoute(current),
      icon: '🧭',
      route: current,
      disabled: Boolean(currentError),
      disabledReason: currentError ?? undefined,
    },
    {
      id: 'direct',
      label: 'Вести в директ',
      description: currentError
        ? 'Доступно сразу, но для этого действия заменит недоступные части плана на ручную обработку в директе.'
        : 'Доступно сразу. Сообщения придётся разбирать вручную.',
      icon: '💬',
      route: direct,
    },
    {
      id: 'guide',
      label: 'Вести через гайд',
      description: 'Человек сначала получает полезный материал, затем переходит к продаже.',
      icon: '📘',
      route: { ...direct, entry: 'guide', nurture: ['guide'] },
      disabled: !state.assets.guide,
      disabledReason: !state.assets.guide ? 'Сначала создайте гайд отдельным действием' : undefined,
    },
    {
      id: 'video',
      label: 'Вести через видеоурок',
      description: 'Видеоурок прогревает человека перед предложением продукта.',
      icon: '🎬',
      route: { ...direct, entry: 'video_lesson', nurture: ['video_lesson'] },
      disabled: !state.assets.videoLesson,
      disabledReason: !state.assets.videoLesson ? 'Сначала создайте видеоурок отдельным действием' : undefined,
    },
    {
      id: 'website',
      label: 'Вести на сайт',
      description: 'Заявка и продажа проходят через готовый сайт.',
      icon: '🌐',
      route: { ...direct, entry: 'website', processing: 'website_auto', saleMethod: 'website_auto' },
      disabled: !state.assets.website,
      disabledReason: !state.assets.website ? 'Сначала создайте сайт отдельным действием' : undefined,
    },
    {
      id: 'bot',
      label: 'Вести в бота',
      description: 'Бот автоматически отвечает и переводит человека к покупке.',
      icon: '🤖',
      route: {
        ...direct,
        processing: state.assets.aiBot ? 'ai_bot' : 'simple_bot',
        saleMethod: 'bot_auto',
      },
      disabled: !state.assets.simpleBot && !state.assets.aiBot,
      disabledReason: !state.assets.simpleBot && !state.assets.aiBot
        ? 'Сначала создайте простого или ИИ-бота отдельным действием'
        : undefined,
    },
  ];

  const defaultRouteId = currentError ? null : 'current';

  return (
    <MultiChoiceScreen
      title="Куда вести людей?"
      description={currentError
        ? `Текущий маршрут сейчас недоступен: ${currentError.toLowerCase()}. Выберите временный маршрут явно или вернитесь и создайте нужный инструмент.`
        : 'Выберите маршрут. Закрытые варианты показаны заранее, но не блокируют продолжение игры.'}
      choices={routes.map(({ id, label, description, icon, disabled, disabledReason }) => ({
        id,
        label,
        description,
        icon,
        disabled,
        disabledReason,
      }))}
      selectedId={defaultRouteId}
      layout="list"
      confirmText="Продолжить"
      onConfirm={(id) => {
        const selected = routes.find((item) => item.id === id);
        if (selected && !selected.disabled) return dispatch('configure_action', { route: selected.route });
      }}
      secondaryText="← Назад к выбору действий"
      onSecondary={goBack}
      busy={busy}
    />
  );
}

function routeUnavailableReason(state: GameState, route: RouteSelection): string | null {
  if (route.entry === 'guide' && !state.assets.guide) return 'не создан гайд';
  if (route.entry === 'video_lesson' && !state.assets.videoLesson) return 'не создан видеоурок';
  if (route.entry === 'website' && !state.assets.website) return 'не создан сайт';
  if (route.nurture.includes('guide') && !state.assets.guide) return 'не создан гайд';
  if (route.nurture.includes('video_lesson') && !state.assets.videoLesson) return 'не создан видеоурок';
  if (!routeProcessingAvailable(state, route.processing)) return 'не создан инструмент обработки заявок';
  if (!saleMethodAvailable(state, route.saleMethod)) return 'не создан инструмент продажи';
  if (route.followup === 'bot' && !state.assets.simpleBot && !state.assets.aiBot) return 'не создан бот для дожима';
  return null;
}

function routeProcessingAvailable(state: GameState, processing: RouteSelection['processing']): boolean {
  if (processing === 'simple_bot') return Boolean(state.assets.simpleBot);
  if (processing === 'ai_bot') return Boolean(state.assets.aiBot);
  if (processing === 'manager') return Boolean(state.assets.manager);
  if (processing === 'website_auto') return Boolean(state.assets.website);
  return true;
}

function saleMethodAvailable(state: GameState, saleMethod: RouteSelection['saleMethod']): boolean {
  if (saleMethod === 'website_auto') return Boolean(state.assets.website);
  if (saleMethod === 'bot_auto') return Boolean(state.assets.simpleBot || state.assets.aiBot);
  return true;
}

function nurtureAvailable(state: GameState, nurture: RouteSelection['nurture'][number]): boolean {
  if (nurture === 'guide') return Boolean(state.assets.guide);
  if (nurture === 'video_lesson') return Boolean(state.assets.videoLesson);
  if (nurture === 'webinar') return false;
  return true;
}

function describeRoute(route: RouteSelection): string {
  const entry = route.entry === 'direct_messages'
    ? 'директ'
    : route.entry === 'video_lesson'
      ? 'видеоурок'
      : route.entry === 'guide'
        ? 'гайд'
        : route.entry === 'website'
          ? 'сайт'
          : 'вебинар';
  const processing = route.processing === 'manual'
    ? 'вручную'
    : route.processing === 'manager'
      ? 'менеджер'
      : route.processing === 'ai_bot'
        ? 'ИИ-бот'
        : route.processing === 'simple_bot'
          ? 'простой бот'
          : 'сайт';
  const nurtureLabels: Record<RouteSelection['nurture'][number], string> = {
    none: 'без прогрева',
    guide: 'гайд',
    video_lesson: 'видеоурок',
    telegram: 'Telegram-прогрев',
    webinar: 'вебинар',
  };
  const nurture = route.nurture.includes('none')
    ? 'без прогрева'
    : route.nurture.map((item) => nurtureLabels[item]).join(', ');
  return `Вход: ${entry} · прогрев: ${nurture} · обработка: ${processing}`;
}
