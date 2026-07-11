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
  selectedId?: T | T[] | null;
  onSelect?: (id: T | T[]) => void;
  onConfirm?: (id: T | T[]) => void;
  confirmText?: string;
  busy?: boolean;
  layout?: 'grid-2' | 'grid-3' | 'list';
  isMulti?: boolean;
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
  layout = 'grid-2',
  isMulti = false
}: Props<T>) {
  const [localSelected, setLocalSelected] = useState<T | T[] | null>(
    initialSelected !== null ? initialSelected : (isMulti ? [] : null)
  );

  const handleSelect = (id: T) => {
    if (busy) return;

    let newSelected: T | T[];

    if (isMulti) {
      const arr = (Array.isArray(localSelected) ? localSelected : []) as T[];
      if (arr.includes(id)) {
        newSelected = arr.filter(v => v !== id);
      } else {
        newSelected = [...arr, id];
      }
    } else {
      newSelected = id;
    }

    setLocalSelected(newSelected);
    if (onSelect) onSelect(newSelected);
  };

  const handleConfirm = () => {
    if (onConfirm && !busy) {
      if (isMulti) {
        if (Array.isArray(localSelected) && localSelected.length > 0) {
          onConfirm(localSelected);
        }
      } else {
        if (localSelected) {
          onConfirm(localSelected);
        }
      }
    }
  };

  const canConfirm = isMulti ? Array.isArray(localSelected) && localSelected.length > 0 : !!localSelected;

  return (
    <div className="scene-step">
      {imageClass && <div className={`scene-image ${imageClass}`} aria-hidden="true" />}

      <h2 className="scene-question">{title}</h2>
      {description && <p className="scene-description">{description}</p>}

      <div className={`scene-choices scene-choices--${layout}`}>
        {choices.map(choice => {
          const isSelected = isMulti
            ? Array.isArray(localSelected) && localSelected.includes(choice.id)
            : localSelected === choice.id;

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
          disabled={!canConfirm || busy}
        >
          {busy ? 'Загрузка...' : confirmText}
        </button>
      )}
    </div>
  );
}
