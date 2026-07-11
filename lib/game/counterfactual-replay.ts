import { applyCommand, createInitialState, type GameCommand, type GameConfig, type GameState } from '@/packages/game-engine/src';

type Counterfactual = { change: string; expectedProfitDelta: number };
type Transformer = (command: GameCommand, original: GameState) => GameCommand;

export function buildReplayCounterfactuals(original: GameState, config: GameConfig): Counterfactual[] {
  const baselineProfit = original.metrics.revenue - original.metrics.expenses;
  const scenarios: Array<{ change: string; transform: Transformer }> = [
    {
      change: 'Не игнорировать входящие и обработать доступный объём',
      transform: (command) => {
        if (command.type === 'resolve_pending_decision' && ['ignore', 'defer'].includes(command.payload.action)) {
          return { ...command, payload: { ...command.payload, action: 'process_available' } } as GameCommand;
        }
        return command;
      },
    },
    {
      change: 'Не бросать сомневающихся без дожима',
      transform: (command) => {
        if (command.type === 'resolve_pending_decision' && command.payload.action === 'ignore') {
          return { ...command, payload: { ...command.payload, action: 'followup_message' } } as GameCommand;
        }
        return command;
      },
    },
    {
      change: 'Дорогой продукт продавать через созвон',
      transform: (command, source) => {
        if (
          (source.launchPlan.productPrice ?? 0) > 50_000 &&
          command.type === 'resolve_pending_decision' &&
          ['sell_chat', 'sell_website', 'sell_bot'].includes(command.payload.action)
        ) {
          return { ...command, payload: { ...command.payload, action: 'sell_call' } } as GameCommand;
        }
        return command;
      },
    },
  ];

  const results: Counterfactual[] = [];
  for (const scenario of scenarios) {
    const replay = replayDecisionLog(original, config, scenario.transform);
    if (!replay) continue;
    const replayProfit = replay.metrics.revenue - replay.metrics.expenses;
    const delta = Math.round(replayProfit - baselineProfit);
    if (delta > 0) results.push({ change: scenario.change, expectedProfitDelta: delta });
  }

  return results.sort((left, right) => right.expectedProfitDelta - left.expectedProfitDelta).slice(0, 3);
}

function replayDecisionLog(original: GameState, config: GameConfig, transform: Transformer): GameState | null {
  let state = createInitialState(original.player, config, original.seed);
  const replayConfig: GameConfig = { ...config, events: [] };

  try {
    for (const record of original.decisionLog) {
      if (['request_finish', 'cancel_finish', 'abandon_game', 'repair_flow'].includes(record.commandType)) continue;
      const command = {
        commandId: `replay_${record.sequence}_${record.commandType}`,
        type: record.commandType,
        payload: structuredClone(record.payload),
      } as GameCommand;
      state = applyCommand(state, replayConfig, transform(command, original));
    }
    return state;
  } catch {
    return null;
  }
}
