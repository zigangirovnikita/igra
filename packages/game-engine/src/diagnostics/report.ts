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
    counterfactuals: buildCounterfactuals(state),
    mistakes: detectMistakes(state),
    dreams: buildDreamResults(state, config, dreamMoney),
  };
}

function buildDreamResults(state: GameState, config: GameConfig, money: number) {
  let remaining = money;
  return state.launchPlan.dreams.map((id) => {
    const dream = config.dreams.find((item) => item.id === id);
    const price = dream?.price ?? 0;
    const affordable = remaining >= price;
    if (affordable) remaining -= price;
    return { id, title: dream?.title ?? id, price, affordable };
  });
}

function detectMistakes(state: GameState): Array<{ day: number; message: string; category: string }> {
  const actions = state.history.filter((entry) => entry.type === 'action_started');
  const result: Array<{ day: number; message: string; category: string }> = [];
  const fullProduct = actions.find((entry) => ['product_self', 'product_home', 'product_studio'].includes(String(entry.payload?.actionId)));
  const demand = actions.find((entry) => String(entry.payload?.actionId).startsWith('demand_'));
  if (fullProduct && (!demand || fullProduct.day < demand.day)) result.push({ day: fullProduct.day, category: 'sequence', message: `На ${fullProduct.day}-й день вы начали полный продукт до проверки спроса.` });
  const earlySelling = state.cohorts.find((cohort) => cohort.contentType === 'selling' && cohort.routeSnapshot.nurture.includes('none'));
  if (earlySelling) result.push({ day: earlySelling.createdDay, category: 'nurture', message: `На ${earlySelling.createdDay}-й день вы начали продавать без прогрева.` });
  const lost = state.cohorts.find((cohort) => cohort.lost > 0);
  if (lost) result.push({ day: lost.createdDay, category: 'processing', message: `После контента на ${lost.createdDay}-й день часть входящих остыла без обработки.` });
  const reflection = state.history.find((entry) => entry.type === 'reflection' && entry.message === 'audience');
  if (reflection) result.push({ day: reflection.day, category: 'diagnosis', message: `На ${reflection.day}-й день вы объяснили слабый результат только размером аудитории и не проверили маршрут.` });
  if (state.resources.energy < 30) result.push({ day: state.resources.day, category: 'energy', message: 'К концу запуска энергия упала ниже безопасного уровня и ограничила ручную работу.' });
  return result.slice(0, 3);
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
  const price = state.launchPlan.productPrice || 0;
  const items = [
    { category: 'processing', expectedLoss: state.metrics.expectedLostRevenue },
    { category: 'capacity', expectedLoss: state.metrics.capacityLostLeads * price * 0.5 },
    { category: 'energy', expectedLoss: state.resources.energy < 30 ? state.metrics.revenue * 0.15 : 0 },
    { category: 'traffic', expectedLoss: state.metrics.impressions < 1_000 ? price * 3 : 0 }
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
    },
    {
      change: 'Полный продукт до спроса -> быстрый пилот',
      expectedProfitDelta: state.history.some((entry) => entry.type === 'action_started' && ['product_home', 'product_studio'].includes(String(entry.payload?.actionId))) && state.assets.demandConfidence < 0.7 ? 20_000 : 0
    },
    {
      change: 'Продажа дорогого продукта напрямую -> созвон',
      expectedProfitDelta: (state.launchPlan.productPrice || 0) > 50_000 && state.activeRoute.saleMethod !== 'call' ? state.metrics.applications * (state.launchPlan.productPrice || 0) * 0.08 : 0
    }
  ];
  return items.filter((item) => item.expectedProfitDelta > 0).sort((a, b) => b.expectedProfitDelta - a.expectedProfitDelta).slice(0, 3);
}
