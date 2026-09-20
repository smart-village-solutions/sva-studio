import { describe, expect, it, vi } from 'vitest';

import { createDraftReadinessHandler } from './service-draft-readiness.js';
import {
  buildExpectedClientConfig,
  buildExpectedTenantAdminClientConfig,
} from './provisioning-auth-utils.js';

const input = {
  idempotencyKey: 'draft-readiness-test',
  instanceId: 'demo',
  displayName: 'Demo',
  parentDomain: 'studio.example.org',
  realmMode: 'existing' as const,
  authRealm: 'demo',
  authClientId: 'sva-studio-login',
  tenantAdminClient: { clientId: 'sva-studio-tenant-admin' },
  tenantAdminBootstrap: {
    username: 'admin',
    email: 'admin@example.org',
    firstName: 'Admin',
    lastName: 'Demo',
  },
};

const readState = (overrides: Record<string, unknown> = {}) => ({
  realm: { realm: 'demo' },
  client: {},
  expectedClient: buildExpectedClientConfig('demo.studio.example.org'),
  expectedTenantAdminClient: buildExpectedTenantAdminClientConfig('demo.studio.example.org'),
  clientRepresentation: null,
  tenantAdminClientRepresentation: null,
  pluginOidcClients: [],
  protocolMappers: [],
  tenantAdminStatus: { tenantAdminExists: false, tenantAdminHasSystemAdmin: false },
  tenantAdminRepresentation: null,
  keycloakClientSecret: null,
  tenantAdminClientSecret: null,
  systemAdminRole: null,
  ...overrides,
});

const createRepository = (overrides: Record<string, unknown> = {}) => ({
  getInstanceById: vi.fn(async () => null),
  resolvePrimaryHostname: vi.fn(async () => null),
  listInstances: vi.fn(async () => []),
  ...overrides,
});

describe('draft readiness', () => {
  it('keeps an absent imported-realm secret out of create blockers', async () => {
    const readiness = await createDraftReadinessHandler({
      readKeycloakStateViaProvisioner: vi.fn(async () => readState()),
      repository: createRepository(),
    } as never)(input);

    expect(readiness.createBlockers).toEqual([]);
    expect(readiness.provisioningBlockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ checkKey: 'tenant_secret', status: 'warning' }),
      ])
    );
    expect(readiness.realmSuitability).toMatchObject({
      classification: 'auto_completable',
      reasonCode: 'studio_artifacts_missing_or_drifted',
      nextCheck: 'draft_readiness',
    });
    expect(readiness.draftFingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects master and a realm assigned to another instance', async () => {
    const readKeycloakStateViaProvisioner = vi.fn(async () =>
      readState({ realm: { realm: 'master' } })
    );
    const master = await createDraftReadinessHandler({
      readKeycloakStateViaProvisioner,
      repository: createRepository(),
    } as never)({ ...input, authRealm: 'master' });
    const assigned = await createDraftReadinessHandler({
      readKeycloakStateViaProvisioner,
      repository: createRepository({
        listInstances: vi.fn(async () => [{ instanceId: 'other', authRealm: 'demo' }]),
      }),
    } as never)(input);

    expect(master.createBlockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkKey: 'realm_selection',
          details: { reasonCode: 'system_realm' },
        }),
      ])
    );
    expect(assigned.createBlockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkKey: 'realm_selection',
          details: expect.objectContaining({ reasonCode: 'already_assigned' }),
        }),
      ])
    );
  });

  it('reports existing instance ids and primary hostnames as create blockers', async () => {
    const readiness = await createDraftReadinessHandler({
      readKeycloakStateViaProvisioner: vi.fn(async () => readState()),
      repository: createRepository({
        getInstanceById: vi.fn(async () => ({ instanceId: 'demo' })),
        resolvePrimaryHostname: vi.fn(async () => ({ instanceId: 'other' })),
      }),
    } as never)(input);

    expect(readiness.createBlockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkKey: 'registry_instance_id',
          details: expect.objectContaining({ reasonCode: 'instance_id_already_exists' }),
        }),
        expect.objectContaining({
          checkKey: 'registry_hostname',
          details: expect.objectContaining({ reasonCode: 'primary_hostname_already_exists' }),
        }),
      ])
    );
  });

  it('requires manual resolution for an unowned same-named client', async () => {
    const readiness = await createDraftReadinessHandler({
      readKeycloakStateViaProvisioner: vi.fn(async () =>
        readState({
          clientRepresentation: {
            id: 'foreign-client',
            clientId: 'sva-studio-login',
            redirectUris: [],
            webOrigins: [],
            attributes: {},
          },
        })
      ),
      repository: createRepository(),
    } as never)(input);

    expect(readiness.createBlockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkKey: 'realm_ownership',
          details: expect.objectContaining({ reasonCode: 'artifact_ownership_conflict' }),
        }),
      ])
    );
    expect(readiness.realmSuitability).toMatchObject({
      classification: 'manual_resolution_required',
      reasonCode: 'artifact_ownership_conflict',
      impact: 'create',
      responsibility: 'platform_operator',
    });
  });

  it('redacts provider error messages from readiness details', async () => {
    const error = Object.assign(new Error('realm secret leaked'), { statusCode: 403 });
    const readiness = await createDraftReadinessHandler({
      readKeycloakStateViaProvisioner: vi.fn(async () => {
        throw error;
      }),
      repository: createRepository(),
    } as never)(input);

    expect(JSON.stringify(readiness)).not.toContain('realm secret leaked');
    expect(readiness.createBlockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkKey: 'keycloak_admin_access',
          details: { error: 'keycloak_authorization_failed' },
        }),
      ])
    );
  });

  it.each([
    [{ statusCode: 401, code: 'provider-secret-code' }, 'keycloak_authentication_failed'],
    [{ statusCode: 403, code: 'provider-secret-code' }, 'keycloak_authorization_failed'],
    [{ name: 'AbortError', code: 'provider-secret-code' }, 'keycloak_timeout'],
    [{ name: 'KeycloakAdminUnavailableError' }, 'keycloak_unavailable'],
    [{ code: 'keycloak_circuit_open' }, 'keycloak_circuit_open'],
    [{ code: 'provider-secret-code' }, 'keycloak_readiness_unavailable'],
  ] as const)('maps Keycloak access failures to safe codes: %j', async (shape, expectedCode) => {
    const providerError = Object.assign(new Error('provider secret detail'), shape);
    const readiness = await createDraftReadinessHandler({
      readKeycloakStateViaProvisioner: vi.fn(async () => {
        throw providerError;
      }),
      repository: createRepository(),
    } as never)(input);

    expect(readiness.createBlockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkKey: 'keycloak_admin_access',
          details: { error: expectedCode },
        }),
      ])
    );
    expect(JSON.stringify(readiness)).not.toContain('provider secret');
    expect(JSON.stringify(readiness)).not.toContain('provider-secret-code');
  });

  it('blocks a colliding new realm without mutating Keycloak', async () => {
    const stateReader = vi.fn(async () => readState({ realm: { realm: 'demo' } }));
    const readiness = await createDraftReadinessHandler({
      readKeycloakStateViaProvisioner: stateReader,
      readKeycloakRealmCreateCapability: vi.fn(async () => true),
      repository: createRepository(),
    } as never)({ ...input, realmMode: 'new' });

    expect(readiness.createBlockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ checkKey: 'realm_mode', status: 'blocked' }),
      ])
    );
    expect(stateReader).toHaveBeenCalledOnce();
  });

  it('requires an explicit non-mutating realm-create capability for new realms', async () => {
    const newRealmInput = { ...input, realmMode: 'new' as const };
    const repository = createRepository();
    const stateReader = vi.fn(async () => readState({ realm: null }));
    const denied = await createDraftReadinessHandler({
      readKeycloakStateViaProvisioner: stateReader,
      readKeycloakRealmCreateCapability: vi.fn(async () => false),
      repository,
    } as never)(newRealmInput);
    const allowed = await createDraftReadinessHandler({
      readKeycloakStateViaProvisioner: stateReader,
      readKeycloakRealmCreateCapability: vi.fn(async () => true),
      repository,
    } as never)(newRealmInput);

    expect(denied.createBlockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ checkKey: 'realm_create_capability', status: 'blocked' }),
      ])
    );
    expect(allowed.createBlockers).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ checkKey: 'realm_create_capability', status: 'blocked' }),
      ])
    );
    expect(stateReader).toHaveBeenCalledTimes(2);
  });

  it('fails closed when no Keycloak reader is configured', async () => {
    const readiness = await createDraftReadinessHandler({} as never)(input);

    expect(readiness.createBlockers).toEqual(
      expect.arrayContaining([expect.objectContaining({ checkKey: 'keycloak_admin_access' })])
    );
    expect(readiness.backgroundCapabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ capability: 'queue', status: 'ready' }),
        expect.objectContaining({ capability: 'worker', status: 'unknown' }),
        expect.objectContaining({ capability: 'callback', status: 'unknown' }),
        expect.objectContaining({ capability: 'provisioner', status: 'unknown' }),
      ])
    );
  });

  it('projects profile-specific ingress and plugin capabilities without blocking create', async () => {
    const readiness = await createDraftReadinessHandler({
      readKeycloakStateViaProvisioner: vi.fn(async () => readState()),
      repository: createRepository(),
      isAutomatedTenantProvisioningEnabled: vi.fn(() => true),
      publishTenantIngress: vi.fn(),
      probeTenantEndpoint: vi.fn(),
      pluginTenantLifecycleRegistry: new Map(),
      provisionInstanceAuth: vi.fn(),
    } as never)(input);

    expect(readiness.createBlockers).toEqual([]);
    expect(readiness.backgroundCapabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ capability: 'ingress', status: 'ready' }),
        expect.objectContaining({ capability: 'plugin', status: 'ready' }),
        expect.objectContaining({ capability: 'provisioner', status: 'ready' }),
      ])
    );
  });
});
