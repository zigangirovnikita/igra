export type SetupDraft = {
  gender: 'female' | 'male';
  name: string;
};

export type SetupStep = 'welcome' | 'gender' | 'name';
export const SETUP_STEPS: SetupStep[] = ['welcome', 'gender', 'name'];

export const defaultDraft: SetupDraft = {
  gender: 'female',
  name: '',
};
