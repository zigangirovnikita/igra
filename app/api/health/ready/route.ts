import { NextResponse } from 'next/server';
import { loadGameConfig } from '@/lib/config/game-config';

export function GET() {
  try {
    const config = loadGameConfig();
    const production = process.env.NODE_ENV === 'production';
    const hasLeadWebhook = Boolean(process.env.LEAD_WEBHOOK_URL && process.env.LEAD_WEBHOOK_SECRET);
    const hasTelegramLeadDelivery = Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
    const missingProductionEnv = production
      ? [
        ...['DATABASE_URL', 'LEAD_ENCRYPTION_KEY'].filter((key) => !process.env[key]),
        ...(!hasLeadWebhook && !hasTelegramLeadDelivery ? ['LEAD_DELIVERY'] : []),
      ]
      : [];

    if (missingProductionEnv.length > 0) {
      return NextResponse.json({ status: 'not_ready', missingProductionEnv }, { status: 503 });
    }

    return NextResponse.json({
      status: 'ready',
      configVersion: config.version,
      db: process.env.DATABASE_URL ? 'configured' : 'not_configured'
    });
  } catch (error) {
    return NextResponse.json({ status: 'not_ready', error: error instanceof Error ? error.message : 'unknown' }, { status: 503 });
  }
}
