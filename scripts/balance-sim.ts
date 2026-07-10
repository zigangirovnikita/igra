import { applyCommand, assertStateInvariants, createInitialState, type GameState } from '../packages/game-engine/src';
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
  const summary = getSummary(summaries, fixture.policy);
  try {
    let state = createInitialState(fixture.setup, config, `${fixture.seed}_${index}`);
    for (const command of fixture.commands) {
      state = applyCommand(state, config, { ...command, commandId: `${command.commandId}_${index}` });
    }
    assertStateInvariants(state, config);
    collect(summary, state);
  } catch (error) {
    summary.invariantViolations += 1;
    if (runs <= 100) {
      console.error(`Simulation error in ${fixture.id}:`, error);
    }
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
  invariantViolations: summary.invariantViolations
}));

console.table(report);

const violations = report.reduce((sum, item) => sum + item.invariantViolations, 0);
if (violations > 0) {
  throw new Error(`Balance simulation found ${violations} invariant violations`);
}

function collect(summary: Summary, state: GameState): void {
  summary.runs += 1;
  summary.wins += state.metrics.sales >= state.targets.targetSales ? 1 : 0;
  summary.revenue.push(state.metrics.revenue);
  summary.profit.push(state.metrics.revenue - state.metrics.expenses);
  summary.finalEnergy.push(state.resources.energy);
}

function getSummary(summaries: Map<string, Summary>, policy: string): Summary {
  const existing = summaries.get(policy);
  if (existing) return existing;
  const created: Summary = { policy, runs: 0, wins: 0, revenue: [], profit: [], finalEnergy: [], invariantViolations: 0 };
  summaries.set(policy, created);
  return created;
}

function getRuns(): number {
  const flagIndex = process.argv.indexOf('--runs');
  if (flagIndex >= 0) return Number(process.argv[flagIndex + 1] ?? 50_000);
  return 50_000;
}

function percentile(values: number[], percentileValue: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * percentileValue)));
  return Math.round(sorted[index]);
}

function pct(value: number): string {
  return `${Math.round(value * 1000) / 10}%`;
}
