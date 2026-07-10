import { NextResponse } from 'next/server';
import { applyCommand, type GameCommand } from '@/packages/game-engine/src';
import { loadGameConfig } from '@/lib/config/game-config';
import { commandRequestSchema } from '@/lib/game/schemas';
import { getSession, saveSession } from '@/lib/game/store';
import { prisma } from '@/lib/db/client';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const session = await getSession(id);
  if (!session) return NextResponse.json({ error: 'session_not_found' }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = commandRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_command', issues: parsed.error.flatten() }, { status: 400 });
  }
  if (parsed.data.expectedVersion !== session.state.stateVersion) {
    return NextResponse.json({ error: 'version_conflict', state: session.state }, { status: 409 });
  }

  try {
    const config = loadGameConfig();
    const command = {
      commandId: parsed.data.commandId,
      type: parsed.data.type,
      payload: parsed.data.payload ?? {}
    } as GameCommand;
    session.state = applyCommand(session.state, config, command);
    await saveSession(session);
    
    // Save event for analytics
    await prisma.gameEvent.create({
      data: {
        sessionId: id,
        sequenceNumber: session.state.stateVersion,
        commandId: parsed.data.commandId,
        eventType: parsed.data.type,
        gameDay: session.state.resources.day,
        payload: parsed.data.payload ?? {},
        idempotencyKey: parsed.data.idempotencyKey ?? crypto.randomUUID(),
      }
    }).catch(e => {
      console.error('Failed to log event:', e);
    });
    
    return NextResponse.json({ state: session.state });
  } catch (error) {
    return NextResponse.json({ error: 'command_rejected', message: error instanceof Error ? error.message : 'unknown' }, { status: 400 });
  }
}
