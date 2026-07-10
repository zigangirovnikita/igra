import { NextResponse } from 'next/server';
import { leadSchema } from '@/lib/game/schemas';
import { getSession, saveLead } from '@/lib/game/store';
import { signPayload } from '@/lib/security/hmac';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_lead', issues: parsed.error.flatten() }, { status: 400 });
  }
  if (parsed.data.website) {
    return NextResponse.json({ error: 'spam_rejected' }, { status: 400 });
  }

  const session = getSession(parsed.data.sessionId);
  if (!session || session.state.status !== 'finished') {
    return NextResponse.json({ error: 'finished_session_required' }, { status: 409 });
  }

  const leadId = crypto.randomUUID();
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
    superpowers: session.state.player.superpowers
  };
  const lead = saveLead({
    id: leadId,
    sessionId: parsed.data.sessionId,
    status: 'pending',
    payload,
    attempts: 0,
    lastError: null,
    createdAt: new Date().toISOString()
  });

  const webhookUrl = process.env.LEAD_WEBHOOK_URL;
  const webhookSecret = process.env.LEAD_WEBHOOK_SECRET;
  if (!webhookUrl || !webhookSecret) {
    lead.status = 'delivery_failed';
    lead.lastError = 'LEAD_WEBHOOK_URL or LEAD_WEBHOOK_SECRET is not configured';
    saveLead(lead);
    return NextResponse.json({ error: 'webhook_not_configured', leadId }, { status: 503 });
  }

  const serialized = JSON.stringify(payload);
  try {
    lead.attempts += 1;
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Launch-Game-Signature': signPayload(serialized, webhookSecret)
      },
      body: serialized
    });
    if (!response.ok) throw new Error(`Webhook status ${response.status}`);
    lead.status = 'delivered';
    saveLead(lead);
    return NextResponse.json({ ok: true, leadId });
  } catch (error) {
    lead.status = 'delivery_failed';
    lead.lastError = error instanceof Error ? error.message : 'unknown';
    saveLead(lead);
    return NextResponse.json({ error: 'webhook_delivery_failed', leadId }, { status: 502 });
  }
}
