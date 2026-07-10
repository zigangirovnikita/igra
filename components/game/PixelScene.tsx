import type { GameState } from '@/packages/game-engine/src';
import { compact } from './format';

export function PixelScene({ state, tired }: { state: GameState | null; tired: boolean }) {
  const sales = state?.metrics.sales ?? 0;
  const applications = state?.metrics.applications ?? 0;
  return (
    <div className={`pixel-scene ${tired ? 'is-tired' : ''}`} aria-label="Игровая сцена">
      <div className="sun" />
      <div className="sea">
        <span />
        <span />
        <span />
      </div>
      <div className="sand" />
      <div className="palm"><i /><b /></div>
      <div className="character">
        <div className="hat" />
        <div className="hair" />
        <div className="face" />
        <div className="body" />
        <div className="legs" />
      </div>
      <div className="scene-bubbles">
        <div>Заявки: {compact(applications)}</div>
        <div>Продажи: {compact(sales)}</div>
      </div>
    </div>
  );
}
