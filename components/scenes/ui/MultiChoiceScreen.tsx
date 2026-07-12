import { useEffect, useMemo, useState, type ReactNode } from 'react';

export type ChoiceItem<T extends string = string> = {
  id: T;
  label: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
  disabledReason?: ReactNode;
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
  secondaryText?: string;
  onSecondary?: () => void;
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
  secondaryText,
  onSecondary,
  busy,
  layout = 'grid-2',
  isMulti = false,
}: Props<T>) {
  const [localSelected, setLocalSelected] = useState<T | T[] | null>(
    initialSelected !== null ? initialSelected : (isMulti ? [] : null),
  );
  const choiceSignature = useMemo(() => choices.map((choice) => choice.id).join('|'), [choices]);

  // Один и тот же компонент обслуживает разные последовательные вопросы.
  // При смене набора вариантов нельзя переносить выбор с прошлого вопроса.
  useEffect(() => {
    setLocalSelected(initialSelected !== null ? initialSelected : (isMulti ? [] : null));
  }, [choiceSignature, initialSelected, isMulti]);

  const handleSelect = (id: T) => {
    if (busy) return;

    let newSelected: T | T[];

    if (isMulti) {
      const arr = (Array.isArray(localSelected) ? localSelected : []) as T[];
      newSelected = arr.includes(id) ? arr.filter((value) => value !== id) : [...arr, id];
    } else {
      newSelected = id;
    }

    setLocalSelected(newSelected);
    onSelect?.(newSelected);
  };

  const handleConfirm = () => {
    if (!onConfirm || busy) return;
    if (isMulti) {
      if (Array.isArray(localSelected) && localSelected.length > 0) onConfirm(localSelected);
      return;
    }
    if (localSelected) onConfirm(localSelected);
  };

  const canConfirm = isMulti
    ? Array.isArray(localSelected) && localSelected.length > 0
    : Boolean(localSelected);

  return (
    <section className="scene-screen">
      {imageClass && <div className={`scene-image ${imageClass}`} aria-hidden="true" />}

      <div className="choice-body">
        <div className="choice-heading">
          <h2 className="choice-question">{title}</h2>
          {description && <div className="choice-subtext">{description}</div>}
        </div>

        <div className={`choice-list choice-list--${layout}`} role={isMulti ? 'group' : 'radiogroup'}>
          {choices.map((choice) => {
            const isSelected = isMulti
              ? Array.isArray(localSelected) && localSelected.includes(choice.id)
              : localSelected === choice.id;

            return (
              <button
                key={choice.id}
                type="button"
                className={[
                  'choice-card',
                  isSelected ? 'choice-card--selected' : '',
                  choice.disabled ? 'choice-card--disabled' : '',
                ].filter(Boolean).join(' ')}
                onClick={() => handleSelect(choice.id)}
                disabled={choice.disabled || busy}
                aria-pressed={isMulti ? isSelected : undefined}
                aria-checked={!isMulti ? isSelected : undefined}
                role={isMulti ? undefined : 'radio'}
              >
                {choice.icon && <span className="choice-icon" aria-hidden="true">{choice.icon}</span>}
                <span className="choice-content">
                  <span className="choice-title">{choice.label}</span>
                  {choice.description && <span className="choice-desc">{choice.description}</span>}
                  {choice.disabledReason && (
                    <span className="choice-disabled-reason">{choice.disabledReason}</span>
                  )}
                </span>
                <span className="choice-state" aria-hidden="true">
                  {choice.disabled ? '🔒' : isSelected ? '✓' : ''}
                </span>
              </button>
            );
          })}
        </div>

        {(onConfirm || onSecondary) && (
          <div className="choice-actions">
            {onConfirm && (
              <button
                type="button"
                className="btn-primary scene-confirm-btn"
                onClick={handleConfirm}
                disabled={!canConfirm || busy}
              >
                {busy ? 'Загрузка...' : confirmText}
              </button>
            )}
            {onSecondary && secondaryText && (
              <button
                type="button"
                className="btn-secondary"
                onClick={onSecondary}
                disabled={busy}
              >
                {secondaryText}
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
