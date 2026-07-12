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
  const lostLeadsDelta = Number(pending.payload?.lostLeadsDelta ?? 0);
  const paragraphs = templateId === 'inbound_lost' && lostLeadsDelta > 0
    ? [`На этом этапе ${lostLeadsDelta} ${formatContacts(lostLeadsDelta)} не дошли до следующего шага.`, 'Проверьте вход, прогрев и обработку: потеря может возникнуть в любом из этих звеньев.']
    : template?.messages?.length ? template.messages : [pending.message];

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

function formatContacts(count: number): string {
  const lastTwo = count % 100;
  if (lastTwo >= 11 && lastTwo <= 14) return 'контактов';
  const last = count % 10;
  if (last === 1) return 'контакт';
  if (last >= 2 && last <= 4) return 'контакта';
  return 'контактов';
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
