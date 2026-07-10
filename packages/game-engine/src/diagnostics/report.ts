import type { Diagnostics, GameConfig, GameState } from '../types';

export function calculateDiagnostics(state: GameState, config: GameConfig): Diagnostics {
  void config;
  const revenue = state.metrics.revenue;
  const expenses = state.metrics.expenses;
  const launchProfit = revenue - expenses;
  const bankRemaining = state.resources.bank;
  const totalLiquidity = bankRemaining + revenue;
  const dreamMoney = Math.max(0, launchProfit);
  const finalStatus =
    state.metrics.sales >= state.targets.targetSales ? 'business_goal_reached' :
    revenue === 0 ? 'zero_revenue' :
    launchProfit > 0 ? 'profitable_without_goal' :
    'learning_launch';

  return {
    finalStatus,
    financials: {
      revenue,
      expenses,
      launchProfit,
      bankRemaining,
      totalLiquidity,
      dreamMoney
    },
    strongDecisions: detectStrongDecisions(state),
    bottlenecks: detectBottlenecks(state),
    counterfactuals: buildCounterfactuals(state)
  };
}

function detectStrongDecisions(state: GameState): string[] {
  const decisions: string[] = [];
  if (state.assets.demandConfidence >= 0.7) decisions.push('Проверка спроса до масштабирования');
  if (state.assets.aiBot || state.assets.manager) decisions.push('Усиление обработки входящих');
  if (state.activeRoute.followup !== 'none') decisions.push('Дожим думающих лидов');
  if (state.metrics.sales >= state.targets.targetSales) decisions.push('Достижение бизнес-цели');
  return decisions.slice(0, 3);
}

function detectBottlenecks(state: GameState): Array<{ category: string; expectedLoss: number }> {
  const items = [
    { category: 'processing', expectedLoss: state.metrics.expectedLostRevenue },
    { category: 'capacity', expectedLoss: state.metrics.capacityLostLeads * state.player.productPrice * 0.5 },
    { category: 'energy', expectedLoss: state.resources.energy < 30 ? state.metrics.revenue * 0.15 : 0 },
    { category: 'traffic', expectedLoss: state.metrics.impressions < 1_000 ? state.player.productPrice * 3 : 0 }
  ];
  return items.filter((item) => item.expectedLoss > 0).sort((a, b) => b.expectedLoss - a.expectedLoss).slice(0, 3);
}

function buildCounterfactuals(state: GameState): Array<{ change: string; expectedProfitDelta: number }> {
  const items = [
    {
      change: 'Ручная обработка -> ИИ-бот',
      expectedProfitDelta: state.activeRoute.processing === 'manual' ? state.metrics.expectedLostRevenue * 0.35 - 25_000 : 0
    },
    {
      change: 'Нет проверки спроса -> пилотное предложение',
      expectedProfitDelta: state.assets.demandConfidence < 1 ? state.metrics.revenue * 0.15 : 0
    },
    {
      change: 'Нет дожима -> подходящий дожим',
      expectedProfitDelta: state.activeRoute.followup === 'none' ? state.metrics.revenue * 0.08 : 0
    }
  ];
  return items.filter((item) => item.expectedProfitDelta > 0).sort((a, b) => b.expectedProfitDelta - a.expectedProfitDelta).slice(0, 3);
}
