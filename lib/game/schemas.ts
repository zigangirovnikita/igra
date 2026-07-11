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

const productTypeSchema = z.enum([
  'consultation',
  'service',
  'recorded_course',
  'live_course',
  'mentorship',
  'membership',
]);

const saleMethodSchema = z.enum([
  'manual_chat',
  'call',
  'website_auto',
  'bot_auto',
  'webinar_direct',
]);

const entryPointSchema = z.enum([
  'direct_messages',
  'guide',
  'video_lesson',
  'website',
  'webinar_registration',
]);

const nurtureSchema = z.enum([
  'none',
  'guide',
  'video_lesson',
  'telegram',
  'webinar',
]);

const contentTypeSchema = z.enum([
  'useful',
  'storytelling',
  'selling',
  'chaotic',
]);

const audienceChannelSchema = z.enum([
  'instagram',
  'telegram',
  'contacts',
]);

const routeSchema = z.object({
  entry: entryPointSchema,
  nurture: z.array(nurtureSchema).min(1).max(3),
  processing: z.enum(['manual', 'simple_bot', 'ai_bot', 'manager', 'website_auto']),
  saleMethod: saleMethodSchema,
  followup: z.enum(['none', 'manual', 'bot']),
});

export const commandRequestSchema = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('advance_intro'), payload: z.object({}).optional() }),
  z.object({ ...base, type: z.literal('set_product_type'), payload: z.object({ productType: productTypeSchema }) }),
  z.object({ ...base, type: z.literal('set_product_name'), payload: z.object({ productName: z.string().trim().min(2).max(120) }) }),
  z.object({ ...base, type: z.literal('set_product_price'), payload: z.object({ productPrice: z.number().int().min(100).max(5_000_000) }) }),
  z.object({ ...base, type: z.literal('set_sale_method'), payload: z.object({ saleMethod: saleMethodSchema }) }),
  z.object({ ...base, type: z.literal('set_nurture'), payload: z.object({ nurture: z.array(nurtureSchema).min(1).max(3), uncertain: z.boolean().optional() }) }),
  z.object({ ...base, type: z.literal('set_entry_point'), payload: z.object({ entryPoint: entryPointSchema }) }),
  z.object({ ...base, type: z.literal('set_dreams'), payload: z.object({ dreams: z.array(z.string()).max(10) }) }),
  z.object({ ...base, type: z.literal('advance_day1_goal'), payload: z.object({}).optional() }),
  z.object({ ...base, type: z.literal('back_to_day1_price'), payload: z.object({}).optional() }),
  z.object({ ...base, type: z.literal('edit_day1_plan'), payload: z.object({}).optional() }),
  z.object({ ...base, type: z.literal('complete_day_one'), payload: z.object({}).optional() }),
  z.object({ ...base, type: z.literal('advance_day2_intro'), payload: z.object({}).optional() }),
  z.object({ ...base, type: z.literal('set_channels'), payload: z.object({ channels: z.array(audienceChannelSchema).max(3) }) }),
  z.object({ ...base, type: z.literal('set_audience_metrics'), payload: z.object({ reels: z.number().int().min(0).max(10_000_000).optional(), stories: z.number().int().min(0).max(10_000_000).optional(), telegram: z.number().int().min(0).max(10_000_000).optional(), contacts: z.number().int().min(0).max(10_000_000).optional() }) }),
  z.object({ ...base, type: z.literal('edit_day2_resources'), payload: z.object({}).optional() }),
  z.object({ ...base, type: z.literal('complete_day_two'), payload: z.object({}).optional() }),
  z.object({ ...base, type: z.literal('advance_daily_intro'), payload: z.object({}).optional() }),
  z.object({ ...base, type: z.literal('choose_intent'), payload: z.object({ intent: z.enum(['get_sales', 'fix_system', 'get_advice', 'restore_energy', 'repeat_last', 'automate', 'finish']).nullable() }) }),
  z.object({ ...base, type: z.literal('choose_action_group'), payload: z.object({ group: z.string().nullable() }) }),
  z.object({ ...base, type: z.literal('select_action'), payload: z.object({ actionId: z.string() }) }),
  z.object({ ...base, type: z.literal('configure_action'), payload: z.object({ contentType: contentTypeSchema.optional(), route: routeSchema.optional(), targetCohortId: z.string().optional() }) }),
  z.object({ ...base, type: z.literal('cancel_pending_action'), payload: z.object({}).optional() }),
  z.object({ ...base, type: z.literal('confirm_action'), payload: z.object({}).optional() }),
  z.object({ ...base, type: z.literal('acknowledge_action_process'), payload: z.object({}).optional() }),
  z.object({ ...base, type: z.literal('acknowledge_action_result'), payload: z.object({}).optional() }),
  z.object({ ...base, type: z.literal('follow_advice'), payload: z.object({}).optional() }),
  z.object({ ...base, type: z.literal('resolve_inbound'), payload: z.object({ cohortId: z.string(), mode: z.enum(['all', 'manual', 'bot', 'manager', 'none', 'defer']), processed: z.number().int().positive().optional() }) }),
  z.object({ ...base, type: z.literal('defer_inbound'), payload: z.object({ cohortId: z.string() }) }),
  z.object({ ...base, type: z.literal('resolve_sales'), payload: z.object({ cohortId: z.string(), action: z.enum(['process', 'defer', 'ignore']), amount: z.number().int().positive().optional() }) }),
  z.object({ ...base, type: z.literal('resolve_followup'), payload: z.object({ cohortId: z.string(), action: z.enum(['process', 'defer', 'ignore']) }) }),
  z.object({ ...base, type: z.literal('resolve_pending_decision'), payload: z.object({ cohortId: z.string().optional(), action: z.enum(['process', 'process_all', 'process_available', 'process_selected', 'defer', 'ignore', 'connect_manager', 'connect_bot', 'sell_chat', 'sell_call', 'sell_website', 'sell_bot', 'sell_webinar', 'followup_message', 'followup_call', 'followup_case', 'followup_discount', 'followup_bot', 'confirm', 'cancel', 'rest_day', 'rest_two_days', 'delegate', 'push_through', 'continue_without_budget']), amount: z.number().int().positive().optional() }) }),
  z.object({ ...base, type: z.literal('complete_day'), payload: z.object({}).optional() }),
  z.object({ ...base, type: z.literal('continue_after_goal'), payload: z.object({}).optional() }),
  z.object({ ...base, type: z.literal('request_finish'), payload: z.object({}).optional() }),
  z.object({ ...base, type: z.literal('cancel_finish'), payload: z.object({}).optional() }),
  z.object({ ...base, type: z.literal('repair_flow'), payload: z.object({}).optional() }),
  z.object({ ...base, type: z.literal('abandon_game'), payload: z.object({}).optional() }),
  z.object({ ...base, type: z.literal('resolve_mini_game'), payload: z.object({ cohortId: z.string(), mode: z.enum(['manual', 'auto']), processed: z.number().int().positive().optional() }) }),
  z.object({ ...base, type: z.literal('start_parallel'), payload: z.object({ actionAId: z.string(), actionBId: z.string(), contentType: contentTypeSchema.optional(), route: routeSchema.optional() }) }),
  z.object({ ...base, type: z.literal('record_reflection'), payload: z.object({ eventId: z.string(), answer: z.string() }) }),
  z.object({ ...base, type: z.literal('set_route'), payload: routeSchema }),
  z.object({ ...base, type: z.literal('acknowledge_event'), payload: z.object({ eventId: z.string() }) }),
]);

export const developerCommandRequestSchema = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('start_parallel'), payload: z.object({ actionAId: z.string(), actionBId: z.string(), contentType: contentTypeSchema.optional(), route: routeSchema.optional() }) }),
  z.object({ ...base, type: z.literal('set_route'), payload: routeSchema }),
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
