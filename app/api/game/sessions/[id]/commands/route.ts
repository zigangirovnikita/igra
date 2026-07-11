/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { applyCommand, type GameCommand } from '@/packages/game-engine/src';
import { loadGameConfig } from '@/lib/config/game-config';
import { commandRequestSchema } from '@/lib/game/schemas';
import { getSession } from '@/lib/game/store';
import { prisma } from '@/lib/db/client';
import { globalRateLimiter } from '@/lib/api/rate-limit';
import { hasSessionAccess, sessionAccessDenied } from '@/lib/security/session-access';

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
  if (session.state.appliedCommandIds.includes(parsed.data.commandId)) {
    return NextResponse.json({ state: session.state, idempotent: true });
  }

  try {
    const config = loadGameConfig();
    const command = {
      commandId: parsed.data.commandId,
      type: parsed.data.type,
      payload: parsed.data.payload ?? {},
    } as GameCommand;
    const nextState = applyCommand(session.state, config, command);

    await prisma.$transaction(async (transaction) => {
      const updated = await transaction.gameSession.updateMany({
        where: { id, stateVersion: parsed.data.expectedVersion },
        data: {
          stateVersion: nextState.stateVersion,
          currentState: nextState as any,
          status: nextState.status,
          lastEventAt: new Date(),
          updatedAt: new Date(),
        },
      });
      if (updated.count !== 1) throw new VersionConflictError();

      await transaction.gameEvent.create({
        data: {
          sessionId: id,
          sequenceNumber: nextState.stateVersion,
          commandId: parsed.data.commandId,
          eventType: parsed.data.type,
          gameDay: nextState.resources.day,
          payload: (parsed.data.payload ?? {}) as any,
          idempotencyKey: parsed.data.idempotencyKey ?? parsed.data.commandId,
        },
      });
    });

    return NextResponse.json({ state: nextState });
  } catch (error) {
    if (error instanceof VersionConflictError) {
      const current = await getSession(id);
      return NextResponse.json({ error: 'version_conflict', state: current?.state }, { status: 409 });
    }
    return NextResponse.json(
      { error: 'command_rejected', message: error instanceof Error ? error.message : 'unknown' },
      { status: 400 },
    );
  }
}

class VersionConflictError extends Error {}
