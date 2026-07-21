'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  getV4Instrument,
  simulateV4Attempt,
  type GameState,
  type V4AttemptReport,
  type V4FunnelStage,
} from '@/packages/game-engine/src';
import { instrumentIcon } from './V4Builder';
import { rub, V4Screen } from './v4Ui';

type Dispatch = (actionType: string, payload?: Record<string, unknown>) => Promise<boolean>;

type ActiveAction = {
  stageId: string;
  label: string;
  endsAt: number;
};

type StageAction = {
  stage: V4FunnelStage;
  label: string;
  durationMs: number;
  queue: number;
};

type VisualPerson = {
  id: string;
  status: 'stream' | 'warm' | 'waiting' | 'cooling' | 'processing' | 'sold' | 'lost';
  text: string | null;
  amount: number | null;
  x: number;
  y: number;
  delay: number;
};

const MAX_PEOPLE_PER_STAGE = 20;

export function V4MiniGame({ state, dispatch, busy }: { state: GameState; dispatch: Dispatch; busy: boolean }) {
  const active = state.v4.activeAttempt;
  const [nowMs, setNowMs] = useState(Date.now());
  const [manualActions, setManualActions] = useState(0);
  const [handledByStage, setHandledByStage] = useState<Record<string, number>>({});
  const [activeAction, setActiveAction] = useState<ActiveAction | null>(null);
  const [finishing, setFinishing] = useState(false);
  const elapsedSeconds = active ? Math.max(0, Math.floor((nowMs - Date.parse(active.startedAt)) / 1000)) : 0;
  const limit = active?.mode === 'tutorial' ? 20 : active?.durationSeconds ?? 60;
  const remainingSeconds = Math.max(0, limit - elapsedSeconds);
  const actionEnergyCost = active?.stages.some((stage) => stage.instrumentId === 'call') ? 14 : 8;
  const energyCap = Math.floor(100 / actionEnergyCost);
  const maxManualActions = Math.min(active?.mode === 'tutorial' ? 8 : 60, energyCap);

  const preview = useMemo(() => {
    if (!active || !state.v4.productPrice || !state.v4.dream) return null;
    return simulateV4Attempt({
      seed: active.seed,
      mainProductPrice: state.v4.productPrice,
      dreamPrice: state.v4.dream.price,
      stages: active.stages,
      manualActions,
    });
  }, [active, manualActions, state.v4.dream, state.v4.productPrice]);

  const baseReport = useMemo(() => {
    if (!active || !state.v4.productPrice || !state.v4.dream) return null;
    return simulateV4Attempt({
      seed: active.seed,
      mainProductPrice: state.v4.productPrice,
      dreamPrice: state.v4.dream.price,
      stages: active.stages,
      manualActions: 0,
    });
  }, [active, state.v4.dream, state.v4.productPrice]);

  const actions = useMemo(() => {
    if (!active || !baseReport) return [];
    return buildStageActions(active.stages, baseReport, handledByStage);
  }, [active, baseReport, handledByStage]);

  useEffect(() => {
    if (!active || finishing) return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 200);
    return () => window.clearInterval(timer);
  }, [active, finishing]);

  useEffect(() => {
    if (!activeAction || activeAction.endsAt > nowMs) return;
    setHandledByStage((current) => ({
      ...current,
      [activeAction.stageId]: (current[activeAction.stageId] ?? 0) + 1,
    }));
    setManualActions((current) => Math.min(maxManualActions, current + 1));
    setActiveAction(null);
  }, [activeAction, maxManualActions, nowMs]);

  useEffect(() => {
    if (!active || finishing) return;
    if (elapsedSeconds >= limit || preview?.bankRemaining === 0 || preview?.energyRemaining === 0) {
      setFinishing(true);
      void dispatch('v4_finish_attempt', { manualActions });
    }
  }, [active, dispatch, elapsedSeconds, finishing, limit, manualActions, preview?.bankRemaining, preview?.energyRemaining]);

  if (!active || !preview || !baseReport) {
    return (
      <V4Screen title="Попытка не запущена">
        <button className="btn-primary btn-compact" onClick={() => dispatch('v4_start_next_attempt')}>Вернуться</button>
      </V4Screen>
    );
  }

  const people = buildVisualPeople({
    stages: active.stages,
    report: preview,
    queueReport: baseReport,
    handledByStage,
    activeStageId: activeAction?.stageId ?? null,
    mainProductPrice: state.v4.productPrice ?? 0,
  });
  const actionRemainingSeconds = activeAction ? Math.max(0, Math.ceil((activeAction.endsAt - nowMs) / 1000)) : 0;

  return (
    <V4Screen title={active.mode === 'tutorial' ? 'Учебный запуск' : 'Запуск на 2 недели'}>
      <div className="v4-mini-hud">
        <strong>00:{String(remainingSeconds).padStart(2, '0')}</strong>
        <span>Осталось {rub(preview.bankRemaining)}</span>
        <span>Энергия {preview.energyRemaining}</span>
      </div>
      <div className="v4-mini-board" style={{ ['--stage-count' as string]: active.stages.length }}>
        <div className="v4-mini-stages" aria-label="Этапы воронки">
          {active.stages.map((stage) => (
            <div className="v4-mini-stage" key={stage.id}>
              <div className="v4-mini-stage-icon">{instrumentIcon(stage.instrumentId)}</div>
              <span>{getV4Instrument(stage.instrumentId).title}</span>
            </div>
          ))}
        </div>
        <div className="v4-mini-flow" aria-label="Люди движутся между этапами">
          {active.stages.map((stage) => (
            <div className="v4-flow-row" key={stage.id} />
          ))}
          {people.map((person, personIndex) => (
            <span
              key={`${person.id}-${personIndex}`}
              className={`v4-flow-person v4-flow-person--${person.status}`}
              data-person-id={person.id}
              style={{
                ['--x' as string]: `${person.x}%`,
                ['--y' as string]: `${person.y}%`,
                animationDelay: `${person.delay}s`,
              }}
            >
              {person.text && <em>{person.text}</em>}
              {person.amount !== null && <b>+{rub(person.amount)}</b>}
            </span>
          ))}
        </div>
        <div className="v4-mini-actions" aria-label="Ручные действия">
          {active.stages.map((stage) => {
            const action = actions.find((item) => item.stage.id === stage.id);
            const isActive = activeAction?.stageId === stage.id;
            const disabled = busy
              || finishing
              || Boolean(activeAction)
              || manualActions >= maxManualActions
              || preview.energyRemaining <= 0
              || !action
              || action.queue <= 0;
            return (
              <div className="v4-stage-action-slot" key={stage.id}>
                {action && (
                  <button
                    className="btn-primary btn-compact v4-stage-action"
                    disabled={disabled}
                    onClick={() => {
                      setActiveAction({
                        stageId: stage.id,
                        label: action.label,
                        endsAt: Date.now() + action.durationMs,
                      });
                      setNowMs(Date.now());
                    }}
                  >
                    {isActive ? `${action.label}: ${actionRemainingSeconds}` : action.label}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </V4Screen>
  );
}

function buildStageActions(
  stages: V4FunnelStage[],
  report: V4AttemptReport,
  handledByStage: Record<string, number>,
): StageAction[] {
  return stages.flatMap((stage, index) => {
    const definition = getV4Instrument(stage.instrumentId);
    const result = report.stageResults[index];
    const queue = Math.max(0, (result?.manualQueue ?? 0) - (handledByStage[stage.id] ?? 0));
    if (!result || queue <= 0 && !definition.manual) return [];
    if (stage.instrumentId === 'call') return [{ stage, label: 'Проведи созвон', durationMs: 4_000, queue }];
    if (stage.instrumentId === 'chat') return [{ stage, label: 'Продай в переписке', durationMs: 1_000, queue }];
    if (stage.instrumentId === 'simple_bot') return [{ stage, label: 'Ответь в боте', durationMs: 1_000, queue }];
    if (definition.manual) return [{ stage, label: getReplyLabel(stages[0]), durationMs: 1_000, queue }];
    return [];
  });
}

function getReplyLabel(sourceStage: V4FunnelStage | undefined): string {
  if (sourceStage?.instrumentId === 'reels' || sourceStage?.instrumentId === 'stories') return 'Ответь в директе';
  return 'Ответь в личке';
}

function buildVisualPeople(input: {
  stages: V4FunnelStage[];
  report: V4AttemptReport;
  queueReport: V4AttemptReport;
  handledByStage: Record<string, number>;
  activeStageId: string | null;
  mainProductPrice: number;
}): VisualPerson[] {
  const people: VisualPerson[] = [];
  input.stages.forEach((stage, stageIndex) => {
    const result = input.report.stageResults[stageIndex];
    const queueResult = input.queueReport.stageResults[stageIndex];
    if (!result) return;
    const y = stageY(stageIndex, input.stages.length);
    const handled = input.handledByStage[stage.id] ?? 0;
    const processing = input.activeStageId === stage.id ? 1 : 0;
    const waiting = Math.max(0, (queueResult?.manualQueue ?? result.manualQueue) - handled - processing);
    const sold = result.mainProductSales + result.tripwireSales;
    const lost = result.lost;
    const warm = result.progressed;
    const streamCount = stageIndex === 0 ? Math.max(6, Math.min(8, Math.ceil(result.entered / 10))) : 0;
    const counts = allocatePeopleCounts(
      [
        { status: 'waiting' as const, value: waiting },
        { status: 'sold' as const, value: sold },
        { status: 'lost' as const, value: lost },
        { status: 'warm' as const, value: warm },
      ],
      MAX_PEOPLE_PER_STAGE - streamCount - processing,
    );

    addPeople(people, stage, stageIndex, 'stream', streamCount, y, input.mainProductPrice);
    addPeople(people, stage, stageIndex, 'warm', counts.warm ?? 0, y, input.mainProductPrice);
    addWaitingPeople(people, stage, stageIndex, counts.waiting ?? 0, y);
    addPeople(people, stage, stageIndex, 'lost', counts.lost ?? 0, y, input.mainProductPrice);
    addPeople(people, stage, stageIndex, 'sold', counts.sold ?? 0, y, input.mainProductPrice);
    if (processing > 0) addPeople(people, stage, stageIndex, 'processing', 1, y, input.mainProductPrice);
  });
  return people;
}

function allocatePeopleCounts(
  items: Array<{ status: VisualPerson['status']; value: number }>,
  maxCount = MAX_PEOPLE_PER_STAGE,
): Partial<Record<VisualPerson['status'], number>> {
  const relevant = items.filter((item) => item.value > 0);
  const total = relevant.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0 || maxCount <= 0) return {};
  const baseCount = Math.min(relevant.length, maxCount);
  const remainingSlots = Math.max(0, maxCount - baseCount);
  const counts: Partial<Record<VisualPerson['status'], number>> = {};
  relevant.forEach((item) => {
    const extraCount = remainingSlots > 0 ? Math.round((item.value / total) * remainingSlots) : 0;
    counts[item.status] = 1 + extraCount;
  });
  let allocated = Object.values(counts).reduce((sum, count) => sum + (count ?? 0), 0);
  for (const item of [...relevant].reverse()) {
    if (allocated <= maxCount) break;
    const current = counts[item.status] ?? 0;
    if (current > 1) {
      counts[item.status] = current - 1;
      allocated -= 1;
    }
  }
  return counts;
}

function amountFor(status: VisualPerson['status'], stage: V4FunnelStage, mainProductPrice: number): number | null {
  if (status !== 'sold') return null;
  if (getV4Instrument(stage.instrumentId).kind !== 'sales') return null;
  if (stage.offerMode === 'tripwire' && stage.tripwirePrice) return stage.tripwirePrice;
  return mainProductPrice;
}

function addPeople(
  people: VisualPerson[],
  stage: V4FunnelStage,
  stageIndex: number,
  status: VisualPerson['status'],
  count: number,
  y: number,
  mainProductPrice: number,
): void {
  if (count <= 0) return;
  const segment = segmentFor(status);
  for (let index = 0; index < count; index += 1) {
    people.push({
      id: `${stage.id}-${status}-${index}`,
      status,
      text: phraseFor(status, index, getV4Instrument(stage.instrumentId).kind === 'sales'),
      amount: amountFor(status, stage, mainProductPrice),
      x: lineX(segment.from, segment.to, index, count),
      y,
      delay: index * 0.14 + stageIndex * 0.08,
    });
  }
}

function addWaitingPeople(
  people: VisualPerson[],
  stage: V4FunnelStage,
  stageIndex: number,
  count: number,
  y: number,
): void {
  for (let index = 0; index < count; index += 1) {
    const status = index % 4 === 2 ? 'cooling' : 'waiting';
    people.push({
      id: `${stage.id}-${status}-${index}`,
      status,
      text: null,
      amount: null,
      x: lineX(54, 88, index, count),
      y,
      delay: index * 0.12 + stageIndex * 0.08,
    });
  }
}

function phraseFor(status: VisualPerson['status'], index: number, salesStage: boolean): string | null {
  if (!salesStage || status !== 'sold' && status !== 'lost') return null;
  const phrases = {
    lost: ['Дорого', 'Не понял ценность', 'Подумаю'],
    sold: ['Оплатил!', 'Беру', 'Когда старт?'],
  } satisfies Record<'sold' | 'lost', string[]>;
  return phrases[status][index % phrases[status].length];
}

function stageY(index: number, total: number): number {
  if (total <= 1) return 50;
  return 10 + (index * 80) / (total - 1);
}

function segmentFor(status: VisualPerson['status']): { from: number; to: number } {
  if (status === 'stream') return { from: 8, to: 58 };
  if (status === 'warm') return { from: 22, to: 74 };
  if (status === 'waiting' || status === 'cooling') return { from: 54, to: 88 };
  if (status === 'processing') return { from: 76, to: 92 };
  if (status === 'sold') return { from: 80, to: 93 };
  return { from: 28, to: 10 };
}

function lineX(from: number, to: number, index: number, count: number): number {
  if (count <= 1) return (from + to) / 2;
  return from + ((to - from) * index) / (count - 1);
}
