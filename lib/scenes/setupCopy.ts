import type { FamilyType, SetupDraft } from './types';

export type SetupStep = 'welcome' | 'gender' | 'name' | 'niche' | 'superpowers' | 'product' | 'product_name' | 'price' | 'family' | 'legend' | 'dreams' | 'channels' | 'reach' | 'summary';
export const SETUP_STEPS: SetupStep[] = ['welcome', 'gender', 'name', 'niche', 'superpowers', 'product', 'product_name', 'price', 'family', 'dreams', 'legend', 'channels', 'reach', 'summary'];

export const productTypeLabels: Record<string, string> = {
  consultation: 'Консультации', service: 'Услуга', recorded_course: 'Обучение в записи', live_course: 'Живое обучение', mentorship: 'Наставничество', membership: 'Клуб / подписка',
};
export const familyOptions: { id: FamilyType; label: string }[] = [
  { id: 'couple_no_kids', label: 'Детей нет, партнёр есть' }, { id: 'couple_kids', label: 'Дети есть, партнёр есть' },
  { id: 'single_no_kids', label: 'Детей нет, без партнёра' }, { id: 'single_kids', label: 'Дети есть, без партнёра' },
];
export const defaultDraft: SetupDraft = { gender: 'female', name: '', niche: '', productName: '', superpowers: [], productType: 'recorded_course', productPrice: 30000,
  familyType: 'couple_no_kids', dreams: [], channelMode: 'instagram', averageReelViews: 1500, averageStoryViews: 200, averageTelegramViews: 150 };

export function getLegendText(draft: SetupDraft): string[] {
  const product = draft.productName || productTypeLabels[draft.productType]?.toLowerCase() || 'свой продукт';
  if (draft.familyType.startsWith('couple')) return [
    `${draft.name}, поздравляем — у вас отличные стартовые условия!`, 'Ваш партнёр поддержал идею и выделил 100 000 ₽ на запуск.', 'Он взял на себя бытовые расходы и сказал:',
    `«Ты давно ${draft.gender === 'female' ? 'хотела' : 'хотел'} запустить ${product}. У тебя как раз есть месяц. Попробуй!»`,
    `И вот вы остались с идеей, деньгами и мечтой: ${draft.dreams.length > 1 ? 'осуществить выбранные цели' : 'осуществить выбранную цель'}.`,
  ];
  return [`${draft.name}, поздравляем — у вас отличные стартовые условия!`, 'У вас есть 100 000 ₽, которые вы готовы вложить в запуск.',
    `Бытовые расходы закрыты. Впереди 30 дней, чтобы превратить ${product} в систему продаж.`, 'Сейчас всё зависит только от вас.'];
}
