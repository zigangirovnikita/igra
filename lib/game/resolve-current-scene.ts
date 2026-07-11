import type { GameState } from '@/packages/game-engine/src';

export function resolveCurrentScene(state: GameState): { scene: string; props?: Record<string, unknown> } {
  switch (state.status) {
    case 'setup':
      return { scene: 'setup' };
    case 'intro':
    case 'day_start':
      return { scene: 'intro' }; // Both use narrative wrappers
    case 'day_1':
      return { scene: 'day_1' };
    case 'day_2':
      return { scene: 'day_2' };
    case 'daily_intent':
      return { scene: 'daily_intent' };
    case 'action_selection':
      return { scene: 'action_selection' };
    case 'action_configuration':
      return { scene: 'action_configuration' };
    case 'action_confirmation':
      return { scene: 'action_confirmation' };
    case 'pending_decision':
      return { scene: 'pending_decision' };
    case 'day_completion':
      return { scene: 'day_completion' };
    case 'energy_crisis':
      return { scene: 'energy_crisis' };
    case 'goal_reached':
    case 'finished':
      return { scene: 'finished' };
    default:
      return { scene: 'unknown' };
  }
}
