import type { GameState } from '@/packages/game-engine/src';

export async function submitLead(state: GameState, formData: FormData): Promise<void> {
  const payload = { sessionId: state.sessionId, name: String(formData.get('name') ?? ''), contact: String(formData.get('contact') ?? ''),
    product: String(formData.get('product') ?? ''), productPrice: Number(formData.get('productPrice') ?? state.player.productPrice),
    socialLink: String(formData.get('socialLink') ?? ''), comment: String(formData.get('comment') ?? ''),
    privacyConsent: formData.get('privacyConsent') === 'on', marketingConsent: formData.get('marketingConsent') === 'on', website: String(formData.get('website') ?? '') };
  const response = await fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? 'Заявка не отправлена');
}
