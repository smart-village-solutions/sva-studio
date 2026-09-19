import type { RuntimeProfile } from '../../../packages/core/src/runtime-profile.ts';
import type { DoctorCheck, RemoteRuntimeProfile, TenantRuntimeTargetResolution } from '../runtime-env.shared.ts';
import { isExpectedOidcRedirect } from './acceptance-runtime-checks-core.ts';
import {
  buildOidcClientSecretProbes,
  evaluateOidcClientSecretProbeResponse,
  getObservabilitySummary,
  normalizeBaseUrl,
  parseLiveRuntimeFlags,
  readJsonResponse,
  resolveRemoteShortServiceName,
  resolveRemoteStackServiceName,
} from './runtime-health-helpers.ts';
import type { LiveRuntimeFlags, OidcClientSecretProbe, OidcClientSecretProbeResult, RuntimeHealthDeps } from './runtime-health.types.ts';

const KEYCLOAK_INSECURE_CONTEXT_QUERY =
  '{swarm_service=~".*keycloak_keycloak"} |= "Non-secure context detected; cookies are not secured"';
const LOKI_PROBE_WINDOW_MINUTES = 15;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const isLokiValuePair = (value: unknown): value is readonly [string, string] =>
  Array.isArray(value) && value.length === 2 && typeof value[0] === 'string' && typeof value[1] === 'string';

const isLokiStream = (value: unknown): value is Readonly<{
  stream: Readonly<Record<string, string>>;
  values: ReadonlyArray<readonly [string, string]>;
}> =>
  isRecord(value) &&
  isRecord(value.stream) &&
  Object.values(value.stream).every((labelValue) => typeof labelValue === 'string') &&
  Array.isArray(value.values) &&
  value.values.every(isLokiValuePair);

const parseStrictLokiStreamLines = (payload: unknown): readonly string[] => {
  if (
    !isRecord(payload) ||
    payload.status !== 'success' ||
    !isRecord(payload.data) ||
    payload.data.resultType !== 'streams' ||
    !Array.isArray(payload.data.result) ||
    !payload.data.result.every(isLokiStream)
  ) {
    throw new Error('loki_probe_invalid_response');
  }

  return payload.data.result
    .flatMap((entry) => entry.values.map(([, line]) => line))
    .filter((line) => line.length > 0);
};

const readLiveRuntimeFlags = async (deps: RuntimeHealthDeps, env: NodeJS.ProcessEnv): Promise<LiveRuntimeFlags> => {
  const stackName = deps.getConfiguredStackName(env);
  const liveContract = await deps.inspectRemoteServiceContract(env, {
    quantumEndpoint: deps.getConfiguredQuantumEndpoint(env),
    serviceName: resolveRemoteShortServiceName(stackName, deps.getRemoteAppServiceName(env)),
    stackName,
  });
  if (!liveContract) throw new Error('Live-Service-Spec fuer den App-Container konnte nicht gelesen werden.');
  return parseLiveRuntimeFlags(Object.entries(liveContract.env).map(([key, value]) => `${key}=${value}`).join('\n'));
};

const queryRecentLokiLines = async (
  env: NodeJS.ProcessEnv,
  query: string,
  limit = 20,
  strictResult = false,
): Promise<readonly string[]> => {
  const lokiUrl = env.SVA_LOKI_URL?.trim();
  const grafanaToken = env.SVA_GRAFANA_TOKEN?.trim();
  if (!lokiUrl || !grafanaToken) throw new Error('loki_probe_unconfigured');
  const url = new URL(`${lokiUrl.replace(/\/+$/u, '')}/query_range`);
  url.searchParams.set('query', query);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('start', String((Date.now() - LOKI_PROBE_WINDOW_MINUTES * 60 * 1000) * 1_000_000));
  const response = await fetch(url, { headers: { Authorization: `Bearer ${grafanaToken}` }, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`loki_probe_failed:${response.status}`);
  const payload: unknown = await response.json();
  if (strictResult) return parseStrictLokiStreamLines(payload);
  const permissivePayload = payload as { data?: { result?: Array<{ values?: string[][] }> } };
  return (permissivePayload.data?.result ?? []).flatMap((entry) => (entry.values ?? []).map((value) => value[1] ?? '')).filter((line) => line.length > 0);
};

const queryRecentLokiLinesWithRetry = async (
  deps: RuntimeHealthDeps,
  env: NodeJS.ProcessEnv,
  query: string,
  options: { attempts?: number; delayMs?: number; limit?: number; strictResult?: boolean } = {},
) => {
  const attempts = options.attempts ?? 3;
  const delayMs = options.delayMs ?? 2_000;
  const limit = options.limit ?? 20;
  let lastLines: readonly string[] = [];
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    lastLines = await queryRecentLokiLines(env, query, limit, options.strictResult);
    if (lastLines.length > 0 || attempt >= attempts) return lastLines;
    await deps.wait(delayMs);
  }
  return lastLines;
};

const probeOidcClientSecret = async (probe: OidcClientSecretProbe): Promise<OidcClientSecretProbeResult> => {
  const tokenUrl = `${normalizeBaseUrl(probe.issuerUrl)}/protocol/openid-connect/token`;
  const body = new URLSearchParams({ grant_type: 'client_credentials', client_id: probe.clientId, client_secret: probe.clientSecret });
  const response = await fetch(tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body, signal: AbortSignal.timeout(10_000) });
  return evaluateOidcClientSecretProbeResponse(probe, response, await readJsonResponse(response));
};

export const buildExpectedLiveRuntimeFlags = (
  runtimeProfile: RemoteRuntimeProfile,
  env: NodeJS.ProcessEnv,
): Partial<LiveRuntimeFlags> => ({
  ...(env.ENABLE_OTEL?.trim() ? { ENABLE_OTEL: env.ENABLE_OTEL.trim() } : {}),
  ...(env.SVA_ENABLE_SERVER_CONSOLE_LOGS?.trim()
    ? { SVA_ENABLE_SERVER_CONSOLE_LOGS: env.SVA_ENABLE_SERVER_CONSOLE_LOGS.trim() }
    : {}),
  ...(env.SVA_AUTH_ISSUER?.trim() ? { SVA_AUTH_ISSUER: env.SVA_AUTH_ISSUER.trim() } : {}),
  ...(env.SVA_AUTH_CLIENT_ID?.trim() ? { SVA_AUTH_CLIENT_ID: env.SVA_AUTH_CLIENT_ID.trim() } : {}),
  ...(env.SVA_AUTH_REDIRECT_URI?.trim() ? { SVA_AUTH_REDIRECT_URI: env.SVA_AUTH_REDIRECT_URI.trim() } : {}),
  ...(env.SVA_AUTH_POST_LOGOUT_REDIRECT_URI?.trim()
    ? { SVA_AUTH_POST_LOGOUT_REDIRECT_URI: env.SVA_AUTH_POST_LOGOUT_REDIRECT_URI.trim() }
    : {}),
  ...(env.IAM_CSRF_ALLOWED_ORIGINS?.trim() ? { IAM_CSRF_ALLOWED_ORIGINS: env.IAM_CSRF_ALLOWED_ORIGINS.trim() } : {}),
  SVA_RUNTIME_PROFILE: runtimeProfile,
});

const buildLiveRuntimeEnvCheck = async (
  deps: RuntimeHealthDeps,
  runtimeProfile: RemoteRuntimeProfile,
  env: NodeJS.ProcessEnv,
): Promise<DoctorCheck> => {
  try {
    const liveFlags = await readLiveRuntimeFlags(deps, env);
    const expectedFlags = buildExpectedLiveRuntimeFlags(runtimeProfile, env);
    const mismatches = Object.entries(expectedFlags)
      .filter(([key, expectedValue]) => liveFlags[key as keyof LiveRuntimeFlags] !== expectedValue)
      .map(([key, expectedValue]) => ({ actual: liveFlags[key as keyof LiveRuntimeFlags], expected: expectedValue, key }));
    return mismatches.length > 0
      ? deps.toDoctorCheck('runtime-env-live', 'error', 'runtime_env_live_mismatch', 'Die effektive Container-Umgebung weicht von den erwarteten Runtime-Flags ab.', { expectedFlags, liveFlags, mismatches })
      : deps.toDoctorCheck('runtime-env-live', 'ok', 'runtime_env_live_match', 'Die effektive Container-Umgebung entspricht den erwarteten Runtime-Flags.', { channel: 'portainer-api', expectedFlags, liveFlags });
  } catch (error) {
    return deps.toDoctorCheck('runtime-env-live', 'error', 'runtime_env_live_unavailable', error instanceof Error ? error.message : String(error));
  }
};

const buildObservabilityDoctorCheck = async (
  deps: RuntimeHealthDeps,
  runtimeProfile: RuntimeProfile,
  env: NodeJS.ProcessEnv,
): Promise<DoctorCheck> => {
  const summary = getObservabilitySummary(env);
  if (summary.loggerMode === 'degraded') {
    return deps.toDoctorCheck('observability-readiness', 'error', 'observability_transport_missing', 'Weder OTEL noch produktives Console-Logging sind aktiv; der Logger waere im degradierten Modus.', summary);
  }
  if (runtimeProfile === 'local-builder' || runtimeProfile === 'local-keycloak') {
    return deps.toDoctorCheck('observability-readiness', 'ok', 'observability_local_ready', 'Lokales Laufzeitprofil verwendet einen gueltigen Logger-Modus.', summary);
  }

  let insecureContextLines: readonly string[];
  try {
    insecureContextLines = await queryRecentLokiLinesWithRetry(deps, env, KEYCLOAK_INSECURE_CONTEXT_QUERY, {
      attempts: 3,
      delayMs: 2_000,
      limit: 20,
      strictResult: true,
    });
  } catch (error) {
    const unconfigured = error instanceof Error && error.message === 'loki_probe_unconfigured';
    return deps.toDoctorCheck(
      'observability-readiness',
      unconfigured ? 'warn' : 'error',
      unconfigured ? 'loki_probe_unconfigured' : 'keycloak_insecure_cookie_probe_failed',
      unconfigured
        ? 'Der Loki-Nachweis fuer den sicheren Keycloak-Cookie-Kontext ist nicht konfiguriert.'
        : 'Der Loki-Nachweis fuer den sicheren Keycloak-Cookie-Kontext ist fehlgeschlagen.',
      summary,
    );
  }

  if (insecureContextLines.length > 0) {
    return deps.toDoctorCheck(
      'observability-readiness',
      'error',
      'keycloak_insecure_cookie_context',
      'Keycloak meldet einen unsicheren Cookie-Kontext hinter dem Reverse Proxy.',
      { matchesAtLeast: insecureContextLines.length, sampleLimit: 20, windowMinutes: LOKI_PROBE_WINDOW_MINUTES },
    );
  }

  try {
    const stackName = deps.getConfiguredStackName(env);
    const appService = resolveRemoteStackServiceName(stackName, deps.getRemoteAppServiceName(env));
    const lines = await queryRecentLokiLinesWithRetry(deps, env, `{swarm_stack="${stackName}",swarm_service="${appService}"} |= "observability_"`, { attempts: 3, delayMs: 2_000, limit: 50 });
    const readyLine = [...lines].reverse().find((line) => line.includes('observability_ready'));
    const degradedLine = [...lines].reverse().find((line) => line.includes('observability_degraded'));
    if (readyLine) return deps.toDoctorCheck('observability-readiness', 'ok', 'observability_ready', 'Ein frisches Observability-Ready-Event ist in Loki sichtbar.', { ...summary, sample: readyLine });
    if (degradedLine) return deps.toDoctorCheck('observability-readiness', 'warn', 'observability_degraded', 'Die App meldet einen degradierten Observability-Zustand in Loki.', { ...summary, sample: degradedLine });
    return deps.toDoctorCheck('observability-readiness', 'warn', 'observability_probe_empty', 'Es wurden keine frischen Observability-Ereignisse in Loki gefunden.', summary);
  } catch (error) {
    const code = error instanceof Error && error.message === 'loki_probe_unconfigured' ? 'loki_probe_unconfigured' : 'loki_probe_failed';
    return deps.toDoctorCheck('observability-readiness', 'warn', code, error instanceof Error ? error.message : String(error), summary);
  }
};

type TenantAuthRedirectProbeResult =
  | { failedCheck: DoctorCheck }
  | { probeResults: Array<{ authRealm: string; host: string; instanceId: string }>; source: TenantRuntimeTargetResolution['source'] };

const resolveTenantIssuerUrl = (
  tenantTarget: TenantRuntimeTargetResolution['targets'][number],
  env: NodeJS.ProcessEnv,
): URL | null => {
  const rawIssuerUrl = tenantTarget.authIssuerUrl
    ? tenantTarget.authIssuerUrl
    : env.KEYCLOAK_ADMIN_BASE_URL
      ? `${normalizeBaseUrl(env.KEYCLOAK_ADMIN_BASE_URL)}/realms/${tenantTarget.authRealm}`
      : env.SVA_AUTH_ISSUER;
  if (!rawIssuerUrl) return null;

  try {
    const issuerUrl = new URL(rawIssuerUrl);
    return issuerUrl.protocol === 'https:' &&
      issuerUrl.username.length === 0 &&
      issuerUrl.password.length === 0 &&
      issuerUrl.search.length === 0 &&
      issuerUrl.hash.length === 0
      ? issuerUrl
      : null;
  } catch {
    return null;
  }
};

const parseTenantAuthorizationUrl = (
  location: string,
  issuerUrl: URL,
): URL | null => {
  try {
    const authorizationUrl = new URL(location);
    const expectedPath = `${issuerUrl.pathname.replace(/\/+$/u, '')}/protocol/openid-connect/auth`;
    return authorizationUrl.protocol === 'https:'
      && authorizationUrl.username.length === 0
      && authorizationUrl.password.length === 0
      && authorizationUrl.origin === issuerUrl.origin
      && authorizationUrl.pathname === expectedPath
      && authorizationUrl.hash.length === 0
      ? authorizationUrl
      : null;
  } catch {
    return null;
  }
};

const probeTenantAuthRedirects = async (
  deps: RuntimeHealthDeps,
  env: NodeJS.ProcessEnv,
  tenantTargetResolution: TenantRuntimeTargetResolution,
): Promise<TenantAuthRedirectProbeResult> => {
  const baseProtocol = new URL(env.SVA_PUBLIC_BASE_URL ?? 'https://studio.smart-village.app').protocol;
  const probeResults: Array<{ authRealm: string; host: string; instanceId: string }> = [];
  for (const tenantTarget of tenantTargetResolution.targets.slice(0, 2)) {
    const issuerUrl = resolveTenantIssuerUrl(tenantTarget, env);
    if (!issuerUrl) {
      return { failedCheck: deps.toDoctorCheck('tenant-auth-proof', 'error', 'tenant_auth_redirect_failed', `Tenant-Login fuer ${tenantTarget.instanceId} besitzt keinen gueltigen vertrauenswuerdigen Issuer.`, { authRealm: tenantTarget.authRealm, host: tenantTarget.host, instanceId: tenantTarget.instanceId, source: tenantTargetResolution.source }) };
    }
    const target = `${baseProtocol}//${tenantTarget.host}/auth/login`;
    const response = await fetch(target, { redirect: 'manual', signal: AbortSignal.timeout(10_000) });
    const location = response.headers.get('location') ?? '';
    const authorizationUrl = response.status === 302
      ? parseTenantAuthorizationUrl(location, issuerUrl)
      : null;
    const expectedRedirectUri = `${baseProtocol}//${tenantTarget.host}/auth/callback`;
    if (!authorizationUrl || !isExpectedOidcRedirect(location, env, {
      clientId: tenantTarget.authClientId,
      issuerUrl: issuerUrl.href,
      redirectUri: expectedRedirectUri,
    })) {
      return { failedCheck: deps.toDoctorCheck('tenant-auth-proof', 'error', 'tenant_auth_redirect_failed', `Tenant-Login fuer ${tenantTarget.instanceId} liefert keinen korrekten Realm-Redirect.`, { authRealm: tenantTarget.authRealm, host: tenantTarget.host, instanceId: tenantTarget.instanceId, source: tenantTargetResolution.source, status: response.status }) };
    }
    try {
      const authorizationResponse = await fetch(authorizationUrl, {
        headers: { Accept: 'text/html' },
        redirect: 'manual',
        signal: AbortSignal.timeout(10_000),
      });
      if (!authorizationResponse.ok) {
        return { failedCheck: deps.toDoctorCheck('tenant-auth-proof', 'error', 'tenant_auth_authorization_failed', `Keycloak-Authorization fuer ${tenantTarget.instanceId} ist nicht erreichbar.`, { authRealm: tenantTarget.authRealm, host: tenantTarget.host, instanceId: tenantTarget.instanceId, source: tenantTargetResolution.source, status: authorizationResponse.status }) };
      }
    } catch {
      return { failedCheck: deps.toDoctorCheck('tenant-auth-proof', 'error', 'tenant_auth_authorization_failed', `Keycloak-Authorization fuer ${tenantTarget.instanceId} ist nicht erreichbar.`, { authRealm: tenantTarget.authRealm, host: tenantTarget.host, instanceId: tenantTarget.instanceId, source: tenantTargetResolution.source }) };
    }
    probeResults.push({ authRealm: tenantTarget.authRealm, host: tenantTarget.host, instanceId: tenantTarget.instanceId });
  }
  return { probeResults, source: tenantTargetResolution.source };
};

const buildTenantAuthProofCheck = async (
  deps: RuntimeHealthDeps,
  runtimeProfile: RemoteRuntimeProfile,
  env: NodeJS.ProcessEnv,
): Promise<DoctorCheck> => {
  const tenantTargetResolution = await deps.resolveTenantRuntimeTargets(runtimeProfile, env, { limit: 2 });
  if (tenantTargetResolution.targets.length === 0) {
    return deps.toDoctorCheck('tenant-auth-proof', 'skipped', 'tenant_auth_optional', 'Kein Tenant-Auth-Proof konfiguriert.', { source: tenantTargetResolution.source });
  }
  const redirectResult = await probeTenantAuthRedirects(deps, env, tenantTargetResolution);
  if ('failedCheck' in redirectResult) return redirectResult.failedCheck;

  try {
    const stackName = deps.getConfiguredStackName(env);
    const appService = resolveRemoteStackServiceName(stackName, deps.getRemoteAppServiceName(env));
    const missingEvidence: string[] = [];
    for (const probe of redirectResult.probeResults) {
      const query = `{swarm_stack="${stackName}",swarm_service="${appService}"} |= "tenant_auth_resolution_summary" |= "${probe.instanceId}"`;
      const lines = await queryRecentLokiLinesWithRetry(deps, env, query, { attempts: 3, delayMs: 2_000, limit: 20 });
      if (lines.length === 0) missingEvidence.push(probe.instanceId);
    }
    return missingEvidence.length > 0
      ? deps.toDoctorCheck('tenant-auth-proof', 'warn', 'tenant_auth_log_missing', 'Tenant-Redirects sind korrekt, aber Loki enthaelt noch nicht fuer alle Tenant-Probes die passenden Resolution-Logs.', { missingEvidence, probeResults: redirectResult.probeResults, source: redirectResult.source })
      : deps.toDoctorCheck('tenant-auth-proof', 'ok', 'tenant_auth_resolution_logged', 'Tenant-Redirects und zugehoerige Resolution-Logs sind vorhanden.', { probeResults: redirectResult.probeResults, source: redirectResult.source });
  } catch (error) {
    return deps.toDoctorCheck('tenant-auth-proof', 'warn', 'tenant_auth_log_probe_failed', error instanceof Error ? error.message : String(error), { probeResults: redirectResult.probeResults, source: redirectResult.source });
  }
};

const buildKeycloakClientSecretCheck = async (
  deps: RuntimeHealthDeps,
  runtimeProfile: RuntimeProfile,
  env: NodeJS.ProcessEnv,
): Promise<DoctorCheck> => {
  if (deps.isMockAuthRuntimeProfile(runtimeProfile)) {
    return deps.toDoctorCheck('keycloak-client-secrets', 'skipped', 'keycloak_client_secrets_not_applicable', 'Keycloak-Client-Secret-Pruefung ist fuer Mock-Auth-Profile nicht anwendbar.');
  }
  const probes = buildOidcClientSecretProbes(env);
  if (probes.length === 0) {
    return deps.toDoctorCheck('keycloak-client-secrets', 'warn', 'keycloak_client_secrets_unconfigured', 'Keine pruefbaren Keycloak-Client-Secrets fuer Runtime-Doctor gefunden.');
  }
  try {
    const results = await Promise.all(probes.map((probe) => probeOidcClientSecret(probe)));
    const clients = results.map((result) => ({ mode: result.mode, name: result.name, reason: result.reason, status: result.status }));
    return deps.toDoctorCheck('keycloak-client-secrets', 'ok', 'keycloak_client_secrets_verified', 'Alle pruefbaren Keycloak-Client-Secrets authentifizieren erfolgreich gegen den Token-Endpoint.', { clients });
  } catch (error) {
    return deps.toDoctorCheck('keycloak-client-secrets', 'error', 'keycloak_client_secret_check_failed', error instanceof Error ? error.message : String(error));
  }
};

export const createRuntimeHealthDoctorChecks = (deps: RuntimeHealthDeps) => ({
  buildKeycloakClientSecretCheck: (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) =>
    buildKeycloakClientSecretCheck(deps, runtimeProfile, env),
  buildLiveRuntimeEnvCheck: (runtimeProfile: RemoteRuntimeProfile, env: NodeJS.ProcessEnv) =>
    buildLiveRuntimeEnvCheck(deps, runtimeProfile, env),
  buildObservabilityDoctorCheck: (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) =>
    buildObservabilityDoctorCheck(deps, runtimeProfile, env),
  buildTenantAuthProofCheck: (runtimeProfile: RemoteRuntimeProfile, env: NodeJS.ProcessEnv) =>
    buildTenantAuthProofCheck(deps, runtimeProfile, env),
}) as const;
