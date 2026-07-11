import type { GameState, MiniGameSession, MiniGameMessage, MiniGameMessageKind } from '../types';
import { stochasticRound } from '../random/keyed';

export function generateMiniGameSession(state: GameState, cohortId: string): MiniGameSession {
  const cohort = state.cohorts.find(c => c.id === cohortId);
  if (!cohort) throw new Error('Cohort not found');

  const count = Math.min(5, Math.max(3, stochasticRound(cohort.unprocessedInbound * 0.5, `${state.seed}|${cohort.id}|mg_count`)));
  
  const messages: MiniGameMessage[] = [];

  for (let i = 0; i < count; i++) {
    const r = stochasticRound(100, `${state.seed}|${cohort.id}|mg_msg_${i}`);
    let kind: MiniGameMessageKind = 'price_question';
    if (r < 20) kind = 'price_question';
    else if (r < 40) kind = 'program_question';
    else if (r < 55) kind = 'doubt';
    else if (r < 70) kind = 'installment_question';
    else if (r < 80) kind = 'irrelevant';
    else if (r < 85) kind = 'unusual';
    else if (r < 95) kind = 'call_ready';
    else kind = 'payment_ready';

    let qualityWeight = 1;
    let applicationModifier = 1.0;
    let saleModifier = 1.0;

    if (kind === 'payment_ready' || kind === 'call_ready') {
      qualityWeight = 2;
      applicationModifier = 2.0;
      saleModifier = 1.5;
    } else if (kind === 'irrelevant' || kind === 'unusual') {
      qualityWeight = 0;
      applicationModifier = 0.0;
    } else {
      qualityWeight = 1;
      applicationModifier = 1.2;
    }

    messages.push({
      id: `mg_msg_${i}`,
      kind,
      text: `Message ${i}`,
      qualityWeight,
      applicationModifier,
      saleModifier,
      displayOrder: i
    });
  }

  return {
    id: `mg_${cohort.id}_${state.resources.day}`,
    cohortId,
    startedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60 * 1000).toISOString(),
    durationSeconds: 60,
    messages,
    status: 'active'
  };
}
