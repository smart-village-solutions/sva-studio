import { describe, expect, it, vi } from 'vitest';

import { runExternalSmokeWithWarmup, shouldRetryExternalSmoke } from './runtime-env.ts';
import type { AcceptanceProbeResult } from './runtime-env.shared.ts';

const createProbe = (overrides: Partial<AcceptanceProbeResult>): AcceptanceProbeResult => ({
  durationMs: 10,
  message: 'ok',
  name: 'public-ready',
  scope: 'external',
  status: 'ok',
  target: 'https://studio.smart-village.app/health/ready',
  ...overrides,
});

describe('shouldRetryExternalSmoke', () => {
  it('retries only retryable warmup probe failures', () => {
    const probes = [
      createProbe({
        message: 'Erwartet HTTP 200, erhalten 404.',
        name: 'public-home',
        status: 'error',
      }),
      createProbe({
        message: 'Unerwarteter Ready-Status 504.',
        name: 'public-ready',
        status: 'error',
      }),
    ];

    expect(shouldRetryExternalSmoke(probes)).toBe(true);
  });

  it('does not retry non-warmup probe failures', () => {
    const probes = [
      createProbe({
        message: 'IAM-Kontext lieferte HTML statt eines API-Vertrags.',
        name: 'public-iam-context',
        status: 'error',
        target: 'https://studio.smart-village.app/api/v1/iam/me/context',
      }),
    ];

    expect(shouldRetryExternalSmoke(probes)).toBe(false);
  });
});

describe('runExternalSmokeWithWarmup', () => {
  it('retries once after a transient warmup failure', async () => {
    const runner = vi
      .fn<(env: NodeJS.ProcessEnv) => Promise<readonly AcceptanceProbeResult[]>>()
      .mockResolvedValueOnce([
        createProbe({
          message: 'Erwartet HTTP 200, erhalten 404.',
          name: 'public-home',
          status: 'error',
          target: 'https://studio.smart-village.app',
        }),
      ])
      .mockResolvedValueOnce([
        createProbe({
          message: 'Probe erfolgreich mit HTTP 200.',
          name: 'public-home',
          status: 'ok',
          target: 'https://studio.smart-village.app',
        }),
      ]);

    const probes = await runExternalSmokeWithWarmup(
      {},
      {
        maxAttempts: 2,
        retryDelayMs: 0,
        runner,
      }
    );

    expect(runner).toHaveBeenCalledTimes(2);
    expect(probes[0]?.status).toBe('ok');
  });

  it('returns immediately for non-retryable failures', async () => {
    const runner = vi.fn<(env: NodeJS.ProcessEnv) => Promise<readonly AcceptanceProbeResult[]>>().mockResolvedValue([
      createProbe({
        message: 'IAM-Instanzliste lieferte HTML statt JSON/API-Vertrag.',
        name: 'public-iam-instances',
        status: 'error',
        target: 'https://studio.smart-village.app/api/v1/iam/instances',
      }),
    ]);

    const probes = await runExternalSmokeWithWarmup(
      {},
      {
        maxAttempts: 2,
        retryDelayMs: 0,
        runner,
      }
    );

    expect(runner).toHaveBeenCalledTimes(1);
    expect(probes[0]?.status).toBe('error');
  });
});
