import type { GameState } from '@/packages/game-engine/src';
import { PixelArtScene } from '@/components/game/PixelArtScene';

export function ResumePrompt({ state, onResume, onRestart }: { state: GameState; onResume: () => void; onRestart: () => void }) {
  return (
    <div className="scene-screen scene-screen--setup">
      <div className="setup-step setup-step--center">
        <PixelArtScene variant="notebook" gender={state.player.avatarGender} />
        <h1 className="setup-headline">Продолжить запуск?</h1>
        <p className="setup-subtext">Сохранён прогресс: день {state.resources.day}/30, банк {Math.round(state.resources.bank).toLocaleString('ru-RU')} ₽, энергия {Math.round(state.resources.energy)}%.</p>
        <button className="btn-primary" onClick={onResume}>Продолжить</button>
        <button className="btn-secondary" onClick={onRestart}>Начать заново</button>
      </div>
    </div>
  );
}
