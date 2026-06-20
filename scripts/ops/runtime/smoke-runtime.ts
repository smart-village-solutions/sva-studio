import type { AcceptanceProbeResult, DoctorReport, RemoteRuntimeProfile, RuntimeProfile, TenantRuntimeTargetResolution } from '../runtime-env.shared.ts';
import { deriveInternalVerifyMaxAttempts, shouldRetryExternalSmoke, shouldRetryInternalVerifyAttempt } from './smoke-retry.ts';

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
  isExpectedOidcRedirect: (location: string, env: NodeJS.ProcessEnv) => boolean;
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

const tenantAuthLoginProbe = (deps: RuntimeSmokeDeps, base: URL, tenantTarget: TenantRuntimeTargetResolution['targets'][number]) =>
  deps.runHttpProbe({
    name: `public-auth-login-${tenantTarget.instanceId}`,
    scope: 'external',
    target: new URL('/auth/login', `${base.protocol}//${tenantTarget.host}`).toString(),
    expect: (response) => {
      const location = response.headers.get('location') ?? '';
      if (response.status !== 302) return `Erwartet Redirect fuer Tenant ${tenantTarget.instanceId}, erhalten ${response.status}.`;
      if (!location.includes(`/realms/${tenantTarget.authRealm}/`)) return `Tenant-Realm stimmt nicht fuer ${tenantTarget.instanceId}: ${location}`;
      const encodedRedirect = encodeURIComponent(`${base.protocol}//${tenantTarget.host}/auth/callback`);
      return location.includes(`redirect_uri=${encodedRedirect}`) ? null : `Tenant-Redirect-URI stimmt nicht fuer ${tenantTarget.instanceId}: ${location}`;
    },
  });

const baseExternalProbes = (deps: RuntimeSmokeDeps, baseUrl: string, env: NodeJS.ProcessEnv) => [
  deps.runHttpProbe({ name: 'public-home', scope: 'external', target: baseUrl, expect: (response) => (response.status === 200 ? null : `Erwartet HTTP 200, erhalten ${response.status}.`) }),
  deps.runHttpProbe({ name: 'public-live', scope: 'external', target: new URL('/health/live', baseUrl).toString(), expect: (response) => (response.status === 200 ? null : `Erwartet HTTP 200, erhalten ${response.status}.`) }),
  deps.runHttpProbe({ name: 'public-ready', scope: 'external', target: new URL('/health/ready', baseUrl).toString(), expect: (response) => (response.status === 200 || response.status === 503 ? null : `Unerwarteter Ready-Status ${response.status}.`) }),
  deps.runHttpProbe({
    name: 'public-auth-login',
    scope: 'external',
    target: new URL('/auth/login', baseUrl).toString(),
    expect: (response) => {
      const location = response.headers.get('location') ?? '';
      return response.status !== 302 ? `Erwartet Redirect, erhalten ${response.status}.` : deps.isExpectedOidcRedirect(location, env) ? null : `OIDC-Redirect stimmt nicht: ${location}`;
    },
  }),
  deps.runHttpProbe({ name: 'public-iam-context', scope: 'external', target: new URL('/api/v1/iam/me/context', baseUrl).toString(), expect: (response, payload) => ([200, 401, 403].includes(response.status) && !(typeof payload === 'string' && payload.toLowerCase().includes('<html'))) ? null : `Unerwarteter IAM-Kontext-Status ${response.status}.` }),
  deps.runHttpProbe({ name: 'public-iam-instances', scope: 'external', target: new URL('/api/v1/iam/instances', baseUrl).toString(), expect: (response, payload) => ([200, 401, 403].includes(response.status) && !(typeof payload === 'string' && payload.toLowerCase().includes('<html'))) ? null : `Unerwarteter IAM-Instanzlisten-Status ${response.status}.` }),
];

const runExternalSmoke = async (deps: RuntimeSmokeDeps, runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv): Promise<readonly AcceptanceProbeResult[]> => {
  const baseUrl = env.SVA_PUBLIC_BASE_URL ?? 'http://localhost:3000';
  const base = new URL(baseUrl);
  const tenantOptions = deps.shouldUseStudioReleaseBlockingTenantScope(runtimeProfile, env) ? undefined : { limit: 2 };
  const tenantResolution = await deps.resolveTenantRuntimeTargets(runtimeProfile, env, tenantOptions);
  const tenantTargets = deps.selectSmokeTenantTargets(runtimeProfile, tenantResolution.targets, { env, source: tenantResolution.source });
  const tenantProbes = tenantTargets.map((tenantTarget) => tenantAuthLoginProbe(deps, base, tenantTarget));

  return Promise.all([...baseExternalProbes(deps, baseUrl, env), ...tenantProbes]);
};

const runExternalSmokeWithWarmup = async (deps: RuntimeSmokeDeps, env: NodeJS.ProcessEnv, options?: ExternalSmokeWarmupOptions) => {
  const retryDelayMs = options?.retryDelayMs ?? Number(env.SVA_EXTERNAL_SMOKE_RETRY_DELAY_MS ?? '15000');
  const warmupWindowMs = Number(env.SVA_EXTERNAL_SMOKE_WARMUP_WINDOW_MS ?? '300000');
  const maxAttempts = options?.maxAttempts ?? Number(env.SVA_EXTERNAL_SMOKE_MAX_ATTEMPTS ?? String(Math.max(1, Math.floor(warmupWindowMs / Math.max(retryDelayMs, 1)) + 1)));
  const shouldRetry = options?.shouldRetry ?? shouldRetryExternalSmoke;
  const runtimeProfile = options?.runtimeProfile ?? defaultRuntimeProfile(deps, env);
  const runner = options?.runner ?? ((currentEnv: NodeJS.ProcessEnv) => runExternalSmoke(deps, runtimeProfile, currentEnv));
  let lastProbes: readonly AcceptanceProbeResult[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const probes = await runner(env);
    lastProbes = probes;
    if (!shouldRetry(probes) || attempt >= maxAttempts) return probes;
    await deps.wait(retryDelayMs);
  }

  return lastProbes;
};

const isBlockingSmokeProbe = (probe: AcceptanceProbeResult) =>
  ['public-live', 'public-ready', 'public-auth-login'].includes(probe.name) || probe.name.startsWith('public-auth-login-');

const waitForRemoteSmokeWarmup = async (deps: RuntimeSmokeDeps, env: NodeJS.ProcessEnv, options?: ExternalSmokeWarmupOptions) => {
  const runtimeProfile = options?.runtimeProfile ?? defaultRuntimeProfile(deps, env);
  const probes = await runExternalSmokeWithWarmup(deps, env, {
    maxAttempts: options?.maxAttempts,
    retryDelayMs: options?.retryDelayMs,
    runtimeProfile,
    runner: options?.runner,
    shouldRetry: (candidateProbes) => shouldRetryExternalSmoke(candidateProbes.filter(isBlockingSmokeProbe)),
  });
  const failingProbe = probes.find((probe) => probe.status === 'error' && isBlockingSmokeProbe(probe));
  if (failingProbe) throw new Error(`${failingProbe.name}: ${failingProbe.message}`);
  return probes;
};

export const createRuntimeSmokeOps = (deps: RuntimeSmokeDeps) => ({
  runExternalSmoke: (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => runExternalSmoke(deps, runtimeProfile, env),
  runExternalSmokeWithWarmup: (env: NodeJS.ProcessEnv, options?: ExternalSmokeWarmupOptions) => runExternalSmokeWithWarmup(deps, env, options),
  runInternalVerify: (runtimeProfile: RemoteRuntimeProfile, env: NodeJS.ProcessEnv) => runInternalVerify(deps, runtimeProfile, env),
  waitForRemoteSmokeWarmup: (env: NodeJS.ProcessEnv, options?: ExternalSmokeWarmupOptions) => waitForRemoteSmokeWarmup(deps, env, options),
}) as const;
