import { describe, expect, it, vi } from 'vitest';

import type { AcceptanceProbeResult, DoctorReport } from '../runtime-env.shared.ts';
import {
  deriveInternalVerifyMaxAttempts,
  shouldRetryExternalSmoke,
  shouldRetryInternalProbeFailure,
  shouldRetryInternalVerify,
} from './smoke.ts';
import { createRuntimeSmokeOps } from './smoke-runtime.ts';
import { resolveStudioIngressContract } from './tenant-ingress-hosts.ts';

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
  it('fails a persistent root 404 only after 50 attempts every 10 seconds by default', async () => {
    const wait = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue();
    const runner = vi.fn<(env: NodeJS.ProcessEnv) => Promise<readonly AcceptanceProbeResult[]>>()
      .mockResolvedValue([
        createProbe({
          message: 'Erwartet HTTP 200, erhalten 404.',
          name: 'public-home',
          status: 'error',
        }),
      ]);
    const ops = createRuntimeSmokeOps({
      buildSwarmAppTaskProbe: () => createProbe({ scope: 'internal' }),
      buildSwarmServicePresenceProbe: () => createProbe({ scope: 'internal' }),
      doctorRuntime: async () => createDoctorReport({}),
      isExpectedOidcRedirect: () => true,
      parseRuntimeProfile: (value) => value,
      resolveTenantRuntimeTargets: async () => ({ source: 'registry', targets: [] }),
      runHttpProbe: async (input) => createProbe({ name: input.name, target: input.target }),
      selectSmokeTenantTargets: (_runtimeProfile, tenantTargets) => tenantTargets,
      shouldUseStudioReleaseBlockingTenantScope: () => true,
      wait,
    });

    await expect(ops.waitForRemoteSmokeWarmup({}, { runner, runtimeProfile: 'studio' }))
      .rejects.toThrow('PROMOTE_INTERNAL_ERROR: public-home: Erwartet HTTP 200, erhalten 404.');

    expect(runner).toHaveBeenCalledTimes(50);
    expect(wait).toHaveBeenCalledTimes(49);
    expect(wait.mock.calls).toEqual(Array.from({ length: 49 }, () => [10_000]));
  });

  it.each([
    { SVA_EXTERNAL_SMOKE_MAX_ATTEMPTS: 'abc', SVA_EXTERNAL_SMOKE_RETRY_DELAY_MS: 'abc' },
    { SVA_EXTERNAL_SMOKE_RETRY_DELAY_MS: 'abc', SVA_EXTERNAL_SMOKE_WARMUP_WINDOW_MS: 'abc' },
  ])('falls back to safe defaults for invalid external warmup settings', async (env) => {
    const wait = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue();
    const transientFailure = createProbe({
      message: 'Erwartet HTTP 200, erhalten 404.',
      name: 'public-home',
      status: 'error',
    });
    const runner = vi.fn<(env: NodeJS.ProcessEnv) => Promise<readonly AcceptanceProbeResult[]>>()
      .mockResolvedValueOnce([transientFailure])
      .mockResolvedValueOnce([createProbe({ name: 'public-home' })]);
    const ops = createRuntimeSmokeOps({
      buildSwarmAppTaskProbe: () => createProbe({ scope: 'internal' }),
      buildSwarmServicePresenceProbe: () => createProbe({ scope: 'internal' }),
      doctorRuntime: async () => createDoctorReport({}),
      isExpectedOidcRedirect: () => true,
      parseRuntimeProfile: (value) => value,
      resolveTenantRuntimeTargets: async () => ({ source: 'registry', targets: [] }),
      runHttpProbe: async (input) => createProbe({ name: input.name, target: input.target }),
      selectSmokeTenantTargets: (_runtimeProfile, tenantTargets) => tenantTargets,
      shouldUseStudioReleaseBlockingTenantScope: () => true,
      wait,
    });

    await expect(ops.runExternalSmokeWithWarmup(env, { runner, runtimeProfile: 'studio' }))
      .resolves.toEqual([expect.objectContaining({ name: 'public-home', status: 'ok' })]);

    expect(runner).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledExactlyOnceWith(10_000);
  });

  it('probes every explicit ingress host and an unknown host for the selected environment', async () => {
    const targets: string[] = [];
    const names: string[] = [];
    const ops = createRuntimeSmokeOps({
      buildSwarmAppTaskProbe: () => createProbe({ scope: 'internal' }),
      buildSwarmServicePresenceProbe: () => createProbe({ scope: 'internal' }),
      doctorRuntime: async () => createDoctorReport({}),
      isExpectedOidcRedirect: () => true,
      parseRuntimeProfile: (value) => value,
      resolveTenantRuntimeTargets: async () => ({ source: 'registry', targets: [] }),
      runHttpProbe: async (input) => {
        names.push(input.name);
        targets.push(input.target);
        return createProbe({
          ...(input.name === 'public-ingress-unknown-host' ? { httpStatus: undefined } : { httpStatus: 200 }),
          message: input.name === 'public-ingress-unknown-host' ? 'getaddrinfo ENOTFOUND unknown-ingress-smoke' : 'ok',
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
      message: expect.stringContaining('getaddrinfo ENOTFOUND unknown-ingress-smoke'),
      status: 'ok',
    });
    expect(names).not.toContain('public-ingress-https-studio-dev.smart-village.app');
    expect(names).not.toContain('public-ingress-login-studio-dev.smart-village.app');
  });

  it('checks the registry realm for every explicit tenant ingress login', async () => {
    let loginExpectation: ((response: Response, payload: unknown) => string | null) | undefined;
    const ops = createRuntimeSmokeOps({
      buildSwarmAppTaskProbe: () => createProbe({ scope: 'internal' }),
      buildSwarmServicePresenceProbe: () => createProbe({ scope: 'internal' }),
      doctorRuntime: async () => createDoctorReport({}),
      isExpectedOidcRedirect: () => true,
      parseRuntimeProfile: (value) => value,
      resolveTenantRuntimeTargets: async () => ({
        source: 'registry',
        targets: [{ authRealm: 'custom-teststadt-realm', host: 'de-teststadt-dev.studio-dev.smart-village.app', instanceId: 'de-teststadt-dev' }],
      }),
      runHttpProbe: async (input) => {
        if (input.name === 'public-ingress-login-de-teststadt-dev.studio-dev.smart-village.app') loginExpectation = input.expect;
        return createProbe({ name: input.name, target: input.target });
      },
      selectSmokeTenantTargets: () => [],
      shouldUseStudioReleaseBlockingTenantScope: () => true,
      wait: async () => undefined,
    });

    await ops.runExternalSmoke('studio', { SVA_PUBLIC_BASE_URL: 'https://studio-dev.smart-village.app' });

    expect(loginExpectation).toBeDefined();
    expect(loginExpectation?.(new Response(null, {
      headers: { location: `https://keycloak.example/realms/wrong-realm/protocol/openid-connect/auth?redirect_uri=${encodeURIComponent('https://de-teststadt-dev.studio-dev.smart-village.app/auth/callback')}` },
      status: 302,
    }), null)).toContain('custom-teststadt-realm');
    expect(loginExpectation?.(new Response(null, {
      headers: { location: `https://keycloak.example/realms/custom-teststadt-realm/protocol/openid-connect/auth?redirect_uri=${encodeURIComponent('https://de-teststadt-dev.studio-dev.smart-village.app/auth/callback')}` },
      status: 302,
    }), null)).toBeNull();
  });

  it('does not block production releases on non-release tenant ingress failures', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const ops = createRuntimeSmokeOps({
      buildSwarmAppTaskProbe: () => createProbe({ scope: 'internal' }),
      buildSwarmServicePresenceProbe: () => createProbe({ scope: 'internal' }),
      doctorRuntime: async () => createDoctorReport({}),
      isExpectedOidcRedirect: () => true,
      parseRuntimeProfile: (value) => value,
      resolveTenantRuntimeTargets: async () => ({ source: 'registry', targets: [] }),
      runHttpProbe: async (input) => createProbe({ name: input.name, target: input.target }),
      selectSmokeTenantTargets: (_runtimeProfile, tenantTargets) => tenantTargets,
      shouldUseStudioReleaseBlockingTenantScope: (runtimeProfile, env) =>
        runtimeProfile === 'studio' && (env.SVA_ACCEPTANCE_RELEASE_MODE?.trim().length ?? 0) > 0,
      wait: async () => undefined,
    });
    const nonBlockingFailure = createProbe({
      message: 'fetch failed',
      name: 'public-ingress-https-bb-ahrensfelde.studio.smart-village.app',
      status: 'error',
    });

    await expect(ops.waitForRemoteSmokeWarmup({
      SVA_ACCEPTANCE_RELEASE_MODE: 'app-only',
      SVA_RUNTIME_PROFILE: 'studio',
    }, {
      maxAttempts: 1,
      runner: async () => [nonBlockingFailure],
      runtimeProfile: 'studio',
    })).resolves.toEqual([nonBlockingFailure]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(nonBlockingFailure.name));
    warn.mockRestore();
  });

  it.each([
    'public-home',
    'public-iam-context',
    'public-ingress-https-de-studio-sandbox.studio-staging.smart-village.app',
  ])('keeps %s release-blocking', async (name) => {
    const ops = createRuntimeSmokeOps({
      buildSwarmAppTaskProbe: () => createProbe({ scope: 'internal' }),
      buildSwarmServicePresenceProbe: () => createProbe({ scope: 'internal' }),
      doctorRuntime: async () => createDoctorReport({}),
      isExpectedOidcRedirect: () => true,
      parseRuntimeProfile: (value) => value,
      resolveTenantRuntimeTargets: async () => ({ source: 'registry', targets: [] }),
      runHttpProbe: async (input) => createProbe({ name: input.name, target: input.target }),
      selectSmokeTenantTargets: (_runtimeProfile, tenantTargets) => tenantTargets,
      shouldUseStudioReleaseBlockingTenantScope: () => true,
      wait: async () => undefined,
    });
    const blockingFailure = createProbe({ message: 'fetch failed', name, status: 'error' });

    await expect(ops.waitForRemoteSmokeWarmup({
      SVA_ACCEPTANCE_RELEASE_MODE: 'app-only',
      SVA_RUNTIME_PROFILE: 'studio',
    }, {
      maxAttempts: 1,
      runner: async () => [blockingFailure],
      runtimeProfile: 'studio',
    })).rejects.toThrow(name);
  });

  it('returns no ingress contract for an invalid base URL', () => {
    expect(resolveStudioIngressContract('https://')).toBeNull();
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

  it.each(['public-iam-context', 'public-iam-instances'])('retries a complete router gap for %s', (name) => {
    expect(shouldRetryExternalSmoke([createProbe({ message: 'Unerwarteter Status 404.', name, status: 'error' })])).toBe(true);
  });

  it.each([
    'public-ingress-https-de-teststadt-dev.studio-dev.smart-village.app',
    'public-ingress-login-de-teststadt-dev.studio-dev.smart-village.app',
  ])('retries transient failures for %s', (name) => {
    expect(shouldRetryExternalSmoke([
      createProbe({
        message: 'Gateway antwortet während des Warmups mit 503.',
        name,
        status: 'error',
      }),
    ])).toBe(true);
  });

  it.each([
    'public-ingress-https-de-teststadt-dev.studio-dev.smart-village.app',
    'public-ingress-login-de-teststadt-dev.studio-dev.smart-village.app',
  ])('retries transport failures without an HTTP response for %s', (name) => {
    expect(shouldRetryExternalSmoke([
      createProbe({
        httpStatus: undefined,
        message: 'fetch failed',
        name,
        status: 'error',
      }),
    ])).toBe(true);
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
