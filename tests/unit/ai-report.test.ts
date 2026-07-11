// @ts-nocheck
import { afterEach, describe, expect, it, vi } from 'vitest';
import { explainWithAi } from '../../lib/ai/report';
import { applyCommand, createInitialState } from '../../packages/game-engine/src';
import { loadGameConfig } from '../../lib/config/game-config';
import { scenarios } from '../fixtures/scenarios';

const config = loadGameConfig();
const finished = applyCommand(createInitialState(scenarios[0].setup, config, 'ai_test'), config, { commandId: 'finish', type: 'finish_game' });

afterEach(() => { vi.unstubAllGlobals(); delete process.env.OPENAI_API_KEY; delete process.env.OPENAI_REPORT_MODEL; });

describe('AI report reliability', () => {
  it('uses deterministic fallback when credentials are absent', async () => {
    const result = await explainWithAi(finished, finished.diagnostics!);
    expect(result.source).toBe('fallback');
    expect(result.report.resultSummary).toContain('продаж');
  });

  it('retries one transient server failure and then falls back', async () => {
    process.env.OPENAI_API_KEY = 'test'; process.env.OPENAI_REPORT_MODEL = 'test-model';
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await explainWithAi(finished, finished.diagnostics!);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.source).toBe('fallback');
  });

  it('does not retry an invalid successful payload', async () => {
    process.env.OPENAI_API_KEY = 'test'; process.env.OPENAI_REPORT_MODEL = 'test-model';
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ output_text: '{}' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await explainWithAi(finished, finished.diagnostics!);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.source).toBe('fallback');
  });
});
