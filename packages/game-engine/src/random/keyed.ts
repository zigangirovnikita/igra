import type { GameConfig } from '../types';

export function hashToUnitInterval(...parts: Array<string | number>): number {
  const input = parts.join('|');
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
}

export function keyedRandomMultiplier(
  seed: string,
  config: GameConfig,
  cohortId: string,
  stageId: string,
  occurrenceIndex = 0
): number {
  const unit = hashToUnitInterval(seed, config.version, cohortId, stageId, occurrenceIndex);
  let cursor = 0;
  for (const item of config.randomness.distribution) {
    cursor += item.probability;
    if (unit <= cursor) return item.multiplier;
  }
  return config.randomness.distribution.at(-1)?.multiplier ?? 1;
}

export function stochasticRound(value: number, key: string): number {
  const whole = Math.floor(value);
  const fraction = value - whole;
  return whole + (hashToUnitInterval(key) < fraction ? 1 : 0);
}
