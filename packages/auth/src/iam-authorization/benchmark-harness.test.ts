import { describe, expect, it } from 'vitest';

import { runTimedScenario } from './benchmark-harness';

describe('runTimedScenario', () => {
  it('returns machine-readable percentile metrics', async () => {
    let executions = 0;

    const metrics = await runTimedScenario({
      scenario: 'cache-hit',
      warmupRuns: 2,
      samples: 5,
      execute: () => {
        executions += 1;
      },
    });

    expect(executions).toBe(7);
    expect(metrics).toMatchObject({
      scenario: 'cache-hit',
      samples: 5,
      warmupRuns: 2,
    });
    expect(metrics.p50Ms).toBeTypeOf('number');
    expect(metrics.p95Ms).toBeTypeOf('number');
    expect(metrics.p99Ms).toBeTypeOf('number');
    expect(metrics.avgMs).toBeTypeOf('number');
    expect(metrics.maxMs).toBeTypeOf('number');
  });
});
