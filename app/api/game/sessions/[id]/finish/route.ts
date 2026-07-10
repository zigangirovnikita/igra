import { NextResponse } from 'next/server';
import { finishGame } from '@/packages/game-engine/src';
import { explainWithAi } from '@/lib/ai/report';
import { loadGameConfig } from '@/lib/config/game-config';
import { getSession, saveSession } from '@/lib/game/store';
import { prisma } from '@/lib/db/client';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const session = await getSession(id);
  if (!session) return NextResponse.json({ error: 'session_not_found' }, { status: 404 });

  const config = loadGameConfig();
  session.state = finishGame(session.state, config);
  if (!session.state.diagnostics) {
    return NextResponse.json({ error: 'missing_diagnostics' }, { status: 500 });
  }
  session.result = session.state.diagnostics;
  await saveSession(session);
  
  await prisma.gameSession.update({
    where: { id },
    data: { 
      status: 'finished',
      finishedAt: new Date()
    }
  });

  await prisma.gameResult.upsert({
    where: { sessionId: id },
    update: {
      metrics: session.state.metrics as any,
      targets: session.state.targets as any,
      financials: session.state.diagnostics.financials as any,
      strongDecisions: session.state.diagnostics.strongDecisions as any,
      bottlenecks: session.state.diagnostics.bottlenecks as any,
      counterfactuals: session.state.diagnostics.counterfactuals as any,
      finalStatus: session.state.diagnostics.finalStatus,
    },
    create: {
      sessionId: id,
      configVersion: session.state.configVersion,
      metrics: session.state.metrics as any,
      targets: session.state.targets as any,
      financials: session.state.diagnostics.financials as any,
      strongDecisions: session.state.diagnostics.strongDecisions as any,
      bottlenecks: session.state.diagnostics.bottlenecks as any,
      counterfactuals: session.state.diagnostics.counterfactuals as any,
      finalStatus: session.state.diagnostics.finalStatus,
    }
  });

  const report = await explainWithAi(session.state, session.state.diagnostics);
  return NextResponse.json({
    state: session.state,
    diagnostics: session.state.diagnostics,
    report: report.report,
    reportSource: report.source
  });
}
