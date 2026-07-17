import type { GameState } from '@/packages/game-engine/src';

export async function submitLead(state: GameState, formData: FormData): Promise<void> {
  const name = String(formData.get('name') ?? '').trim();
  const contact = String(formData.get('contact') ?? '').trim();
  if (!name || !contact) {
    throw new Error('Заполните обязательные поля "Имя" и "Телеграм/Номер"');
  }

  const formProduct = String(formData.get('product') ?? '').trim();
  const formProductPrice = String(formData.get('productPrice') ?? '').trim();
  const fallbackProductPrice = state.launchPlan.productPrice ?? state.v3.productPrice ?? 1000;
  const parsedProductPrice = formProductPrice ? Number(formProductPrice) : fallbackProductPrice;
  const productPrice = Number.isFinite(parsedProductPrice) && parsedProductPrice >= 100
    ? parsedProductPrice
    : fallbackProductPrice;

  const payload = {
    sessionId: state.sessionId,
    name,
    contact,
    product: formProduct || state.player.niche,
    productPrice,
    socialLink: String(formData.get('socialLink') ?? ''),
    comment: String(formData.get('comment') ?? ''),
    privacyConsent: true,
    marketingConsent: false,
    website: String(formData.get('website') ?? ''),
  };

  const storageKey = `launch-game-lead-idempotency:${state.sessionId}`;
  const idempotencyKey = sessionStorage.getItem(storageKey) ?? crypto.randomUUID();
  sessionStorage.setItem(storageKey, idempotencyKey);

  const response = await fetch('/api/leads', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? 'Заявка не отправлена');
  sessionStorage.removeItem(storageKey);
}
