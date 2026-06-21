import type { RuntimeProfile } from '../../../packages/core/src/runtime-profile.ts';
import { resolveAcceptanceContainerServices, resolveRemoteShortServiceName, resolveRemoteStackServiceName } from './runtime-health-helpers.ts';
import type { RuntimeHealthDeps } from './runtime-health.types.ts';

const baseUrl = (env: NodeJS.ProcessEnv) => env.SVA_PUBLIC_BASE_URL ?? 'http://localhost:3000';
const httpTimeoutSignal = (timeoutMs: number) => AbortSignal.timeout(timeoutMs);

const assertLoginFlow = async (deps: RuntimeHealthDeps, runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => {
  const loginUrl = new URL('/auth/login', baseUrl(env)).toString();
  const response = await fetch(loginUrl, { redirect: 'manual', signal: httpTimeoutSignal(10_000) });
  const location = response.headers.get('location') ?? '';

  if (runtimeProfile === 'local-builder') {
    if (location !== '/?auth=mock-login') throw new Error(`Builder-Mock-Login unerwartet: ${location}`);
    return;
  }

  if (response.status !== 302 || !deps.isExpectedOidcRedirect(location, env)) {
    throw new Error(`OIDC-Login redirect stimmt nicht. Erhalten Status ${response.status} mit Location ${location}`);
  }
};

const assertMeEndpoint = async (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => {
  const meUrl = new URL('/auth/me', baseUrl(env)).toString();
  const response = await fetch(meUrl, { redirect: 'manual', signal: httpTimeoutSignal(10_000) });

  if (runtimeProfile === 'local-builder') {
    if (!response.ok) throw new Error(`/auth/me fuer ${runtimeProfile} antwortet mit ${response.status}`);
    const payload = (await response.json()) as { user?: { name?: string } };
    if (payload.user?.name !== (env.SVA_MOCK_AUTH_USER_NAME ?? 'Builder Mock User')) {
      throw new Error(`Mock-User stimmt nicht: ${JSON.stringify(payload)}`);
    }
    return;
  }

  if (response.status !== 401) throw new Error(`/auth/me ohne Session sollte 401 liefern, erhielt ${response.status}`);
};

const assertIamContextEndpoint = async (env: NodeJS.ProcessEnv) => {
  const contextUrl = new URL('/api/v1/iam/me/context', baseUrl(env)).toString();
  const response = await fetch(contextUrl, { redirect: 'manual', signal: AbortSignal.timeout(10_000) });
  const body = await response.text();

  if (![200, 401, 403].includes(response.status)) {
    throw new Error(`/api/v1/iam/me/context antwortet unerwartet mit ${response.status}`);
  }
  if (body.toLowerCase().includes('<html')) {
    throw new Error('/api/v1/iam/me/context lieferte HTML statt einer API-Antwort.');
  }
};

const assertMainserverSmoke = async (env: NodeJS.ProcessEnv) => {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: env.SVA_MAINSERVER_CLIENT_ID ?? '',
    client_secret: env.SVA_MAINSERVER_CLIENT_SECRET ?? '',
  });
  const tokenResponse = await fetch(env.SVA_MAINSERVER_OAUTH_TOKEN_URL ?? '', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(10_000),
  });
  if (!tokenResponse.ok) throw new Error(`Mainserver OAuth fehlgeschlagen: ${tokenResponse.status}`);

  const tokenPayload = (await tokenResponse.json()) as { access_token?: string };
  if (!tokenPayload.access_token) throw new Error('Mainserver OAuth liefert kein access_token.');

  const graphqlResponse = await fetch(env.SVA_MAINSERVER_GRAPHQL_URL ?? '', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenPayload.access_token}` },
    body: JSON.stringify({ query: '{ __typename }' }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!graphqlResponse.ok) throw new Error(`Mainserver GraphQL fehlgeschlagen: ${graphqlResponse.status}`);

  const graphqlPayload = (await graphqlResponse.json()) as { errors?: unknown[] };
  if (Array.isArray(graphqlPayload.errors) && graphqlPayload.errors.length > 0) {
    throw new Error(`Mainserver GraphQL antwortete mit Fehlern: ${JSON.stringify(graphqlPayload.errors)}`);
  }
};

const assertOtelLocal = async (env: NodeJS.ProcessEnv) => {
  if (env.SVA_ENABLE_MONITORING === 'false') return;

  const candidates = [
    { name: 'collector-health', url: 'http://127.0.0.1:13133/healthz', rejectStatus: (status: number) => status < 200 || status >= 300 },
    { name: 'otlp-endpoint', url: env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://127.0.0.1:4318', rejectStatus: (status: number) => status >= 500 },
  ] as const;
  let lastError: unknown = new Error('OTEL Collector nicht erreichbar.');

  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate.url, { signal: AbortSignal.timeout(5_000) });
      if (candidate.rejectStatus(response.status)) throw new Error(`OTEL Endpoint antwortet mit ${response.status}`);
      return;
    } catch (error) {
      lastError = new Error(`${candidate.name} fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  }

  throw lastError;
};

const assertRemoteEvidenceHasServices = async (deps: RuntimeHealthDeps, env: NodeJS.ProcessEnv, services: readonly string[]) => {
  const evidence = await deps.readRemoteStackEvidence(env);
  for (const service of services) {
    if (!evidence.hasRunningService(service)) throw new Error(`Remote-Service fuer ${service} nicht gefunden.`);
  }
};

const assertAcceptanceContainerHealth = async (deps: RuntimeHealthDeps, env: NodeJS.ProcessEnv) => {
  const stackName = deps.getConfiguredStackName(env);
  const appServiceName = resolveRemoteShortServiceName(stackName, deps.getRemoteAppServiceName(env));
  const services = resolveAcceptanceContainerServices(env, appServiceName);

  try {
    await assertRemoteEvidenceHasServices(deps, env, services);
    return;
  } catch {
    // Fallbacks below keep local emergency checks usable without Portainer evidence.
  }

  if (deps.commandExists('quantum-cli')) {
    const quantumEndpoint = deps.getConfiguredQuantumEndpoint(env);
    const summary = deps.runCapture('quantum-cli', ['ps', '--endpoint', quantumEndpoint, '--stack', stackName, '--all'], deps.withoutDebugEnv(env));
    for (const service of services) if (!summary.includes(service)) throw new Error(`Remote-Service fuer ${service} nicht gefunden.`);
    return;
  }

  for (const service of services) {
    const output = deps.runCapture('docker', ['ps', '--filter', `name=${resolveRemoteStackServiceName(stackName, service)}`, '--format', '{{.Status}}'], env);
    if (output.length === 0) throw new Error(`Container fuer ${service} nicht gefunden.`);
  }
};

const assertBasicHealth = async (deps: RuntimeHealthDeps, env: NodeJS.ProcessEnv) => {
  const live = await deps.checkHttpHealth(new URL('/health/live', baseUrl(env)).toString());
  if (!live.response.ok) throw new Error(`Live-Healthcheck fehlgeschlagen: ${live.response.status}`);

  const ready = await deps.checkHttpHealth(new URL('/health/ready', baseUrl(env)).toString());
  if (!ready.response.ok) throw new Error(`Ready-Healthcheck fehlgeschlagen: ${ready.response.status} ${JSON.stringify(ready.payload)}`);
};

const smokeRuntime = async (deps: RuntimeHealthDeps, runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => {
  deps.assertRuntimeEnv(runtimeProfile, env);
  const isLocalProfile = deps.getRuntimeProfileDefinition(runtimeProfile).isLocal;
  if (!isLocalProfile) await deps.waitForRemoteSmokeWarmup(env, { runtimeProfile });

  await assertBasicHealth(deps, env);
  await assertLoginFlow(deps, runtimeProfile, env);
  await assertMeEndpoint(runtimeProfile, env);
  await assertIamContextEndpoint(env);
  if (deps.isMainserverCheckRequired(runtimeProfile, env)) await assertMainserverSmoke(env);
  if (isLocalProfile) await assertOtelLocal(env);
  else await assertAcceptanceContainerHealth(deps, env);

  const schemaGuard = deps.runSchemaGuard(runtimeProfile, env);
  if (!schemaGuard.ok) throw new Error(`Kritische IAM-Schema-Drift erkannt: ${deps.summarizeSchemaGuardFailures(schemaGuard)}`);
};

export const createRuntimeHealthSmokeOps = (deps: RuntimeHealthDeps) => ({
  assertAcceptanceContainerHealth: (env: NodeJS.ProcessEnv) => assertAcceptanceContainerHealth(deps, env),
  assertIamContextEndpoint,
  assertLoginFlow: (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => assertLoginFlow(deps, runtimeProfile, env),
  assertMainserverSmoke,
  assertMeEndpoint,
  assertOtelLocal,
  smokeRuntime: (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => smokeRuntime(deps, runtimeProfile, env),
}) as const;
