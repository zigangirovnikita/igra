import type { GameState, GameConfig, GameCommand } from '../types';
import { assertStateInvariants } from '../state/invariants';
import { calculateDiagnostics } from '../diagnostics/report';
import { appendTriggeredEvents } from '../events/dispatcher';
import * as SetupTransitions from '../flow/transitions';
import * as DailyTransitions from '../flow/daily';
import * as OutcomeTransitions from '../flow/outcome';
import * as PendingDecisions from '../flow/pending-decisions';
import { applyEffect } from './dsl';

export function applyCommand(input: GameState, config: GameConfig, command: GameCommand): GameState {
  if (input.appliedCommandIds.includes(command.commandId)) return input;
  if (input.status === 'finished') {
    throw new Error('Finished session does not accept game commands');
  }

  let state = structuredClone(input);

  switch (command.type) {
    // Setup - Intro & Day 1
    case 'advance_intro':
      state = SetupTransitions.advanceIntro(state);
      break;
    case 'set_product_type':
      state = SetupTransitions.setProductType(state, config, command.payload.productType);
      break;
    case 'set_product_name':
      state = SetupTransitions.setProductName(state, command.payload.productName);
      break;
    case 'set_product_price':
      state = SetupTransitions.setProductPrice(state, config, command.payload.productPrice);
      break;
    case 'set_sale_method':
      state = SetupTransitions.setSaleMethod(state, command.payload.saleMethod);
      break;
    case 'set_nurture':
      state = SetupTransitions.setNurture(state, command.payload.nurture, command.payload.uncertain);
      break;
    case 'set_entry_point':
      state = SetupTransitions.setEntryPoint(state, command.payload.entryPoint);
      break;
    case 'advance_day1_goal':
      state = SetupTransitions.advanceDay1Goal(state);
      break;
    case 'back_to_day1_price':
      state = SetupTransitions.backToDay1Price(state);
      break;
    case 'set_dreams':
      state = SetupTransitions.setDreams(state, config, command.payload.dreams);
      break;
    case 'edit_day1_plan':
      state = SetupTransitions.editDay1Plan(state);
      break;
    case 'complete_day_one':
      state = SetupTransitions.completeDayOne(state);
      break;

    // Setup - Day 2
    case 'advance_day2_intro':
      state = SetupTransitions.advanceDay2Intro(state);
      break;
    case 'set_channels':
      state = SetupTransitions.setChannels(state, command.payload.channels);
      break;
    case 'set_audience_metrics':
      state = SetupTransitions.setAudienceMetrics(state, command.payload);
      break;
    case 'edit_day2_resources':
      state = SetupTransitions.editDay2Resources(state);
      break;
    case 'complete_day_two':
      state = SetupTransitions.completeDayTwo(state);
      break;

    // Daily Flow
    case 'advance_daily_intro':
      if (state.flow.step !== 'daily_intro') throw new Error('Invalid step');
      state.flow.step = 'daily_intent';
      break;
    case 'choose_intent':
      state = DailyTransitions.chooseIntent(state, config, command.payload.intent);
      break;
    case 'choose_action_group':
      state = DailyTransitions.chooseActionGroup(state, command.payload.group);
      break;
    case 'select_action':
      state = DailyTransitions.selectAction(state, config, command.payload.actionId);
      break;
    case 'configure_action':
      state = DailyTransitions.configureAction(state, command.payload);
      break;
    case 'cancel_pending_action':
      state = DailyTransitions.cancelPendingAction(state);
      break;
    case 'confirm_action':
      state = OutcomeTransitions.confirmAction(state, config);
      break;

    // Action progression
    case 'acknowledge_action_process':
      if (state.flow.step !== 'action_process') throw new Error('Invalid step');
      if (state.lastOutcome) {
        state.flow.step = 'action_result';
      } else {
        state.flow.step = 'day_summary';
      }
      break;
    case 'acknowledge_action_result':
      if (state.flow.step !== 'action_result') throw new Error('Invalid step');
      state.flow.step = 'post_action';
      state.pendingDecision = PendingDecisions.deriveNextPendingDecision(state);
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
      state.flow.step = 'action_list';
      break;

    // Mini-games
    case 'resolve_pending_decision':
      state = PendingDecisions.resolvePendingDecision(state, config, command.payload);
      break;
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

    // Day end
    case 'complete_day':
      state = DailyTransitions.completeDay(state, config);
      break;
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
    case 'abandon_game':
      state.status = 'abandoned';
      break;
    case 'repair_flow':
      state.pendingAction = null;
      state.pendingDecision = null;
      state.flow.step = state.flow.stage === 'daily' ? 'daily_intro' : state.flow.step;
      break;

    case 'record_reflection':
      state.history.push({ day: state.resources.day, type: 'reflection', message: command.payload.answer, payload: { eventId: command.payload.eventId } });
      break;

    case 'resolve_mini_game':
      if (state.pendingDecision?.type === 'mini_game') {
        const action = command.payload.mode === 'manual' ? 'process_mini_game' : 'skip_mini_game';
        state = PendingDecisions.resolvePendingDecision(state, config, { 
          cohortId: command.payload.cohortId, 
          action, 
          amount: command.payload.processed 
        });
      }
      break;

    case 'acknowledge_event': {
      const eventId = command.payload.eventId as string;
      const template = config.events.find(e => e.id === eventId);
      if (template && template.effects) {
        for (const effect of template.effects) {
          state = applyEffect(state, effect);
        }
      }
      break;
    }
    
    case 'start_parallel':
    case 'set_route':
      // Developer commands, skip strict handling
      break;

    default:
      throw new Error(`Unhandled command: ${(command as { type: string }).type}`);
  }

  const actionId = ['select_action', 'confirm_action'].includes(command.type) ? (command.payload as { actionId?: string }).actionId : undefined;
  state = appendTriggeredEvents(input, state, config, actionId);
  state.appliedCommandIds.push(command.commandId);
  
  if (command.type !== 'repair_flow' && command.type !== 'acknowledge_event') {
    state.decisionLog = state.decisionLog || [];
    state.decisionLog.push({
      sequence: state.decisionLog.length,
      day: state.resources.day,
      commandType: command.type,
      payload: command.payload,
    });
  }

  state.stateVersion += 1;
  assertStateInvariants(state, config);
  return state;
}

export function finishGame(input: GameState, config: GameConfig): GameState {
  const state = structuredClone(input);
  state.status = 'finished';
  state.flow.stage = 'final';
  state.flow.step = 'final_diagnosis';
  state.diagnostics = calculateDiagnostics(state, config);
  return state;
}

function adviceGroupForAction(actionId?: string): string {
  if (actionId === 'smm_advice') return 'route';
  if (actionId === 'consultation_detailed') return 'processing';
  if (actionId === 'consultation_basic') return 'nurture';
  return 'demand';
}
