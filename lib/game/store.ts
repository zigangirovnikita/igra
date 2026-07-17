/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Diagnostics, GameState, SetupInput } from '@/packages/game-engine/src';
import { prisma } from '../db/client';
import { encryptField } from '../security/encryption';

export type StoredSession = {
  id: string;
  state: GameState;
  setup: SetupInput;
  result: Diagnostics | null;
  createdAt: string;
  updatedAt: string;
};

export type StoredLead = {
  id: string;
  sessionId: string;
  status: 'pending' | 'delivered' | 'delivery_failed';
  payload: Record<string, unknown>;
  attempts: number;
  lastError: string | null;
  createdAt: string;
};

export async function saveSession(session: StoredSession): Promise<StoredSession> {
  const updatedDate = new Date();

  if (session.state.stateVersion === 0) {
    await prisma.gameSession.create({
      data: {
        id: session.id,
        anonymousId: session.id,
        status: session.state.status,
        configVersion: session.state.configVersion,
        seedEncrypted: null,
        stateVersion: session.state.stateVersion,
        setup: session.setup as any,
        currentState: session.state as any,
        createdAt: new Date(session.createdAt),
        updatedAt: updatedDate,
      },
    });
  } else {
    const result = await prisma.gameSession.updateMany({
      where: {
        id: session.id,
        stateVersion: session.state.stateVersion - 1,
      },
      data: {
        stateVersion: session.state.stateVersion,
        currentState: session.state as any,
        updatedAt: updatedDate,
        status: session.state.status,
      },
    });
    if (result.count === 0) throw new Error('Optimistic concurrency error: session version mismatch');
  }

  session.updatedAt = updatedDate.toISOString();
  return session;
}

export async function getSession(id: string): Promise<StoredSession | null> {
  const record = await prisma.gameSession.findUnique({ where: { id } });
  if (!record) return null;

  let result: Diagnostics | null = null;
  const resultRecord = await prisma.gameResult.findUnique({ where: { sessionId: id } });
  if (resultRecord) {
    result = resultRecord.diagnostics ? resultRecord.diagnostics as unknown as Diagnostics : {
      finalStatus: resultRecord.finalStatus,
      financials: resultRecord.financials as any,
      strongDecisions: resultRecord.strongDecisions as any,
      bottlenecks: resultRecord.bottlenecks as any,
      counterfactuals: resultRecord.counterfactuals as any,
      mistakes: [],
      dreams: [],
    };
  }

  return {
    id: record.id,
    state: record.currentState as unknown as GameState,
    setup: record.setup as unknown as SetupInput,
    result,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export async function saveLead(lead: StoredLead): Promise<StoredLead> {
  const deliveredAt = lead.status === 'delivered' ? new Date() : null;
  await prisma.lead.upsert({
    where: { id: lead.id },
    update: {
      deliveryStatus: lead.status,
      deliveryAttempts: lead.attempts,
      webhookLastError: lead.lastError,
      deliveredAt,
    },
    create: {
      id: lead.id,
      sessionId: lead.sessionId,
      name: String(lead.payload.name || 'Lead'),
      contactEncrypted: encryptField(String(lead.payload.contact || '')),
      product: String(lead.payload.product || ''),
      productPrice: Number(lead.payload.productPrice || 0),
      socialLink: lead.payload.socialLink ? encryptField(String(lead.payload.socialLink)) : null,
      comment: lead.payload.comment ? encryptField(String(lead.payload.comment)) : null,
      deliveryStatus: lead.status,
      deliveryAttempts: lead.attempts,
      webhookLastError: lead.lastError,
      privacyConsentAt: new Date(lead.createdAt),
      marketingConsentAt: lead.payload.marketingConsent ? new Date(lead.createdAt) : null,
      deliveredAt,
      createdAt: new Date(lead.createdAt),
    },
  });
  return lead;
}
