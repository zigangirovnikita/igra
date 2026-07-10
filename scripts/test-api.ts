import { setupSchema } from '../lib/game/schemas';
import { createInitialState } from '../packages/game-engine/src';
import { loadGameConfig } from '../lib/config/game-config';
import { saveSession } from '../lib/game/store';

async function main() {
  const input = {
    avatarGender: 'female',
    name: 'Test',
    niche: 'QA',
    superpowers: ['expertise', 'sales'],
    productType: 'consultation',
    productPrice: 30000,
    averageReelViews: 1500,
    averageStoryViews: 200,
    telegramStatus: 'none',
    averageTelegramViews: 0,
    dreams: ['dream1']
  };

  const parsed = setupSchema.safeParse(input);
  if (!parsed.success) {
    console.error('Validation error:', parsed.error.flatten());
    return;
  }

  try {
    const config = loadGameConfig();
    const seed = crypto.randomUUID();
    const state = createInitialState(parsed.data, config, seed);
    const now = new Date().toISOString();
    
    console.log('Saving session...');
    await saveSession({
      id: state.sessionId,
      state,
      setup: parsed.data,
      result: null,
      createdAt: now,
      updatedAt: now
    });
    console.log('Success!', state.sessionId);
  } catch (e) {
    console.error('Error!', e);
  }
}

main();
