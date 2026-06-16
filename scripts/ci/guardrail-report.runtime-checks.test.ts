import { describe, expect, it } from 'vitest';

import { buildRuntimeBootCheck } from './guardrail-report.runtime-checks.ts';

describe('guardrail-report runtime checks', () => {
  it('treats OTEL without endpoint as degraded runtime observability', async () => {
    const result = await buildRuntimeBootCheck({
      env: {
        ENABLE_OTEL: 'true',
      },
      rootDir: process.cwd(),
      runtimeProfile: 'studio',
    });

    expect(result.status).toBe('warn');
    expect(result.evidence).toMatchObject({
      loggerMode: 'degraded',
      otelEndpoint: null,
    });
  });

  it('reports otel_to_loki only when the OTLP endpoint is configured', async () => {
    const result = await buildRuntimeBootCheck({
      env: {
        ENABLE_OTEL: 'true',
        OTEL_EXPORTER_OTLP_ENDPOINT: 'http://otel.example.test:4318',
      },
      rootDir: process.cwd(),
      runtimeProfile: 'studio',
    });

    expect(result.evidence).toMatchObject({
      loggerMode: 'otel_to_loki',
      otelEndpoint: 'http://otel.example.test:4318',
    });
  });
});
