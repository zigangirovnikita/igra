import type { GameState } from '@/packages/game-engine/src';

const icons: Record<string, string> = {
  demand_poll: '🗳️', demand_interviews: '💬', demand_pilot_offer: '🚀', product_pilot: '⚡', product_self: '🎬', product_home: '🎥', product_studio: '🎞️',
  stories_3d: '📱', reels_7d: '🎵', reels_stories_7d: '🔥', live_stream: '📡', webinar: '🎤', telegram_warmup: '✈️', guide_self: '📄', guide_specialist: '📋',
  video_self: '🎓', video_specialist: '🎓', simple_bot_self: '🤖', simple_bot_specialist: '🤖', ai_bot_self: '🧠', ai_bot_specialist: '🧠', website_basic: '🌐',
  website_beautiful: '✨', hire_manager: '👤', manual_chat: '💌', calls: '📞', manual_followup: '🔄', bot_followup: '🔄', consultation_basic: '📊',
  consultation_detailed: '🔍', rest_one_day: '☀️', rest_two_days: '🌴',
};

const descriptions: Record<string, string> = {
  demand_poll: 'Опросить аудиторию — хотят ли они продукт', demand_interviews: 'Провести 10 живых диалогов, узнать возражения', demand_pilot_offer: 'Предложить пилот первым трём клиентам',
  product_pilot: 'Быстро собрать MVP и начать продавать', product_self: 'Записать продукт самостоятельно дома', product_home: 'Снять дома с хорошим светом и микрофоном',
  product_studio: 'Студия, оператор и монтаж', stories_3d: 'Три дня сторис для текущей аудитории', reels_7d: 'Неделя рилсов для новой аудитории',
  reels_stories_7d: 'Рилсы и сторис параллельно', live_stream: 'Живой эфир и вопросы аудитории', webinar: 'Вебинар с продажей в конце', telegram_warmup: 'Прогрев в Telegram',
  guide_self: 'Создать гайд как вход в воронку', guide_specialist: 'Заказать гайд у специалиста', video_self: 'Записать прогревающий видеоурок', video_specialist: 'Заказать видеоурок',
  simple_bot_self: 'Собрать бота для стандартных вопросов', simple_bot_specialist: 'Простой бот под ключ', ai_bot_self: 'Настроить ИИ-бота самостоятельно', ai_bot_specialist: 'ИИ-бот под ключ',
  website_basic: 'Простой сайт с описанием продукта', website_beautiful: 'Красивый лендинг с дизайном', hire_manager: 'Менеджер обрабатывает входящие',
  consultation_basic: 'Широкие диапазоны и уровень риска', consultation_detailed: 'Точные диапазоны и главный риск', rest_one_day: 'Восстановить 12 энергии', rest_two_days: 'Восстановить 25 энергии',
};

export const getActionIcon = (actionId: string) => icons[actionId] ?? '▶️';

export function getActionDescription(state: GameState, actionId: string): string {
  const base = descriptions[actionId] ?? 'Следующий шаг в запуске';
  if (actionId.startsWith('consultation_')) return base;
  if (state.flags.detailedConsultation) return `${base}. Конверсия: 14–18%. Главный риск зависит от прогрева и продажи.`;
  if (state.flags.basicConsultation) return `${base}. Ориентир: 10–25%. Риск потери входящих: ${state.activeRoute.processing === 'manual' ? 'высокий' : 'средний'}.`;
  return `${base}. Может дать заявки; точный диапазон пока неизвестен.`;
}
