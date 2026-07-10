'use client';

import type { GameConfig } from '@/packages/game-engine/src';
import { SceneEngine } from '@/components/scenes/SceneEngine';

export function GameApp({ config }: { config: GameConfig }) {
  return <SceneEngine config={config} />;
}
