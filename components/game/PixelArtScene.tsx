import type { Gender } from '@/packages/game-engine/src';

type Variant =
  | 'sunset-duo'
  | 'beach-talk'
  | 'notebook'
  | 'cocktails'
  | 'laptop'
  | 'active'
  | 'summary';

export function PixelArtScene({
  variant,
  gender = 'female',
}: {
  variant: Variant;
  gender?: Gender;
}) {
  const sceneByVariant: Record<Variant, string> = {
    'sunset-duo': 'start',
    'beach-talk': 'beach-talk',
    notebook: 'notebook',
    cocktails: 'cocktails',
    laptop: 'laptop',
    active: 'active',
    summary: 'summary',
  };
  const asset = `/assets/pixel-scenes/${sceneByVariant[variant]}-${gender}.gif`;

  return (
    <div className={`v3-pixel-scene v3-pixel-scene--${variant}`} aria-hidden="true">
      <img className="v3-pixel-scene__asset" src={asset} alt="" draggable={false} />
      <div className="v3-scene-overlay v3-scene-overlay--scan" />
      {variant === 'notebook' && <div className="v3-notebook"><i /><b /></div>}
      {variant === 'laptop' && <div className="v3-laptop"><i /><i /><i /></div>}
      {variant === 'active' && (
        <div className="v3-active-visual" aria-hidden="true">
          <span data-label="Рилс" /><span data-label="Бот" /><span data-label="Чат" /><span data-label="₽" />
        </div>
      )}
      {variant === 'summary' && <div className="v3-trophy" aria-hidden="true" />}
    </div>
  );
}
