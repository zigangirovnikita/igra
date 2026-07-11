import type { GameState } from '@/packages/game-engine/src';

export function resolveCurrentScene(state: GameState): { scene: string; props?: Record<string, unknown> } {
  if (state.status === 'setup') {
    return { scene: 'setup' };
  }

  // If status is finished, abandoned, or goal reached, route appropriately
  // However, flow.step might already be set to something related to finish
  const step = state.flow.step;

  if (state.pendingDecision?.type === 'energy_crisis') return { scene: 'energy_crisis' };
  if (state.pendingDecision && !['finish_confirmation', 'goal_reached'].includes(step)) {
    return { scene: 'pending_decision' };
  }

  if (step.startsWith('intro_')) return { scene: 'intro' };
  if (step.startsWith('day1_')) return { scene: 'day_1' };
  if (step.startsWith('day2_')) return { scene: 'day_2' };

  switch (step) {
    case 'daily_intro':
      return { scene: 'daily_intro' };
    case 'daily_intent':
      return { scene: 'daily_intent' };
    case 'action_list':
      return { scene: 'action_selection' };
    case 'action_configuration':
      return { scene: 'action_configuration' };
    case 'action_confirmation':
      return { scene: 'action_confirmation' };
    case 'action_process':
      return { scene: 'action_process' };
    case 'action_result':
      return { scene: 'action_result' };
    case 'post_action':
      if (state.pendingDecision) {
        return { scene: 'pending_decision' };
      }
      return { scene: 'day_completion' };
    case 'day_summary':
      return { scene: 'day_completion' };
    case 'energy_crisis':
      return { scene: 'energy_crisis' };
    case 'budget_notice':
      return { scene: 'energy_crisis' }; // Re-use crisis screen
    case 'goal_reached':
    case 'finish_confirmation':
    case 'final_reason':
    case 'final_diagnosis':
      return { scene: 'finished' };
    default:
      if (state.pendingDecision) {
        return { scene: 'pending_decision' };
      }
      return { scene: 'unknown' };
  }
}
