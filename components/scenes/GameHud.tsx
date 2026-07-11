import type { GameState } from '@/packages/game-engine/src';

export function GameHud({ state }: { state: GameState }) {
  return (
    <div className="game-hud" aria-label="Текущие показатели запуска">
      <span>День <strong>{state.resources.day}/30</strong></span>
      <span>Банк <strong>{Math.round(state.resources.bank).toLocaleString('ru-RU')} ₽</strong></span>
      <span>Энергия <strong>{Math.round(state.resources.energy)}%</strong></span>
    </div>
  );
}
