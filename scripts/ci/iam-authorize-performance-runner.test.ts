import { describe, expect, it, vi } from 'vitest';

import { runScenario } from './iam-authorize-performance-scenario.ts';
import type { Pool } from './iam-authorize-performance-request.ts';
import type { BrowserContext } from './iam-authorize-performance-session.ts';

describe('IAM authorize performance runner', () => {
  it('measures warmup before cache-hit samples and rejects a wrong cache status', async () => {
    const post = vi.fn().mockResolvedValue({
      json: async () => ({ allowed: true, cacheStatus: 'hit' }),
      status: () => 200,
    });
    const context = { request: { post } } as unknown as BrowserContext;
    const pool = { connect: vi.fn() } as unknown as Pool;
    const input = {
      basePayload: {
        instanceId: 'de-musterhausen',
        action: 'content.read',
        resource: { type: 'content' },
      },
      baseUrl: 'https://studio.example.test',
      context,
      invalidationDelayMs: 0,
      keycloakSubject: 'subject-1',
      measuredRequests: 2,
      pool,
      runId: 'run-1',
      scenario: 'cache-hit' as const,
      scenarioConcurrency: 1,
      warmupRequests: 1,
    };

    const result = await runScenario(input);

    expect(post).toHaveBeenCalledTimes(3);
    expect(post.mock.calls.map((call) => call[1].data)).toEqual([
      { ...input.basePayload, context: { requestId: 'bench-run-1-cache-hit-0' } },
      { ...input.basePayload, context: { requestId: 'bench-run-1-cache-hit-0' } },
      { ...input.basePayload, context: { requestId: 'bench-run-1-cache-hit-1' } },
    ]);
    expect(result.scenario).toBe('cache-hit');
    expect(result.samplesMs).toHaveLength(2);
    expect(result.summary.count).toBe(2);
    expect(pool.connect).not.toHaveBeenCalled();

    post.mockResolvedValue({
      json: async () => ({ allowed: true, cacheStatus: 'miss' }),
      status: () => 200,
    });
    await expect(runScenario({ ...input, measuredRequests: 1, warmupRequests: 0 })).rejects.toThrow(
      'Szenario cache-hit lieferte unerwartete cacheStatus-Werte: miss.'
    );
  });
});
