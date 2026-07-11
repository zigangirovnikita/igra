/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { finishGame } from '@/packages/game-engine/src';
import { explainWithAi } from '@/lib/ai/report';
import { loadGameConfig } from '@/lib/config/game-config';
import { getSession, saveSession } from '@/lib/game/store';
import { prisma } from '@/lib/db/client';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = await _request.json().catch(() => ({}));

  const session = await getSession(id);
  if (!session) return NextResponse.json({ error: 'session_not_found' }, { status: 404 });

  if (session.state.status === 'finished') {
    // Already finished, but we might be submitting the lead form if they had final_reason
    // Or we just return the current state
  }

  const config = loadGameConfig();

  // if not finished, finish it
  if (session.state.status !== 'finished') {
    session.state = finishGame(session.state, config);
    if (!session.state.diagnostics) {
      return NextResponse.json({ error: 'missing_diagnostics' }, { status: 500 });
    }
    session.result = session.state.diagnostics;
  }

  if (body.lead) {
    const { leadSchema } = await import('@/lib/game/schemas');
    const parsed = leadSchema.safeParse({ ...body.lead, sessionId: id, privacyConsent: body.lead.privacyConsent === 'on' });
    if (parsed.success) {
      await prisma.lead.create({
        data: {
          sessionId: id,
          name: parsed.data.name,
          contactEncrypted: parsed.data.contact,
          product: parsed.data.product,
          productPrice: parsed.data.productPrice,
          socialLink: parsed.data.socialLink,
          comment: parsed.data.comment,
          privacyConsentAt: new Date(),
          marketingConsentAt: parsed.data.marketingConsent ? new Date() : null,
          deliveryStatus: 'pending'
        }
      });
    }
  }

  await saveSession(session);

  await prisma.gameSession.update({
    where: { id },
    data: {
      status: 'finished',
      finishedAt: new Date()
    }
  });

  if (!session.state.diagnostics) {
    return NextResponse.json({ error: 'missing_diagnostics' }, { status: 500 });
  }

  const diagnostics = session.state.diagnostics;

  await prisma.gameResult.upsert({
    where: { sessionId: id },
    update: {
      metrics: session.state.metrics as any,
      targets: session.state.targets as any,
      financials: diagnostics.financials as any,
      strongDecisions: diagnostics.strongDecisions as any,
      bottlenecks: diagnostics.bottlenecks as any,
      counterfactuals: diagnostics.counterfactuals as any,
      finalStatus: diagnostics.finalStatus,
      diagnostics: diagnostics as any,
      endingReason: session.state.endingReason,
    },
    create: {
      sessionId: id,
      configVersion: session.state.configVersion,
      metrics: session.state.metrics as any,
      targets: session.state.targets as any,
      financials: diagnostics.financials as any,
      strongDecisions: diagnostics.strongDecisions as any,
      bottlenecks: diagnostics.bottlenecks as any,
      counterfactuals: diagnostics.counterfactuals as any,
      finalStatus: diagnostics.finalStatus,
      diagnostics: diagnostics as any,
      endingReason: session.state.endingReason,
    }
  });

  const report = await explainWithAi(session.state, diagnostics);
  return NextResponse.json({
    state: session.state,
    diagnostics: diagnostics,
    report: report.report,
    reportSource: report.source
  });
}
