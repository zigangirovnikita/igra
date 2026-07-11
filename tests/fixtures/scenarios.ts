import type { ContentType, GameCommand, NurtureType, ProductTypeConfig, SaleMethod, SetupInput } from '../../packages/game-engine/src';

export type ScenarioFixture = {
  id: string;
  setup: SetupInput;
  seed: string;
  commands: GameCommand[];
};

type Policy = {
  id: string;
  productType: ProductTypeConfig['id'];
  price: number;
  saleMethod: SaleMethod;
  nurture: NurtureType[];
  contentType: ContentType;
  reels: number;
  stories: number;
};

const baseSetup: SetupInput = {
  avatarGender: 'female',
  name: 'Никита',
  niche: 'онлайн-консультации',
};

const policies: Policy[] = [
  policy('consult_low_direct', 'consultation', 5_000, 'manual_chat', ['none'], 'selling', 1_000, 300),
  policy('consult_mid_warm', 'consultation', 15_000, 'manual_chat', ['telegram'], 'storytelling', 3_000, 700),
  policy('consult_high_call', 'consultation', 80_000, 'call', ['video_lesson'], 'useful', 5_000, 1_000),
  policy('service_low_direct', 'service', 10_000, 'manual_chat', ['none'], 'selling', 1_500, 400),
  policy('service_mid_guide', 'service', 35_000, 'manual_chat', ['guide'], 'useful', 4_000, 900),
  policy('service_high_call', 'service', 150_000, 'call', ['telegram'], 'storytelling', 8_000, 1_500),
  policy('recorded_low', 'recorded_course', 3_000, 'manual_chat', ['none'], 'selling', 2_000, 500),
  policy('recorded_mid', 'recorded_course', 20_000, 'manual_chat', ['video_lesson'], 'useful', 6_000, 1_200),
  policy('recorded_high', 'recorded_course', 60_000, 'call', ['webinar'], 'storytelling', 10_000, 2_000),
  policy('live_low', 'live_course', 8_000, 'manual_chat', ['guide'], 'useful', 1_000, 250),
  policy('live_mid', 'live_course', 40_000, 'call', ['telegram'], 'storytelling', 5_000, 1_000),
  policy('live_high', 'live_course', 120_000, 'call', ['webinar'], 'selling', 12_000, 2_500),
  policy('mentor_low', 'mentorship', 25_000, 'manual_chat', ['telegram'], 'storytelling', 2_500, 650),
  policy('mentor_mid', 'mentorship', 90_000, 'call', ['video_lesson'], 'useful', 7_000, 1_400),
  policy('mentor_high', 'mentorship', 250_000, 'call', ['webinar'], 'selling', 15_000, 3_000),
  policy('membership_low', 'membership', 1_500, 'manual_chat', ['none'], 'chaotic', 800, 200),
  policy('membership_warm', 'membership', 5_000, 'manual_chat', ['telegram'], 'useful', 3_500, 800),
  policy('membership_story', 'membership', 9_000, 'manual_chat', ['guide'], 'storytelling', 9_000, 1_800),
  policy('tiny_audience', 'consultation', 20_000, 'manual_chat', ['none'], 'selling', 50, 20),
  policy('large_cold_audience', 'service', 30_000, 'manual_chat', ['none'], 'selling', 50_000, 8_000),
  policy('large_warm_audience', 'service', 30_000, 'call', ['telegram'], 'storytelling', 50_000, 8_000),
  policy('chaotic_content', 'recorded_course', 15_000, 'manual_chat', ['none'], 'chaotic', 5_000, 900),
  policy('useful_no_warmup', 'live_course', 45_000, 'call', ['none'], 'useful', 6_000, 1_000),
  policy('selling_with_warmup', 'mentorship', 100_000, 'call', ['telegram'], 'selling', 8_000, 1_600),
];

export const scenarios: ScenarioFixture[] = policies.map((item) => scenario(item.id, baseSetup, buildCommands(item)));

function buildCommands(item: Policy): GameCommand[] {
  return [
    command('c1', 'advance_intro', {}),
    command('c1b', 'advance_intro', {}),
    command('c2', 'set_product_type', { productType: item.productType }),
    command('c3', 'set_product_name', { productName: 'Тестовый продукт' }),
    command('c4', 'set_product_price', { productPrice: item.price }),
    command('c5', 'set_sale_method', { saleMethod: item.saleMethod }),
    command('c6', 'set_nurture', { nurture: item.nurture }),
    command('c7', 'set_entry_point', { entryPoint: 'direct_messages' }),
    command('c8', 'advance_day1_goal', {}),
    command('c9', 'set_dreams', { dreams: ['vacation'] }),
    command('c10', 'complete_day_one', {}),
    command('c11', 'advance_day2_intro', {}),
    command('c12', 'set_channels', { channels: ['instagram'] }),
    command('c13', 'set_audience_metrics', { reels: item.reels, stories: item.stories }),
    command('c14', 'complete_day_two', {}),
    command('c14a', 'advance_daily_intro', {}),
    command('c15', 'choose_intent', { intent: 'fix_system' }),
    command('c16', 'choose_action_group', { group: 'product' }),
    command('c17', 'select_action', { actionId: 'product_pilot' }),
    command('c18', 'confirm_action', {}),
    command('c18p', 'acknowledge_action_process', {}),
    command('c19', 'acknowledge_action_result', {}),
    command('c19e', 'complete_day', {}),
    command('c19a', 'advance_daily_intro', {}),
    command('c20', 'choose_intent', { intent: 'get_sales' }),
    command('c21', 'choose_action_group', { group: 'traffic' }),
    command('c22', 'select_action', { actionId: 'stories_3d' }),
    command('c23', 'configure_action', { contentType: item.contentType }),
    command('c23b', 'configure_action', {
      route: {
        entry: 'direct_messages',
        nurture: item.nurture,
        processing: 'manual',
        saleMethod: item.saleMethod,
        followup: 'none',
      },
    }),
    command('c24', 'confirm_action', {}),
    command('c25', 'acknowledge_action_process', {}),
    command('c26', 'acknowledge_action_result', {}),
  ];
}

function command(commandId: string, type: GameCommand['type'], payload: Record<string, unknown>): GameCommand {
  return { commandId, type, payload } as GameCommand;
}

function policy(
  id: string,
  productType: ProductTypeConfig['id'],
  price: number,
  saleMethod: SaleMethod,
  nurture: NurtureType[],
  contentType: ContentType,
  reels: number,
  stories: number,
): Policy {
  return { id, productType, price, saleMethod, nurture, contentType, reels, stories };
}

function scenario(id: string, setup: SetupInput, commands: GameCommand[]): ScenarioFixture {
  return { id, setup, seed: `seed_${id}`, commands };
}
