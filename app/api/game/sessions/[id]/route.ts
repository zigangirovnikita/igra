import { NextResponse } from 'next/server';
import { getSession } from '@/lib/game/store';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const session = await getSession(id);
  
  if (!session) {
    return NextResponse.json({ error: 'session_not_found' }, { status: 404 });
  }

  return NextResponse.json({
    sessionId: session.id,
    configVersion: session.state.configVersion,
    seedFingerprint: session.state.seed.slice(0, 8),
    state: session.state,
    result: session.result
  });
}
