import type { AcceptanceProbeResult, DoctorReport, RemoteRuntimeProfile, RuntimeProfile, TenantRuntimeTargetResolution } from '../runtime-env.shared.ts';
import type { OidcAuthorizationRedirectExpectation } from './acceptance-runtime-checks-core.ts';
import { buildPromoteFailure, PromoteContractError, writePromoteFailureRecord, type PromoteErrorCode, type PromoteEnvironment } from '../../ci/promote-result.ts';
import { deriveInternalVerifyMaxAttempts, shouldRetryExternalSmoke, shouldRetryInternalVerifyAttempt, summarizeExternalSmokeAttempt } from './smoke-retry.ts';
import { resolveStudioIngressContract, studioIngressContracts } from './tenant-ingress-hosts.ts';

type RunHttpProbeInput = {
  expect: (response: Response, payload: unknown) => string | null;
  name: string;
  scope: 'external';
  target: string;
};

export type RuntimeSmokeDeps = {
  buildSwarmAppTaskProbe: (env: NodeJS.ProcessEnv) => AcceptanceProbeResult;
  buildSwarmServicePresenceProbe: (env: NodeJS.ProcessEnv) => AcceptanceProbeResult;
  doctorRuntime: (runtimeProfile: RemoteRuntimeProfile, env: NodeJS.ProcessEnv) => Promise<DoctorReport>;
  isExpectedOidcRedirect: (location: string, env: NodeJS.ProcessEnv, expectation?: OidcAuthorizationRedirectExpectation) => boolean;
  parseRuntimeProfile: (value: RuntimeProfile | undefined) => RuntimeProfile | undefined;
  resolveTenantRuntimeTargets: (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv, options?: { readonly limit?: number }) => Promise<TenantRuntimeTargetResolution>;
  runHttpProbe: (input: RunHttpProbeInput) => Promise<AcceptanceProbeResult>;
  selectSmokeTenantTargets: (runtimeProfile: RuntimeProfile, tenantTargets: TenantRuntimeTargetResolution['targets'], options: { readonly env: NodeJS.ProcessEnv; readonly source: TenantRuntimeTargetResolution['source'] }) => TenantRuntimeTargetResolution['targets'];
  shouldUseStudioReleaseBlockingTenantScope: (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => boolean;
  wait: (ms: number) => Promise<unknown>;
};

type ExternalSmokeWarmupOptions = {
  readonly maxAttempts?: number;
  readonly retryDelayMs?: number;
  readonly runtimeProfile?: RuntimeProfile;
  readonly runner?: (env: NodeJS.ProcessEnv) => Promise<readonly AcceptanceProbeResult[]>;
  readonly shouldRetry?: (probes: readonly AcceptanceProbeResult[]) => boolean;
};

const defaultExternalSmokeMaxAttempts = 50;
const defaultExternalSmokeRetryDelayMs = 10_000;

export const resolveRuntimeSmokePromoteEnvironment = (env: NodeJS.ProcessEnv): PromoteEnvironment => {
  const stackName = env.SVA_STACK_NAME?.trim();
  if (stackName === 'studio') return 'prod';
  if (stackName === 'studio-staging') return 'staging';
  if (stackName === 'studio-dev') return 'dev';
  try {
    const hostname = new URL(env.SVA_PUBLIC_BASE_URL ?? '').hostname;
    if (hostname === 'studio.smart-village.app') return 'prod';
    if (hostname === 'studio-staging.smart-village.app') return 'staging';
    if (hostname === 'studio-dev.smart-village.app') return 'dev';
  } catch {
    // Unknown or malformed targets remain explicitly invalid in redacted evidence.
  }
  return 'invalid';
};

export const classifyRuntimeSmokeFailure = (probe: AcceptanceProbeResult): PromoteErrorCode =>
  probe.name === 'public-ready'
    ? 'PROMOTE_READINESS_NOT_READY'
    : probe.message.includes('Realm stimmt nicht') || probe.message.includes('erwarteten Realm')
      ? 'PROMOTE_SMOKE_REALM_MISMATCH'
      : probe.message.includes('Redirect-URI') || probe.message.includes('Rückkehr-Host') || probe.message.includes('OIDC-Redirect-Vertrag')
        ? 'PROMOTE_SMOKE_CALLBACK_MISMATCH'
        : 'PROMOTE_INTERNAL_ERROR';

const parsePositiveInteger = (value: number | string | undefined): number | undefined => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
};

const parseNonNegativeInteger = (value: number | undefined): number | undefined =>
  value !== undefined && Number.isInteger(value) && value >= 0 ? value : undefined;

const defaultRuntimeProfile = (deps: RuntimeSmokeDeps, env: NodeJS.ProcessEnv) =>
  deps.parseRuntimeProfile(env.SVA_RUNTIME_PROFILE as RuntimeProfile | undefined) ?? 'local-keycloak';

const runInternalVerify = async (deps: RuntimeSmokeDeps, runtimeProfile: RemoteRuntimeProfile, env: NodeJS.ProcessEnv) => {
  const retryDelayMs = Number(env.SVA_INTERNAL_VERIFY_RETRY_DELAY_MS ?? '5000');
  const warmupWindowMs = Number(env.SVA_INTERNAL_VERIFY_WARMUP_WINDOW_MS ?? '90000');
  const maxAttempts = Number(env.SVA_INTERNAL_VERIFY_MAX_ATTEMPTS ?? String(deriveInternalVerifyMaxAttempts({ retryDelayMs, warmupWindowMs })));
  let lastDoctorReport: DoctorReport | null = null;
  let lastProbes: AcceptanceProbeResult[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const doctorReport = await deps.doctorRuntime(runtimeProfile, env);
    const probes = [deps.buildSwarmServicePresenceProbe(env), deps.buildSwarmAppTaskProbe(env)];
    lastDoctorReport = doctorReport;
    lastProbes = probes;
    if (doctorReport.status !== 'error' && probes.every((probe) => probe.status !== 'error')) return { doctorReport, probes };
    if (attempt < maxAttempts && shouldRetryInternalVerifyAttempt({ doctorReport, probes })) await deps.wait(retryDelayMs);
    else return { doctorReport, probes };
  }

  return { doctorReport: lastDoctorReport ?? (await deps.doctorRuntime(runtimeProfile, env)), probes: lastProbes };
};

const tenantOidcExpectation = (
  base: URL,
  tenantTarget: TenantRuntimeTargetResolution['targets'][number],
  env: NodeJS.ProcessEnv,
): OidcAuthorizationRedirectExpectation => ({
  clientId: tenantTarget.authClientId ?? env.SVA_AUTH_CLIENT_ID,
  issuerUrl: tenantTarget.authIssuerUrl ?? (env.KEYCLOAK_ADMIN_BASE_URL
    ? `${env.KEYCLOAK_ADMIN_BASE_URL.replace(/\/+$/u, '')}/realms/${tenantTarget.authRealm}`
    : env.SVA_AUTH_ISSUER),
  redirectUri: `${base.protocol}//${tenantTarget.host}/auth/callback`,
});

const tenantAuthLoginProbe = (deps: RuntimeSmokeDeps, base: URL, env: NodeJS.ProcessEnv, tenantTarget: TenantRuntimeTargetResolution['targets'][number]) =>
  deps.runHttpProbe({
    name: `public-auth-login-${tenantTarget.instanceId}`,
    scope: 'external',
    target: new URL('/auth/login', `${base.protocol}//${tenantTarget.host}`).toString(),
    expect: (response) => {
      const location = response.headers.get('location') ?? '';
      if (response.status !== 302) return `Erwartet Redirect fuer Tenant ${tenantTarget.instanceId}, erhalten ${response.status}.`;
      return deps.isExpectedOidcRedirect(location, env, tenantOidcExpectation(base, tenantTarget, env))
        ? null
        : `Tenant-OIDC-Redirect-Vertrag stimmt nicht fuer ${tenantTarget.instanceId}.`;
    },
  });

const explicitIngressHostProbes = (
  deps: RuntimeSmokeDeps,
  base: URL,
  env: NodeJS.ProcessEnv,
  tenantTargets: TenantRuntimeTargetResolution['targets'],
) => {
  const contract = resolveStudioIngressContract(base.toString());
  if (!contract) return [];

  const tenantTargetsByHost = new Map(tenantTargets.map((target) => [target.host, target] as const));
  const allowedHostProbes = contract.tenantIds.flatMap((instanceId) => {
    const host = `${instanceId}.${contract.rootHost}`;
    const tenantTarget = tenantTargetsByHost.get(host) ?? { authRealm: instanceId, host, instanceId };
    return [
    deps.runHttpProbe({
      name: `public-ingress-https-${host}`,
      scope: 'external',
      target: `${base.protocol}//${host}/health/live`,
      expect: (response) => response.status === 200 ? null : `Expliziter Ingress-Host ${host} antwortet mit ${response.status}.`,
    }),
    deps.runHttpProbe({
      name: `public-ingress-login-${host}`,
      scope: 'external',
      target: `${base.protocol}//${host}/auth/login`,
      expect: (response) => {
        const location = response.headers.get('location') ?? '';
        if (response.status !== 302) return `Login auf ${host} antwortet mit ${response.status}.`;
        return deps.isExpectedOidcRedirect(location, env, tenantOidcExpectation(base, tenantTarget, env))
          ? null
          : `Login auf ${host} verletzt den OIDC-Redirect-Vertrag.`;
      },
    }),
    ];
  });
  const unknownHostProbe = deps.runHttpProbe({
    name: 'public-ingress-unknown-host',
    scope: 'external',
    target: `${base.protocol}//${contract.unknownHost}/auth/login`,
    expect: (response) => [200, 302].includes(response.status)
      ? `Unbekannter Host erscheint mit HTTP ${response.status} als betriebsbereit.`
      : null,
  }).then((probe) => probe.httpStatus === undefined
    ? {
        ...probe,
        message: `Unbekannter Host wurde vor der Anwendung fail-closed abgelehnt. Ursache: ${probe.message}`,
        status: 'ok' as const,
      }
    : probe);

  return [...allowedHostProbes, unknownHostProbe];
};

const baseExternalProbes = (deps: RuntimeSmokeDeps, baseUrl: string, env: NodeJS.ProcessEnv) => [
  deps.runHttpProbe({ name: 'public-home', scope: 'external', target: baseUrl, expect: (response) => (response.status === 200 ? null : `Erwartet HTTP 200, erhalten ${response.status}.`) }),
  deps.runHttpProbe({ name: 'public-live', scope: 'external', target: new URL('/health/live', baseUrl).toString(), expect: (response) => (response.status === 200 ? null : `Erwartet HTTP 200, erhalten ${response.status}.`) }),
  deps.runHttpProbe({ name: 'public-ready', scope: 'external', target: new URL('/health/ready', baseUrl).toString(), expect: (response) => (response.status === 200 ? null : `Unerwarteter Ready-Status ${response.status}.`) }),
  deps.runHttpProbe({
    name: 'public-auth-login',
    scope: 'external',
    target: new URL('/auth/login', baseUrl).toString(),
    expect: (response) => {
      const location = response.headers.get('location') ?? '';
      return response.status !== 302 ? `Erwartet Redirect, erhalten ${response.status}.` : deps.isExpectedOidcRedirect(location, env) ? null : 'OIDC-Redirect verletzt den erwarteten Vertrag.';
    },
  }),
  deps.runHttpProbe({ name: 'public-iam-context', scope: 'external', target: new URL('/api/v1/iam/me/context', baseUrl).toString(), expect: (response, payload) => ([200, 401, 403].includes(response.status) && !(typeof payload === 'string' && payload.toLowerCase().includes('<html'))) ? null : `Unerwarteter IAM-Kontext-Status ${response.status}.` }),
  deps.runHttpProbe({ name: 'public-iam-instances', scope: 'external', target: new URL('/api/v1/iam/instances', baseUrl).toString(), expect: (response, payload) => ([200, 401, 403].includes(response.status) && !(typeof payload === 'string' && payload.toLowerCase().includes('<html'))) ? null : `Unerwarteter IAM-Instanzlisten-Status ${response.status}.` }),
];

const runExternalSmoke = async (deps: RuntimeSmokeDeps, runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv): Promise<readonly AcceptanceProbeResult[]> => {
  const baseUrl = env.SVA_PUBLIC_BASE_URL ?? 'http://localhost:3000';
  const base = new URL(baseUrl);
  const tenantOptions = deps.shouldUseStudioReleaseBlockingTenantScope(runtimeProfile, env)
    || resolveStudioIngressContract(baseUrl)
    ? undefined
    : { limit: 2 };
  const tenantResolution = await deps.resolveTenantRuntimeTargets(runtimeProfile, env, tenantOptions);
  const tenantTargets = deps.selectSmokeTenantTargets(runtimeProfile, tenantResolution.targets, { env, source: tenantResolution.source });
  const tenantProbes = tenantTargets.map((tenantTarget) => tenantAuthLoginProbe(deps, base, env, tenantTarget));

  return Promise.all([...baseExternalProbes(deps, baseUrl, env), ...explicitIngressHostProbes(deps, base, env, tenantResolution.targets), ...tenantProbes]);
};

const runExternalSmokeWithWarmup = async (deps: RuntimeSmokeDeps, env: NodeJS.ProcessEnv, options?: ExternalSmokeWarmupOptions) => {
  const retryDelayMs = options?.retryDelayMs === undefined
    ? parsePositiveInteger(env.SVA_EXTERNAL_SMOKE_RETRY_DELAY_MS) ?? defaultExternalSmokeRetryDelayMs
    : parseNonNegativeInteger(options.retryDelayMs) ?? defaultExternalSmokeRetryDelayMs;
  const configuredWarmupWindowMs = parsePositiveInteger(env.SVA_EXTERNAL_SMOKE_WARMUP_WINDOW_MS);
  const maxAttemptsFromWarmupWindow = configuredWarmupWindowMs === undefined
    ? defaultExternalSmokeMaxAttempts
    : Math.max(1, Math.floor(configuredWarmupWindowMs / Math.max(retryDelayMs, 1)) + 1);
  const maxAttempts = parsePositiveInteger(options?.maxAttempts ?? env.SVA_EXTERNAL_SMOKE_MAX_ATTEMPTS)
    ?? maxAttemptsFromWarmupWindow;
  const shouldRetry = options?.shouldRetry ?? shouldRetryExternalSmoke;
  const runtimeProfile = options?.runtimeProfile ?? defaultRuntimeProfile(deps, env);
  const runner = options?.runner ?? ((currentEnv: NodeJS.ProcessEnv) => runExternalSmoke(deps, runtimeProfile, currentEnv));
  let lastProbes: readonly AcceptanceProbeResult[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const probes = await runner(env);
    lastProbes = probes;
    const summary = summarizeExternalSmokeAttempt(probes);
    process.stdout.write(`[runtime-env] HTTP-Warmup ${attempt}/${maxAttempts}: ${JSON.stringify(summary)}\n`);
    if (!shouldRetry(probes) || attempt >= maxAttempts) return probes;
    await deps.wait(retryDelayMs);
  }

  return lastProbes;
};

export const isBlockingSmokeProbe = (
  probe: AcceptanceProbeResult,
  usesReleaseBlockingTenantScope: boolean,
) => {
  if (['public-home', 'public-live', 'public-ready', 'public-auth-login', 'public-ingress-unknown-host'].includes(probe.name)) return true;
  if (probe.name.startsWith('public-auth-login-')) return true;

  const isExplicitIngressProbe = probe.name.startsWith('public-ingress-https-')
    || probe.name.startsWith('public-ingress-login-');
  if (!isExplicitIngressProbe) return true;
  if (!usesReleaseBlockingTenantScope) return true;

  const releaseBlockingTenantId = studioIngressContracts.prod.releaseBlockingTenantId;
  return probe.name.startsWith(`public-ingress-https-${releaseBlockingTenantId}.`)
    || probe.name.startsWith(`public-ingress-login-${releaseBlockingTenantId}.`);
};

export const reportNonBlockingSmokeFailures = (
  probes: readonly AcceptanceProbeResult[],
  usesReleaseBlockingTenantScope: boolean,
) => {
  for (const probe of probes) {
    if (probe.status !== 'error' || isBlockingSmokeProbe(probe, usesReleaseBlockingTenantScope)) continue;
    console.warn('[runtime-env] PROMOTE_SMOKE_NON_BLOCKING_FAILURE: Eine nicht blockierende Smoke-Prüfung ist fehlgeschlagen.');
  }
};

const waitForRemoteSmokeWarmup = async (deps: RuntimeSmokeDeps, env: NodeJS.ProcessEnv, options?: ExternalSmokeWarmupOptions) => {
  const runtimeProfile = options?.runtimeProfile ?? defaultRuntimeProfile(deps, env);
  const usesReleaseBlockingTenantScope = deps.shouldUseStudioReleaseBlockingTenantScope(runtimeProfile, env);
  const probes = await runExternalSmokeWithWarmup(deps, env, {
    maxAttempts: options?.maxAttempts,
    retryDelayMs: options?.retryDelayMs,
    runtimeProfile,
    runner: options?.runner,
    shouldRetry: (candidateProbes) => shouldRetryExternalSmoke(
      candidateProbes.filter((probe) => isBlockingSmokeProbe(probe, usesReleaseBlockingTenantScope)),
    ),
  });
  reportNonBlockingSmokeFailures(probes, usesReleaseBlockingTenantScope);
  const failingProbe = probes.find(
    (probe) => probe.status === 'error' && isBlockingSmokeProbe(probe, usesReleaseBlockingTenantScope),
  );
  if (failingProbe) {
    const failure = buildPromoteFailure({
      code: classifyRuntimeSmokeFailure(failingProbe),
      environment: resolveRuntimeSmokePromoteEnvironment(env),
      phase: 'external-smoke',
    });
    writePromoteFailureRecord(failure, env.PROMOTE_FAILURE_PATH);
    throw new PromoteContractError(failure);
  }
  return probes;
};

export const createRuntimeSmokeOps = (deps: RuntimeSmokeDeps) => ({
  runExternalSmoke: (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => runExternalSmoke(deps, runtimeProfile, env),
  runExternalSmokeWithWarmup: (env: NodeJS.ProcessEnv, options?: ExternalSmokeWarmupOptions) => runExternalSmokeWithWarmup(deps, env, options),
  runInternalVerify: (runtimeProfile: RemoteRuntimeProfile, env: NodeJS.ProcessEnv) => runInternalVerify(deps, runtimeProfile, env),
  waitForRemoteSmokeWarmup: (env: NodeJS.ProcessEnv, options?: ExternalSmokeWarmupOptions) => waitForRemoteSmokeWarmup(deps, env, options),
}) as const;
