import { describe, expect, it } from 'vitest';

import type { AcceptanceProbeResult, DoctorReport } from '../runtime-env.shared.ts';
import {
  deriveInternalVerifyMaxAttempts,
  shouldRetryExternalSmoke,
  shouldRetryInternalProbeFailure,
  shouldRetryInternalVerify,
} from './smoke.ts';
import { createRuntimeSmokeOps } from './smoke-runtime.ts';

const createProbe = (overrides: Partial<AcceptanceProbeResult>): AcceptanceProbeResult => ({
  durationMs: 10,
  message: 'ok',
  name: 'public-ready',
  scope: 'external',
  status: 'ok',
  target: 'https://studio.smart-village.app/health/ready',
  ...overrides,
});

const createDoctorReport = (overrides: Partial<DoctorReport>): DoctorReport => ({
  checks: [],
  generatedAt: '2026-06-19T10:00:00.000Z',
  profile: 'studio',
  status: 'ok',
  ...overrides,
});

describe('smoke helpers', () => {
  it('probes every explicit ingress host and an unknown host for the selected environment', async () => {
    const targets: string[] = [];
    const ops = createRuntimeSmokeOps({
      buildSwarmAppTaskProbe: () => createProbe({ scope: 'internal' }),
      buildSwarmServicePresenceProbe: () => createProbe({ scope: 'internal' }),
      doctorRuntime: async () => createDoctorReport({}),
      isExpectedOidcRedirect: () => true,
      parseRuntimeProfile: (value) => value,
      resolveTenantRuntimeTargets: async () => ({ source: 'registry', targets: [] }),
      runHttpProbe: async (input) => {
        targets.push(input.target);
        return createProbe({
          ...(input.name === 'public-ingress-unknown-host' ? { httpStatus: undefined } : { httpStatus: 200 }),
          name: input.name,
          status: input.name === 'public-ingress-unknown-host' ? 'error' : 'ok',
          target: input.target,
        });
      },
      selectSmokeTenantTargets: (_runtimeProfile, tenantTargets) => tenantTargets,
      shouldUseStudioReleaseBlockingTenantScope: () => true,
      wait: async () => undefined,
    });

    const probes = await ops.runExternalSmoke('studio', {
      SVA_PUBLIC_BASE_URL: 'https://studio-dev.smart-village.app',
    });

    expect(targets).toEqual(expect.arrayContaining([
      'https://studio-dev.smart-village.app/health/live',
      'https://studio-dev.smart-village.app/auth/login',
      'https://de-teststadt-dev.studio-dev.smart-village.app/health/live',
      'https://de-teststadt-dev.studio-dev.smart-village.app/auth/login',
      'https://unknown-ingress-smoke.studio-dev.smart-village.app/auth/login',
    ]));
    expect(probes.find((probe) => probe.name === 'public-ingress-unknown-host')).toMatchObject({
      status: 'ok',
    });
  });

  it('caps derived internal verify attempts when retry delay is zero or negative', () => {
    expect(deriveInternalVerifyMaxAttempts({ retryDelayMs: 0, warmupWindowMs: 90_000 })).toBe(91);
    expect(deriveInternalVerifyMaxAttempts({ retryDelayMs: -100, warmupWindowMs: 90_000 })).toBe(91);
  });

  it('retries only retryable external warmup failures', () => {
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

  it('does not retry non-warmup external failures', () => {
    const probes = [
      createProbe({
        message: 'IAM-Kontext lieferte HTML statt eines API-Vertrags.',
        name: 'public-iam-context',
        status: 'error',
      }),
    ];

    expect(shouldRetryExternalSmoke(probes)).toBe(false);
  });

  it('retries warmup-like swarm app task failures', () => {
    expect(
      shouldRetryInternalProbeFailure(
        createProbe({
          details: {
            desiredState: 'running',
            state: 'preparing',
          },
          message: 'Swarm-App-Task ist nicht stabil running (preparing).',
          name: 'swarm-app-task',
          scope: 'internal',
          status: 'error',
          target: 'studio/app',
        }),
      ),
    ).toBe(true);
  });

  it('retries only retryable doctor warmup failures', () => {
    const report = createDoctorReport({
      checks: [
        {
          code: 'live_failed',
          details: { status: 404 },
          message: 'Live-Endpoint antwortet mit 404.',
          name: 'health-live',
          status: 'error',
        },
      ],
      status: 'error',
    });

    expect(shouldRetryInternalVerify(report)).toBe(true);
  });
});
