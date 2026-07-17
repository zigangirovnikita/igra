import type { Superpower } from '@/packages/game-engine/src';

export type SetupDraft = {
  gender: 'female' | 'male';
  name: string;
  niche: string;
  superpower: Superpower | null;
};

export type SetupStep = 'welcome' | 'setup_intro' | 'gender' | 'name' | 'niche' | 'superpower' | 'created';
export const SETUP_STEPS: SetupStep[] = ['welcome', 'setup_intro', 'gender', 'name', 'niche', 'superpower', 'created'];

export const defaultDraft: SetupDraft = {
  gender: 'female',
  name: '',
  niche: '',
  superpower: null,
};
