'use client';

import { useState } from 'react';
import type { GameState } from '@/packages/game-engine/src';
import { PRODUCT_TITLES } from './flows/v4/v4Ui';

export function LeadForm({ state, busy, status, onSubmit, onBack, onRestart }: { state: GameState; busy: boolean; status: string | null; onSubmit: (data: FormData) => void; onBack: () => void; onRestart: () => void }) {
  const [validationError, setValidationError] = useState<string | null>(null);
  const visibleStatus = validationError ?? status;
  const productTitle = state.flow.stage === 'v4' && state.v4.productType
    ? PRODUCT_TITLES[state.v4.productType]
    : state.player.niche;
  const productPrice = state.flow.stage === 'v4'
    ? state.v4.productPrice ?? ''
    : state.launchPlan?.productPrice ?? '';

  if (status === 'success') {
    return (
      <div className="scene-screen lead-form-screen">
        <section className="lead-submitted-card" role="status">
          <h2>Ваша заявка отправлена</h2>
          <p>В ближайшее время Никита с вами свяжется.</p>
          <p>Если хотите еще раз пройти игру, нажмите кнопку ниже.</p>
          <button className="btn-primary" type="button" onClick={onRestart}>Пройти игру заново</button>
        </section>
      </div>
    );
  }

  return <div className="scene-screen lead-form-screen">
    <form className="lead-form" onSubmit={(event) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      const name = String(formData.get('name') ?? '').trim();
      const contact = String(formData.get('contact') ?? '').trim();
      if (!name || !contact) {
        setValidationError('Заполните обязательные поля "Имя" и "Телеграм/Номер"');
        return;
      }
      setValidationError(null);
      onSubmit(formData);
    }}>
      <h2 className="lead-form-title">Оставить заявку на бесплатный разбор</h2>
      <p className="lead-form-sub">Заполните контакты — мы посмотрим ваш продукт, воронку и точки роста.</p>
      <label className="setup-field-label">Имя * <input name="name" defaultValue={state.player.name} aria-required="true" /></label>
      <label className="setup-field-label">Телеграм / номер * <input name="contact" aria-required="true" placeholder="@username или номер" /></label>
      <label className="setup-field-label">Продукт <input name="product" defaultValue={productTitle} /></label>
      <label className="setup-field-label">Чек <input name="productPrice" type="number" defaultValue={productPrice} /></label>
      <label className="setup-field-label">Инстаграм, если есть <input name="socialLink" placeholder="@username или ссылка" /></label>
      <label className="setup-field-label">Что вы хотите получить на разборе? <textarea name="comment" maxLength={1000} /></label>
      <input className="hidden-field" name="website" tabIndex={-1} autoComplete="off" />
      <div className="scene-btn-row"><button className="btn-primary" type="submit" disabled={busy}>{busy ? 'Отправляем…' : 'Отправить заявку'}</button><button className="btn-secondary" type="button" onClick={onBack}>← Назад</button></div>
      {visibleStatus === 'success' && <p className="lead-success" role="status">✅ Заявка сохранена! Мы скоро свяжемся.</p>}
      {visibleStatus && visibleStatus !== 'success' && <p className="lead-error" role="alert">⚠️ {visibleStatus}</p>}
    </form></div>;
}
