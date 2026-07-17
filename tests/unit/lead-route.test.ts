import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  saveLead: vi.fn(async (lead) => lead),
  getSession: vi.fn(),
  findLead: vi.fn(),
}));

vi.mock('@/lib/game/store', () => ({ saveLead: mocks.saveLead, getSession: mocks.getSession }));
vi.mock('@/lib/db/client', () => ({ prisma: { lead: { findUnique: mocks.findLead } } }));

describe('lead webhook delivery', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.saveLead.mockImplementation(async (lead) => lead);
    mocks.findLead.mockResolvedValue(null);
    process.env.LEAD_WEBHOOK_URL = 'https://example.invalid/lead';
    process.env.LEAD_WEBHOOK_SECRET = 'secret';
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    mocks.getSession.mockResolvedValue({ state: { status: 'finished', metrics: {}, launchPlan: {} }, result: {} });
  });

  it('retries temporary webhook failures up to three attempts', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);
    const { POST } = await import('../../app/api/leads/route');
    const response = await POST(new Request('http://localhost/api/leads', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId: crypto.randomUUID(),
        name: 'Марина',
        contact: '@marina',
        product: 'Курс',
        productPrice: 30000,
        privacyConsent: true,
        marketingConsent: false,
        website: '',
      }),
    }));
    expect(response.status).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(mocks.saveLead).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'delivery_failed', attempts: 3 }));
  });

  it('sends delivered leads to Telegram when Telegram delivery is configured', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'test-token';
    process.env.TELEGRAM_CHAT_ID = 'test-chat-id';
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { POST } = await import('../../app/api/leads/route');
    const sessionId = crypto.randomUUID();
    const response = await POST(new Request('http://localhost/api/leads', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        name: 'Марина',
        contact: '@marina',
        product: 'Психолог',
        productPrice: 30000,
        socialLink: '@marina_psy',
        comment: 'Хочу понять рекламу',
        privacyConsent: true,
        marketingConsent: false,
        website: '',
      }),
    }));

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.telegram.org/bottest-token/sendMessage',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('Новая заявка на бесплатный разбор'),
      }),
    );
    expect(mocks.saveLead).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'delivered', attempts: 1 }));
  });
});
