import type { GameState } from '@/packages/game-engine/src';

export function resolveCurrentScene(state: GameState): { scene: string; props?: Record<string, unknown> } {
  if (state.status === 'setup') return { scene: 'setup' };

  const step = state.flow.step;
  if (state.flow.stage === 'final' || step === 'final_reason' || step === 'final_diagnosis' || step === 'finish_confirmation') {
    return { scene: 'finished' };
  }
  if (state.flow.stage === 'v3' || step.startsWith('v3_')) return { scene: 'v3' };

  const pendingEvent = state.history.find((entry) => {
    if (entry.type !== 'game_event') return false;
    const instanceId = String(entry.payload?.eventInstanceId ?? '');
    return instanceId.length > 0 && !state.flags[`event_ack:${instanceId}`];
  });
  if (pendingEvent) return { scene: 'event' };

  if (state.pendingDecision?.type === 'energy_crisis') return { scene: 'energy_crisis' };
  if (state.pendingDecision?.type === 'budget_notice') return { scene: 'budget_notice' };
  if (state.pendingDecision && !['finish_confirmation', 'goal_reached'].includes(step)) {
    return { scene: 'pending_decision' };
  }

  if (step.startsWith('intro_')) return { scene: 'intro' };
  if (step.startsWith('day1_')) return { scene: 'day_1' };
  if (step.startsWith('day2_')) return { scene: 'day_2' };

  switch (step) {
    case 'daily_intro': return { scene: 'daily_intro' };
    case 'daily_intent': return { scene: 'daily_intent' };
    case 'action_list': return { scene: 'action_selection' };
    case 'action_configuration': return { scene: 'action_configuration' };
    case 'action_confirmation': return { scene: 'action_confirmation' };
    case 'action_process': return { scene: 'action_process' };
    case 'action_result': return { scene: 'action_result' };
    case 'post_action': return state.pendingDecision ? { scene: 'pending_decision' } : { scene: 'day_completion' };
    case 'day_summary': return { scene: 'day_completion' };
    case 'energy_crisis': return { scene: 'energy_crisis' };
    case 'budget_notice': return { scene: 'budget_notice' };
    case 'goal_reached': return { scene: 'finished' };
    default:
      return state.pendingDecision ? { scene: 'pending_decision' } : { scene: 'unknown' };
  }
}
