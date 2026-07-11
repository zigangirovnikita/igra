import type { GameState, SetupInput } from '@/packages/game-engine/src';
import type { SetupDraft } from './types';

export const commandId = (prefix: string) => `${prefix}-${Date.now()}`;

export function draftToSetupInput(draft: SetupDraft): SetupInput {
  const instagram = !['telegram', 'contacts', 'none'].includes(draft.channelMode);
  const telegram = ['telegram', 'instagram_telegram'].includes(draft.channelMode);
  return { avatarGender: draft.gender, name: draft.name, niche: draft.niche, productName: draft.productName, superpowers: draft.superpowers,
    productType: draft.productType, productPrice: draft.productPrice, averageReelViews: instagram ? draft.averageReelViews : 0,
    averageStoryViews: instagram ? draft.averageStoryViews : 0, telegramStatus: telegram ? 'known' : 'none',
    averageTelegramViews: telegram ? draft.averageTelegramViews : 0, dreams: draft.dreams };
}

export function readCachedGame(): { expiresAt: number; state: GameState } | null {
  const raw = localStorage.getItem('launch-game-cache');
  if (!raw) return null;
  try {
    const cached = JSON.parse(raw) as { expiresAt: number; state: GameState };
    if (cached.expiresAt > Date.now() && cached.state.status !== 'finished') return cached;
  } catch { /* remove malformed cache below */ }
  localStorage.removeItem('launch-game-cache');
  return null;
}
