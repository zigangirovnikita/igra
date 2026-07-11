import type { ReactNode } from 'react';

type Props = {
  title: string;
  description: ReactNode;
  cost: number;
  energyCost: number;
  days: number;
  currentBank: number;
  currentEnergy: number;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  busy?: boolean;
};

export function ActionConfirmationScreen({
  title,
  description,
  cost,
  energyCost,
  days,
  currentBank,
  currentEnergy,
  onConfirm,
  onCancel,
  confirmText = 'Запустить',
  cancelText = 'Отмена',
  busy
}: Props) {
  const canAffordMoney = currentBank >= cost;
  const canAffordEnergy = currentEnergy >= energyCost;
  const canAfford = canAffordMoney && canAffordEnergy;

  return (
    <div className="scene-step scene-step--center">
      <h2 className="scene-headline">{title}</h2>
      
      <div className="scene-description">
        {description}
      </div>

      <div className="scene-costs">
        <div className="cost-row">
          <span>Время:</span>
          <strong>{days} {days === 1 ? 'день' : 'дней'}</strong>
        </div>
        <div className={`cost-row ${!canAffordMoney ? 'cost-row--error' : ''}`}>
          <span>Деньги:</span>
          <strong>{cost.toLocaleString('ru-RU')} ₽</strong>
          <small>(Осталось: {currentBank.toLocaleString('ru-RU')} ₽)</small>
        </div>
        <div className={`cost-row ${!canAffordEnergy ? 'cost-row--error' : ''}`}>
          <span>Энергия:</span>
          <strong>-{energyCost} ⚡</strong>
          <small>(Осталось: {currentEnergy} ⚡)</small>
        </div>
      </div>

      {!canAfford && (
        <div className="scene-error" role="alert">
          Недостаточно ресурсов (денег или энергии) для этого действия.
        </div>
      )}

      <div className="scene-actions">
        <button 
          className="btn-primary" 
          onClick={onConfirm}
          disabled={!canAfford || busy}
          aria-busy={busy}
          aria-disabled={!canAfford || busy}
        >
          {busy ? 'Загрузка...' : confirmText}
        </button>
        <button 
          className="btn-secondary" 
          onClick={onCancel}
          disabled={busy}
        >
          {cancelText}
        </button>
      </div>
    </div>
  );
}
