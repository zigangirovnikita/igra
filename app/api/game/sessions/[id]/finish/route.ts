/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { finishGame } from '@/packages/game-engine/src';
import { explainWithAi } from '@/lib/ai/report';
import { loadGameConfig } from '@/lib/config/game-config';
import { getSession } from '@/lib/game/store';
import { prisma } from '@/lib/db/client';
import { globalRateLimiter } from '@/lib/api/rate-limit';
import { hasSessionAccess, sessionAccessDenied } from '@/lib/security/session-access';
import { buildReplayCounterfactuals } from '@/lib/game/counterfactual-replay';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anonymous';
  const limit = globalRateLimiter.check(ip);
  if (!limit.success) {
    return NextResponse.json(
      { error: 'rate_limit_exceeded' },
      { status: 429, headers: { 'Retry-After': Math.ceil((limit.reset - Date.now()) / 1000).toString() } },
    );
  }

  const { id } = await context.params;
  if (!hasSessionAccess(request, id)) return sessionAccessDenied();

  const body = await request.json().catch(() => ({}));
  const session = await getSession(id);
  if (!session) return NextResponse.json({ error: 'session_not_found' }, { status: 404 });

  const expectedVersion = typeof body.expectedVersion === 'number' ? body.expectedVersion : session.state.stateVersion;
  if (expectedVersion !== session.state.stateVersion) {
    return NextResponse.json({ error: 'version_conflict', state: session.state }, { status: 409 });
  }

  const config = loadGameConfig();
  let finalState = session.state;

  if (finalState.status !== 'finished') {
    finalState = finishGame(finalState, config);
    finalState.stateVersion = expectedVersion + 1;
    if (!finalState.diagnostics) return NextResponse.json({ error: 'missing_diagnostics' }, { status: 500 });
    finalState.diagnostics.counterfactuals = buildReplayCounterfactuals(session.state, config);

    try {
      await prisma.$transaction(async (transaction) => {
        const updated = await transaction.gameSession.updateMany({
          where: { id, stateVersion: expectedVersion },
          data: {
            status: 'finished',
            stateVersion: finalState.stateVersion,
            currentState: finalState as any,
            finishedAt: new Date(),
            updatedAt: new Date(),
          },
        });
        if (updated.count !== 1) throw new VersionConflictError();

        const diagnostics = finalState.diagnostics!;
        await transaction.gameResult.upsert({
          where: { sessionId: id },
          update: resultData(finalState, diagnostics),
          create: {
            sessionId: id,
            configVersion: finalState.configVersion,
            ...resultData(finalState, diagnostics),
          },
        });
      });
    } catch (error) {
      if (error instanceof VersionConflictError) {
        const current = await getSession(id);
        return NextResponse.json({ error: 'version_conflict', state: current?.state }, { status: 409 });
      }
      throw error;
    }
  }

  if (!finalState.diagnostics) return NextResponse.json({ error: 'missing_diagnostics' }, { status: 500 });

  const existingReport = await prisma.aiReport.findFirst({
    where: { sessionId: id, status: 'completed' },
    orderBy: { createdAt: 'desc' },
  });
  if (existingReport?.report) {
    return NextResponse.json({
      state: finalState,
      diagnostics: finalState.diagnostics,
      report: existingReport.report,
      reportSource: existingReport.provider === 'openai' ? 'ai' : 'fallback',
    });
  }

  const startedAt = Date.now();
  const generated = await explainWithAi(finalState, finalState.diagnostics);
  await prisma.aiReport.create({
    data: {
      sessionId: id,
      provider: generated.source === 'ai' ? 'openai' : 'fallback',
      model: generated.source === 'ai' ? (process.env.OPENAI_REPORT_MODEL ?? 'unknown') : 'deterministic-fallback',
      promptVersion: 'launch-report-v1',
      status: 'completed',
      report: generated.report as any,
      latencyMs: Date.now() - startedAt,
    },
  });

  return NextResponse.json({
    state: finalState,
    diagnostics: finalState.diagnostics,
    report: generated.report,
    reportSource: generated.source,
  });
}

function resultData(state: Awaited<ReturnType<typeof finishGame>>, diagnostics: NonNullable<typeof state.diagnostics>) {
  return {
    metrics: state.metrics as any,
    targets: state.targets as any,
    financials: diagnostics.financials as any,
    strongDecisions: diagnostics.strongDecisions as any,
    bottlenecks: diagnostics.bottlenecks as any,
    counterfactuals: diagnostics.counterfactuals as any,
    finalStatus: diagnostics.finalStatus,
    diagnostics: diagnostics as any,
    endingReason: state.endingReason,
  };
}

class VersionConflictError extends Error {}
