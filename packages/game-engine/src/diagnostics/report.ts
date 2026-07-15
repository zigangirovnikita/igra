import type { Diagnostics, GameConfig, GameState } from '../types';

export function calculateDiagnostics(state: GameState, config: GameConfig): Diagnostics {
  const revenue = state.metrics.revenue;
  const bankRemaining = state.resources.bank;
  const expenses = Math.max(0, config.startingBank - bankRemaining);
  const launchProfit = revenue - expenses;
  const totalLiquidity = bankRemaining + revenue;
  const dreamMoney = Math.max(0, launchProfit);
  const finalStatus =
    state.metrics.sales >= state.targets.targetSales || (state.targets.targetRevenue > 0 && revenue >= state.targets.targetRevenue) ? 'business_goal_reached' :
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
      dreamMoney,
    },
    strongDecisions: detectStrongDecisions(state),
    bottlenecks: detectBottlenecks(state),
    counterfactuals: [],
    mistakes: detectMistakes(state),
    dreams: buildDreamResults(state, config, dreamMoney),
  };
}

export function buildAIDiagnosticContext(state: GameState, config: GameConfig): Record<string, unknown> {
  const diagnostics = calculateDiagnostics(state, config);
  return {
    version: config.version,
    finalStatus: diagnostics.finalStatus,
    financials: diagnostics.financials,
    mistakes: diagnostics.mistakes.map((mistake) => mistake.message),
    strongDecisions: diagnostics.strongDecisions,
    bottlenecks: diagnostics.bottlenecks,
    counterfactuals: diagnostics.counterfactuals,
    metrics: {
      sales: state.metrics.sales,
      revenue: state.metrics.revenue,
      expenses: diagnostics.financials.expenses,
      inbound: state.metrics.inbound,
      lostLeads: state.metrics.lostLeads,
    },
    daysPlayed: state.resources.day,
    endingReason: state.endingReason,
  };
}

function buildDreamResults(state: GameState, config: GameConfig, money: number) {
  let remaining = money;
  return state.launchPlan.dreams.map((id) => {
    if (id.startsWith('custom:')) {
      const price = state.v3.customDreamPrice ?? 0;
      const affordable = remaining >= price;
      if (affordable) remaining -= price;
      return { id, title: state.v3.customDreamTitle ?? id.replace('custom:', ''), price, affordable };
    }
    const dream = config.dreams.find((item) => item.id === id);
    const price = dream?.price ?? 0;
    const affordable = remaining >= price;
    if (affordable) remaining -= price;
    return { id, title: dream?.title ?? id, price, affordable };
  });
}

function detectMistakes(state: GameState): Array<{ day: number; message: string; category: string }> {
  if (state.v3.stageReports.length > 0) return detectV3Mistakes(state);

  const actions = state.history.filter((entry) => entry.type === 'action_completed');
  const result: Array<{ day: number; message: string; category: string }> = [];
  const fullProduct = actions.find((entry) => ['product_self', 'product_home', 'product_studio'].includes(String(entry.payload?.actionId)));
  const demand = actions.find((entry) => String(entry.payload?.actionId).startsWith('demand_') || entry.payload?.actionId === 'product_pilot');
  if (fullProduct && (!demand || fullProduct.day < demand.day)) {
    result.push({ day: fullProduct.day, category: 'sequence', message: `На ${fullProduct.day}-й день вы начали полный продукт до проверки спроса.` });
  }
  const earlySelling = state.cohorts.find((cohort) => cohort.contentType === 'selling' && cohort.routeSnapshot.nurture.includes('none'));
  if (earlySelling) {
    result.push({ day: earlySelling.createdDay, category: 'nurture', message: `На ${earlySelling.createdDay}-й день вы начали продавать без прогрева.` });
  }
  const lost = state.cohorts.find((cohort) => Object.values(cohort.losses).reduce((sum, value) => sum + value, 0) > 0);
  if (lost) {
    result.push({ day: lost.createdDay, category: 'processing', message: `После действия на ${lost.createdDay}-й день часть людей была потеряна на одном из этапов воронки.` });
  }
  if (state.resources.energy < 30) {
    result.push({ day: state.resources.day, category: 'energy', message: 'К концу запуска энергия упала ниже безопасного уровня и ограничила ручную работу.' });
  }
  return result.slice(0, 3);
}

function detectStrongDecisions(state: GameState): string[] {
  if (state.v3.stageReports.length > 0) return detectV3StrongDecisions(state);

  const decisions: string[] = [];
  if (state.assets.demandConfidence >= 0.7) decisions.push('Проверка спроса до масштабирования');
  if (state.assets.aiBot || state.assets.manager) decisions.push('Усиление обработки входящих');
  if (state.activeRoute.followup !== 'none') decisions.push('Дожим думающих лидов');
  if (state.metrics.sales >= state.targets.targetSales) decisions.push('Достижение бизнес-цели');
  return decisions.slice(0, 3);
}

function detectBottlenecks(state: GameState): Array<{ category: string; expectedLoss: number }> {
  if (state.v3.stageReports.length > 0) return detectV3Bottlenecks(state);

  const price = state.launchPlan.productPrice || 0;
  const items = [
    { category: 'processing', expectedLoss: state.metrics.expectedLostRevenue },
    { category: 'capacity', expectedLoss: state.metrics.capacityLostLeads * price * 0.5 },
    { category: 'energy', expectedLoss: state.resources.energy < 30 ? state.metrics.revenue * 0.15 : 0 },
    { category: 'traffic', expectedLoss: state.metrics.impressions < 1_000 ? price * 3 : 0 },
  ];
  return items.filter((item) => item.expectedLoss > 0).sort((left, right) => right.expectedLoss - left.expectedLoss).slice(0, 3);
}

function detectV3Mistakes(state: GameState): Array<{ day: number; message: string; category: string }> {
  const result: Array<{ day: number; message: string; category: string }> = [];
  const reports = state.v3.stageReports;
  const firstLowTraffic = reports.find((report) => report.newLeads < 30);
  if (firstLowTraffic) {
    result.push({
      day: firstLowTraffic.startedDay,
      category: 'traffic',
      message: `В попытке №${firstLowTraffic.stageNumber} рекламы хватило только на ${firstLowTraffic.newLeads} лидов. Воронке не хватило входящего потока.`,
    });
  }

  const firstLostApplications = reports.find((report) => report.lost > 0);
  if (firstLostApplications) {
    result.push({
      day: firstLostApplications.startedDay,
      category: 'processing',
      message: `В попытке №${firstLostApplications.stageNumber} остывших заявок без ответа: ${firstLostApplications.lost}. Они не дошли до продаж.`,
    });
  }

  const weakSales = reports.find((report) =>
    report.applications > 0
    && report.salesCount === 0
    && report.callsHeld + report.chatsHeld + report.siteVisits > 0
  );
  if (weakSales) {
    result.push({
      day: weakSales.startedDay,
      category: 'sales',
      message: `В попытке №${weakSales.stageNumber} заявки были, но продаж не получилось. Слабое место было на этапе продажи.`,
    });
  }

  const unprepared = reports.find((report) =>
    report.adTitle.includes('без подготовки')
    || report.warmupTitle.includes('руками')
    || report.salesTitle.includes('по наитию')
  );
  if (unprepared) {
    result.push({
      day: unprepared.startedDay,
      category: 'preparation',
      message: `В попытке №${unprepared.stageNumber} часть связки шла без подготовки, поэтому результат сильнее зависел от ручной нагрузки и случайности.`,
    });
  }

  if (state.resources.energy < 30) {
    result.push({
      day: state.resources.day,
      category: 'energy',
      message: 'К концу запуска энергия упала ниже безопасного уровня и ограничила ручную работу.',
    });
  }

  return result.slice(0, 3);
}

function detectV3StrongDecisions(state: GameState): string[] {
  const decisions: string[] = [];
  if (state.v3.preparedTools.length > 0 || state.v3.preparedAds.length > 0 || state.v3.stageReports.some((report) =>
    !report.adTitle.includes('без подготовки')
    || !report.warmupTitle.includes('руками')
    || !report.salesTitle.includes('по наитию')
  )) {
    decisions.push('Подготовка инструментов перед активным этапом');
  }
  if (state.v3.stageReports.some((report) => report.applications > 0)) decisions.push('Доведение лидов до заявок');
  if (state.v3.stageReports.some((report) => report.salesCount > 0)) decisions.push('Обработка заявок до продаж');
  if (state.history.some((entry) => entry.type === 'v3_advice')) decisions.push('Использование консультации перед решением');
  if (state.metrics.sales >= state.targets.targetSales || (state.targets.targetRevenue > 0 && state.metrics.revenue >= state.targets.targetRevenue)) {
    decisions.push('Достижение бизнес-цели');
  }
  return decisions.slice(0, 3);
}

function detectV3Bottlenecks(state: GameState): Array<{ category: string; expectedLoss: number }> {
  const price = state.launchPlan.productPrice || 0;
  const reports = state.v3.stageReports;
  const totals = reports.reduce((acc, report) => ({
    views: acc.views + report.views,
    leads: acc.leads + report.newLeads,
    notInterested: acc.notInterested + report.notInterested,
    applications: acc.applications + report.applications,
    lost: acc.lost + report.lost,
    salesActions: acc.salesActions + report.callsHeld + report.chatsHeld + report.siteVisits,
    noBuys: acc.noBuys + report.callsNoBuy + report.chatsNoBuy + Math.max(0, report.siteVisits - report.siteBuys),
  }), {
    views: 0,
    leads: 0,
    notInterested: 0,
    applications: 0,
    lost: 0,
    salesActions: 0,
    noBuys: 0,
  });
  const targetSalesGap = Math.max(0, state.targets.targetSales - state.metrics.sales);
  const averageSaleValue = Math.max(price, state.targets.targetRevenue > 0 && state.targets.targetSales > 0
    ? Math.round(state.targets.targetRevenue / state.targets.targetSales)
    : price);
  const items = [
    {
      category: 'traffic',
      expectedLoss: totals.leads < Math.max(60, state.targets.targetSales * 8)
        ? targetSalesGap * averageSaleValue * 0.35
        : 0,
    },
    {
      category: 'warmup',
      expectedLoss: totals.notInterested > totals.applications
        ? Math.min(totals.notInterested, targetSalesGap * 6) * averageSaleValue * 0.08
        : 0,
    },
    {
      category: 'processing',
      expectedLoss: totals.lost * averageSaleValue * 0.12,
    },
    {
      category: 'sales',
      expectedLoss: totals.applications > 0 && totals.noBuys > state.metrics.sales
        ? Math.min(totals.noBuys, Math.max(1, targetSalesGap * 4)) * averageSaleValue * 0.10
        : 0,
    },
    {
      category: 'energy',
      expectedLoss: state.resources.energy < 30 ? Math.max(state.metrics.revenue * 0.15, averageSaleValue) : 0,
    },
  ];
  return items.filter((item) => item.expectedLoss > 0).sort((left, right) => right.expectedLoss - left.expectedLoss).slice(0, 3);
}
