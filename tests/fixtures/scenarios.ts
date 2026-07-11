import type { GameCommand, SetupInput } from '../../packages/game-engine/src';

export type ScenarioFixture = {
  id: string;
  setup: SetupInput;
  seed: string;
  commands: GameCommand[];
};

const baseSetup: SetupInput = {
  avatarGender: 'female',
  name: 'Никита',
  niche: 'онлайн-консультации'
};

export const scenarios: ScenarioFixture[] = [
  scenario('basic_win', baseSetup, [
    { commandId: 'c1', type: 'advance_intro', payload: {} },
    { commandId: 'c1b', type: 'advance_intro', payload: {} },
    { commandId: 'c2', type: 'set_product_type', payload: { productType: 'consultation' } },
    { commandId: 'c3', type: 'set_product_name', payload: { productName: 'My Consult' } },
    { commandId: 'c4', type: 'set_product_price', payload: { productPrice: 10_000 } },
    { commandId: 'c5', type: 'set_sale_method', payload: { saleMethod: 'manual_chat' } },
    { commandId: 'c6', type: 'set_nurture', payload: { nurture: ['none'] } },
    { commandId: 'c7', type: 'set_entry_point', payload: { entryPoint: 'direct_messages' } },
    { commandId: 'c8', type: 'advance_day1_goal', payload: {} },
    { commandId: 'c9', type: 'set_dreams', payload: { dreams: ['vacation'] } },
    { commandId: 'c10', type: 'complete_day_one', payload: {} },
    { commandId: 'c11', type: 'advance_day2_intro', payload: {} },
    { commandId: 'c12', type: 'set_channels', payload: { channels: ['instagram'] } },
    { commandId: 'c13', type: 'set_audience_metrics', payload: { reels: 1000, stories: 300 } },
    { commandId: 'c14', type: 'complete_day_two', payload: {} },
    { commandId: 'c14a', type: 'advance_daily_intro', payload: {} },
    // day 1 starts
    { commandId: 'c15', type: 'choose_intent', payload: { intent: 'fix_system' } },
    { commandId: 'c16', type: 'choose_action_group', payload: { group: 'product' } },
    { commandId: 'c17', type: 'select_action', payload: { actionId: 'product_pilot' } },
    { commandId: 'c18', type: 'confirm_action', payload: {} },
    { commandId: 'c18_process', type: 'acknowledge_action_process', payload: {} },
    { commandId: 'c19', type: 'acknowledge_action_result', payload: {} },
    { commandId: 'c19_end', type: 'complete_day', payload: {} },
    { commandId: 'c19a', type: 'advance_daily_intro', payload: {} },

    // some content
    { commandId: 'c20', type: 'choose_intent', payload: { intent: 'get_sales' } },
    { commandId: 'c21', type: 'choose_action_group', payload: { group: 'traffic' } },
    { commandId: 'c22', type: 'select_action', payload: { actionId: 'stories_3d' } },
    { commandId: 'c23', type: 'configure_action', payload: { contentType: 'selling' } },
    { commandId: 'c23b', type: 'configure_action', payload: { route: { entry: 'direct_messages', nurture: ['none'], processing: 'manual', saleMethod: 'manual_chat', followup: 'none' } } },
    { commandId: 'c24', type: 'confirm_action', payload: {} },
    { commandId: 'c25', type: 'acknowledge_action_process', payload: {} },
    { commandId: 'c26', type: 'acknowledge_action_result', payload: {} },
    { commandId: 'c26_end', type: 'complete_day', payload: {} },
    { commandId: 'c26a', type: 'advance_daily_intro', payload: {} },

    { commandId: 'end', type: 'choose_intent', payload: { intent: 'finish' } },
    { commandId: 'end2', type: 'resolve_pending_decision', payload: { action: 'confirm' } },
  ])
];

function scenario(
  id: string,
  setup: SetupInput,
  commands: GameCommand[]
): ScenarioFixture {
  return { id, setup, seed: `seed_${id}`, commands };
}
