import type { GameState, MiniGameMessage, MiniGameMessageKind, MiniGameSession } from '../types';
import { stochasticRound } from '../random/keyed';

const MESSAGE_TEXTS: Record<MiniGameMessageKind, string[]> = {
  payment_ready: [
    'Куда оплатить? Я готова начать.',
    'Можно ссылку на оплату?',
    'Хочу купить сегодня. Что делать дальше?',
  ],
  price_question: [
    'Сколько стоит участие?',
    'Подскажите цену, пожалуйста.',
    'Какая стоимость вашей программы?',
  ],
  program_question: [
    'А что именно входит в программу?',
    'Сколько длится обучение?',
    'Будет ли обратная связь?',
  ],
  doubt: [
    'Не уверена, что у меня получится.',
    'А если я совсем новичок?',
    'Мне нужно подумать. Есть гарантии?',
  ],
  installment_question: [
    'Можно оплатить частями?',
    'Есть рассрочка?',
    'Можно разбить платёж на два месяца?',
  ],
  irrelevant: [
    'А вы делаете расклад на отношения?',
    'Можно просто задать один бесплатный вопрос?',
    'Подпишитесь на мой аккаунт, пожалуйста.',
  ],
  unusual: [
    'А можно оплатить после результата?',
    'Сделаете индивидуальную программу за один день?',
    'Можно вместо оплаты сделать вам рекламу?',
  ],
  call_ready: [
    'Готова созвониться сегодня после 18:00.',
    'Можно записаться на консультацию?',
    'Давайте короткий созвон, хочу уточнить детали.',
  ],
};

export function generateMiniGameSession(state: GameState, cohortId: string): MiniGameSession {
  const cohort = state.cohorts.find((candidate) => candidate.id === cohortId);
  if (!cohort) throw new Error('Cohort not found');
  if (cohort.unprocessedInbound < 30) throw new Error('Mini-game requires at least 30 inbound messages');

  const count = Math.min(80, Math.floor(cohort.unprocessedInbound));
  const messages: MiniGameMessage[] = [];

  for (let index = 0; index < count; index += 1) {
    const roll = stochasticRound(100, `${state.seed}|${cohort.id}|mini_game_kind|${index}`);
    const kind = kindForRoll(roll);
    const variants = MESSAGE_TEXTS[kind];
    const variantRoll = stochasticRound(variants.length * 100, `${state.seed}|${cohort.id}|mini_game_text|${index}`);
    const text = variants[Math.abs(variantRoll) % variants.length];
    const valuable = kind === 'payment_ready' || kind === 'call_ready';
    const irrelevant = kind === 'irrelevant' || kind === 'unusual';

    messages.push({
      id: `mg_${cohort.id}_${state.resources.day}_${index}`,
      kind,
      text,
      qualityWeight: valuable ? 2 : irrelevant ? 0 : 1,
      applicationModifier: valuable ? 2 : irrelevant ? 0 : 1.2,
      saleModifier: valuable ? 1.5 : 1,
      displayOrder: index,
    });
  }

  const startedAt = new Date();
  return {
    id: `mg_${cohort.id}_${state.resources.day}_${state.metrics.miniGameCount + 1}`,
    cohortId,
    startedAt: startedAt.toISOString(),
    expiresAt: new Date(startedAt.getTime() + 60_000).toISOString(),
    durationSeconds: 60,
    messages,
    status: 'active',
  };
}

function kindForRoll(roll: number): MiniGameMessageKind {
  if (roll < 18) return 'price_question';
  if (roll < 36) return 'program_question';
  if (roll < 52) return 'doubt';
  if (roll < 66) return 'installment_question';
  if (roll < 76) return 'irrelevant';
  if (roll < 84) return 'unusual';
  if (roll < 94) return 'call_ready';
  return 'payment_ready';
}
