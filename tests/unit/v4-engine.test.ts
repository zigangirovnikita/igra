import { describe, expect, it } from 'vitest';
import { simulateV4Attempt, type V4FunnelStage } from '../../packages/game-engine/src';

const stages: V4FunnelStage[] = [
  { id: 'reels', instrumentId: 'reels', execution: 'expert', offerMode: 'free', tripwirePrice: null, volume: 28 },
  { id: 'bot', instrumentId: 'ai_bot', execution: 'expert', offerMode: 'tripwire', tripwirePrice: 990, volume: 1 },
  { id: 'call', instrumentId: 'call', execution: 'expert', offerMode: 'main_product', tripwirePrice: null, volume: 1 },
];

describe('v4 funnel engine', () => {
  it('is deterministic for the same seed and allows repeated instruments', () => {
    const repeated = [...stages, { ...stages[1], id: 'second-bot', offerMode: 'free' as const }];
    const input = { seed: 'v4-repeat', mainProductPrice: 30_000, dreamPrice: 300_000, stages: repeated };
    expect(simulateV4Attempt(input)).toEqual(simulateV4Attempt(input));
  });

  it('requires traffic as the first funnel stage', () => {
    const report = simulateV4Attempt({
      seed: 'v4-invalid', mainProductPrice: 20_000, dreamPrice: 150_000,
      stages: [{ ...stages[1] }, { ...stages[2] }],
    });
    expect(report.valid).toBe(false);
    expect(report.errors).toContain('Первый этап — всегда реклама');
  });

  it('calculates tripwire and product revenue separately', () => {
    const report = simulateV4Attempt({ seed: 'v4-money', mainProductPrice: 30_000, dreamPrice: 300_000, stages });
    expect(report.tripwireRevenue).toBeGreaterThanOrEqual(0);
    expect(report.totalRevenue).toBe(report.mainProductRevenue + report.tripwireRevenue);
    expect(report.totalMoney).toBe(report.bankRemaining + report.totalRevenue);
  });

  it('routes unfinished final-stage people to a manual fallback queue', () => {
    const report = simulateV4Attempt({
      seed: 'v4-fallback', mainProductPrice: 25_000, dreamPrice: 200_000,
      stages: [
        { id: 'reels', instrumentId: 'reels', execution: 'expert', offerMode: 'free', tripwirePrice: null, volume: 20 },
        { id: 'webinar', instrumentId: 'auto_webinar', execution: 'expert', offerMode: 'free', tripwirePrice: null, volume: 1 },
      ],
    });
    expect(report.fallbackManualQueue).toBeGreaterThanOrEqual(0);
  });
});
