import { z } from 'zod';

export const setupSchema = z.object({
  avatarGender: z.enum(['female', 'male']),
  name: z.string().trim().min(2).max(30),
  niche: z.string().trim().min(2).max(120),
});

export const commandRequestSchema = z.object({
  commandId: z.string().min(1).max(120),
  expectedVersion: z.number().int().nonnegative(),
  type: z.enum(['start_action', 'set_route', 'set_plan', 'record_reflection', 'process_inbound', 'start_parallel', 'resolve_mini_game', 'finish_game']),
  idempotencyKey: z.string().optional(),
  payload: z.unknown().optional()
});

export const leadSchema = z.object({
  sessionId: z.string().min(1),
  name: z.string().trim().min(2).max(80),
  contact: z.string().trim().min(3).max(120),
  product: z.string().trim().min(2).max(160),
  productPrice: z.coerce.number().int().min(100).max(5_000_000),
  socialLink: z.string().trim().max(300).optional().or(z.literal('')),
  comment: z.string().trim().max(1000).optional().or(z.literal('')),
  privacyConsent: z.literal(true),
  marketingConsent: z.boolean().optional(),
  website: z.string().max(0).optional()
});

export type SetupPayload = z.infer<typeof setupSchema>;
