import { NextResponse } from 'next/server';
import { createInitialState } from '@/packages/game-engine/src';
import { loadGameConfig } from '@/lib/config/game-config';
import { saveSession } from '@/lib/game/store';
import { setupSchema } from '@/lib/game/schemas';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = setupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_setup', issues: parsed.error.flatten() }, { status: 400 });
  }

  const config = loadGameConfig();
  const seed = crypto.randomUUID();
  const state = createInitialState(parsed.data, config, seed);
  const now = new Date().toISOString();
  saveSession({
    id: state.sessionId,
    state,
    setup: parsed.data,
    result: null,
    createdAt: now,
    updatedAt: now
  });

  const response = NextResponse.json({
    sessionId: state.sessionId,
    configVersion: state.configVersion,
    seedFingerprint: state.seed.slice(0, 8),
    state
  });
  response.cookies.set('launch_game_session', state.sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24
  });
  return response;
}
