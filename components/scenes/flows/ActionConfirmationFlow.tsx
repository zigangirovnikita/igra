import type { GameState, GameConfig } from '@/packages/game-engine/src';
import { ActionConfirmationScreen } from '../ui';

type FlowProps = {
  state: GameState;
  config: GameConfig;
  dispatch: (action: string, payload?: Record<string, unknown>) => Promise<void>;
  busy: boolean;
};

export function ActionConfirmationFlow({ state, config, dispatch, busy }: FlowProps) {
  const pending = state.pendingAction;
  if (!pending) return null;
  
  const action = config.actions.find(a => a.id === pending.actionId);
  if (!action) return null;
  let displayedCost = action.cost;
  if (action.repeatPolicy === 'upgrade' && action.upgradeCost !== undefined && action.upgradeGroup) {
    const hasPrevious = state.history.some((entry) => entry.type === 'action_completed' && config.actions.some((candidate) =>
      candidate.id === entry.payload?.actionId && candidate.upgradeGroup === action.upgradeGroup));
    if (hasPrevious) displayedCost = action.upgradeCost;
  }
  const route = pending.temporaryRoute ?? state.activeRoute;
  const routeText = [
    `Вход: ${entryLabel(route.entry)}`,
    `Прогрев: ${route.nurture.map(nurtureLabel).join(', ') || 'нет'}`,
    `Обработка: ${processingLabel(route.processing)}`,
    `Продажа: ${saleLabel(route.saleMethod)}`,
  ].join(' · ');
  const warning = action.cost > state.resources.bank
    ? 'На это действие не хватает бюджета.'
    : action.energyCost > state.resources.energy
      ? 'На это действие не хватает энергии.'
      : route.saleMethod === 'website_auto' && (state.launchPlan.productPrice ?? 0) > 100_000
        ? 'Дорогой продукт через сайт без личного контакта может продаваться хуже.'
        : null;

  return (
    <ActionConfirmationScreen
      title={action.title}
      description={<>
        <p>{action.description || 'Вы уверены, что хотите запустить это действие?'}</p>
        <p>{routeText}</p>
        {warning && <p>{warning}</p>}
      </>}
      cost={displayedCost}
      energyCost={action.energyCost}
      days={action.days}
      currentBank={state.resources.bank}
      currentEnergy={state.resources.energy}
      onConfirm={() => dispatch('confirm_action')}
      onCancel={() => dispatch('cancel_pending_action')}
      confirmText="Запустить действие"
      cancelText="Изменить настройки"
      busy={busy}
    />
  );
}

function entryLabel(value: string): string {
  if (value === 'direct_messages') return 'директ';
  if (value === 'guide') return 'гайд';
  if (value === 'video_lesson') return 'видеоурок';
  if (value === 'website') return 'сайт';
  if (value === 'webinar_registration') return 'вебинар';
  return value;
}

function nurtureLabel(value: string): string {
  if (value === 'none') return 'нет';
  if (value === 'guide') return 'гайд';
  if (value === 'video_lesson') return 'видеоурок';
  if (value === 'telegram') return 'история и кейсы';
  if (value === 'webinar') return 'вебинар';
  return value;
}

function processingLabel(value: string): string {
  if (value === 'manual') return 'вручную';
  if (value === 'simple_bot') return 'простой бот';
  if (value === 'ai_bot') return 'ИИ-бот';
  if (value === 'manager') return 'менеджер';
  if (value === 'website_auto') return 'сайт';
  return value;
}

function saleLabel(value: string): string {
  if (value === 'manual_chat') return 'переписка';
  if (value === 'call') return 'созвон';
  if (value === 'website_auto') return 'сайт';
  if (value === 'bot_auto') return 'бот';
  if (value === 'webinar_direct') return 'вебинар';
  return value;
}
