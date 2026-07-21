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
  status: 'stream' | 'warm' | 'waiting' | 'cooling' | 'cold' | 'sold' | 'lost';
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
    report: baseReport,
    handledByStage,
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
          {people.map((person) => (
            <span
              key={person.id}
              className={`v4-flow-person v4-flow-person--${person.status}`}
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
  handledByStage: Record<string, number>;
  mainProductPrice: number;
}): VisualPerson[] {
  const people: VisualPerson[] = [];
  input.stages.forEach((stage, stageIndex) => {
    const result = input.report.stageResults[stageIndex];
    if (!result) return;
    const y = stageY(stageIndex, input.stages.length);
    const handled = input.handledByStage[stage.id] ?? 0;
    const waiting = Math.max(0, result.manualQueue - handled);
    const sold = result.mainProductSales + result.tripwireSales + handledSales(stage, handled);
    const lost = result.lost;
    const warm = result.progressed;
    const streamCount = stageIndex === 0 ? Math.max(6, Math.min(8, Math.ceil(result.entered / 10))) : 0;
    const streamMix = Array.from({ length: streamCount }, () => ({ status: 'stream' as const }));
    const mix = [
      ...streamMix,
      ...allocatePeople(
        [
          { status: 'waiting' as const, value: waiting },
          { status: 'sold' as const, value: sold },
          { status: 'lost' as const, value: lost },
          { status: 'warm' as const, value: warm },
        ],
        MAX_PEOPLE_PER_STAGE - streamCount,
      ),
    ];
    mix.forEach((item, localIndex) => {
      const status = item.status === 'waiting' && localIndex % 3 === 1 ? 'cooling' : item.status;
      people.push({
        id: `${stage.id}-${status}-${localIndex}`,
        status,
        text: phraseFor(status, localIndex),
        amount: amountFor(status, stage, input.mainProductPrice),
        x: xFor(status, localIndex),
        y: y + jitter(localIndex),
        delay: (localIndex % 8) * 0.16 + stageIndex * 0.08,
      });
    });
  });
  return people;
}

function allocatePeople(
  items: Array<{ status: VisualPerson['status']; value: number }>,
  maxCount = MAX_PEOPLE_PER_STAGE,
): Array<{ status: VisualPerson['status'] }> {
  const relevant = items.filter((item) => item.value > 0);
  const total = relevant.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0 || maxCount <= 0) return [];
  const baseCount = Math.min(relevant.length, maxCount);
  const remainingSlots = Math.max(0, maxCount - baseCount);
  const allocated = relevant.flatMap((item) => {
    const extraCount = remainingSlots > 0 ? Math.round((item.value / total) * remainingSlots) : 0;
    return Array.from({ length: 1 + extraCount }, () => ({ status: item.status }));
  });
  return allocated.slice(0, maxCount);
}

function handledSales(stage: V4FunnelStage, handled: number): number {
  return stage.instrumentId === 'call' || stage.instrumentId === 'chat' ? Math.ceil(handled * 0.2) : 0;
}

function amountFor(status: VisualPerson['status'], stage: V4FunnelStage, mainProductPrice: number): number | null {
  if (status !== 'sold') return null;
  if (stage.offerMode === 'tripwire' && stage.tripwirePrice) return stage.tripwirePrice;
  return mainProductPrice;
}

function phraseFor(status: VisualPerson['status'], index: number): string | null {
  const phrases = {
    waiting: ['Можно подробнее?', 'А сколько стоит?', 'Хочу созвон'],
    cooling: ['Жду ответа', 'Еще актуально?', 'Напишите мне'],
    cold: ['Не дождался', 'Уже не актуально', 'Напишу потом'],
    lost: ['Дорого', 'Не понял ценность', 'Подумаю'],
    sold: ['Оплатил!', 'Беру', 'Когда старт?'],
    warm: [null, null, 'Иду дальше'],
    stream: [null, null, null],
  } satisfies Record<VisualPerson['status'], Array<string | null>>;
  return phrases[status][index % phrases[status].length];
}

function stageY(index: number, total: number): number {
  if (total <= 1) return 50;
  return 10 + (index * 80) / (total - 1);
}

function xFor(status: VisualPerson['status'], index: number): number {
  if (status === 'sold') return 82 + (index % 4) * 3;
  if (status === 'lost' || status === 'cold') return 8 + (index % 4) * 4;
  if (status === 'waiting' || status === 'cooling') return 42 + (index % 5) * 5;
  if (status === 'stream') return 16 + (index % 8) * 8;
  return 50 + (index % 6) * 6;
}

function jitter(index: number): number {
  return ((index % 5) - 2) * 1.4;
}
