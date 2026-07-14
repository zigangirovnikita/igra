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
  return (
    <div className={`v3-pixel-scene v3-pixel-scene--${variant}`} aria-hidden="true">
      <div className="v3-sun" />
      <div className="v3-cloud v3-cloud--a" />
      <div className="v3-cloud v3-cloud--b" />
      <div className="v3-birds"><i /><i /><i /></div>
      <div className="v3-sea"><i /><i /><i /></div>
      <div className="v3-sand" />
      {(variant === 'sunset-duo' || variant === 'beach-talk' || variant === 'cocktails') && (
        <>
          <PixelPerson gender={gender} side="left" />
          <PixelPerson gender={gender === 'female' ? 'male' : 'female'} side="right" />
        </>
      )}
      {variant === 'notebook' && <div className="v3-notebook"><i /><b /></div>}
      {variant === 'laptop' && <div className="v3-laptop"><i /><i /><i /></div>}
      {variant === 'active' && (
        <div className="v3-active-visual">
          <span>Рилс</span><span>Бот</span><span>Чат</span><span>$</span>
        </div>
      )}
      {variant === 'summary' && <div className="v3-trophy">$</div>}
    </div>
  );
}

function PixelPerson({ gender, side }: { gender: Gender; side: 'left' | 'right' }) {
  return (
    <div className={`v3-person v3-person--${gender} v3-person--${side}`}>
      <i className="v3-person__hair" />
      <i className="v3-person__head" />
      <i className="v3-person__body" />
      <i className="v3-person__legs" />
    </div>
  );
}
