import type { SetupDraft } from './setupCopy';
import type { PlayerProfile } from '@/packages/game-engine/src';

export function draftToSetupInput(draft: SetupDraft): PlayerProfile {
  return {
    avatarGender: draft.gender,
    name: draft.name,
    niche: draft.niche,
  };
}

// Keep commandId here if it's used
export function commandId(actionId: string): string {
  return `${actionId}_${Date.now()}`;
}

export function readCachedGame() {
  if (typeof localStorage === 'undefined') return null;
  const cached = localStorage.getItem('launch-game-cache');
  if (!cached) return null;
  try {
    const parsed = JSON.parse(cached);
    if (parsed.expiresAt < Date.now()) {
      localStorage.removeItem('launch-game-cache');
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
