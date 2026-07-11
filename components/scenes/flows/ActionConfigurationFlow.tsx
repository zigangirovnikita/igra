import type { GameConfig, GameState, RouteSelection } from '@/packages/game-engine/src';
import { MultiChoiceScreen } from '../ui';

type FlowProps = {
  state: GameState;
  config: GameConfig;
  dispatch: (action: string, payload?: Record<string, unknown>) => Promise<void>;
  busy: boolean;
};

export function ActionConfigurationFlow({ state, config, dispatch, busy }: FlowProps) {
  const pending = state.pendingAction;
  const action = config.actions.find((candidate) => candidate.id === pending?.actionId);
  if (!pending || !action) return null;

  if (action.configurationSteps.includes('content_type') && !pending.contentType) {
    return <MultiChoiceScreen title="Какой контент сделать?" choices={[
      { id: 'useful', label: 'Полезный контент' },
      { id: 'storytelling', label: 'Сторителлинг' },
      { id: 'selling', label: 'Продающий контент' },
      { id: 'chaotic', label: 'Сделать всё по настроению' },
    ]} onConfirm={(contentType) => dispatch('configure_action', { contentType })} busy={busy} />;
  }

  const current = state.activeRoute;
  const direct: RouteSelection = {
    ...current,
    entry: 'direct_messages',
    processing: routeProcessingAvailable(state, current.processing) ? current.processing : 'manual',
    saleMethod: saleMethodAvailable(state, current.saleMethod) ? current.saleMethod : 'manual_chat',
  };
  const routes: Array<{ id: string; label: string; route: RouteSelection; disabled?: boolean }> = [
    { id: 'current', label: 'Использовать текущий маршрут', route: current, disabled: !routeAvailable(state, current) },
    { id: 'direct', label: 'Вести в директ', route: direct },
    { id: 'guide', label: 'Вести через гайд', route: { ...direct, entry: 'guide', nurture: ['guide'] }, disabled: !state.assets.guide },
    { id: 'video', label: 'Вести через видеоурок', route: { ...direct, entry: 'video_lesson', nurture: ['video_lesson'] }, disabled: !state.assets.videoLesson },
    { id: 'website', label: 'Вести на сайт', route: { ...direct, entry: 'website', processing: 'website_auto', saleMethod: 'website_auto' }, disabled: !state.assets.website },
    { id: 'bot', label: 'Вести в бота', route: { ...direct, processing: state.assets.aiBot ? 'ai_bot' : 'simple_bot', saleMethod: 'bot_auto' }, disabled: !state.assets.simpleBot && !state.assets.aiBot },
  ];

  return (
    <MultiChoiceScreen
      title="Куда вести людей?"
      description="Сначала создайте нужный инструмент отдельным действием. Недоступные маршруты нельзя выбрать."
      choices={routes.map(({ id, label, disabled }) => ({ id, label, disabled }))}
      onConfirm={(id) => dispatch('configure_action', { route: routes.find((item) => item.id === id)?.route })}
      busy={busy}
    />
  );
}

function routeAvailable(state: GameState, route: RouteSelection): boolean {
  if (route.entry === 'guide' && !state.assets.guide) return false;
  if (route.entry === 'video_lesson' && !state.assets.videoLesson) return false;
  if (route.entry === 'website' && !state.assets.website) return false;
  if (!routeProcessingAvailable(state, route.processing)) return false;
  if (!saleMethodAvailable(state, route.saleMethod)) return false;
  if (route.followup === 'bot' && !state.assets.simpleBot && !state.assets.aiBot) return false;
  return true;
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
