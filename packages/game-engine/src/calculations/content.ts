import type { ContentType, GameConfig, GameState, LeadCohort, RouteSnapshot, SourceType } from '../types';
import { keyedRandomMultiplier } from '../random/keyed';
import { hasSuperpower, lowEnergyContentMultiplier } from './modifiers';

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
  const responseRate = getResponseRate(sourceType, contentType);
  let responseModifier = 1;
  if (hasSuperpower(state, 'expertise') && contentType === 'useful') responseModifier *= 1.25;
  if (hasSuperpower(state, 'expertise') && contentType === 'selling') responseModifier *= 0.9;
  if (hasSuperpower(state, 'sales')) responseModifier *= 0.9;
  if (hasSuperpower(state, 'marketing')) responseModifier *= 1.3;
  const responses = impressions * responseRate * responseModifier * keyedRandomMultiplier(state.seed, config, cohortId, 'response');
  const routeSnapshot: RouteSnapshot = { ...state.activeRoute, capturedDay: state.resources.day };

  return {
    id: cohortId,
    createdDay: state.resources.day,
    sourceActionId: actionId,
    sourceType,
    contentType,
    impressions,
    responses,
    activated: 0,
    processed: 0,
    applications: 0,
    bookedCalls: 0,
    heldCalls: 0,
    sales: 0,
    considering: 0,
    unprocessedWarm: 0,
    unprocessedApplications: 0,
    lost: 0,
    capacityLostLeads: 0,
    temperature: 1,
    routeSnapshot,
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
  if (sourceType === 'reels') {
    const reels = hasSuperpower(state, 'energy') ? 8 : 7;
    return state.player.averageReelViews * reels * contentReach * lowEnergyContentMultiplier(state) * random;
  }
  if (sourceType === 'stories') {
    const sellingCycles = state.history.filter((entry) => entry.type === 'action_completed' && entry.payload?.actionId === 'stories_3d').length;
    const sellingPenalty = contentType === 'selling' ? 0.8 * Math.pow(0.85, sellingCycles) : 1;
    return state.player.averageStoryViews * 2.25 * contentReach * sellingPenalty * lowEnergyContentMultiplier(state) * random;
  }
  if (sourceType === 'telegram') return (state.player.averageTelegramViews ?? 150) * 5 * lowEnergyContentMultiplier(state) * random;
  if (sourceType === 'live') return Math.max(state.player.averageStoryViews * 1.5, 50) * random;
  return Math.max(state.player.averageStoryViews * 2, 100) * random;
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
  return null;
}
