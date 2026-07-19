import { describe, expect, it } from 'vitest';
import { createInitialState, simulateV4Attempt, tutorialV4Funnel, type V4FunnelStage } from '../../packages/game-engine/src';
import { loadGameConfig } from '../../lib/config/game-config';

const stages: V4FunnelStage[] = [
  { id: 'reels', instrumentId: 'reels', execution: 'expert', offerMode: 'free', tripwirePrice: null, volume: 28 },
  { id: 'bot', instrumentId: 'ai_bot', execution: 'expert', offerMode: 'tripwire', tripwirePrice: 990, volume: 1 },
  { id: 'call', instrumentId: 'call', execution: 'expert', offerMode: 'main_product', tripwirePrice: null, volume: 1 },
];

describe('v4 funnel engine', () => {
  it('starts new public sessions in the v4 dream step', () => {
    const state = createInitialState({
      avatarGender: 'female',
      name: 'Марина',
      niche: 'Воронка на мечту',
      superpower: 'energy',
    }, loadGameConfig(), 'v4-start');
    expect(state.flow.stage).toBe('v4');
    expect(state.flow.step).toBe('v4_dream');
    expect(state.v4.funnel.length).toBeGreaterThanOrEqual(2);
  });

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
    const stageMainSales = report.stageResults.reduce((sum, stage) => sum + stage.mainProductSales, 0);
    expect(report.tripwireRevenue).toBeGreaterThanOrEqual(0);
    expect(report.totalRevenue).toBe(report.mainProductRevenue + report.tripwireRevenue);
    expect(report.totalMoney).toBe(report.bankRemaining + report.totalRevenue);
    expect(report.mainProductRevenue).toBe(stageMainSales * 30_000);
  });

  it('applies sales conversion once for an automatic sales stage', () => {
    const report = simulateV4Attempt({
      seed: 'v4-single-sales-conversion',
      mainProductPrice: 30_000,
      dreamPrice: 300_000,
      stages: [
        { id: 'ads', instrumentId: 'paid_ads', execution: 'expert', offerMode: 'free', tripwirePrice: null, volume: 60_000 },
        { id: 'site', instrumentId: 'website', execution: 'expert', offerMode: 'main_product', tripwirePrice: null, volume: 1 },
      ],
    });
    const salesStage = report.stageResults.at(-1);
    expect(salesStage?.entered).toBeGreaterThan(1_000);
    expect(salesStage?.mainProductSales ?? 0).toBeGreaterThan(40);
  });

  it('does not turn a middle warmup manual queue directly into product sales', () => {
    const report = simulateV4Attempt({
      seed: 'v4-middle-manual-queue',
      mainProductPrice: 30_000,
      dreamPrice: 300_000,
      manualActions: 10,
      stages: [
        { id: 'ads', instrumentId: 'paid_ads', execution: 'expert', offerMode: 'free', tripwirePrice: null, volume: 60_000 },
        { id: 'bot', instrumentId: 'simple_bot', execution: 'self', offerMode: 'free', tripwirePrice: null, volume: 1 },
        { id: 'guide', instrumentId: 'guide', execution: 'self', offerMode: 'free', tripwirePrice: null, volume: 1 },
      ],
    });
    expect(report.handledManualQueue).toBeGreaterThan(0);
    expect(report.mainProductRevenue).toBe(0);
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

  it('keeps missed revenue bounded to achievable extra sales', () => {
    const report = simulateV4Attempt({
      seed: 'v4-tutorial-loss',
      mainProductPrice: 30_000,
      dreamPrice: 100_000,
      manualActions: 7,
      stages: [
        { id: 'ads', instrumentId: 'paid_ads', execution: 'expert', offerMode: 'free', tripwirePrice: null, volume: 55_000 },
        { id: 'tg', instrumentId: 'telegram', execution: 'self', offerMode: 'free', tripwirePrice: null, volume: 14 },
        { id: 'calls', instrumentId: 'call', execution: 'self', offerMode: 'main_product', tripwirePrice: null, volume: 1 },
      ],
    });
    expect(report.lostPotentialRevenue).toBeLessThanOrEqual(360_000);
  });

  it('keeps the tutorial funnel as an early loss for a cheap dream', () => {
    const report = simulateV4Attempt({
      seed: 'v4-tutorial-loss-cheap-dream',
      mainProductPrice: 30_000,
      dreamPrice: 100_000,
      manualActions: 7,
      stages: tutorialV4Funnel(),
    });
    expect(report.result).toBe('not_reached');
  });

  it('reports lost people whenever missed revenue is positive', () => {
    const report = simulateV4Attempt({
      seed: 'v4-lost-people-consistency',
      mainProductPrice: 30_000,
      dreamPrice: 100_000,
      stages,
    });
    if (report.lostPotentialRevenue > 0) expect(report.lostPeople).toBeGreaterThan(0);
  });
});
