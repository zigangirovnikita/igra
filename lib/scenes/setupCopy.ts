export type SetupDraft = {
  gender: 'female' | 'male';
  name: string;
  niche: string;
};

export type SetupStep = 'welcome' | 'gender' | 'name' | 'niche';
export const SETUP_STEPS: SetupStep[] = ['welcome', 'gender', 'name', 'niche'];

export const defaultDraft: SetupDraft = {
  gender: 'female',
  name: '',
  niche: '',
};
