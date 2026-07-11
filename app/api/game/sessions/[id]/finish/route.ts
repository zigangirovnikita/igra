/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { finishGame } from '@/packages/game-engine/src';
import { explainWithAi } from '@/lib/ai/report';
import { loadGameConfig } from '@/lib/config/game-config';
import { getSession, saveSession } from '@/lib/game/store';
import { prisma } from '@/lib/db/client';
import { globalRateLimiter } from '@/lib/api/rate-limit';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const ip = _request.headers.get('x-forwarded-for') ?? 'anonymous';
  const limit = globalRateLimiter.check(ip);
  if (!limit.success) {
    return NextResponse.json({ error: 'rate_limit_exceeded' }, { status: 429, headers: { 'Retry-After': Math.ceil((limit.reset - Date.now()) / 1000).toString() } });
  }

  const { id } = await context.params;
  const body = await _request.json().catch(() => ({}));

  const session = await getSession(id);
  if (!session) return NextResponse.json({ error: 'session_not_found' }, { status: 404 });
  if (typeof body.expectedVersion === 'number' && body.expectedVersion !== session.state.stateVersion) {
    return NextResponse.json({ error: 'version_conflict', state: session.state }, { status: 409 });
  }

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
