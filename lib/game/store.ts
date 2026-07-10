import type { Diagnostics, GameState, SetupInput } from '@/packages/game-engine/src';

export type StoredSession = {
  id: string;
  state: GameState;
  setup: SetupInput;
  result: Diagnostics | null;
  createdAt: string;
  updatedAt: string;
};

export type StoredLead = {
  id: string;
  sessionId: string;
  status: 'pending' | 'delivered' | 'delivery_failed';
  payload: Record<string, unknown>;
  attempts: number;
  lastError: string | null;
  createdAt: string;
};

type Store = {
  sessions: Map<string, StoredSession>;
  leads: Map<string, StoredLead>;
};

const globalStore = globalThis as typeof globalThis & { launchGameStore?: Store };

export function getStore(): Store {
  globalStore.launchGameStore ??= {
    sessions: new Map<string, StoredSession>(),
    leads: new Map<string, StoredLead>()
  };
  return globalStore.launchGameStore;
}

export function saveSession(session: StoredSession): StoredSession {
  session.updatedAt = new Date().toISOString();
  getStore().sessions.set(session.id, session);
  return session;
}

export function getSession(id: string): StoredSession | null {
  return getStore().sessions.get(id) ?? null;
}

export function saveLead(lead: StoredLead): StoredLead {
  getStore().leads.set(lead.id, lead);
  return lead;
}
