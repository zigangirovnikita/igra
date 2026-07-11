import type { ReactNode } from 'react';

type Props = {
  title: string;
  description: ReactNode;
  crisisType: 'energy' | 'money';
  onAction: (actionId: string) => void;
  busy?: boolean;
};

export function CrisisScreen({ title, description, crisisType, onAction, busy }: Props) {
  return (
    <div className={`scene-step scene-step--center scene-crisis scene-crisis--${crisisType}`}>
      <div className={`scene-image scene-image--crisis_${crisisType}`} aria-hidden="true" />
      <h2 className="scene-headline">{title}</h2>

      <div className="scene-description">
        {description}
      </div>

      <div className="scene-actions scene-actions--vertical">
        {crisisType === 'energy' && (
          <>
            <button className="btn-primary" onClick={() => onAction('rest_day')} disabled={busy}>
              Взять выходной (+20 ⚡, пропуск дня)
            </button>
            <button className="btn-secondary" onClick={() => onAction('push_through')} disabled={busy}>
              Продолжить через силу (Риск выгорания)
            </button>
          </>
        )}

        {crisisType === 'money' && (
          <>
            <button className="btn-primary" onClick={() => onAction('take_loan')} disabled={busy}>
              Взять микрозайм (+50 000 ₽, долг)
            </button>
            <button className="btn-secondary" onClick={() => onAction('request_finish')} disabled={busy}>
              Признать банкротство (Конец игры)
            </button>
          </>
        )}
      </div>
    </div>
  );
}
