import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildOidcClientSecretProbes,
  createRuntimeHealthOps,
  evaluateOidcClientSecretProbeResponse,
  resolveAcceptanceContainerServices,
} from './runtime-health.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('runtime-health helpers', () => {
  it('builds all configured oidc client-secret probes', () => {
    expect(
      buildOidcClientSecretProbes({
        KEYCLOAK_ADMIN_BASE_URL: 'https://keycloak.example/',
        KEYCLOAK_ADMIN_CLIENT_ID: 'iam-service',
        KEYCLOAK_ADMIN_CLIENT_SECRET: 'admin-secret',
        KEYCLOAK_ADMIN_REALM: 'master',
        KEYCLOAK_PROVISIONER_CLIENT_ID: 'provisioner',
        KEYCLOAK_PROVISIONER_CLIENT_SECRET: 'provisioner-secret',
        KEYCLOAK_PROVISIONER_REALM: 'provisioning',
        SVA_AUTH_CLIENT_ID: 'studio-bff',
        SVA_AUTH_CLIENT_SECRET: 'auth-secret',
        SVA_AUTH_ISSUER: 'https://keycloak.example/realms/platform',
      }),
    ).toEqual([
      {
        allowClientAuthOnly: true,
        clientId: 'studio-bff',
        clientSecret: 'auth-secret',
        issuerUrl: 'https://keycloak.example/realms/platform',
        name: 'auth-client',
      },
      {
        clientId: 'iam-service',
        clientSecret: 'admin-secret',
        issuerUrl: 'https://keycloak.example/realms/master',
        name: 'admin-client',
      },
      {
        clientId: 'provisioner',
        clientSecret: 'provisioner-secret',
        issuerUrl: 'https://keycloak.example/realms/provisioning',
        name: 'provisioner-client',
      },
    ]);
  });

  it('accepts unauthorized_client for auth-only probes', () => {
    expect(
      evaluateOidcClientSecretProbeResponse(
        {
          allowClientAuthOnly: true,
          clientId: 'studio-bff',
          clientSecret: 'auth-secret',
          issuerUrl: 'https://keycloak.example/realms/platform',
          name: 'auth-client',
        },
        { ok: false, status: 400 },
        {
          error: 'unauthorized_client',
          error_description: 'Client not enabled to retrieve service account',
        },
      ),
    ).toEqual({
      mode: 'authenticated',
      name: 'auth-client',
      reason: 'Client not enabled to retrieve service account',
      status: 'ok',
    });
  });

  it('rejects invalid client secrets', () => {
    expect(() =>
      evaluateOidcClientSecretProbeResponse(
        {
          clientId: 'iam-service',
          clientSecret: 'wrong-secret',
          issuerUrl: 'https://keycloak.example/realms/master',
          name: 'admin-client',
        },
        { ok: false, status: 401 },
        {
          error: 'invalid_client',
          error_description: 'Invalid client secret',
        },
      ),
    ).toThrow('admin-client: Client-Secret-Pruefung fehlgeschlagen (401 invalid_client: Invalid client secret).');
  });

  it('resolves remote container services based on otel mode', () => {
    expect(resolveAcceptanceContainerServices({})).toEqual(['app', 'redis', 'postgres', 'otel-collector']);
    expect(resolveAcceptanceContainerServices({ ENABLE_OTEL: 'false' })).toEqual(['app', 'redis', 'postgres']);
  });

  it('uses timeouts for login and me smoke requests', async () => {
    const fetchCalls: RequestInit[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
        fetchCalls.push(init ?? {});
        return fetchCalls.length === 1
          ? new Response(null, {
              headers: { location: 'https://issuer.example.test/protocol/openid-connect/auth' },
              status: 302,
            })
          : new Response(null, { status: 401 });
      }),
    );

    const ops = createRuntimeHealthOps({
      assertRuntimeEnv: vi.fn(),
      checkHttpHealth: vi.fn(),
      commandExists: vi.fn(),
      getConfiguredQuantumEndpoint: vi.fn(),
      getConfiguredStackName: vi.fn(),
      getRemoteAppServiceName: vi.fn(),
      getRuntimeProfileDefinition: vi.fn(() => ({ isLocal: true })),
      inspectRemoteServiceContract: vi.fn(),
      isExpectedOidcRedirect: vi.fn(() => true),
      isMainserverCheckRequired: vi.fn(() => false),
      isMockAuthRuntimeProfile: vi.fn(() => false),
      readRemoteStackEvidence: vi.fn(),
      resolveTenantRuntimeTargets: vi.fn(),
      runCapture: vi.fn(),
      runSchemaGuard: vi.fn(),
      summarizeSchemaGuardFailures: vi.fn(),
      toDoctorCheck: vi.fn(),
      wait: vi.fn(),
      waitForRemoteSmokeWarmup: vi.fn(),
      withoutDebugEnv: vi.fn(),
    });

    await ops.assertLoginFlow('studio', { SVA_AUTH_ISSUER: 'https://issuer.example.test' });
    await ops.assertMeEndpoint('studio', {});

    expect(fetchCalls).toHaveLength(2);
    expect(fetchCalls[0]?.signal).toBeInstanceOf(AbortSignal);
    expect(fetchCalls[1]?.signal).toBeInstanceOf(AbortSignal);
  });
});
