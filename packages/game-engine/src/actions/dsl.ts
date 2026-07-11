import type { Condition, Effect, GameState } from '../types';

const allowedConditionOperators = new Set<Condition['operator']>([
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'in',
  'notIn',
  'hasFlag',
  'lacksFlag',
  'and',
  'or',
  'not'
]);

const allowedEffectOperators = new Set<Effect['operator']>([
  'setFlag',
  'addMetric',
  'multiplyMetric',
  'addResource',
  'createAsset',
  'replaceAsset',
  'scheduleAction',
  'emitEvent'
]);

export function validateDsl(conditionOrEffect: Condition | Effect): void {
  const operator = conditionOrEffect.operator;
  if (!allowedConditionOperators.has(operator as Condition['operator']) && !allowedEffectOperators.has(operator as Effect['operator'])) {
    throw new Error(`Unsupported DSL operator: ${operator}`);
  }
}

export function evaluateCondition(state: GameState, condition: Condition): boolean {
  validateDsl(condition);
  switch (condition.operator) {
    case 'eq':
      return getPath(state, condition.path) === condition.value;
    case 'neq':
      return getPath(state, condition.path) !== condition.value;
    case 'gt':
      return Number(getPath(state, condition.path)) > Number(condition.value);
    case 'gte':
      return Number(getPath(state, condition.path)) >= Number(condition.value);
    case 'lt':
      return Number(getPath(state, condition.path)) < Number(condition.value);
    case 'lte':
      return Number(getPath(state, condition.path)) <= Number(condition.value);
    case 'in':
      return Array.isArray(condition.value) && condition.value.includes(getPath(state, condition.path));
    case 'notIn':
      return Array.isArray(condition.value) && !condition.value.includes(getPath(state, condition.path));
    case 'hasFlag':
      return Boolean(condition.path && state.flags[condition.path]);
    case 'lacksFlag':
      return Boolean(condition.path && !state.flags[condition.path]);
    case 'and':
      return (condition.conditions ?? []).every((item) => evaluateCondition(state, item));
    case 'or':
      return (condition.conditions ?? []).some((item) => evaluateCondition(state, item));
    case 'not':
      return !(condition.conditions ?? []).some((item) => evaluateCondition(state, item));
  }
}

export function applyEffect(state: GameState, effect: Effect): GameState {
  validateDsl(effect);
  switch (effect.operator) {
    case 'setFlag':
      if (!effect.path) return state;
      state.flags[effect.path] = Boolean(effect.value ?? true);
      return state;
    case 'addMetric':
      if (!effect.path || !(effect.path in state.metrics)) return state;
      state.metrics[effect.path as keyof typeof state.metrics] += Number(effect.value ?? 0);
      return state;
    case 'multiplyMetric':
      if (!effect.path || !(effect.path in state.metrics)) return state;
      state.metrics[effect.path as keyof typeof state.metrics] *= Number(effect.value ?? 1);
      return state;
    case 'addResource':
      if (effect.path === 'bank') state.resources.bank += Number(effect.value ?? 0);
      if (effect.path === 'energy') state.resources.energy += Number(effect.value ?? 0);
      state.resources.energy = Math.min(100, Math.max(0, state.resources.energy));
      return state;
    case 'createAsset':
    case 'replaceAsset':
      return createAsset(state, effect.path, effect.value);
    case 'scheduleAction':
      return state;
    case 'emitEvent':
      state.history.push({
        day: state.resources.day,
        type: String(effect.payload?.type ?? 'config_event'),
        message: String(effect.payload?.message ?? effect.path ?? 'Событие'),
        payload: effect.payload
      });
      return state;
  }
}

function createAsset(state: GameState, path: string | undefined, value: unknown): GameState {
  if (path === 'demandConfidence') state.assets.demandConfidence = Number(value ?? 0);
  if (path === 'pilotReady') state.assets.pilotReady = Boolean(value ?? true);
  if (path === 'productQuality') state.assets.productQuality = Number(value ?? 1);
  if (path === 'guide') state.assets.guide = String(value ?? 'ready');
  if (path === 'videoLesson') state.assets.videoLesson = String(value ?? 'ready');
  if (path === 'simpleBot') state.assets.simpleBot = String(value ?? 'ready');
  if (path === 'aiBot') {
    state.assets.aiBot = String(value ?? 'ready');
    state.assets.simpleBot = null;
  }
  if (path === 'website') state.assets.website = String(value ?? 'basic');
  if (path === 'manager') state.assets.manager = String(value ?? 'ready');
  return state;
}

function getPath(source: unknown, path: string | undefined): unknown {
  if (!path) return undefined;
  return path.split('.').reduce<unknown>((current, key) => {
    if (current && typeof current === 'object' && key in current) {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, source);
}
