import { NextResponse } from 'next/server';
import { leadSchema } from '@/lib/game/schemas';
import { getSession, saveLead, type StoredLead } from '@/lib/game/store';
import { signPayload } from '@/lib/security/hmac';
import { globalRateLimiter } from '@/lib/api/rate-limit';
import { hasSessionAccess, sessionAccessDenied } from '@/lib/security/session-access';
import { prisma } from '@/lib/db/client';
import { deliverLeadToTelegram, isTelegramLeadDeliveryConfigured } from '@/lib/game/telegramLeadDelivery';

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anonymous';
  const limit = globalRateLimiter.check(ip);
  if (!limit.success) {
    return NextResponse.json(
      { error: 'rate_limit_exceeded' },
      { status: 429, headers: { 'Retry-After': Math.ceil((limit.reset - Date.now()) / 1000).toString() } },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_lead', issues: parsed.error.flatten() }, { status: 400 });
  }
  if (parsed.data.website) return NextResponse.json({ error: 'spam_rejected' }, { status: 400 });
  if (!hasSessionAccess(request, parsed.data.sessionId)) return sessionAccessDenied();

  const session = await getSession(parsed.data.sessionId);
  const canSubmitLead = session?.state.status === 'finished'
    || (session?.state.flow.stage === 'v4' && Boolean(session.state.v4.lastReport));
  if (!session || !canSubmitLead) {
    return NextResponse.json({ error: 'finished_session_required' }, { status: 409 });
  }

  const requestedId = request.headers.get('idempotency-key');
  const leadId = requestedId && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestedId)
    ? requestedId
    : crypto.randomUUID();
  const existing = await prisma.lead.findUnique({ where: { id: leadId } });
  if (existing?.deliveryStatus === 'delivered') {
    return NextResponse.json({ ok: true, leadId, idempotent: true });
  }

  const payload = {
    leadId,
    sessionId: parsed.data.sessionId,
    name: parsed.data.name,
    contact: parsed.data.contact,
    product: parsed.data.product,
    productPrice: parsed.data.productPrice,
    socialLink: parsed.data.socialLink || null,
    comment: parsed.data.comment || null,
    marketingConsent: Boolean(parsed.data.marketingConsent),
    result: session.result,
    metrics: session.state.metrics,
    launchPlan: session.state.launchPlan,
  };

  const lead: StoredLead = {
    id: leadId,
    sessionId: parsed.data.sessionId,
    status: 'pending',
    payload,
    attempts: existing?.deliveryAttempts ?? 0,
    lastError: null,
    createdAt: existing?.createdAt.toISOString() ?? new Date().toISOString(),
  };

  try {
    await saveLead(lead);
  } catch (error) {
    return NextResponse.json(
      { error: 'lead_storage_failed', message: error instanceof Error ? error.message : 'unknown' },
      { status: 500 },
    );
  }

  const webhookUrl = process.env.LEAD_WEBHOOK_URL;
  const webhookSecret = process.env.LEAD_WEBHOOK_SECRET;
  if (isTelegramLeadDeliveryConfigured()) {
    try {
      lead.attempts = 1;
      await deliverLeadToTelegram(payload);
      lead.status = 'delivered';
      await saveLead(lead);
      return NextResponse.json({ ok: true, leadId });
    } catch (error) {
      lead.status = 'delivery_failed';
      lead.lastError = error instanceof Error ? error.message : 'unknown';
      await saveLead(lead);
      return NextResponse.json({ error: 'telegram_delivery_failed', leadId }, { status: 502 });
    }
  }

  if (!webhookUrl || !webhookSecret) {
    lead.status = 'delivery_failed';
    lead.lastError = 'Telegram delivery or lead webhook is not configured';
    await saveLead(lead);
    return NextResponse.json({ error: 'lead_delivery_not_configured', leadId }, { status: 503 });
  }

  const serialized = JSON.stringify(payload);
  try {
    let lastStatus = 0;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      lead.attempts = attempt;
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Launch-Game-Signature': signPayload(serialized, webhookSecret),
          'Idempotency-Key': leadId,
        },
        body: serialized,
      });
      lastStatus = response.status;
      if (response.ok) break;
      if (response.status < 500 && response.status !== 429) throw new Error(`Webhook status ${response.status}`);
      await new Promise((resolve) => setTimeout(resolve, attempt * 250));
    }
    if (lastStatus < 200 || lastStatus >= 300) throw new Error(`Webhook status ${lastStatus}`);
    lead.status = 'delivered';
    await saveLead(lead);
    return NextResponse.json({ ok: true, leadId });
  } catch (error) {
    lead.status = 'delivery_failed';
    lead.lastError = error instanceof Error ? error.message : 'unknown';
    await saveLead(lead);
    return NextResponse.json({ error: 'webhook_delivery_failed', leadId }, { status: 502 });
  }
}
