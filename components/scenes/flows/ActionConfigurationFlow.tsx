import type { GameState, GameConfig, RouteSelection } from '@/packages/game-engine/src';
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

  const route = state.activeRoute;
  const routes: Array<{ id: string; label: string; route: RouteSelection }> = [
    { id: 'current', label: 'Использовать текущий маршрут', route },
    { id: 'direct', label: 'Вести в директ', route: { ...route, entry: 'direct_messages' } },
    { id: 'guide', label: 'Вести через гайд', route: { ...route, entry: 'guide', nurture: ['guide'] } },
    { id: 'video', label: 'Вести через видеоурок', route: { ...route, entry: 'video_lesson', nurture: ['video_lesson'] } },
    { id: 'website', label: 'Вести на сайт', route: { ...route, entry: 'website' } },
    { id: 'bot', label: 'Вести в бота', route: { ...route, entry: 'direct_messages', processing: 'simple_bot', saleMethod: 'bot_auto' } },
    { id: 'webinar', label: 'Вести на вебинар', route: { ...route, entry: 'webinar_registration' } },
  ];
  return <MultiChoiceScreen title="Куда вести людей?" choices={routes.map(({ id, label }) => ({ id, label }))}
    onConfirm={(id) => dispatch('configure_action', { route: routes.find((item) => item.id === id)?.route })} busy={busy} />;
}
