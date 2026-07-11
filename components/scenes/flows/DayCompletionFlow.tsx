import type { GameState, GameConfig } from '@/packages/game-engine/src';
import { DaySummaryScreen } from '../ui';

type FlowProps = {
  state: GameState;
  config: GameConfig;
  dispatch: (action: string, payload?: Record<string, unknown>) => Promise<void>;
  busy: boolean;
};

export function DayCompletionFlow({ state, dispatch, busy }: FlowProps) {
  const report = state.currentDayReport;
  
  if (!report) {
    // Failsafe
    return (
      <div style={{ padding: '20px', color: 'white' }}>
        <button className="btn-primary" onClick={() => dispatch('complete_day')}>Дальше</button>
      </div>
    );
  }

  return (
    <DaySummaryScreen
      day={state.resources.day}
      title={report.actionTitle}
      metrics={report.outcome}
      onNext={() => dispatch('complete_day')}
      busy={busy}
    />
  );
}
