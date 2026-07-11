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

export type CachedSessionPointer = {
  sessionId: string;
  schemaVersion: 2;
  expiresAt: number;
};

export function readCachedGame(): CachedSessionPointer | null {
  if (typeof localStorage === 'undefined') return null;
  const cached = localStorage.getItem('launch-game-cache');
  if (!cached) return null;
  try {
    const parsed = JSON.parse(cached);
    if (parsed.expiresAt < Date.now()) {
      localStorage.removeItem('launch-game-cache');
      return null;
    }

    if (parsed.schemaVersion !== 2 || typeof parsed.sessionId !== 'string') {
      localStorage.removeItem('launch-game-cache');
      return null;
    }
    return parsed as CachedSessionPointer;
  } catch {
    localStorage.removeItem('launch-game-cache');
    return null;
  }
}

export function cacheSessionPointer(sessionId: string): void {
  localStorage.setItem('launch-game-cache', JSON.stringify({
    sessionId,
    schemaVersion: 2,
    expiresAt: Date.now() + 86_400_000,
  } satisfies CachedSessionPointer));
}
