import { loadGameConfig } from '../lib/config/game-config';
import { defaultV4Funnel, simulateV4Attempt, V4_INSTRUMENTS } from '../packages/game-engine/src';

const config = loadGameConfig();
const probability = config.randomness.distribution.reduce((sum, item) => sum + item.probability, 0);

if (Math.abs(probability - 1) > 0.000001) {
  throw new Error(`Random distribution probability must equal 1, got ${probability}`);
}

const v4Ids = Object.keys(V4_INSTRUMENTS);
if (v4Ids.length !== 12) throw new Error(`V4 must define 12 instruments, got ${v4Ids.length}`);
for (const instrument of Object.values(V4_INSTRUMENTS)) {
  if (instrument.self.maxVolume < 1 || instrument.expert.maxVolume < 1) {
    throw new Error(`Invalid V4 volume for ${instrument.id}`);
  }
  if (instrument.self.entryRate < 0 || instrument.expert.entryRate < 0) {
    throw new Error(`Invalid V4 entry rate for ${instrument.id}`);
  }
}

const v4Smoke = simulateV4Attempt({
  seed: 'validate-v4',
  dreamPrice: 300_000,
  mainProductPrice: 30_000,
  stages: defaultV4Funnel(),
  manualActions: 12,
});
if (!v4Smoke.valid) throw new Error(`Default V4 funnel is invalid: ${v4Smoke.errors.join(', ')}`);

console.log(`Config ${config.version} is valid with ${config.actions.length} actions and ${v4Ids.length} v4 instruments.`);
