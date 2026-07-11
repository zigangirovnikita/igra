import { z } from 'zod';

export const setupSchema = z.object({
  avatarGender: z.enum(['female', 'male']),
  name: z.string().trim().min(2).max(30),
  niche: z.string().trim().min(2).max(120),
});

const base = {
  commandId: z.string().min(1).max(120),
  expectedVersion: z.number().int().nonnegative(),
  idempotencyKey: z.string().optional(),
};

export const commandRequestSchema = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('advance_intro'), payload: z.object({}).optional() }),
  z.object({ ...base, type: z.literal('set_product_type'), payload: z.object({ productType: z.string() }) }),
  z.object({ ...base, type: z.literal('set_product_name'), payload: z.object({ productName: z.string() }) }),
  z.object({ ...base, type: z.literal('set_product_price'), payload: z.object({ productPrice: z.number() }) }),
  z.object({ ...base, type: z.literal('set_sale_method'), payload: z.object({ saleMethod: z.string() }) }),
  z.object({ ...base, type: z.literal('set_nurture'), payload: z.object({ nurture: z.array(z.string()), uncertain: z.boolean().optional() }) }),
  z.object({ ...base, type: z.literal('set_entry_point'), payload: z.object({ entryPoint: z.string() }) }),
  z.object({ ...base, type: z.literal('set_dreams'), payload: z.object({ dreams: z.array(z.string()) }) }),
  z.object({ ...base, type: z.literal('advance_day1_goal'), payload: z.object({}).optional() }),
  z.object({ ...base, type: z.literal('back_to_day1_price'), payload: z.object({}).optional() }),
  z.object({ ...base, type: z.literal('edit_day1_plan'), payload: z.object({}).optional() }),
  z.object({ ...base, type: z.literal('complete_day_one'), payload: z.object({}).optional() }),
  z.object({ ...base, type: z.literal('advance_day2_intro'), payload: z.object({}).optional() }),
  z.object({ ...base, type: z.literal('set_channels'), payload: z.object({ channels: z.array(z.string()) }) }),
  z.object({ ...base, type: z.literal('set_audience_metrics'), payload: z.object({ reels: z.number().optional(), stories: z.number().optional(), telegram: z.number().optional(), contacts: z.number().optional() }) }),
  z.object({ ...base, type: z.literal('edit_day2_resources'), payload: z.object({}).optional() }),
  z.object({ ...base, type: z.literal('complete_day_two'), payload: z.object({}).optional() }),
  z.object({ ...base, type: z.literal('advance_daily_intro'), payload: z.object({}).optional() }),
  z.object({ ...base, type: z.literal('choose_intent'), payload: z.object({ intent: z.string().nullable() }) }),
  z.object({ ...base, type: z.literal('choose_action_group'), payload: z.object({ group: z.string().nullable() }) }),
  z.object({ ...base, type: z.literal('select_action'), payload: z.object({ actionId: z.string() }) }),
  z.object({ ...base, type: z.literal('configure_action'), payload: z.object({ contentType: z.string().optional(), route: z.any().optional(), targetCohortId: z.string().optional() }) }),
  z.object({ ...base, type: z.literal('cancel_pending_action'), payload: z.object({}).optional() }),
  z.object({ ...base, type: z.literal('confirm_action'), payload: z.object({}).optional() }),
  z.object({ ...base, type: z.literal('acknowledge_action_process'), payload: z.object({}).optional() }),
  z.object({ ...base, type: z.literal('acknowledge_action_result'), payload: z.object({}).optional() }),
  z.object({ ...base, type: z.literal('follow_advice'), payload: z.object({}).optional() }),
  z.object({ ...base, type: z.literal('resolve_inbound'), payload: z.object({ cohortId: z.string(), mode: z.enum(['all', 'manual', 'bot', 'manager', 'none', 'defer']), processed: z.number().optional() }) }),
  z.object({ ...base, type: z.literal('defer_inbound'), payload: z.object({ cohortId: z.string() }) }),
  z.object({ ...base, type: z.literal('resolve_sales'), payload: z.object({ cohortId: z.string(), action: z.enum(['process', 'defer', 'ignore']), amount: z.number().int().positive().optional() }) }),
  z.object({ ...base, type: z.literal('resolve_followup'), payload: z.object({ cohortId: z.string(), action: z.enum(['process', 'defer', 'ignore']) }) }),
  z.object({ ...base, type: z.literal('resolve_pending_decision'), payload: z.object({ cohortId: z.string().optional(), action: z.enum(['process', 'process_all', 'process_available', 'process_selected', 'defer', 'ignore', 'connect_manager', 'connect_bot', 'sell_chat', 'sell_call', 'sell_website', 'sell_bot', 'sell_webinar', 'followup_message', 'followup_call', 'followup_case', 'followup_discount', 'followup_bot', 'confirm', 'cancel', 'rest_day', 'rest_two_days', 'delegate', 'push_through', 'continue_without_budget']), amount: z.number().optional() }) }),
  z.object({ ...base, type: z.literal('complete_day'), payload: z.object({}).optional() }),
  z.object({ ...base, type: z.literal('continue_after_goal'), payload: z.object({}).optional() }),
  z.object({ ...base, type: z.literal('request_finish'), payload: z.object({}).optional() }),
  z.object({ ...base, type: z.literal('cancel_finish'), payload: z.object({}).optional() }),
  z.object({ ...base, type: z.literal('repair_flow'), payload: z.object({}).optional() }),
  z.object({ ...base, type: z.literal('abandon_game'), payload: z.object({}).optional() }),
  z.object({ ...base, type: z.literal('resolve_mini_game'), payload: z.object({ cohortId: z.string(), mode: z.enum(['manual', 'auto']), processed: z.number().optional() }) }),
  z.object({ ...base, type: z.literal('start_parallel'), payload: z.object({ actionAId: z.string(), actionBId: z.string(), contentType: z.string().optional(), route: z.any().optional() }) }),
  z.object({ ...base, type: z.literal('record_reflection'), payload: z.object({ eventId: z.string(), answer: z.string() }) }),
  z.object({ ...base, type: z.literal('set_route'), payload: z.any() }),
]);

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

export const gameStateSchema = z.object({
  sessionId: z.string(),
  status: z.string(),
  stateVersion: z.number(),
  configVersion: z.string(),
  flow: z.object({
    stage: z.string(),
    step: z.string(),
  }).passthrough(),
}).passthrough();
