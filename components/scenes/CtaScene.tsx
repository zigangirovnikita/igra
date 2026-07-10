'use client';

import type { CtaScene as CtaSceneType } from '@/lib/scenes/types';

const rub = (n: number) =>
  n.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 });

type Props = {
  scene: CtaSceneType;
  onCta: () => void;
  onRestart: () => void;
};

export function CtaScene({ scene, onCta, onRestart }: Props) {
  return (
    <div className="scene-screen scene-screen--cta">
      <div className="scene-image scene-image--character_happy" aria-hidden="true" />
      <div className="cta-body">
        {scene.won ? (
          <>
            <h2 className="cta-title">🏆 Цель достигнута!</h2>
            <p className="cta-text">Выручка: <strong>{rub(scene.revenue)}</strong></p>
            <p className="cta-text">Это была симуляция. В реальном запуске — всё сложнее.</p>
            <p className="cta-insight">
              Хотите узнать, где конкретно у вас теряются заявки и деньги прямо сейчас?
            </p>
          </>
        ) : (
          <>
            <h2 className="cta-title">30 дней прошло</h2>
            <p className="cta-text">Выручка: <strong>{rub(scene.revenue)}</strong></p>
            {scene.personalGoal > 0 && scene.revenue < scene.personalGoal && (
              <p className="cta-text cta-text--miss">
                До личной цели не хватило {rub(scene.personalGoal - scene.revenue)}
              </p>
            )}
            <p className="cta-insight">
              Один неверный выбор в реальности — и месяц потерян. Хотите разобраться, где у вас сейчас узкое место?
            </p>
          </>
        )}

        <div className="scene-btn-row">
          <button className="btn-primary btn-cta" onClick={onCta}>
            Разобрать мой запуск и найти, где теряются заявки
          </button>
          <button className="btn-secondary" onClick={onRestart}>
            Пройти заново
          </button>
        </div>
      </div>
    </div>
  );
}
