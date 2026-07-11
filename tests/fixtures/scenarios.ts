import type { GameCommand, RouteSelection, SetupInput } from '../../packages/game-engine/src';

export type ScenarioFixture = {
  id: string;
  policy: string;
  setup: SetupInput;
  seed: string;
  commands: GameCommand[];
};

const baseSetup: SetupInput = {
  avatarGender: 'female',
  name: 'Никита',
  niche: 'онлайн-консультации',
  superpowers: ['marketing', 'sales'],
  productType: 'consultation',
  productPrice: 50_000,
  averageReelViews: 3_000,
  averageStoryViews: 700,
  telegramStatus: 'known',
  averageTelegramViews: 450,
  dreams: ['vacation']
};

const callsRoute: RouteSelection = {
  entry: 'guide',
  nurture: ['guide', 'telegram'],
  processing: 'ai_bot',
  saleMethod: 'call',
  followup: 'bot'
};

const manualRoute: RouteSelection = {
  entry: 'direct_messages',
  nurture: ['none'],
  processing: 'manual',
  saleMethod: 'manual_chat',
  followup: 'none'
};

const websiteRoute: RouteSelection = {
  entry: 'website',
  nurture: ['none'],
  processing: 'website_auto',
  saleMethod: 'website_auto',
  followup: 'none'
};

const webinarRoute: RouteSelection = {
  entry: 'webinar_registration',
  nurture: ['webinar'],
  processing: 'manual',
  saleMethod: 'webinar_direct',
  followup: 'manual'
};

export const scenarios: ScenarioFixture[] = [
  scenario('strong_reels_bot_calls', { ...baseSetup, averageReelViews: 7_000, productPrice: 100_000 }, ['demand_pilot_offer', 'product_pilot', 'guide_specialist', 'ai_bot_specialist'], callsRoute, ['reels_7d', 'calls', 'reels_7d', 'calls', 'manual_followup']),
  scenario('strong_webinar_followup', { ...baseSetup, productType: 'live_course', productPrice: 30_000, averageStoryViews: 7_500 }, ['demand_interviews', 'product_self'], webinarRoute, ['webinar', 'webinar', 'manual_followup']),
  scenario('strong_low_ticket_auto', { ...baseSetup, productType: 'recorded_course', productPrice: 4_000, averageReelViews: 73_000, averageStoryViews: 20_000 }, ['demand_pilot_offer', 'product_self', 'guide_specialist', 'simple_bot_specialist'], { ...callsRoute, saleMethod: 'bot_auto', processing: 'simple_bot' }, ['reels_7d', 'reels_7d', 'reels_7d']),
  scenario('manual_small_audience', { ...baseSetup, averageReelViews: 500, averageStoryViews: 120 }, ['product_pilot'], manualRoute, ['stories_3d']),
  scenario('product_first', baseSetup, ['product_studio', 'demand_poll', 'guide_self'], callsRoute, ['reels_7d']),
  scenario('website_first', baseSetup, ['website_beautiful', 'product_self'], websiteRoute, ['reels_7d']),
  scenario('content_without_route', baseSetup, ['product_pilot'], manualRoute, ['reels_7d', 'stories_3d']),
  scenario('bot_without_traffic', baseSetup, ['ai_bot_specialist', 'product_pilot'], callsRoute, []),
  scenario('manager_without_warmup', baseSetup, ['hire_manager', 'product_pilot'], { ...manualRoute, processing: 'manager' }, ['reels_7d']),
  scenario('burnout_route', { ...baseSetup, superpowers: ['marketing', 'expertise'] }, ['product_home', 'video_self', 'ai_bot_self'], callsRoute, ['reels_stories_7d', 'webinar']),
  scenario('random_valid', baseSetup, ['demand_poll', 'product_pilot', 'guide_self'], manualRoute, ['stories_3d', 'live_stream']),
  scenario('weighted_typical_user', { ...baseSetup, productType: 'mentorship', productPrice: 220_000, averageReelViews: 14_500 }, ['demand_interviews', 'product_self', 'simple_bot_specialist'], { ...callsRoute, processing: 'simple_bot', followup: 'none' }, ['reels_7d', 'calls']),
  scenario('expensive_site', { ...baseSetup, productPrice: 220_000, productType: 'mentorship' }, ['product_self', 'website_basic'], websiteRoute, ['reels_7d']),
  scenario('expensive_call', { ...baseSetup, productPrice: 220_000, productType: 'mentorship' }, ['demand_pilot_offer', 'product_pilot', 'video_specialist'], callsRoute, ['reels_7d', 'calls']),
  scenario('many_inbound_no_bot', { ...baseSetup, averageReelViews: 20_000 }, ['product_pilot'], manualRoute, ['reels_7d']),
  scenario('manager_with_warmup', baseSetup, ['demand_interviews', 'product_self', 'video_specialist', 'hire_manager'], { ...callsRoute, processing: 'manager' }, ['reels_7d']),
  scenario('zero_revenue', { ...baseSetup, averageReelViews: 0, averageStoryViews: 0 }, ['product_home', 'website_beautiful'], websiteRoute, []),
  scenario('pilot_before_full', baseSetup, ['demand_pilot_offer', 'product_pilot', 'product_self', 'ai_bot_specialist'], callsRoute, ['reels_7d']),
  scenario('late_ai_bot', baseSetup, ['product_self', 'reels_7d', 'ai_bot_specialist'], callsRoute, ['reels_7d']),
  scenario('consultation_capacity', { ...baseSetup, productType: 'consultation', productPrice: 10_000, averageReelViews: 50_000 }, ['demand_pilot_offer', 'product_pilot', 'ai_bot_specialist'], callsRoute, ['reels_7d']),
  scenario('parallel_content_bot', baseSetup, ['demand_interviews', 'product_pilot'], callsRoute, ['parallel:reels_7d+ai_bot_specialist', 'manual_followup']),
  scenario('telegram_reels', baseSetup, ['demand_interviews', 'product_self', 'guide_specialist'], callsRoute, ['parallel:telegram_warmup+reels_7d'])
];

function scenario(
  id: string,
  setup: SetupInput,
  prepActions: string[],
  route: RouteSelection,
  playActions: string[]
): ScenarioFixture {
  const commands: GameCommand[] = [];
  let index = 0;
  for (const actionId of prepActions) {
    commands.push({ commandId: `${id}_${index++}`, type: 'start_action', payload: { actionId } });
  }
  commands.push({ commandId: `${id}_${index++}`, type: 'set_route', payload: route });
  for (const actionId of playActions) {
    if (actionId.startsWith('parallel:')) {
      const [actionAId, actionBId] = actionId.replace('parallel:', '').split('+');
      commands.push({ commandId: `${id}_${index++}`, type: 'start_parallel', payload: { actionAId, actionBId, contentType: 'useful', route } });
    } else {
      commands.push({ commandId: `${id}_${index++}`, type: 'start_action', payload: { actionId, contentType: 'useful', route } });
    }
  }
  commands.push({ commandId: `${id}_${index++}`, type: 'finish_game', payload: {} });
  return { id, policy: id, setup, seed: `seed_${id}`, commands };
}
