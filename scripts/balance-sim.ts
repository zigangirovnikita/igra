import {
  defaultV4Funnel,
  simulateV4Attempt,
  type V4FunnelStage,
} from '../packages/game-engine/src';

type Summary = {
  policy: string;
  runs: number;
  wins: number;
  sustainableWins: number;
  revenue: number[];
  totalMoney: number[];
  profit: number[];
  finalEnergy: number[];
  invariantViolations: number;
};

const runs = getRuns();
const policies = new Map<string, V4FunnelStage[]>([
  ['default_reels_ai_webinar_site', defaultV4Funnel()],
  ['reels_ai_webinar_site', [
    { id: 'a', instrumentId: 'reels', execution: 'expert', offerMode: 'free', tripwirePrice: null, volume: 24 },
    { id: 'b', instrumentId: 'ai_bot', execution: 'expert', offerMode: 'free', tripwirePrice: null, volume: 1 },
    { id: 'c', instrumentId: 'auto_webinar', execution: 'expert', offerMode: 'free', tripwirePrice: null, volume: 1 },
    { id: 'd', instrumentId: 'website', execution: 'expert', offerMode: 'main_product', tripwirePrice: null, volume: 1 },
  ]],
  ['stories_lesson_site', [
    { id: 'a', instrumentId: 'stories', execution: 'expert', offerMode: 'free', tripwirePrice: null, volume: 20 },
    { id: 'b', instrumentId: 'video_lesson', execution: 'expert', offerMode: 'tripwire', tripwirePrice: 990, volume: 1 },
    { id: 'c', instrumentId: 'website', execution: 'expert', offerMode: 'main_product', tripwirePrice: null, volume: 1 },
  ]],
  ['telegram_guide_ai_site', [
    { id: 'a', instrumentId: 'telegram', execution: 'expert', offerMode: 'free', tripwirePrice: null, volume: 18 },
    { id: 'b', instrumentId: 'guide', execution: 'expert', offerMode: 'free', tripwirePrice: null, volume: 1 },
    { id: 'c', instrumentId: 'ai_bot', execution: 'expert', offerMode: 'tripwire', tripwirePrice: 1500, volume: 1 },
    { id: 'd', instrumentId: 'website', execution: 'expert', offerMode: 'main_product', tripwirePrice: null, volume: 1 },
  ]],
  ['bad_paid_ads_calls', [
    { id: 'a', instrumentId: 'paid_ads', execution: 'expert', offerMode: 'free', tripwirePrice: null, volume: 55_000 },
    { id: 'b', instrumentId: 'telegram', execution: 'self', offerMode: 'free', tripwirePrice: null, volume: 14 },
    { id: 'c', instrumentId: 'call', execution: 'self', offerMode: 'main_product', tripwirePrice: null, volume: 1 },
  ]],
]);

const summaries = [...policies.keys()].map((policy) => createSummary(policy));

for (let index = 0; index < runs; index += 1) {
  for (const summary of summaries) {
    try {
      const stages = policies.get(summary.policy);
      if (!stages) throw new Error('Missing policy');
      const report = simulateV4Attempt({
        seed: `${summary.policy}_${index}`,
        dreamPrice: 300_000,
        mainProductPrice: 30_000,
        stages,
        manualActions: summary.policy.includes('bad') ? 18 : 14,
      });
      summary.runs += 1;
      summary.wins += report.result !== 'not_reached' ? 1 : 0;
      summary.sustainableWins += report.result === 'sustainable_win' ? 1 : 0;
      summary.revenue.push(report.totalRevenue);
      summary.totalMoney.push(report.totalMoney);
      summary.profit.push(report.totalRevenue - report.spent);
      summary.finalEnergy.push(report.energyRemaining);
      if (!report.valid && !summary.policy.includes('bad')) summary.invariantViolations += 1;
      if (report.totalMoney !== report.bankRemaining + report.totalRevenue) summary.invariantViolations += 1;
      if (report.totalRevenue !== report.mainProductRevenue + report.tripwireRevenue) summary.invariantViolations += 1;
    } catch (error) {
      summary.invariantViolations += 1;
      if (runs <= 100) console.error(`V4 simulation error in ${summary.policy}:`, error);
    }
  }
}

const report = summaries.map((summary) => ({
  policy: summary.policy,
  runs: summary.runs,
  winRate: pct(summary.wins / Math.max(1, summary.runs)),
  sustainableWinRate: pct(summary.sustainableWins / Math.max(1, summary.runs)),
  revenueMedian: percentile(summary.revenue, 0.5),
  totalMoneyMedian: percentile(summary.totalMoney, 0.5),
  revenueP10: percentile(summary.revenue, 0.1),
  revenueP90: percentile(summary.revenue, 0.9),
  profitMedian: percentile(summary.profit, 0.5),
  energyMedian: percentile(summary.finalEnergy, 0.5),
  invariantViolations: summary.invariantViolations,
}));

console.table(report);
const violations = report.reduce((sum, item) => sum + item.invariantViolations, 0);
if (violations > 0) throw new Error(`V4 balance simulation found ${violations} invariant violations`);
const viablePolicies = report.filter((item) => item.winRate !== '0%' && !item.policy.includes('bad')).length;
if (viablePolicies < 2) {
  throw new Error(`V4 balance quality gate failed: expected at least 2 viable policies, got ${viablePolicies}`);
}

function createSummary(policy: string): Summary {
  return {
    policy,
    runs: 0,
    wins: 0,
    sustainableWins: 0,
    revenue: [],
    totalMoney: [],
    profit: [],
    finalEnergy: [],
    invariantViolations: 0,
  };
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
