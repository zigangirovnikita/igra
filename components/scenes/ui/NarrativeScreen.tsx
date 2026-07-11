import type { ReactNode } from 'react';

type Props = {
  title: string;
  imageClass?: string;
  paragraphs: ReactNode[];
  buttonText: string;
  onNext: () => void;
  busy?: boolean;
};

export function NarrativeScreen({ title, imageClass, paragraphs, buttonText, onNext, busy }: Props) {
  return (
    <div className="scene-step scene-step--center">
      {imageClass && <div className={`scene-image ${imageClass}`} aria-hidden="true" />}
      <h2 className="scene-headline">{title}</h2>
      
      <div className="scene-text-block">
        {paragraphs.map((p, i) => (
          <p key={i} className="scene-paragraph">{p}</p>
        ))}
      </div>

      <button className="btn-primary scene-next-btn" onClick={onNext} disabled={busy}>
        {busy ? 'Загрузка...' : buttonText}
      </button>
    </div>
  );
}
