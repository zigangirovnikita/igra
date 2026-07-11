import type { GameState, GameConfig, GameCommand } from '../types';
import { assertStateInvariants } from '../state/invariants';
import { calculateDiagnostics } from '../diagnostics/report';
import { appendTriggeredEvents } from '../events/dispatcher';
import * as SetupTransitions from '../flow/transitions';
import * as DailyTransitions from '../flow/daily';
import * as OutcomeTransitions from '../flow/outcome';
import * as PendingDecisions from '../flow/pending-decisions';

export function applyCommand(input: GameState, config: GameConfig, command: GameCommand): GameState {
  if (input.appliedCommandIds.includes(command.commandId)) return input;
  if (input.status === 'finished' && command.type !== 'finish_game') {
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
    case 'set_dreams':
      state = SetupTransitions.setDreams(state, config, command.payload.dreams);
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
    case 'complete_day_two':
      state = SetupTransitions.completeDayTwo(state);
      break;
      
    // Daily Flow
    case 'choose_intent':
      state = DailyTransitions.chooseIntent(state, command.payload.intent);
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
      state.flow.step = 'action_result';
      break;
    case 'acknowledge_action_result':
      if (state.flow.step !== 'action_result') throw new Error('Invalid step');
      state.flow.step = 'post_action';
      state.pendingDecision = PendingDecisions.deriveNextPendingDecision(state);
      if (!state.pendingDecision) state.flow.step = 'day_summary';
      break;
      
    // Mini-games
    case 'resolve_pending_decision':
      state = PendingDecisions.resolvePendingDecision(state, config, command.payload);
      break;

    // Day end
    case 'complete_day':
      state = DailyTransitions.completeDay(state, config);
      break;
      
    case 'record_reflection':
      state.history.push({ day: state.resources.day, type: 'reflection', message: command.payload.answer, payload: { eventId: command.payload.eventId } });
      break;
      
    case 'finish_game':
      state = finishGame(state, config);
      break;
      
    default:
      console.warn(`Unknown command type`);
  }

  const actionId = ['select_action', 'confirm_action'].includes(command.type) ? (command.payload as any).actionId : undefined;
  state = appendTriggeredEvents(input, state, config, actionId);
  state.appliedCommandIds.push(command.commandId);
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
