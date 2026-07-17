'use client';

import { useEffect, useState } from 'react';
import type { Gender } from '@/packages/game-engine/src';

type Variant =
  | 'sunset-duo'
  | 'beach-talk'
  | 'notebook'
  | 'cocktails'
  | 'laptop'
  | 'product'
  | 'price'
  | 'dream'
  | 'goal'
  | 'rules'
  | 'resume'
  | 'reflection'
  | 'prepare'
  | 'advice'
  | 'rest'
  | 'action'
  | 'active'
  | 'summary';

export function PixelArtScene({
  variant,
  gender = 'female',
}: {
  variant: Variant;
  gender?: Gender;
}) {
  const [failed, setFailed] = useState(false);
  const sceneByVariant: Record<Variant, string> = {
    'sunset-duo': 'start',
    'beach-talk': 'beach-talk',
    notebook: 'notebook',
    cocktails: 'cocktails',
    laptop: 'laptop',
    product: 'product',
    price: 'price',
    dream: 'dream',
    goal: 'goal',
    rules: 'rules',
    resume: 'resume',
    reflection: 'reflection',
    prepare: 'prepare',
    advice: 'advice',
    rest: 'rest',
    action: 'action',
    active: 'active',
    summary: 'summary',
  };
  const asset = `/assets/pixel-scenes/${sceneByVariant[variant]}-${gender}.gif`;

  useEffect(() => {
    setFailed(false);
  }, [asset]);

  return (
    <div className={`v3-pixel-scene v3-pixel-scene--${variant}${failed ? ' v3-pixel-scene--asset-missing' : ''}`} aria-hidden="true">
      {!failed && <img className="v3-pixel-scene__asset" src={asset} alt="" draggable={false} onError={() => setFailed(true)} />}
      <div className="v3-scene-overlay v3-scene-overlay--scan" />
    </div>
  );
}
