import { useState, type ReactNode } from 'react';

export type ChoiceItem<T extends string = string> = {
  id: T;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
};

type Props<T extends string = string> = {
  title: ReactNode;
  description?: ReactNode;
  imageClass?: string;
  choices: ChoiceItem<T>[];
  selectedId?: T | null;
  onSelect?: (id: T) => void;
  onConfirm?: (id: T) => void;
  confirmText?: string;
  busy?: boolean;
  layout?: 'grid-2' | 'grid-3' | 'list';
};

export function MultiChoiceScreen<T extends string>({
  title,
  description,
  imageClass,
  choices,
  selectedId: initialSelected = null,
  onSelect,
  onConfirm,
  confirmText = 'Дальше →',
  busy,
  layout = 'grid-2'
}: Props<T>) {
  const [localSelected, setLocalSelected] = useState<T | null>(initialSelected);

  const handleSelect = (id: T) => {
    if (busy) return;
    setLocalSelected(id);
    if (onSelect) onSelect(id);
  };

  const handleConfirm = () => {
    if (localSelected && onConfirm && !busy) {
      onConfirm(localSelected);
    }
  };

  return (
    <div className="scene-step">
      {imageClass && <div className={`scene-image ${imageClass}`} aria-hidden="true" />}
      
      <h2 className="scene-question">{title}</h2>
      {description && <p className="scene-description">{description}</p>}

      <div className={`scene-choices scene-choices--${layout}`}>
        {choices.map(choice => {
          const isSelected = localSelected === choice.id;
          return (
            <button
              key={choice.id}
              className={`scene-choice-btn ${isSelected ? 'scene-choice-btn--selected' : ''}`}
              onClick={() => handleSelect(choice.id)}
              disabled={choice.disabled || busy}
            >
              <div className="scene-choice-label">{choice.label}</div>
              {choice.description && (
                <div className="scene-choice-desc">{choice.description}</div>
              )}
            </button>
          );
        })}
      </div>

      {onConfirm && (
        <button 
          className="btn-primary scene-confirm-btn" 
          onClick={handleConfirm}
          disabled={!localSelected || busy}
        >
          {busy ? 'Загрузка...' : confirmText}
        </button>
      )}
    </div>
  );
}
