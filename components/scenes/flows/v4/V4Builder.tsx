'use client';

import { useMemo, useState } from 'react';
import {
  estimateV4Views,
  getV4Instrument,
  V4_INSTRUMENTS,
  type GameState,
  type V4Execution,
  type V4FunnelStage,
  type V4InstrumentId,
  type V4OfferMode,
} from '@/packages/game-engine/src';
import { rub, V4Screen } from './v4Ui';

type Dispatch = (actionType: string, payload?: Record<string, unknown>) => Promise<boolean>;

const INSTRUMENTS = Object.values(V4_INSTRUMENTS);
const KIND_TITLES = { traffic: 'Реклама', value: 'Ценность', sales: 'Продажа' };

export function V4Builder({ state, dispatch, busy }: { state: GameState; dispatch: Dispatch; busy: boolean }) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const selected = selectedIndex === null ? null : state.v4.funnel[selectedIndex];
  const plannedSpend = useMemo(() => state.v4.funnel.reduce((sum, stage) => sum + stageCost(stage), 0), [state.v4.funnel]);
  const remaining = 100_000 - plannedSpend;

  return (
    <V4Screen
      title="Соберите воронку"
      footer={(
        <div className="v4-footer-actions">
          <button className="btn-secondary" disabled={busy || state.v4.funnel.length <= 2} onClick={() => dispatch('v4_set_funnel_length', { length: state.v4.funnel.length - 1 })}>− Этап</button>
          <button className="btn-primary" disabled={busy} onClick={() => dispatch('v4_start_attempt')}>Запустить</button>
        </div>
      )}
    >
      <div className="v4-bank-row">
        <span>Заложили на запуск: <strong>{rub(plannedSpend)}</strong></span>
        <span>Осталось в банке: <strong className={remaining < 0 ? 'v4-danger' : ''}>{rub(remaining)}</strong></span>
      </div>
      <div className={`v4-builder-layout${selected ? ' v4-builder-layout--editing' : ''}`}>
        <div className="v4-stage-strip">
          {state.v4.funnel.map((stage, index) => (
            <button
              key={stage.id}
              className={`v4-stage-tile${selectedIndex === index ? ' v4-stage-tile--active' : ''}`}
              onClick={() => setSelectedIndex(index)}
              aria-label={`Этап ${index + 1}`}
            >
              <span>{instrumentIcon(stage.instrumentId)}</span>
              <small>{index + 1}</small>
            </button>
          ))}
          <button
            className="v4-stage-add"
            disabled={busy || state.v4.funnel.length >= 6}
            onClick={() => dispatch('v4_set_funnel_length', { length: state.v4.funnel.length + 1 })}
            aria-label="Добавить этап"
          >
            +
          </button>
        </div>
        {selected && selectedIndex !== null && (
          <StageEditor
            key={selected.id}
            index={selectedIndex}
            stage={selected}
            dispatch={async (action, payload) => {
              const ok = await dispatch(action, payload);
              if (ok) setSelectedIndex(null);
              return ok;
            }}
            busy={busy}
          />
        )}
        {!selected && (
          <div className="v4-builder-hint">
            <p>Нажмите на квадрат этапа, чтобы поставить инструмент.</p>
            <p>Первый квадрат — реклама. Дальше можно экспериментировать.</p>
          </div>
        )}
      </div>
    </V4Screen>
  );
}

function StageEditor({ index, stage, dispatch, busy }: { index: number; stage: V4FunnelStage; dispatch: Dispatch; busy: boolean }) {
  const availableInstruments = INSTRUMENTS.filter((item) => index === 0 ? item.kind === 'traffic' : item.kind !== 'traffic');
  const initialInstrumentId = availableInstruments.some((item) => item.id === stage.instrumentId)
    ? stage.instrumentId
    : availableInstruments[0].id;
  const [instrumentId, setInstrumentId] = useState<V4InstrumentId>(initialInstrumentId);
  const [execution, setExecution] = useState<V4Execution>(stage.execution);
  const [offerMode, setOfferMode] = useState<V4OfferMode>(stage.offerMode);
  const [tripwirePrice, setTripwirePrice] = useState(String(stage.tripwirePrice ?? 990));
  const [volume, setVolume] = useState(String(stage.volume));
  const definition = getV4Instrument(instrumentId);
  const draft: V4FunnelStage = {
    ...stage,
    instrumentId,
    execution,
    offerMode: definition.kind === 'sales' ? 'main_product' : offerMode,
    tripwirePrice: offerMode === 'tripwire' ? Number(tripwirePrice) : null,
    volume: Number(volume),
  };
  const views = estimateV4Views(draft);
  const cannotPutFirst = index === 0 && definition.kind !== 'traffic';

  return (
    <div className="v4-editor">
      <h2>Этап {index + 1}</h2>
      <div className="v4-tool-grid">
        {availableInstruments.map((item) => (
          <button
            key={item.id}
            className={`v4-tool${instrumentId === item.id ? ' v4-tool--selected' : ''}`}
            onClick={() => {
              setInstrumentId(item.id);
              setOfferMode(item.kind === 'sales' ? 'main_product' : 'free');
              setVolume(String(item.kind === 'traffic' ? Math.min(6, item.self.maxVolume) : 1));
            }}
          >
            <span>{instrumentIcon(item.id)}</span>
            <strong>{item.title}</strong>
            <small>{KIND_TITLES[item.kind]}</small>
          </button>
        ))}
      </div>
      {cannotPutFirst && <p className="v4-warning">А как люди узнают, что вы это делаете? Первый шаг — всегда реклама.</p>}
      <div className="v4-segment">
        <button className={execution === 'self' ? 'is-active' : ''} onClick={() => setExecution('self')}>Самостоятельно</button>
        <button className={execution === 'expert' ? 'is-active' : ''} onClick={() => setExecution('expert')}>Со специалистом</button>
      </div>
      {definition.supportsTripwire && (
        <>
          <div className="v4-segment">
            <button className={offerMode === 'free' ? 'is-active' : ''} onClick={() => setOfferMode('free')}>Бесплатно</button>
            <button className={offerMode === 'tripwire' ? 'is-active' : ''} onClick={() => setOfferMode('tripwire')}>Назначить цену</button>
          </div>
          {offerMode === 'tripwire' && <input className="setup-input" inputMode="numeric" value={tripwirePrice} onChange={(event) => setTripwirePrice(event.target.value)} placeholder="Цена трипваера" />}
        </>
      )}
      {definition.kind === 'traffic' && (
        <div className="v4-form-block">
          <label className="setup-field-label">{instrumentId === 'paid_ads' ? 'Медиабюджет' : 'Количество материалов'}
            <input className="setup-input" inputMode="numeric" value={volume} onChange={(event) => setVolume(event.target.value)} />
          </label>
          <p className="v4-muted">Ориентир охвата: {views[0].toLocaleString('ru-RU')}–{views[1].toLocaleString('ru-RU')} показов</p>
        </div>
      )}
      <button
        className="btn-primary"
        disabled={busy || cannotPutFirst}
        onClick={() => dispatch('v4_configure_funnel_stage', {
          index,
          instrumentId,
          execution,
          offerMode: definition.kind === 'sales' ? 'main_product' : offerMode,
          tripwirePrice: offerMode === 'tripwire' ? Number(tripwirePrice) : null,
          volume: Number(volume),
        })}
      >
        Поставить на этап
      </button>
    </div>
  );
}

function stageCost(stage: V4FunnelStage): number {
  const definition = getV4Instrument(stage.instrumentId);
  return definition[stage.execution].unitCost * (definition.kind === 'traffic' ? stage.volume : 1);
}

export function instrumentIcon(id: V4InstrumentId): string {
  const icons: Record<V4InstrumentId, string> = {
    stories: '◷',
    reels: '▶',
    telegram: '✈',
    paid_ads: '▣',
    guide: '▤',
    simple_bot: '◉',
    ai_bot: '◆',
    video_lesson: '▻',
    auto_webinar: '◎',
    chat: '☰',
    call: '☎',
    website: '⌂',
  };
  return icons[id];
}
