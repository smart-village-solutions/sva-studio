import type { RuntimeProfile } from '../../../packages/core/src/runtime-profile.ts';
import { normalizeBaseUrl, readJsonResponse, resolveAcceptanceContainerServices } from './runtime-health-helpers.ts';
import type { OidcClientSecretProbe, RuntimeHealthDeps } from './runtime-health.types.ts';

export const createRuntimeHealthSmokeOps = (deps: RuntimeHealthDeps) => {
  const assertLoginFlow = async (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => {
    const loginUrl = new URL('/auth/login', env.SVA_PUBLIC_BASE_URL ?? 'http://localhost:3000').toString();
    const response = await fetch(loginUrl, { redirect: 'manual' });
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
    const meUrl = new URL('/auth/me', env.SVA_PUBLIC_BASE_URL ?? 'http://localhost:3000').toString();
    const response = await fetch(meUrl, { redirect: 'manual' });
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
    const contextUrl = new URL('/api/v1/iam/me/context', env.SVA_PUBLIC_BASE_URL ?? 'http://localhost:3000').toString();
    const response = await fetch(contextUrl, { redirect: 'manual', signal: AbortSignal.timeout(10_000) });
    const body = await response.text();
    if ([200, 401, 403].includes(response.status)) {
      if (body.toLowerCase().includes('<html')) throw new Error('/api/v1/iam/me/context lieferte HTML statt einer API-Antwort.');
      return;
    }
    throw new Error(`/api/v1/iam/me/context antwortet unerwartet mit ${response.status}`);
  };

  const assertMainserverSmoke = async (env: NodeJS.ProcessEnv) => {
    const body = new URLSearchParams({ grant_type: 'client_credentials', client_id: env.SVA_MAINSERVER_CLIENT_ID ?? '', client_secret: env.SVA_MAINSERVER_CLIENT_SECRET ?? '' });
    const tokenResponse = await fetch(env.SVA_MAINSERVER_OAUTH_TOKEN_URL ?? '', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body, signal: AbortSignal.timeout(10_000) });
    if (!tokenResponse.ok) throw new Error(`Mainserver OAuth fehlgeschlagen: ${tokenResponse.status}`);
    const tokenPayload = (await tokenResponse.json()) as { access_token?: string };
    if (!tokenPayload.access_token) throw new Error('Mainserver OAuth liefert kein access_token.');
    const graphqlResponse = await fetch(env.SVA_MAINSERVER_GRAPHQL_URL ?? '', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenPayload.access_token}` }, body: JSON.stringify({ query: '{ __typename }' }), signal: AbortSignal.timeout(10_000) });
    if (!graphqlResponse.ok) throw new Error(`Mainserver GraphQL fehlgeschlagen: ${graphqlResponse.status}`);
    const graphqlPayload = (await graphqlResponse.json()) as { errors?: unknown[] };
    if (Array.isArray(graphqlPayload.errors) && graphqlPayload.errors.length > 0) {
      throw new Error(`Mainserver GraphQL antwortete mit Fehlern: ${JSON.stringify(graphqlPayload.errors)}`);
    }
  };

  const assertOtelLocal = async (env: NodeJS.ProcessEnv) => {
    if (env.SVA_ENABLE_MONITORING === 'false') return;
    const healthCandidates = [
      { name: 'collector-health', url: 'http://127.0.0.1:13133/healthz', validate: (response: Response) => { if (!response.ok) throw new Error(`OTEL Collector Healthcheck fehlgeschlagen: ${response.status}`); } },
      { name: 'otlp-endpoint', url: env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://127.0.0.1:4318', validate: (response: Response) => { if (response.status >= 500) throw new Error(`OTEL Endpoint antwortet mit ${response.status}`); } },
    ] as const;
    let lastError: unknown = new Error('OTEL Collector nicht erreichbar.');
    for (const candidate of healthCandidates) {
      try {
        const response = await fetch(candidate.url, { signal: AbortSignal.timeout(5_000) });
        candidate.validate(response);
        return;
      } catch (error) {
        lastError = new Error(`${candidate.name} fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
      }
    }
    throw lastError;
  };

  const assertAcceptanceContainerHealth = async (env: NodeJS.ProcessEnv) => {
    const stackName = deps.getConfiguredStackName(env);
    const services = resolveAcceptanceContainerServices(env);
    try {
      const evidence = await deps.readRemoteStackEvidence(env);
      for (const service of services) if (!evidence.hasRunningService(service)) throw new Error(`Remote-Service fuer ${service} nicht gefunden.`);
      return;
    } catch {
      // fallback below
    }
    if (deps.commandExists('quantum-cli')) {
      const quantumEndpoint = deps.getConfiguredQuantumEndpoint(env);
      const summary = deps.runCapture('quantum-cli', ['ps', '--endpoint', quantumEndpoint, '--stack', stackName, '--all'], deps.withoutDebugEnv(env));
      for (const service of services) if (!summary.includes(service)) throw new Error(`Remote-Service fuer ${service} nicht gefunden.`);
      return;
    }
    for (const service of services) {
      const output = deps.runCapture('docker', ['ps', '--filter', `name=${stackName}_${service}`, '--format', '{{.Status}}'], env);
      if (output.length === 0) throw new Error(`Container fuer ${service} nicht gefunden.`);
    }
  };

  const smokeRuntime = async (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => {
    deps.assertRuntimeEnv(runtimeProfile, env);
    if (!deps.getRuntimeProfileDefinition(runtimeProfile).isLocal) await deps.waitForRemoteSmokeWarmup(env, { runtimeProfile });
    const live = await deps.checkHttpHealth(new URL('/health/live', env.SVA_PUBLIC_BASE_URL ?? 'http://localhost:3000').toString());
    if (!live.response.ok) throw new Error(`Live-Healthcheck fehlgeschlagen: ${live.response.status}`);
    const ready = await deps.checkHttpHealth(new URL('/health/ready', env.SVA_PUBLIC_BASE_URL ?? 'http://localhost:3000').toString());
    if (!ready.response.ok) throw new Error(`Ready-Healthcheck fehlgeschlagen: ${ready.response.status} ${JSON.stringify(ready.payload)}`);
    await assertLoginFlow(runtimeProfile, env);
    await assertMeEndpoint(runtimeProfile, env);
    await assertIamContextEndpoint(env);
    if (deps.isMainserverCheckRequired(runtimeProfile, env)) await assertMainserverSmoke(env);
    if (deps.getRuntimeProfileDefinition(runtimeProfile).isLocal) await assertOtelLocal(env);
    else await assertAcceptanceContainerHealth(env);
    const schemaGuard = deps.runSchemaGuard(runtimeProfile, env);
    if (!schemaGuard.ok) throw new Error(`Kritische IAM-Schema-Drift erkannt: ${deps.summarizeSchemaGuardFailures(schemaGuard)}`);
  };

  return { assertAcceptanceContainerHealth, assertIamContextEndpoint, assertLoginFlow, assertMainserverSmoke, assertMeEndpoint, assertOtelLocal, smokeRuntime } as const;
};
