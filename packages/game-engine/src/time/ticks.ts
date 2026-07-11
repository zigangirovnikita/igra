import type { GameState } from '../types';
import { clamp } from '../state/invariants';

export function recalculateMetrics(state: GameState): void {
  const expenses = 100_000 - state.resources.bank;
  state.metrics = {
    ...state.metrics,
    impressions: sum(state.cohorts, 'impressions'),
    responses: sum(state.cohorts, 'responses'),
    activated: sum(state.cohorts, 'activated'),
    processed: sum(state.cohorts, 'processed'),
    applications: sum(state.cohorts, 'applications'),
    bookedCalls: sum(state.cohorts, 'bookedCalls'),
    heldCalls: sum(state.cohorts, 'heldCalls'),
    sales: sum(state.cohorts, 'sales'),
    revenue: sum(state.cohorts, 'sales') * (state.launchPlan.productPrice || 0),
    expenses,
    capacityLostLeads: sum(state.cohorts, 'capacityLostLeads'),
    lostLeads: sum(state.cohorts, 'lost'),
    expectedLostRevenue: sum(state.cohorts, 'lost') * expectedDownstreamSaleProbability(state) * (state.launchPlan.productPrice || 0)
  };
}

function expectedDownstreamSaleProbability(state: GameState): number {
  const processed = Math.max(1, state.metrics.processed);
  return clamp(state.metrics.sales / processed, 0.001, 0.6);
}

function sum(items: GameState['cohorts'], key: keyof GameState['cohorts'][number]): number {
  return items.reduce((total, item) => total + Number(item[key] ?? 0), 0);
}
