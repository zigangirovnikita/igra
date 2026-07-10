import { describe, expect, it } from 'vitest';
import { loadGameConfig } from '../../lib/config/game-config';

describe('game config', () => {
  it('loads and keeps random expectation neutral', () => {
    const config = loadGameConfig();
    const probability = config.randomness.distribution.reduce((sum, item) => sum + item.probability, 0);
    const expectation = config.randomness.distribution.reduce((sum, item) => sum + item.probability * item.multiplier, 0);
    expect(probability).toBeCloseTo(1);
    expect(expectation).toBeCloseTo(1);
  });

  it('contains all required first-stage action groups', () => {
    const categories = [...new Set(loadGameConfig().actions.map((action) => action.category))];
    expect(categories).toEqual(expect.arrayContaining(['preparation', 'product', 'content', 'route', 'sales', 'rest']));
  });
});
