import type { ContentType, GameConfig, GameState, LeadCohort, RouteSnapshot, SourceType } from '../types';
import { keyedRandomMultiplier } from '../random/keyed';
import { lowEnergyContentMultiplier } from './modifiers';

export function createContentCohort(
  state: GameState,
  config: GameConfig,
  actionId: string,
  contentType: ContentType,
  occurrenceIndex: number
): LeadCohort | null {
  const sourceType = getSourceType(actionId);
  if (!sourceType) return null;
  const cohortId = `${actionId}_${state.resources.day}_${occurrenceIndex}`;
  const impressions = calculateImpressions(state, config, sourceType, contentType, cohortId, occurrenceIndex);
  
  let responseRate = getResponseRate(sourceType, contentType);
  if (sourceType === 'contacts') {
    responseRate = Number(config.content?.contactsResponseRate ?? 0.05);
  }
  
  const responses = impressions * responseRate * keyedRandomMultiplier(state.seed, config, cohortId, 'response');
  const routeSnapshot: RouteSnapshot = { ...state.activeRoute, capturedDay: state.resources.day };

  return {
    id: cohortId,
    createdDay: state.resources.day,
    sourceActionId: actionId,
    sourceType,
    contentType,
    impressions,
    
    unprocessedInbound: 0,
    pendingFollowup: 0,
    
    inboundDecision: 'pending',
    salesDecision: 'not_ready',
    followupDecision: 'not_ready',
    
    deferredUntilDay: null,
    deferCount: 0,

    inbound: responses,
    activated: 0,
    processed: 0,
    applications: 0,
    bookedCalls: 0,
    heldCalls: 0,
    sales: 0,
    
    unprocessedApplications: 0,
    
    losses: { entry: 0, processing: 0, qualification: 0, callBooking: 0, callNoShow: 0, sale: 0, followup: 0, capacity: 0 },
    capacityLostLeads: 0,
    routeSnapshot,
    contextSnapshot: {
      productPrice: state.launchPlan.productPrice ?? 0,
      productType: state.launchPlan.productType ?? '',
      demandConfidence: state.assets.demandConfidence,
      productQuality: state.assets.productQuality,
      energyAtCreation: state.resources.energy,
      createdDay: state.resources.day
    },
    followedUp: false
  };
}

function calculateImpressions(
  state: GameState,
  config: GameConfig,
  sourceType: SourceType,
  contentType: ContentType,
  cohortId: string,
  occurrenceIndex: number
): number {
  const contentReach = contentType === 'useful' ? 1.2 : contentType === 'selling' ? 0.7 : contentType === 'chaotic' ? 0.8 : 1;
  const random = keyedRandomMultiplier(state.seed, config, cohortId, 'traffic', occurrenceIndex);
  
  if (sourceType === 'contacts') {
    return state.audience.contactsCount;
  }
  if (sourceType === 'reels') {
    return state.audience.averageReelViews * 7 * contentReach * lowEnergyContentMultiplier(state) * random;
  }
  if (sourceType === 'stories') {
    const sellingCycles = state.history.filter((entry) => entry.type === 'action_completed' && entry.payload?.actionId === 'stories_3d').length;
    const sellingPenalty = contentType === 'selling' ? 0.8 * Math.pow(0.85, sellingCycles) : 1;
    return state.audience.averageStoryViews * 2.25 * contentReach * sellingPenalty * lowEnergyContentMultiplier(state) * random;
  }
  if (sourceType === 'telegram') return (state.audience.averageTelegramViews ?? 150) * 5 * lowEnergyContentMultiplier(state) * random;
  if (sourceType === 'live') return Math.max(state.audience.averageStoryViews * 1.5, 50) * random;
  return Math.max(state.audience.averageStoryViews * 2, 100) * random;
}

function getResponseRate(sourceType: SourceType, contentType: ContentType): number {
  if (sourceType === 'telegram') return 0.0035;
  if (sourceType === 'live') return 0.006;
  if (sourceType === 'webinar') return 0.035;
  if (contentType === 'useful') return 0.005;
  if (contentType === 'storytelling') return 0.004;
  if (contentType === 'selling') return 0.003;
  return 0.002;
}

function getSourceType(actionId: string): SourceType | null {
  if (actionId === 'reels_7d') return 'reels';
  if (actionId === 'stories_3d') return 'stories';
  if (actionId === 'reels_stories_7d') return 'reels';
  if (actionId === 'telegram_warmup') return 'telegram';
  if (actionId === 'live_stream') return 'live';
  if (actionId === 'webinar') return 'webinar';
  if (actionId === 'contacts_outreach') return 'contacts';
  return null;
}
