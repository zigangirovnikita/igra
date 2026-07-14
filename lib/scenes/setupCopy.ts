export type SetupDraft = {
  gender: 'female' | 'male';
  name: string;
  niche: string;
  superpower: 'sales' | 'marketing' | 'energy' | 'ads';
};

export type SetupStep = 'welcome' | 'setup_intro' | 'gender' | 'name' | 'niche' | 'superpower' | 'created';
export const SETUP_STEPS: SetupStep[] = ['welcome', 'setup_intro', 'gender', 'name', 'niche', 'superpower', 'created'];

export const defaultDraft: SetupDraft = {
  gender: 'female',
  name: '',
  niche: '',
  superpower: 'marketing',
};
