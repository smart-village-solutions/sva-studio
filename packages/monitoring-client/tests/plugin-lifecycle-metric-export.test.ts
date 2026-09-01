import { describe, expect, it } from 'vitest';

import {
  OTEL_METRIC_EXPORT_INTERVAL_MS,
  OTEL_METRIC_EXPORT_TIMEOUT_MS,
} from '../src/otel.server.js';

const collectorBatchSeconds = 1;
const prometheusScrapeSeconds = 15;
const prometheusEvaluationSeconds = 15;
const lifecycleCriticalForSeconds = 30;

describe('plugin lifecycle metric export budget', () => {
  it('keeps collection, export, scrape, evaluation and critical for within 120 seconds', () => {
    const worstCaseSeconds =
      OTEL_METRIC_EXPORT_INTERVAL_MS / 1_000 +
      OTEL_METRIC_EXPORT_TIMEOUT_MS / 1_000 +
      collectorBatchSeconds +
      prometheusScrapeSeconds +
      prometheusEvaluationSeconds +
      lifecycleCriticalForSeconds;

    expect(OTEL_METRIC_EXPORT_INTERVAL_MS).toBe(30_000);
    expect(OTEL_METRIC_EXPORT_TIMEOUT_MS).toBe(15_000);
    expect(worstCaseSeconds).toBe(106);
    expect(worstCaseSeconds).toBeLessThanOrEqual(120);
  });

  it('keeps lifecycle SQL and auth-runtime ownership out of monitoring-client', async () => {
    const source = await import('node:fs/promises').then(({ readFile }) =>
      readFile(new URL('../src/otel.server.ts', import.meta.url), 'utf8')
    );
    expect(source).not.toContain('@sva/auth-runtime');
    expect(source).not.toContain('instance_plugin_lifecycle');
    expect(source).not.toMatch(/\bSELECT\b/i);
  });
});
