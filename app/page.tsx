import { loadGameConfig } from '@/lib/config/game-config';
import { GameApp } from '@/components/game/GameApp';

export default function Page() {
  const config = loadGameConfig();
  return <GameApp config={config} />;
}
