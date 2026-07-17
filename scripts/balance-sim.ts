import {
  applyCommand,
  assertStateInvariants,
  buildV3ActiveStagePlan,
  createInitialState,
  type GameCommand,
  type GameState,
  type V3ActiveActionLogEntry,
} from '../packages/game-engine/src';
import { loadGameConfig } from '../lib/config/game-config';
import { scenarios } from '../tests/fixtures/scenarios';

type Summary = {
  policy: string;
  runs: number;
  wins: number;
  revenue: number[];
  profit: number[];
  finalEnergy: number[];
  invariantViolations: number;
};

const runs = getRuns();
const config = loadGameConfig();
const summaries = new Map<string, Summary>();

for (let index = 0; index < runs; index += 1) {
  const fixture = scenarios[index % scenarios.length];
  const summary = getSummary(summaries, fixture.id);
  try {
    let state = createInitialState(fixture.setup, config, `${fixture.seed}_${index}`);
    for (const command of fixture.commands) {
      const preparedCommand = command.type === 'v3_complete_active_stage'
        ? { ...command, payload: { actionLog: buildSimulatedV3ActionLog(state) } }
        : command;
      state = applyCommand(state, config, { ...preparedCommand, commandId: `${command.commandId}_${index}` });
      state = resolveAllPending(state, index);
    }
    assertStateInvariants(state, config);
    collect(summary, state);
  } catch (error) {
    summary.invariantViolations += 1;
    if (runs <= 100) console.error(`Simulation error in ${fixture.id}:`, error);
  }
}

const report = [...summaries.values()].map((summary) => ({
  policy: summary.policy,
  runs: summary.runs,
  winRate: pct(summary.wins / Math.max(1, summary.runs)),
  revenueMedian: percentile(summary.revenue, 0.5),
  revenueP10: percentile(summary.revenue, 0.1),
  revenueP90: percentile(summary.revenue, 0.9),
  profitMedian: percentile(summary.profit, 0.5),
  energyMedian: percentile(summary.finalEnergy, 0.5),
  invariantViolations: summary.invariantViolations,
}));

console.table(report);
const violations = report.reduce((sum, item) => sum + item.invariantViolations, 0);
if (violations > 0) throw new Error(`Balance simulation found ${violations} invariant violations`);
const allPoliciesLose = report.every((item) => item.winRate === '0%');
const allPoliciesBurnOut = report.every((item) => item.energyMedian === 0);
if (allPoliciesLose) console.warn('Balance warning: every policy has 0% win rate. This simulator now reports the problem instead of treating it as a healthy balance.');
if (allPoliciesBurnOut) throw new Error('Balance simulation quality gate failed: every policy ends with zero median energy');

function buildSimulatedV3ActionLog(state: GameState): V3ActiveActionLogEntry[] {
  const plan = state.v3.activeStage?.plan ?? buildV3ActiveStagePlan(state);
  const log: V3ActiveActionLogEntry[] = [];
  let cursorMs = 0;
  let sequence = 0;
  const push = (type: V3ActiveActionLogEntry['type'], targetId: string, startedAtMs: number, durationSeconds: number) => {
    const completedAtMs = startedAtMs + durationSeconds * 1000;
    if (completedAtMs > plan.durationSeconds * 1000) return false;
    sequence += 1;
    log.push({ id: `sim_${sequence}`, type, targetId, startedAtMs, completedAtMs });
    cursorMs = completedAtMs;
    return true;
  };

  for (const message of plan.warmupMessages) {
    const startedAtMs = Math.max(cursorMs, message.second * 1000);
    if (startedAtMs + 1000 > message.expiresSecond * 1000) continue;
    if (!push('answer', message.id, startedAtMs, 1)) return log;
  }

  const salesKey = state.v3.activeSelection.sales ?? '';
  const useCalls = salesKey.includes('call_script') || salesKey === 'sales:intuition';
  const useSiteChats = salesKey.includes('website') || salesKey.includes('auto_webinar');
  if (useCalls) {
    for (const outcome of plan.callOutcomes) {
      if (!push('call', outcome.id, cursorMs, plan.callDurationSeconds)) return log;
      if (outcome.followupMessage && !push('post_call_chat', outcome.id, cursorMs, plan.chatDurationSeconds)) return log;
    }
    return log;
  }

  const chatType: V3ActiveActionLogEntry['type'] = useSiteChats ? 'site_chat' : 'direct_chat';
  for (const outcome of plan.chatOutcomes) {
    if (!push(chatType, outcome.id, cursorMs, plan.chatDurationSeconds)) return log;
  }
  return log;
}

function resolveAllPending(input: GameState, runIndex: number): GameState {
  let state = input;
  let guard = 0;
  while (state.pendingDecision && guard < 20) {
    guard += 1;
    const decision = state.pendingDecision;
    const cohortId = 'cohortId' in decision ? decision.cohortId : undefined;
    let command: GameCommand;

    if (decision.type === 'mini_game') {
      command = {
        commandId: `sim_mini_${runIndex}_${guard}`,
        type: 'resolve_mini_game',
        payload: { cohortId: decision.cohortId, mode: 'auto', processed: 0 },
      };
    } else if (decision.type === 'inbound') {
      command = {
        commandId: `sim_inbound_${runIndex}_${guard}`,
        type: 'resolve_pending_decision',
        payload: {
          cohortId,
          action: state.resources.energy >= 0.3 ? 'process_available' : 'ignore',
        },
      };
    } else if (decision.type === 'sales') {
      command = {
        commandId: `sim_sales_${runIndex}_${guard}`,
        type: 'resolve_pending_decision',
        payload: {
          cohortId,
          action: state.resources.energy >= 0.5 ? 'process' : 'ignore',
          amount: 10,
        },
      };
    } else if (decision.type === 'followup') {
      command = {
        commandId: `sim_followup_${runIndex}_${guard}`,
        type: 'resolve_pending_decision',
        payload: { cohortId, action: state.resources.energy >= 5 ? 'followup_message' : 'ignore' },
      };
    } else if (decision.type === 'energy_crisis') {
      command = {
        commandId: `sim_energy_${runIndex}_${guard}`,
        type: 'resolve_pending_decision',
        payload: { action: state.resources.day < config.totalDays ? 'rest_day' : 'confirm' },
      };
    } else if (decision.type === 'budget_notice') {
      command = {
        commandId: `sim_budget_${runIndex}_${guard}`,
        type: 'resolve_pending_decision',
        payload: { action: 'continue_without_budget' },
      };
    } else if (decision.type === 'goal_reached') {
      command = {
        commandId: `sim_goal_${runIndex}_${guard}`,
        type: 'resolve_pending_decision',
        payload: { action: 'cancel' },
      };
    } else {
      command = {
        commandId: `sim_finish_${runIndex}_${guard}`,
        type: 'resolve_pending_decision',
        payload: { action: 'cancel' },
      };
    }

    state = applyCommand(state, config, command);
  }
  if (guard >= 20 && state.pendingDecision) throw new Error(`Pending decision loop: ${state.pendingDecision.type}`);
  return state;
}

function collect(summary: Summary, state: GameState): void {
  summary.runs += 1;
  summary.wins += state.metrics.sales >= state.targets.targetSales ? 1 : 0;
  summary.revenue.push(state.metrics.revenue);
  summary.profit.push(state.metrics.revenue - state.metrics.expenses);
  summary.finalEnergy.push(state.resources.energy);
}

function getSummary(summaries: Map<string, Summary>, policyName: string): Summary {
  const existing = summaries.get(policyName);
  if (existing) return existing;
  const created: Summary = { policy: policyName, runs: 0, wins: 0, revenue: [], profit: [], finalEnergy: [], invariantViolations: 0 };
  summaries.set(policyName, created);
  return created;
}

function getRuns(): number {
  const flagIndex = process.argv.indexOf('--runs');
  if (flagIndex >= 0) return Number(process.argv[flagIndex + 1] ?? 50_000);
  return 50_000;
}

function percentile(values: number[], percentileValue: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * percentileValue)));
  return Math.round(sorted[index]);
}

function pct(value: number): string {
  return `${Math.round(value * 1000) / 10}%`;
}
