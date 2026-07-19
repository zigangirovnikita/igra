import type { GameCommand, GameConfig, GameState } from '../types';
import { assertStateInvariants } from '../state/invariants';
import { calculateDiagnostics } from '../diagnostics/report';
import { appendTriggeredEvents } from '../events/dispatcher';
import { generateMiniGameSession } from '../calculations/minigame';
import * as SetupTransitions from '../flow/transitions';
import * as DailyTransitions from '../flow/daily';
import * as OutcomeTransitions from '../flow/outcome';
import * as PendingDecisions from '../flow/pending-decisions';
import * as V3 from '../flow/v3';
import * as V4 from '../flow/v4';
import { applyEffect } from './dsl';

export function applyCommand(input: GameState, config: GameConfig, command: GameCommand): GameState {
  if (input.appliedCommandIds.includes(command.commandId)) return input;
  if (input.status === 'finished') throw new Error('Finished session does not accept game commands');

  let state = structuredClone(input);

  switch (command.type) {
    case 'advance_intro': state = SetupTransitions.advanceIntro(state); break;
    case 'set_product_type': state = SetupTransitions.setProductType(state, config, command.payload.productType); break;
    case 'set_product_name': state = SetupTransitions.setProductName(state, command.payload.productName); break;
    case 'set_product_price': state = SetupTransitions.setProductPrice(state, config, command.payload.productPrice); break;
    case 'set_sale_method': state = SetupTransitions.setSaleMethod(state, command.payload.saleMethod); break;
    case 'set_nurture': state = SetupTransitions.setNurture(state, command.payload.nurture, command.payload.uncertain); break;
    case 'set_entry_point': state = SetupTransitions.setEntryPoint(state, command.payload.entryPoint); break;
    case 'advance_day1_goal': state = SetupTransitions.advanceDay1Goal(state); break;
    case 'back_to_day1_price': state = SetupTransitions.backToDay1Price(state); break;
    case 'set_dreams': state = SetupTransitions.setDreams(state, config, command.payload.dreams); break;
    case 'edit_day1_plan': state = SetupTransitions.editDay1Plan(state); break;
    case 'complete_day_one': state = SetupTransitions.completeDayOne(state); break;
    case 'advance_day2_intro': state = SetupTransitions.advanceDay2Intro(state); break;
    case 'set_channels': state = SetupTransitions.setChannels(state, command.payload.channels); break;
    case 'set_audience_metrics': state = SetupTransitions.setAudienceMetrics(state, command.payload); break;
    case 'edit_day2_resources': state = SetupTransitions.editDay2Resources(state); break;
    case 'complete_day_two': state = SetupTransitions.completeDayTwo(state); break;

    case 'advance_daily_intro':
      if (state.flow.step !== 'daily_intro') throw new Error('Invalid step');
      state.flow.step = 'daily_intent';
      break;
    case 'choose_intent': state = DailyTransitions.chooseIntent(state, config, command.payload.intent); break;
    case 'choose_action_group': state = DailyTransitions.chooseActionGroup(state, command.payload.group); break;
    case 'select_action': state = DailyTransitions.selectAction(state, config, command.payload.actionId); break;
    case 'configure_action': state = DailyTransitions.configureAction(state, command.payload); break;
    case 'cancel_pending_action': state = DailyTransitions.cancelPendingAction(state); break;
    case 'confirm_action': state = OutcomeTransitions.confirmAction(state, config); break;

    case 'acknowledge_action_process':
      if (state.flow.step !== 'action_process') throw new Error('Invalid step');
      state.flow.step = state.lastOutcome ? 'action_result' : 'day_summary';
      break;
    case 'acknowledge_action_result':
      if (state.flow.step !== 'action_result') throw new Error('Invalid step');
      state.flow.step = 'post_action';
      state.pendingDecision = PendingDecisions.deriveNextPendingDecision(state);
      if (state.pendingDecision?.type === 'mini_game') {
        state.miniGame = generateMiniGameSession(state, state.pendingDecision.cohortId);
      }
      if (!state.pendingDecision) state.flow.step = 'day_summary';
      break;
    case 'follow_advice':
      if (state.flow.step !== 'action_result') throw new Error('Invalid step');
      if (state.currentDayReport && !state.dayReports.some((report) => report.id === state.currentDayReport?.id)) {
        state.dayReports.push(state.currentDayReport);
      }
      state.currentDayReport = null;
      state.lastOutcome = null;
      state.pendingDecision = null;
      state.flow.selectedIntent = 'fix_system';
      state.flow.selectedGroup = adviceGroupForAction(input.lastOutcome?.actionId);
      state.flow.step = 'day_summary';
      break;

    case 'resolve_pending_decision': state = PendingDecisions.resolvePendingDecision(state, config, command.payload); break;
    case 'resolve_inbound':
      state.pendingDecision = { type: 'inbound', cohortId: command.payload.cohortId, returnStep: 'daily_intro' };
      state = PendingDecisions.resolvePendingDecision(state, config, {
        cohortId: command.payload.cohortId,
        action: command.payload.mode === 'defer' ? 'defer' : command.payload.mode === 'none' ? 'ignore' : 'process',
        amount: command.payload.processed,
      });
      break;
    case 'defer_inbound':
      state.pendingDecision = { type: 'inbound', cohortId: command.payload.cohortId, returnStep: 'daily_intro' };
      state = PendingDecisions.resolvePendingDecision(state, config, { cohortId: command.payload.cohortId, action: 'defer' });
      break;
    case 'resolve_sales':
      state.pendingDecision = { type: 'sales', cohortId: command.payload.cohortId, returnStep: 'daily_intro' };
      state = PendingDecisions.resolvePendingDecision(state, config, command.payload);
      break;
    case 'resolve_followup':
      state.pendingDecision = { type: 'followup', cohortId: command.payload.cohortId, returnStep: 'daily_intro' };
      state = PendingDecisions.resolvePendingDecision(state, config, command.payload);
      break;

    case 'complete_day': state = DailyTransitions.completeDay(state, config); break;
    case 'request_finish':
      state.flow.backStep = state.flow.step;
      state.pendingDecision = { type: 'finish_confirmation', returnStep: state.flow.step };
      state.flow.step = 'finish_confirmation';
      break;
    case 'cancel_finish':
      state.pendingDecision = null;
      state.flow.step = state.flow.backStep ?? 'daily_intent';
      state.flow.backStep = null;
      break;
    case 'continue_after_goal':
      state.flow.goalPromptHandled = true;
      state.pendingDecision = null;
      state.flow.step = 'day_summary';
      break;
    case 'abandon_game': state.status = 'abandoned'; break;
    case 'repair_flow':
      state.pendingAction = null;
      state.pendingDecision = null;
      state.miniGame = null;
      state.flow.step = state.flow.stage === 'daily' ? 'daily_intro' : state.flow.step;
      break;

    case 'record_reflection':
      state.history.push({ day: state.resources.day, type: 'reflection', message: command.payload.answer, payload: { eventId: command.payload.eventId } });
      break;
    case 'resolve_mini_game': {
      if (state.pendingDecision?.type !== 'mini_game') throw new Error('No active mini-game decision');
      const payload = command.payload as {
        cohortId: string;
        mode: 'manual' | 'auto';
        answeredMessageIds?: string[];
      };
      state = PendingDecisions.resolvePendingDecision(state, config, {
        cohortId: payload.cohortId,
        action: payload.mode === 'manual' ? 'process_mini_game' : 'skip_mini_game',
        amount: payload.mode === 'manual' ? validatedMiniGameAnswerCount(state, payload.answeredMessageIds ?? []) : 0,
      });
      break;
    }
    case 'acknowledge_event': {
      const eventInstanceId = command.payload.eventId as string;
      if (!eventInstanceId) throw new Error('eventId required');
      if (state.flags[`event_ack:${eventInstanceId}`]) break;
      const historyEvent = state.history.find((entry) =>
        entry.type === 'game_event' && entry.payload?.eventInstanceId === eventInstanceId
      );
      if (!historyEvent) throw new Error('Event is not pending');
      const templateId = String(historyEvent.payload?.eventId ?? '');
      const template = config.events.find((event) => event.id === templateId);
      if (!template) throw new Error('Unknown event');
      for (const effect of template.effects) state = applyEffect(state, effect);
      state.flags[`event_ack:${eventInstanceId}`] = true;
      break;
    }

    case 'v3_next':
      state = state.flow.step === 'v3_active_intro'
        ? V3.startV3ActiveStageAfterIntro(state)
        : V3.nextV3Step(state);
      break;
    case 'v3_set_product':
      state = V3.setV3Product(state, command.payload.productType);
      break;
    case 'v3_set_price':
      state = V3.setV3Price(state, config, command.payload.productPrice);
      break;
    case 'v3_set_dream':
      state = V3.setV3Dream(state, config, command.payload.dreamId, command.payload.customTitle, command.payload.customPrice);
      break;
    case 'v3_set_dreams':
      state = V3.setV3Dreams(state, config, command.payload.dreams, command.payload.customTitle, command.payload.customPrice);
      break;
    case 'v3_open_reflection':
      state = V3.openV3Reflection(state, command.payload.target);
      break;
    case 'v3_confirm_preparation':
      state = V3.confirmV3Preparation(state, command.payload.area, command.payload.instrumentId, command.payload.mode);
      break;
    case 'v3_request_advice':
      state = V3.requestV3Advice(state, command.payload.category, command.payload.option);
      break;
    case 'v3_rest':
      state = V3.restV3(state, command.payload.days);
      break;
    case 'v3_begin_action_plan':
      state = V3.beginV3ActionPlan(state);
      break;
    case 'v3_change_launch_plan':
      state = V3.changeV3BlockedLaunchPlan(state);
      break;
    case 'v3_finish_launch':
      if (state.flow.step !== 'v3_launch_time_blocked') throw new Error('Invalid step');
      state.endingReason = 'time_finished';
      state = finishGame(state, config);
      break;
    case 'v3_ack_pre_action_summary':
      state = V3.ackV3PreActionSummary(state);
      break;
    case 'v3_select_active':
      state = V3.selectV3Active(state, command.payload.kind, command.payload.key);
      break;
    case 'v3_start_active_stage':
      state = V3.startV3ActiveStage(state);
      break;
    case 'v3_complete_active_stage':
      state = V3.completeV3ActiveStage(state, command.payload);
      break;
    case 'v3_return_reflection':
      state = V3.returnV3Reflection(state);
      break;

    case 'v4_set_dream':
      state = V4.setV4Dream(state, command.payload);
      break;
    case 'v4_set_product':
      state = V4.setV4Product(state, command.payload.productType);
      break;
    case 'v4_set_price':
      state = V4.setV4Price(state, config, command.payload.productPrice);
      break;
    case 'v4_start_tutorial':
      state = V4.startV4Tutorial(state);
      break;
    case 'v4_set_funnel_length':
      state = V4.setV4FunnelLength(state, command.payload.length);
      break;
    case 'v4_configure_funnel_stage':
      state = V4.configureV4FunnelStage(state, command.payload);
      break;
    case 'v4_start_attempt':
      state = V4.startV4Attempt(state);
      break;
    case 'v4_finish_attempt':
      state = V4.finishV4Attempt(state, command.payload?.manualActions ?? 0);
      break;
    case 'v4_start_next_attempt':
      state = V4.startNextV4Attempt(state, command.payload?.changeProduct ?? false);
      break;
    case 'v4_toggle_details':
      state = V4.toggleV4Details(state);
      break;

    case 'start_parallel':
    case 'set_route':
      throw new Error('Developer command is disabled in public game API');
    default:
      throw new Error(`Unhandled command: ${(command as { type: string }).type}`);
  }

  const actionId = command.type === 'confirm_action'
    ? input.pendingAction?.actionId
    : command.type === 'select_action'
      ? command.payload.actionId
      : undefined;
  if (command.type !== 'acknowledge_event' && !command.type.startsWith('v3_') && !command.type.startsWith('v4_')) {
    state = appendTriggeredEvents(input, state, config, actionId);
  }
  state.appliedCommandIds.push(command.commandId);

  if (command.type !== 'repair_flow' && command.type !== 'acknowledge_event') {
    state.decisionLog = state.decisionLog || [];
    state.decisionLog.push({
      sequence: state.decisionLog.length,
      day: state.resources.day,
      commandType: command.type,
      payload: command.payload ?? {},
    });
  }

  state.stateVersion += 1;
  assertStateInvariants(state, config);
  return state;
}

export function finishGame(input: GameState, config: GameConfig): GameState {
  const state = structuredClone(input);
  if (!state.endingReason) {
    state.endingReason = state.resources.day >= config.totalDays
      ? 'time_finished'
      : state.targets.targetRevenue > 0 && state.metrics.revenue >= state.targets.targetRevenue
        ? 'goal_finished'
        : state.resources.bank <= 0 || state.resources.energy <= 0
          ? 'resource_finished'
          : 'manual_finished';
  }
  state.status = 'finished';
  state.flow.stage = 'final';
  state.flow.step = 'final_diagnosis';
  state.diagnostics = calculateDiagnostics(state, config);
  return state;
}

function validatedMiniGameAnswerCount(state: GameState, answeredMessageIds: string[]): number {
  const miniGame = state.miniGame;
  if (!miniGame || miniGame.status !== 'active') return 0;

  const now = Date.now();
  const startedAt = Date.parse(miniGame.startedAt);
  const expiresAt = Date.parse(miniGame.expiresAt);
  if (!Number.isFinite(startedAt) || !Number.isFinite(expiresAt) || now > expiresAt) return 0;

  const validIds = new Set(miniGame.messages.map((message) => message.id));
  const uniqueValidCount = new Set(answeredMessageIds.filter((id) => validIds.has(id))).size;
  const elapsedMs = Math.max(0, now - startedAt);
  const timeCapacity = miniGameTimeCapacity(state.resources.energy, elapsedMs, miniGame.messages.length);
  return Math.min(uniqueValidCount, timeCapacity);
}

function miniGameTimeCapacity(startingEnergy: number, elapsedMs: number, messageCount: number): number {
  if (messageCount <= 0) return 0;

  let capacity = 1;
  let remainingElapsed = elapsedMs;
  let projectedEnergy = Math.max(0, startingEnergy - 0.3);

  while (capacity < messageCount) {
    const cooldown = projectedEnergy < 30 ? 900 : 600;
    if (remainingElapsed < cooldown) break;
    remainingElapsed -= cooldown;
    capacity += 1;
    projectedEnergy = Math.max(0, projectedEnergy - 0.3);
  }

  return capacity;
}

function adviceGroupForAction(actionId?: string): string {
  if (actionId === 'smm_advice') return 'route';
  if (actionId === 'consultation_detailed') return 'processing';
  if (actionId === 'consultation_basic') return 'nurture';
  return 'demand';
}
