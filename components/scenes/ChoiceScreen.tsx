'use client';

import type { ChoiceOption, ChoiceScene } from '@/lib/scenes/types';

type Props = {
  scene: ChoiceScene;
  onChoice: (option: ChoiceOption) => void;
  busy: boolean;
};

export function ChoiceScreen({ scene, onChoice, busy }: Props) {
  return (
    <div className="scene-screen">
      <div className={`scene-image scene-image--${scene.image}`} aria-hidden="true" />
      <div className="choice-body">
        <h2 className="choice-question">{scene.question}</h2>
        {scene.subtext && <p className="choice-subtext">{scene.subtext}</p>}
        <ul className="choice-list" role="list">
          {scene.options.map((option) => (
            <li key={option.id}>
              <button
                className={[
                  'choice-card',
                  option.disabled ? 'choice-card--disabled' : '',
                  option.id === '__finish__' ? 'choice-card--finish' : '',
                ].join(' ')}
                disabled={busy || option.disabled}
                onClick={() => !option.disabled && onChoice(option)}
                title={option.disabled ? option.disabledReason : undefined}
              >
                <span className="choice-icon" aria-hidden="true">{option.icon}</span>
                <span className="choice-content">
                  <span className="choice-title">{option.title}</span>
                  <span className="choice-desc">{option.description}</span>
                  {(option.costLabel || option.daysLabel || option.energyLabel) && (
                    <span className="choice-tags">
                      {option.costLabel && <span className="choice-tag choice-tag--cost">{option.costLabel}</span>}
                      {option.daysLabel && <span className="choice-tag choice-tag--days">{option.daysLabel}</span>}
                      {option.energyLabel && <span className="choice-tag choice-tag--energy">{option.energyLabel}</span>}
                    </span>
                  )}
                  {option.disabled && option.disabledReason && (
                    <span className="choice-disabled-reason">{option.disabledReason}</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
