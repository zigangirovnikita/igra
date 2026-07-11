import type { ChoiceOption, Scene } from '@/lib/scenes/types';
import { ChoiceScreen } from './ChoiceScreen';
import { CtaScene } from './CtaScene';
import { DiagnosisScreen } from './DiagnosisScreen';
import { DirectMiniGame } from './DirectMiniGame';
import { MetricsScreen } from './MetricsScreen';
import { NarrativeScreen } from './NarrativeScreen';
import { ResultScreen } from './ResultScreen';

type Props = { scene: Scene | undefined; fallback: Scene; busy: boolean; advance: () => void; choose: (option: ChoiceOption) => void;
  miniGame: (cohortId: string, mode: 'manual' | 'auto', processed?: number) => void; cta: () => void; restart: () => void };

export function SceneContent({ scene, fallback, busy, advance, choose, miniGame, cta, restart }: Props) {
  const current = scene ?? fallback;
  if (current.type === 'narrative') return <NarrativeScreen scene={current} onAdvance={advance} />;
  if (current.type === 'choice') return <ChoiceScreen scene={current} onChoice={(option) => { advance(); choose(option); }} busy={busy} />;
  if (current.type === 'result') return <ResultScreen scene={current} onNext={advance} />;
  if (current.type === 'metrics') return <MetricsScreen scene={current} onNext={advance} />;
  if (current.type === 'mini_game_direct') return <DirectMiniGame scene={current} onResolve={(mode, processed) => { advance(); miniGame(current.cohortId, mode, processed); }} busy={busy} />;
  if (current.type === 'diagnosis') return <DiagnosisScreen scene={current} onCta={() => { advance(); cta(); }} onRestart={() => { advance(); restart(); }} />;
  if (current.type === 'cta') return <CtaScene scene={current} onCta={() => { advance(); cta(); }} onRestart={() => { advance(); restart(); }} />;
  return null;
}
