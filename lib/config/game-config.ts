import { z } from 'zod';
import rawConfig from '@/config/game-config.v2.json';
import type { GameConfig } from '@/packages/game-engine/src';

const idSchema = z.string().regex(/^[a-z][a-z0-9_]*$/);

const conditionSchema: z.ZodType<GameConfig['actions'][number]['requirements'][number]> = z.lazy(() =>
  z.object({
    operator: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'notIn', 'hasFlag', 'lacksFlag', 'and', 'or', 'not']),
    path: z.string().optional(),
    value: z.unknown().optional(),
    conditions: z.array(conditionSchema).optional()
  })
);

const effectSchema = z.object({
  operator: z.enum(['setFlag', 'addMetric', 'multiplyMetric', 'addResource', 'createAsset', 'replaceAsset', 'scheduleAction', 'emitEvent']),
  path: z.string().optional(),
  value: z.unknown().optional(),
  payload: z.record(z.unknown()).optional()
});

export const gameConfigSchema = z.object({
  version: z.string().regex(/^[0-9]+\.[0-9]+\.[0-9]+$/),
  currency: z.literal('RUB'),
  startingBank: z.number().int().nonnegative(),
  totalDays: z.number().int().min(1).max(365),
  startingEnergy: z.number().min(0).max(100),
  goals: z.object({
    lowTicketMinimumRevenue: z.number().int().nonnegative(),
    priceBuckets: z.array(z.object({ maxPrice: z.number().int().positive().nullable(), targetSales: z.number().int().positive() })).min(1)
  }),
  productTypes: z.array(z.object({
    id: idSchema,
    enabled: z.boolean(),
    title: z.string().min(1),
    description: z.string().optional(),
    modifiers: z.array(z.record(z.unknown())).optional(),
    capacity: z.number().int().positive().nullable(),
    recommendedSalesMethods: z.array(idSchema).optional()
  })).min(1),

  actions: z.array(z.object({
    id: idSchema,
    enabled: z.boolean(),
    category: idSchema,
    title: z.string().min(1),
    description: z.string().optional(),
    cost: z.number().int().nonnegative(),
    days: z.number().int().nonnegative(),
    energyCost: z.number().nonnegative(),
    requirements: z.array(conditionSchema),
    effects: z.array(effectSchema),
    repeatPolicy: z.enum(['never', 'once_per_cohort', 'unlimited', 'upgrade']),
    analyticsId: idSchema.optional(),
    intent: z.enum(['get_sales', 'fix_system', 'get_advice', 'restore_energy']),
    group: z.string(),
    configurationSteps: z.array(z.string()),
    uiVisible: z.boolean(),
    upgradeGroup: z.string().optional(),
    upgradeLevel: z.number().optional(),
    upgradeCost: z.number().optional()
  })).min(1),
  content: z.record(z.unknown()),
  routes: z.record(z.unknown()),
  conversions: z.record(z.unknown()),
  randomness: z.object({
    distribution: z.array(z.object({
      probability: z.number().gt(0).max(1),
      multiplier: z.number().nonnegative()
    })).min(1)
  }),

  events: z.array(z.object({
    id: idSchema,
    enabled: z.boolean(),
    priority: z.number().int(),
    once: z.boolean(),
    conditions: z.array(conditionSchema),
    sceneType: idSchema,
    messages: z.array(z.string()),
    effects: z.array(effectSchema),
    analyticsId: idSchema
  })),
  dreams: z.array(z.object({
    id: idSchema,
    enabled: z.boolean(),
    title: z.string().min(1),
    price: z.number().int().nonnegative(),
    custom: z.boolean().optional()
  })),
  copy: z.record(z.unknown()),
  assets: z.record(z.unknown()),
  cta: z.object({ primary: z.string().min(1), secondary: z.string().min(1) })
});

export function loadGameConfig(): GameConfig {
  return gameConfigSchema.parse(rawConfig) as GameConfig;
}
