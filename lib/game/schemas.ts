import { z } from 'zod';

export const setupSchema = z.object({
  avatarGender: z.enum(['female', 'male']),
  name: z.string().trim().min(2).max(30),
  niche: z.string().trim().min(2).max(120),
  superpower: z.enum(['sales', 'marketing', 'energy', 'ads']),
});

const base = {
  commandId: z.string().min(1).max(120),
  expectedVersion: z.number().int().nonnegative(),
  idempotencyKey: z.string().min(1).max(120).optional(),
};

const productTypeSchema = z.enum([
  'consultation',
  'service',
  'recorded_course',
  'live_course',
  'mentorship',
  'membership',
]);
const saleMethodSchema = z.enum(['manual_chat', 'call', 'website_auto', 'bot_auto', 'webinar_direct']);
const entryPointSchema = z.enum(['direct_messages', 'guide', 'video_lesson', 'website', 'webinar_registration']);
const nurtureSchema = z.enum(['none', 'guide', 'video_lesson', 'telegram', 'webinar']);
const contentTypeSchema = z.enum(['useful', 'storytelling', 'selling', 'chaotic']);
const audienceChannelSchema = z.enum(['instagram', 'telegram', 'contacts']);
const v3ProductTypeSchema = z.enum(['consultation', 'service', 'recorded_course', 'live_course', 'mentorship', 'membership']);
const v3PreparationAreaSchema = z.enum(['warmup', 'sales', 'ads']);
const v3PreparationModeSchema = z.enum(['self', 'expert']);
const v3AdviceCategorySchema = z.enum(['ads', 'warmup', 'sales']);
const v3AdviceOptionSchema = z.enum(['friend', 'consult_5k', 'consult_10k']);
const v3SelectionKindSchema = z.enum(['ad', 'warmup', 'sales']);
const v3ActiveActionLogEntrySchema = z.object({
  id: z.string().min(1).max(120),
  type: z.enum(['answer', 'call', 'direct_chat', 'post_call_chat', 'site_chat']),
  targetId: z.string().min(1).max(160),
  startedAtMs: z.number().int().min(0).max(60_000),
  completedAtMs: z.number().int().min(0).max(60_000),
}).refine((entry) => entry.completedAtMs >= entry.startedAtMs, 'Action completion cannot be before start');
const routeSchema = z.object({
  entry: entryPointSchema,
  nurture: z.array(nurtureSchema).min(1).max(3),
  processing: z.enum(['manual', 'simple_bot', 'ai_bot', 'manager', 'website_auto']),
  saleMethod: saleMethodSchema,
  followup: z.enum(['none', 'manual', 'bot']),
});

const pendingActionSchema = z.enum([
  'process',
  'process_all',
  'process_available',
  'process_selected',
  'defer',
  'ignore',
  'sell_chat',
  'sell_call',
  'sell_website',
  'sell_bot',
  'followup_message',
  'followup_call',
  'followup_case',
  'followup_discount',
  'followup_bot',
  'confirm',
  'cancel',
  'rest_day',
  'rest_two_days',
  'delegate',
  'continue_without_budget',
]);

export const commandRequestSchema = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('advance_intro'), payload: z.object({}).optional() }),
  z.object({ ...base, type: z.literal('set_product_type'), payload: z.object({ productType: productTypeSchema }) }),
  z.object({ ...base, type: z.literal('set_product_name'), payload: z.object({ productName: z.string().trim().min(2).max(120) }) }),
  z.object({ ...base, type: z.literal('set_product_price'), payload: z.object({ productPrice: z.number().int().min(100).max(5_000_000) }) }),
  z.object({ ...base, type: z.literal('set_sale_method'), payload: z.object({ saleMethod: saleMethodSchema }) }),
  z.object({ ...base, type: z.literal('set_nurture'), payload: z.object({ nurture: z.array(nurtureSchema).min(1).max(3), uncertain: z.boolean().optional() }) }),
  z.object({ ...base, type: z.literal('set_entry_point'), payload: z.object({ entryPoint: entryPointSchema }) }),
  z.object({ ...base, type: z.literal('set_dreams'), payload: z.object({ dreams: z.array(z.string().min(1).max(80)).max(10) }) }),
  z.object({ ...base, type: z.literal('advance_day1_goal'), payload: z.object({}).optional() }),
  z.object({ ...base, type: z.literal('back_to_day1_price'), payload: z.object({}).optional() }),
  z.object({ ...base, type: z.literal('edit_day1_plan'), payload: z.object({}).optional() }),
  z.object({ ...base, type: z.literal('complete_day_one'), payload: z.object({}).optional() }),
  z.object({ ...base, type: z.literal('advance_day2_intro'), payload: z.object({}).optional() }),
  z.object({ ...base, type: z.literal('set_channels'), payload: z.object({ channels: z.array(audienceChannelSchema).max(3) }) }),
  z.object({ ...base, type: z.literal('set_audience_metrics'), payload: z.object({
    reels: z.number().int().min(0).max(10_000_000).optional(),
    stories: z.number().int().min(0).max(10_000_000).optional(),
    telegram: z.number().int().min(0).max(10_000_000).optional(),
    contacts: z.number().int().min(0).max(10_000_000).optional(),
  }) }),
  z.object({ ...base, type: z.literal('edit_day2_resources'), payload: z.object({}).optional() }),
  z.object({ ...base, type: z.literal('complete_day_two'), payload: z.object({}).optional() }),
  z.object({ ...base, type: z.literal('advance_daily_intro'), payload: z.object({}).optional() }),
  z.object({ ...base, type: z.literal('choose_intent'), payload: z.object({ intent: z.enum(['get_sales', 'fix_system', 'get_advice', 'restore_energy', 'repeat_last', 'automate', 'finish']).nullable() }) }),
  z.object({ ...base, type: z.literal('choose_action_group'), payload: z.object({ group: z.string().min(1).max(80).nullable() }) }),
  z.object({ ...base, type: z.literal('select_action'), payload: z.object({ actionId: z.string().min(1).max(120) }) }),
  z.object({ ...base, type: z.literal('configure_action'), payload: z.object({ contentType: contentTypeSchema.optional(), route: routeSchema.optional(), targetCohortId: z.string().min(1).max(160).optional() }) }),
  z.object({ ...base, type: z.literal('cancel_pending_action'), payload: z.object({}).optional() }),
  z.object({ ...base, type: z.literal('confirm_action'), payload: z.object({}).optional() }),
  z.object({ ...base, type: z.literal('acknowledge_action_process'), payload: z.object({}).optional() }),
  z.object({ ...base, type: z.literal('acknowledge_action_result'), payload: z.object({}).optional() }),
  z.object({ ...base, type: z.literal('follow_advice'), payload: z.object({}).optional() }),
  z.object({ ...base, type: z.literal('resolve_inbound'), payload: z.object({ cohortId: z.string().min(1), mode: z.enum(['all', 'manual', 'none', 'defer']), processed: z.number().int().min(0).optional() }) }),
  z.object({ ...base, type: z.literal('defer_inbound'), payload: z.object({ cohortId: z.string().min(1) }) }),
  z.object({ ...base, type: z.literal('resolve_sales'), payload: z.object({ cohortId: z.string().min(1), action: z.enum(['process', 'defer', 'ignore']), amount: z.number().int().positive().optional() }) }),
  z.object({ ...base, type: z.literal('resolve_followup'), payload: z.object({ cohortId: z.string().min(1), action: z.enum(['process', 'defer', 'ignore']) }) }),
  z.object({ ...base, type: z.literal('resolve_pending_decision'), payload: z.object({ cohortId: z.string().min(1).optional(), action: pendingActionSchema, amount: z.number().int().min(0).optional() }) }),
  z.object({ ...base, type: z.literal('complete_day'), payload: z.object({}).optional() }),
  z.object({ ...base, type: z.literal('continue_after_goal'), payload: z.object({}).optional() }),
  z.object({ ...base, type: z.literal('request_finish'), payload: z.object({}).optional() }),
  z.object({ ...base, type: z.literal('cancel_finish'), payload: z.object({}).optional() }),
  z.object({ ...base, type: z.literal('repair_flow'), payload: z.object({}).optional() }),
  z.object({ ...base, type: z.literal('abandon_game'), payload: z.object({}).optional() }),
  z.object({
    ...base,
    type: z.literal('resolve_mini_game'),
    payload: z.object({
      cohortId: z.string().min(1),
      mode: z.enum(['manual', 'auto']),
      answeredMessageIds: z.array(z.string().min(1).max(180)).max(80).optional(),
    }),
  }),
  z.object({ ...base, type: z.literal('record_reflection'), payload: z.object({ eventId: z.string().min(1), answer: z.string().trim().min(1).max(1000) }) }),
  z.object({ ...base, type: z.literal('acknowledge_event'), payload: z.object({ eventId: z.string().min(1).max(240) }) }),
  z.object({ ...base, type: z.literal('v3_next'), payload: z.object({}).optional() }),
  z.object({ ...base, type: z.literal('v3_set_product'), payload: z.object({ productType: v3ProductTypeSchema }) }),
  z.object({ ...base, type: z.literal('v3_set_price'), payload: z.object({ productPrice: z.number().int().min(1000).max(5_000_000) }) }),
  z.object({ ...base, type: z.literal('v3_set_dream'), payload: z.object({
    dreamId: z.string().min(1).max(120),
    customTitle: z.string().trim().min(2).max(80).optional(),
    customPrice: z.number().int().min(1_000).max(5_000_000).optional(),
  }) }),
  z.object({ ...base, type: z.literal('v3_set_dreams'), payload: z.object({
    dreams: z.array(z.object({
      id: z.string().trim().min(1).max(120),
      title: z.string().trim().min(2).max(80),
      price: z.number().int().min(1_000).max(5_000_000),
      custom: z.boolean().optional(),
    })).max(10),
    customTitle: z.string().trim().min(2).max(80).optional(),
    customPrice: z.number().int().min(1_000).max(5_000_000).optional(),
  }).refine((payload) => payload.dreams.length > 0 || Boolean(payload.customTitle && payload.customPrice), {
    message: 'Выберите хотя бы одно желание',
  }) }),
  z.object({ ...base, type: z.literal('v3_open_reflection'), payload: z.object({ target: z.enum(['prepare', 'advice', 'rest', 'history', 'act']) }) }),
  z.object({ ...base, type: z.literal('v3_confirm_preparation'), payload: z.object({
    area: v3PreparationAreaSchema,
    instrumentId: z.string().min(1).max(80),
    mode: v3PreparationModeSchema,
  }) }),
  z.object({ ...base, type: z.literal('v3_request_advice'), payload: z.object({
    category: v3AdviceCategorySchema,
    option: v3AdviceOptionSchema,
  }) }),
  z.object({ ...base, type: z.literal('v3_rest'), payload: z.object({ days: z.union([z.literal(1), z.literal(2), z.literal(3)]) }) }),
  z.object({ ...base, type: z.literal('v3_begin_action_plan'), payload: z.object({}).optional() }),
  z.object({ ...base, type: z.literal('v3_ack_pre_action_summary'), payload: z.object({}).optional() }),
  z.object({ ...base, type: z.literal('v3_select_active'), payload: z.object({
    kind: v3SelectionKindSchema,
    key: z.string().min(1).max(180),
  }) }),
  z.object({ ...base, type: z.literal('v3_start_active_stage'), payload: z.object({}).optional() }),
  z.object({ ...base, type: z.literal('v3_complete_active_stage'), payload: z.object({
    manualAnswers: z.number().int().min(0).max(200).optional(),
    salesChats: z.number().int().min(0).max(200).optional(),
    directSalesChats: z.number().int().min(0).max(200).optional(),
    postCallChats: z.number().int().min(0).max(200).optional(),
    calls: z.number().int().min(0).max(60).optional(),
    actionLog: z.array(v3ActiveActionLogEntrySchema).max(240).optional(),
  }).optional() }),
  z.object({ ...base, type: z.literal('v3_return_reflection'), payload: z.object({}).optional() }),
]);

export const developerCommandRequestSchema = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('start_parallel'), payload: z.object({ actionAId: z.string(), actionBId: z.string(), contentType: contentTypeSchema.optional(), route: routeSchema.optional() }) }),
  z.object({ ...base, type: z.literal('set_route'), payload: routeSchema }),
]);

export const leadSchema = z.object({
  sessionId: z.string().uuid(),
  name: z.string().trim().min(2).max(80),
  contact: z.string().trim().min(3).max(120),
  product: z.string().trim().min(2).max(160),
  productPrice: z.coerce.number().int().min(100).max(5_000_000),
  socialLink: z.string().trim().max(300).optional().or(z.literal('')),
  comment: z.string().trim().max(1000).optional().or(z.literal('')),
  privacyConsent: z.literal(true),
  marketingConsent: z.boolean().optional(),
  website: z.string().max(0).optional(),
});

export type SetupPayload = z.infer<typeof setupSchema>;

export const gameStateSchema = z.object({
  sessionId: z.string().uuid(),
  status: z.string(),
  stateVersion: z.number().int().nonnegative(),
  configVersion: z.string(),
  flow: z.object({ stage: z.string(), step: z.string() }).passthrough(),
}).passthrough();
