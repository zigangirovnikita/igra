// @ts-nocheck
import type { GameState } from '@/packages/game-engine/src';

export function LeadForm({ state, busy, status, onSubmit, onBack }: { state: GameState; busy: boolean; status: string | null; onSubmit: (data: FormData) => void; onBack: () => void }) {
  return <div className="scene-screen"><div className="scene-image scene-image--character_happy" aria-hidden="true" />
    <form className="lead-form" action={onSubmit}>
      <h2 className="lead-form-title">Получить бесплатную консультацию</h2>
      <p className="lead-form-sub">Оставьте контакт — мы разберём вашу ситуацию и найдём, где теряются заявки.</p>
      <label className="setup-field-label">Имя <input name="name" defaultValue={state.player.name} required /></label>
      <label className="setup-field-label">Telegram / телефон <input name="contact" required placeholder="@username" /></label>
      <label className="setup-field-label">Ваш продукт <input name="product" defaultValue={state.player.productName ?? state.player.niche} required /></label>
      <label className="setup-field-label">Чек <input name="productPrice" type="number" defaultValue={state.player.productPrice} required /></label>
      <label className="setup-field-label">Соцсеть / ссылка <input name="socialLink" /></label>
      <label className="setup-field-label">Комментарий <textarea name="comment" maxLength={1000} /></label>
      <input className="hidden-field" name="website" tabIndex={-1} autoComplete="off" />
      <label className="setup-checkbox"><input name="privacyConsent" type="checkbox" required /> Согласен(на) на обработку персональных данных</label>
      <label className="setup-checkbox"><input name="marketingConsent" type="checkbox" /> Согласен(на) получать полезные материалы</label>
      <div className="scene-btn-row"><button className="btn-primary" type="submit" disabled={busy}>{busy ? 'Отправляем…' : 'Отправить заявку'}</button><button className="btn-secondary" type="button" onClick={onBack}>← Назад</button></div>
      {status === 'success' && <p className="lead-success" role="status">✅ Заявка доставлена! Мы скоро свяжемся.</p>}
      {status && status !== 'success' && <p className="lead-error" role="alert">⚠️ {status}</p>}
    </form></div>;
}
