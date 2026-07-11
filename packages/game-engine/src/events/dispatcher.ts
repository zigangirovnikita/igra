import type { GameConfig, GameState } from '../types';

export function appendTriggeredEvents(previous: GameState, state: GameState, config: GameConfig, actionId?: string): GameState {
  const output = structuredClone(state);
  const already = new Set(output.history.filter((entry) => entry.type === 'game_event').map((entry) => String(entry.payload?.eventId)));
  const candidates = config.events.filter((template) => template.enabled && (!template.once || !already.has(template.id)))
    .filter((template) => matches(template.id, previous, output, actionId))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 2);
  for (const template of candidates) {
    output.history.push({ day: output.resources.day, type: 'game_event', message: template.messages[0] ?? template.id, payload: { eventId: template.id, sceneType: template.sceneType } });
  }
  return output;
}

function matches(id: string, previous: GameState, state: GameState, actionId?: string): boolean {
  const salesDelta = state.metrics.sales - previous.metrics.sales;
  const inboundDelta = state.metrics.inbound - previous.metrics.inbound;
  const content = state.cohorts.at(-1);
  const isAction = (...ids: string[]) => Boolean(actionId && ids.includes(actionId));
  switch (id) {
    case 'low_energy': return previous.resources.energy >= 30 && state.resources.energy < 30;
    case 'zero_energy': return previous.resources.energy > 0 && state.resources.energy <= 0;
    case 'first_sale': return previous.metrics.sales === 0 && state.metrics.sales > 0;
    case 'multiple_sales': return salesDelta > 1;
    case 'stories_without_warmup': return isAction('stories_3d') && content?.contentType === 'selling' && content.routeSnapshot.nurture.includes('none');
    case 'ordinary_reel': return isAction('reels_7d', 'reels_stories_7d') && inboundDelta < 10;
    case 'viral_reel_manual': return isAction('reels_7d', 'reels_stories_7d') && inboundDelta >= 20 && content?.routeSnapshot.processing === 'manual';
    case 'viral_reel_simple_bot': return isAction('reels_7d', 'reels_stories_7d') && inboundDelta >= 20 && content?.routeSnapshot.processing === 'simple_bot';
    case 'viral_reel_ai_bot': return isAction('reels_7d', 'reels_stories_7d') && inboundDelta >= 20 && content?.routeSnapshot.processing === 'ai_bot';
    case 'ai_bot_without_traffic': return actionId?.startsWith('ai_bot') === true && state.metrics.impressions === 0;
    case 'website_without_traffic': return actionId?.startsWith('website') === true && state.metrics.impressions === 0;
    case 'beautiful_site_before_demand': return actionId === 'website_beautiful' && state.assets.demandConfidence === 0;
    case 'manager_no_nurture': return actionId === 'hire_manager' && state.cohorts.every((cohort) => cohort.routeSnapshot.nurture.includes('none'));
    case 'manager_nurtured': return actionId === 'hire_manager' && state.cohorts.some((cohort) => !cohort.routeSnapshot.nurture.includes('none'));
    case 'expensive_website_sale': return (state.launchPlan.productPrice || 0) > 100_000 && state.activeRoute.saleMethod === 'website_auto' && isAction('reels_7d', 'stories_3d');
    case 'expensive_call_sale': return (state.launchPlan.productPrice || 0) > 100_000 && actionId === 'calls';
    case 'pilot_before_product': return actionId === 'product_pilot' && state.assets.productQuality <= 0.95;
    case 'product_before_demand': return isAction('product_self', 'product_home', 'product_studio') && state.assets.demandConfidence === 0;
    case 'selling_story_fatigue': return actionId === 'stories_3d' && state.cohorts.filter((cohort) => cohort.sourceType === 'stories' && cohort.contentType === 'selling').length > 1;
    case 'inbound_lost': return state.metrics.lostLeads > previous.metrics.lostLeads;
    case 'budget_shortage': return previous.resources.bank >= 5_000 && state.resources.bank < 5_000;
    case 'days_shortage': return previous.resources.day <= 26 && state.resources.day > 26;
    case 'capacity_reached': return state.metrics.capacityLostLeads > previous.metrics.capacityLostLeads;
    case 'followup_success': return actionId?.includes('followup') === true && salesDelta > 0;
    case 'followup_failed': return actionId?.includes('followup') === true && salesDelta === 0;
    case 'business_goal_early': return previous.metrics.revenue < previous.targets.targetRevenue && state.metrics.revenue >= state.targets.targetRevenue && state.resources.day < 30;
    case 'consultation_risk_reveal': return isAction('consultation_basic', 'consultation_detailed');
    case 'call_booked': return state.metrics.bookedCalls > previous.metrics.bookedCalls;
    case 'call_no_show': return state.metrics.bookedCalls > state.metrics.heldCalls && actionId === 'calls';
    case 'client_considering': return state.cohorts.some((cohort) => cohort.pendingFollowup > 0) && salesDelta === 0;
    case 'simple_bot_missed_custom': return content?.routeSnapshot.processing === 'simple_bot' && content.processed < content.activated;
    case 'ai_bot_application': return content?.routeSnapshot.processing === 'ai_bot' && state.metrics.applications > previous.metrics.applications;
    default: return false;
  }
}
