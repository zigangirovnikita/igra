/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Diagnostics, GameState, SetupInput } from '@/packages/game-engine/src';

import { prisma } from '../db/client';

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
  
  await prisma.gameSession.upsert({
    where: { id: session.id },
    update: {
      stateVersion: session.state.stateVersion,
      currentState: session.state as any,
      updatedAt: updatedDate,
      status: session.state.status,
    },
    create: {
      id: session.id,
      anonymousId: session.id, // using session ID as anonymous ID for now
      status: session.state.status,
      configVersion: session.state.configVersion,
      seedEncrypted: null,
      stateVersion: session.state.stateVersion,
      setup: session.setup as any,
      currentState: session.state as any,
      createdAt: new Date(session.createdAt),
      updatedAt: updatedDate,
    }
  });
  
  session.updatedAt = updatedDate.toISOString();
  return session;
}

export async function getSession(id: string): Promise<StoredSession | null> {
  const record = await prisma.gameSession.findUnique({
    where: { id }
  });
  if (!record) return null;

  let result: Diagnostics | null = null;
  const resultRecord = await prisma.gameResult.findUnique({
    where: { sessionId: id }
  });

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
  await prisma.lead.upsert({
    where: { id: lead.id },
    update: {
      deliveryStatus: lead.status,
      deliveryAttempts: lead.attempts,
      webhookLastError: lead.lastError,
    },
    create: {
      id: lead.id,
      sessionId: lead.sessionId,
      name: (lead.payload.name as string) || 'Lead',
      contactEncrypted: (lead.payload.contact as string) || '',
      product: (lead.payload.product as string) || '',
      productPrice: (lead.payload.productPrice as number) || 0,
      deliveryStatus: lead.status,
      deliveryAttempts: lead.attempts,
      webhookLastError: lead.lastError,
      privacyConsentAt: new Date(lead.createdAt),
      createdAt: new Date(lead.createdAt),
    }
  });
  return lead;
}
