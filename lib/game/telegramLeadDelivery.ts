type TelegramLeadPayload = {
  leadId: string;
  sessionId: string;
  name: string;
  contact: string;
  product: string;
  productPrice: number;
  socialLink: string | null;
  comment: string | null;
  metrics?: Record<string, unknown>;
  launchPlan?: Record<string, unknown>;
};

export function isTelegramLeadDeliveryConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

export async function deliverLeadToTelegram(payload: TelegramLeadPayload): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) throw new Error('TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not configured');

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: formatTelegramLeadMessage(payload),
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Telegram status ${response.status}${body ? `: ${body.slice(0, 300)}` : ''}`);
  }
}

function formatTelegramLeadMessage(payload: TelegramLeadPayload): string {
  const sales = typeof payload.metrics?.sales === 'number' ? payload.metrics.sales : null;
  const revenue = typeof payload.metrics?.revenue === 'number' ? payload.metrics.revenue : null;
  const launchProduct = typeof payload.launchPlan?.productName === 'string' ? payload.launchPlan.productName : null;

  return [
    'Новая заявка на бесплатный разбор',
    '',
    `Имя: ${payload.name}`,
    `Контакт: ${payload.contact}`,
    `Ниша: ${payload.product}`,
    `Чек: ${formatRub(payload.productPrice)}`,
    payload.socialLink ? `Инстаграм: ${payload.socialLink}` : null,
    payload.comment ? `Хочет получить на разборе: ${payload.comment}` : null,
    '',
    launchProduct ? `Игровой продукт: ${launchProduct}` : null,
    sales !== null ? `Продажи в игре: ${sales}` : null,
    revenue !== null ? `Выручка в игре: ${formatRub(revenue)}` : null,
    '',
    `Session: ${payload.sessionId}`,
    `Lead: ${payload.leadId}`,
  ].filter(Boolean).join('\n');
}

function formatRub(value: number): string {
  return `${Math.round(value).toLocaleString('ru-RU')} ₽`;
}
