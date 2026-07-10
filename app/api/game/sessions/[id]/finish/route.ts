import { NextResponse } from 'next/server';
import { finishGame } from '@/packages/game-engine/src';
import { explainWithAi } from '@/lib/ai/report';
import { loadGameConfig } from '@/lib/config/game-config';
import { getSession, saveSession } from '@/lib/game/store';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const session = getSession(id);
  if (!session) return NextResponse.json({ error: 'session_not_found' }, { status: 404 });

  const config = loadGameConfig();
  session.state = finishGame(session.state, config);
  if (!session.state.diagnostics) {
    return NextResponse.json({ error: 'missing_diagnostics' }, { status: 500 });
  }
  session.result = session.state.diagnostics;
  saveSession(session);

  const report = await explainWithAi(session.state, session.state.diagnostics);
  return NextResponse.json({
    state: session.state,
    diagnostics: session.state.diagnostics,
    report: report.report,
    reportSource: report.source
  });
}
