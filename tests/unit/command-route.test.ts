import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../../packages/game-engine/src';
import { loadGameConfig } from '../../lib/config/game-config';
import { scenarios } from '../fixtures/scenarios';

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), saveSession: vi.fn(async (session) => session), createEvent: vi.fn() }));
vi.mock('@/lib/game/store', () => ({ getSession: mocks.getSession, saveSession: mocks.saveSession }));
vi.mock('@/lib/db/client', () => ({ prisma: { gameEvent: { create: mocks.createEvent } } }));

const config = loadGameConfig();

describe('command API concurrency', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.createEvent.mockResolvedValue({}); });

  it('returns canonical state on optimistic version conflict', async () => {
    const state = createInitialState(scenarios[0].setup, config, crypto.randomUUID());
    mocks.getSession.mockResolvedValue({ id: state.sessionId, state, setup: state.player });
    const { POST } = await import('../../app/api/game/sessions/[id]/commands/route');
    const response = await POST(new Request('http://localhost', { method: 'POST', body: JSON.stringify({ commandId: 'late', expectedVersion: 99, type: 'advance_intro', payload: {} }) }), { params: Promise.resolve({ id: state.sessionId }) });
    expect(response.status).toBe(409);
    expect((await response.json()).state.stateVersion).toBe(0);
    expect(mocks.saveSession).not.toHaveBeenCalled();
  });

  it('applies an idempotent command only once', async () => {
    const state = createInitialState(scenarios[0].setup, config, crypto.randomUUID());
    const session = { id: state.sessionId, state, setup: state.player };
    mocks.getSession.mockResolvedValue(session);
    const { POST } = await import('../../app/api/game/sessions/[id]/commands/route');
    const body = { commandId: 'same', expectedVersion: 0, type: 'advance_intro', payload: {} };
    const response = await POST(new Request('http://localhost', { method: 'POST', body: JSON.stringify(body) }), { params: Promise.resolve({ id: state.sessionId }) });
    expect(response.status).toBe(200);
    expect(session.state.appliedCommandIds).toEqual(['same']);
    const version = session.state.stateVersion;
    const duplicate = await POST(new Request('http://localhost', { method: 'POST', body: JSON.stringify({ ...body, expectedVersion: version }) }), { params: Promise.resolve({ id: state.sessionId }) });
    expect(duplicate.status).toBe(200);
    expect(session.state.stateVersion).toBe(version);
  });

  it('accepts advance_daily_intro through the HTTP schema', async () => {
    const state = createInitialState(scenarios[0].setup, config, crypto.randomUUID());
    state.flow.stage = 'daily';
    state.flow.step = 'daily_intro';
    state.resources.day = 3;
    const session = { id: state.sessionId, state, setup: state.player };
    mocks.getSession.mockResolvedValue(session);
    const { POST } = await import('../../app/api/game/sessions/[id]/commands/route');
    const response = await POST(new Request('http://localhost', { method: 'POST', body: JSON.stringify({
      commandId: 'day3', expectedVersion: 0, type: 'advance_daily_intro', payload: {},
    }) }), { params: Promise.resolve({ id: state.sessionId }) });
    expect(response.status).toBe(200);
    expect(session.state.flow.step).toBe('daily_intent');
  });
});
