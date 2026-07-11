import type { GameConfig, GameState } from '@/packages/game-engine/src';
import { NarrativeScreen } from '../ui';

type FlowProps = {
  state: GameState;
  config: GameConfig;
  dispatch: (action: string, payload?: Record<string, unknown>) => Promise<void>;
  busy: boolean;
};

export function EventFlow({ state, config, dispatch, busy }: FlowProps) {
  const pending = state.history.find((entry) => {
    if (entry.type !== 'game_event') return false;
    const instanceId = String(entry.payload?.eventInstanceId ?? '');
    return instanceId.length > 0 && !state.flags[`event_ack:${instanceId}`];
  });
  if (!pending) return null;

  const templateId = String(pending.payload?.eventId ?? '');
  const instanceId = String(pending.payload?.eventInstanceId ?? '');
  const template = config.events.find((event) => event.id === templateId);
  const paragraphs = template?.messages?.length ? template.messages : [pending.message];

  return (
    <NarrativeScreen
      title={eventTitle(templateId)}
      paragraphs={paragraphs}
      buttonText="Продолжить"
      busy={busy}
      onNext={() => dispatch('acknowledge_event', { eventId: instanceId })}
    />
  );
}

function eventTitle(eventId: string): string {
  const titles: Record<string, string> = {
    first_sale: 'Первая продажа',
    multiple_sales: 'Сразу несколько оплат',
    viral_reel_manual: 'Директ переполнен',
    viral_reel_simple_bot: 'Бот не справляется со всем',
    viral_reel_ai_bot: 'Автоматизация выдержала рост',
    low_energy: 'Энергия заканчивается',
    zero_energy: 'Вы выгорели',
    budget_shortage: 'Бюджет почти закончился',
    capacity_reached: 'Продукт заполнен',
  };
  return titles[eventId] ?? 'Событие запуска';
}
