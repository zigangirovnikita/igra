'use client';

import { useState } from 'react';
import type { GameConfig, GameState, V4ProductType } from '@/packages/game-engine/src';
import { PRODUCT_TITLES, rub, V4Screen } from './v4Ui';

type Dispatch = (actionType: string, payload?: Record<string, unknown>) => Promise<boolean>;

const PRODUCT_ORDER: V4ProductType[] = ['consultation', 'service', 'live_course', 'recorded_course', 'membership', 'mentorship'];
type DreamChoice = { id: string; title: string; price: number; custom?: boolean };

export function V4SetupFlow({ state, config, dispatch, busy }: { state: GameState; config: GameConfig; dispatch: Dispatch; busy: boolean }) {
  const [customDream, setCustomDream] = useState({ title: '', price: '' });
  const [selectedDreams, setSelectedDreams] = useState<DreamChoice[]>([]);
  const [price, setPrice] = useState('');

  if (state.flow.step === 'v4_dream') {
    const dreams = config.dreams.filter((dream) => dream.enabled && !dream.custom).slice(0, 8);
    const customPrice = Number(customDream.price);
    const canUseCustom = customDream.title.trim().length >= 2 && Number.isFinite(customPrice) && customPrice >= 1_000;
    const totalDreamPrice = selectedDreams.reduce((sum, dream) => sum + dream.price, 0);
    const selectedDreamTitle = selectedDreams.map((dream) => dream.title).join(' + ');
    const toggleDream = (dream: DreamChoice) => {
      setSelectedDreams((current) => current.some((item) => item.id === dream.id)
        ? current.filter((item) => item.id !== dream.id)
        : [...current, dream]);
    };
    const addCustomDream = () => {
      const dream = {
        id: `custom-${customDream.title.trim().toLowerCase()}-${Math.floor(customPrice)}`,
        title: customDream.title.trim(),
        price: Math.floor(customPrice),
        custom: true,
      };
      setSelectedDreams((current) => [...current.filter((item) => item.id !== dream.id), dream]);
      setCustomDream({ title: '', price: '' });
    };
    return (
      <V4Screen title="Какую мечту проверяем?">
        <div className="v4-dream-grid">
          {dreams.map((dream) => (
            <button
              key={dream.id}
              className={`v4-card-button v4-card-button--compact${selectedDreams.some((item) => item.id === dream.id) ? ' v4-card-button--selected' : ''}`}
              disabled={busy}
              onClick={() => toggleDream({ id: dream.id, title: dream.title, price: dream.price })}
            >
              <span>{dream.title}</span>
              <strong>{rub(dream.price)}</strong>
            </button>
          ))}
        </div>
        <div className="v4-form-block v4-form-block--compact">
          <h2>Своя мечта</h2>
          <input className="setup-input setup-input--compact" value={customDream.title} onChange={(event) => setCustomDream((prev) => ({ ...prev, title: event.target.value }))} placeholder="Например: ремонт кабинета" />
          <input className="setup-input setup-input--compact" inputMode="numeric" value={customDream.price} onChange={(event) => setCustomDream((prev) => ({ ...prev, price: event.target.value }))} placeholder="Стоимость" />
          <button
            className="btn-primary btn-compact"
            disabled={busy || !canUseCustom}
            onClick={addCustomDream}
          >
            Добавить свою мечту
          </button>
        </div>
        <div className="v4-selected-summary">
          <span>{selectedDreams.length > 0 ? `Вы выбрали: ${selectedDreamTitle}` : 'Выберите одну или несколько мечт'}</span>
          <strong>{rub(totalDreamPrice)}</strong>
        </div>
        <button
          className="btn-primary btn-compact"
          disabled={busy || selectedDreams.length === 0}
          onClick={() => dispatch('v4_set_dream', {
            dreamId: selectedDreams.map((dream) => dream.id).join('+'),
            title: selectedDreamTitle,
            price: totalDreamPrice,
            custom: selectedDreams.some((dream) => dream.custom),
          })}
        >
          Дальше
        </button>
      </V4Screen>
    );
  }

  if (state.flow.step === 'v4_product') {
    return (
      <V4Screen title="Что продаем?">
        <div className="v4-choice-list">
          {PRODUCT_ORDER.map((productType) => (
            <button
              key={productType}
              className="v4-card-button v4-card-button--red"
              disabled={busy}
              onClick={() => dispatch('v4_set_product', { productType })}
            >
              <span>{PRODUCT_TITLES[productType]}</span>
            </button>
          ))}
        </div>
      </V4Screen>
    );
  }

  const currentPrice = Number(price);
  return (
    <V4Screen title="Какой чек у продукта?">
      <div className="v4-form-block v4-form-block--compact v4-form-block--narrow">
        <input
          className="setup-input setup-input--compact"
          inputMode="numeric"
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          placeholder="Например: 30000"
          autoFocus
        />
        <p className="v4-muted">Эта цена будет использоваться в продажном этапе.</p>
        <button
          className="btn-primary btn-compact"
          disabled={busy || !Number.isFinite(currentPrice) || currentPrice < 1_000}
          onClick={() => dispatch('v4_set_price', { productPrice: Math.floor(currentPrice) })}
        >
          Готово
        </button>
      </div>
    </V4Screen>
  );
}
