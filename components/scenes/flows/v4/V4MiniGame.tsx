'use client';

import { useEffect, useMemo, useState } from 'react';
import { getV4Instrument, simulateV4Attempt, type GameState } from '@/packages/game-engine/src';
import { instrumentIcon } from './V4Builder';
import { rub, V4Screen } from './v4Ui';

type Dispatch = (actionType: string, payload?: Record<string, unknown>) => Promise<boolean>;

export function V4MiniGame({ state, dispatch, busy }: { state: GameState; dispatch: Dispatch; busy: boolean }) {
  const active = state.v4.activeAttempt;
  const [seconds, setSeconds] = useState(0);
  const [manualActions, setManualActions] = useState(0);
  const [finishing, setFinishing] = useState(false);

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

  useEffect(() => {
    if (!active || finishing) return;
    const limit = active.mode === 'tutorial' ? 18 : active.durationSeconds;
    if (seconds >= limit || preview?.bankRemaining === 0 || preview?.energyRemaining === 0) {
      setFinishing(true);
      void dispatch('v4_finish_attempt', { manualActions });
      return;
    }
    const timer = window.setTimeout(() => setSeconds((current) => current + 1), 1000);
    return () => window.clearTimeout(timer);
  }, [active, dispatch, finishing, manualActions, preview?.bankRemaining, preview?.energyRemaining, seconds]);

  if (!active || !preview) {
    return (
      <V4Screen title="Попытка не запущена">
        <button className="btn-primary" onClick={() => dispatch('v4_start_next_attempt')}>Вернуться</button>
      </V4Screen>
    );
  }

  const button = actionLabel(active.stages);
  const visiblePeople = buildPeople(preview.stageResults.reduce((sum, stage) => sum + stage.entered, 0), preview.manualQueueLost, manualActions);

  return (
    <V4Screen title={active.mode === 'tutorial' ? 'Учебный запуск' : 'Запуск на 2 недели'}>
      <div className="v4-mini-hud">
        <strong>00:{String(Math.max(0, (active.mode === 'tutorial' ? 18 : 60) - seconds)).padStart(2, '0')}</strong>
        <span>Банк {rub(preview.bankRemaining)}</span>
        <span>Энергия {preview.energyRemaining}</span>
      </div>
      <div className="v4-ad-lane" aria-hidden="true">
        <span>{instrumentIcon(active.stages[0].instrumentId)}</span>
        <span>{instrumentIcon(active.stages[0].instrumentId)}</span>
        <span>{instrumentIcon(active.stages[0].instrumentId)}</span>
      </div>
      <div className="v4-funnel-play">
        <div className="v4-play-stages">
          {active.stages.map((stage) => (
            <div className="v4-play-stage" key={stage.id}>
              <div className="v4-play-icon">{instrumentIcon(stage.instrumentId)}</div>
              <span>{getV4Instrument(stage.instrumentId).title}</span>
            </div>
          ))}
        </div>
        <div className="v4-people-layer" aria-label="Заявки двигаются по воронке">
          {visiblePeople.map((person) => (
            <span
              key={person.id}
              className={`v4-person v4-person--${person.status}`}
              style={{ left: `${person.left}%`, top: `${person.top}%`, animationDelay: `${person.delay}s` }}
            />
          ))}
        </div>
      </div>
      <div className="v4-action-panel">
        <button
          className="btn-primary"
          disabled={busy || finishing || preview.energyRemaining <= 0}
          onClick={() => setManualActions((current) => current + 1)}
        >
          {button}
        </button>
        <p>{manualActions > 0 ? `Обработано вручную: ${manualActions}` : 'Теплые заявки копятся и остывают, пока вы заняты.'}</p>
      </div>
    </V4Screen>
  );
}

function actionLabel(stages: GameState['v4']['funnel']): string {
  if (stages.some((stage) => stage.instrumentId === 'call')) return 'Проведи созвон';
  if (stages.some((stage) => stage.instrumentId === 'chat')) return 'Продай в переписке';
  const source = stages[0]?.instrumentId;
  if (source === 'reels' || source === 'stories') return 'Ответь в директе';
  return 'Ответь в личке';
}

function buildPeople(totalEntered: number, lost: number, handled: number): Array<{ id: string; status: string; left: number; top: number; delay: number }> {
  const count = Math.max(8, Math.min(36, Math.ceil(totalEntered / 15)));
  return Array.from({ length: count }, (_, index) => {
    const status = index < handled ? 'sold' : index < handled + lost ? 'cold' : index % 5 === 0 ? 'no' : 'warm';
    return {
      id: `p-${index}`,
      status,
      left: 18 + ((index * 13) % 64),
      top: 8 + ((index * 19) % 78),
      delay: (index % 10) * 0.18,
    };
  });
}
