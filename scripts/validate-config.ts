import { loadGameConfig } from '../lib/config/game-config';

const config = loadGameConfig();
const probability = config.randomness.distribution.reduce((sum, item) => sum + item.probability, 0);

if (Math.abs(probability - 1) > 0.000001) {
  throw new Error(`Random distribution probability must equal 1, got ${probability}`);
}

console.log(`Config ${config.version} is valid with ${config.actions.length} actions.`);
