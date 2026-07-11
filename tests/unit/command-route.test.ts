import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../../packages/game-engine/src';
import { loadGameConfig } from '../../lib/config/game-config';
import { scenarios } from '../fixtures/scenarios';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  updateMany: vi.fn(),
  createEvent: vi.fn(),
}));

vi.mock('@/lib/game/store', () => ({ getSession: mocks.getSession }));
vi.mock('@/lib/db/client', () => ({
  prisma: {
    $transaction: vi.fn(async (callback: (transaction: unknown) => Promise<unknown>) => callback({
      gameSession: { updateMany: mocks.updateMany },
      gameEvent: { create: mocks.createEvent },
    })),
  },
}));

const config = loadGameConfig();

describe('command API concurrency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.createEvent.mockResolvedValue({});
  });

  it('returns canonical state on optimistic version conflict', async () => {
    const state = createInitialState(scenarios[0].setup, config, crypto.randomUUID());
    mocks.getSession.mockResolvedValue({ id: state.sessionId, state, setup: state.player });
    const { POST } = await import('../../app/api/game/sessions/[id]/commands/route');
    const response = await POST(
      new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ commandId: 'late', expectedVersion: 99, type: 'advance_intro', payload: {} }),
      }),
      { params: Promise.resolve({ id: state.sessionId }) },
    );
    expect(response.status).toBe(409);
    expect((await response.json()).state.stateVersion).toBe(0);
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it('applies an idempotent command only once', async () => {
    const state = createInitialState(scenarios[0].setup, config, crypto.randomUUID());
    const session = { id: state.sessionId, state, setup: state.player };
    mocks.getSession.mockImplementation(async () => session);
    const { POST } = await import('../../app/api/game/sessions/[id]/commands/route');
    const body = { commandId: 'same', expectedVersion: 0, type: 'advance_intro', payload: {} };

    const response = await POST(
      new Request('http://localhost', { method: 'POST', body: JSON.stringify(body) }),
      { params: Promise.resolve({ id: state.sessionId }) },
    );
    expect(response.status).toBe(200);
    const firstState = (await response.json()).state;
    expect(firstState.appliedCommandIds).toEqual(['same']);
    expect(mocks.updateMany).toHaveBeenCalledTimes(1);

    session.state = firstState;
    const duplicate = await POST(
      new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ ...body, expectedVersion: firstState.stateVersion }),
      }),
      { params: Promise.resolve({ id: state.sessionId }) },
    );
    expect(duplicate.status).toBe(200);
    expect((await duplicate.json()).idempotent).toBe(true);
    expect(mocks.updateMany).toHaveBeenCalledTimes(1);
  });

  it('accepts advance_daily_intro through the HTTP schema', async () => {
    const state = createInitialState(scenarios[0].setup, config, crypto.randomUUID());
    state.flow.stage = 'daily';
    state.flow.step = 'daily_intro';
    state.resources.day = 3;
    mocks.getSession.mockResolvedValue({ id: state.sessionId, state, setup: state.player });
    const { POST } = await import('../../app/api/game/sessions/[id]/commands/route');
    const response = await POST(
      new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ commandId: 'day3', expectedVersion: 0, type: 'advance_daily_intro', payload: {} }),
      }),
      { params: Promise.resolve({ id: state.sessionId }) },
    );
    expect(response.status).toBe(200);
    expect((await response.json()).state.flow.step).toBe('daily_intent');
  });
});
