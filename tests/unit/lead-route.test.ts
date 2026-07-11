import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ saveLead: vi.fn(async (lead) => lead), getSession: vi.fn() }));
vi.mock('@/lib/game/store', () => mocks);

describe('lead webhook delivery', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.saveLead.mockImplementation(async (lead) => lead);
    process.env.LEAD_WEBHOOK_URL = 'https://webhook.test/lead';
    process.env.LEAD_WEBHOOK_SECRET = 'secret';
    mocks.getSession.mockResolvedValue({ state: { status: 'finished', metrics: {}, player: { superpowers: [] } }, result: {} });
  });

  it('retries temporary webhook failures up to three attempts', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);
    const { POST } = await import('../../app/api/leads/route');
    const response = await POST(new Request('http://localhost/api/leads', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
      sessionId: crypto.randomUUID(), name: 'Марина', contact: '@marina', product: 'Курс', productPrice: 30000, privacyConsent: true, marketingConsent: false, website: '',
    }) }));
    expect(response.status).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(mocks.saveLead).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'delivery_failed', attempts: 3 }));
  });
});
