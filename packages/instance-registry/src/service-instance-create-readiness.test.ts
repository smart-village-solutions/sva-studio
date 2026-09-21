import { describe, expect, it, vi } from 'vitest';
import { createProvisioningRequestHandler } from './service-instance-mutations.js';
import { createDraftReadinessHandler } from './service-draft-readiness.js';
import {
  buildExpectedClientConfig,
  buildExpectedTenantAdminClientConfig,
} from './provisioning-auth-utils.js';

const createInput = {
  idempotencyKey: 'idem-1',
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

const readableRealmState = {
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
};

describe('authoritative create readiness', () => {
  it('fails closed before persistence when the authoritative Keycloak reader is missing', async () => {
    const repository = {
      getInstanceById: vi.fn(async () => null),
      resolvePrimaryHostname: vi.fn(async () => null),
      createInstance: vi.fn(),
      createProvisioningRun: vi.fn(),
      appendAuditEvent: vi.fn(),
    };

    await expect(
      createProvisioningRequestHandler({ repository, invalidateHost: vi.fn() } as never)(
        createInput
      )
    ).rejects.toThrow('keycloak_create_readiness_blocked:keycloak_admin_access');

    expect(repository.createInstance).not.toHaveBeenCalled();
    expect(repository.createProvisioningRun).not.toHaveBeenCalled();
    expect(repository.appendAuditEvent).not.toHaveBeenCalled();
  });

  it('does not persist anything when current Keycloak access is blocked', async () => {
    const repository = {
      getInstanceById: vi.fn(async () => null),
      resolvePrimaryHostname: vi.fn(async () => null),
      createInstance: vi.fn(),
      createProvisioningRun: vi.fn(),
      appendAuditEvent: vi.fn(),
    };
    const create = createProvisioningRequestHandler({
      repository,
      invalidateHost: vi.fn(),
      readKeycloakStateViaProvisioner: vi.fn(async () => {
        throw new Error('HTTP 403 forbidden');
      }),
    } as never);

    await expect(create({ ...createInput, realmMode: 'new' })).rejects.toThrow(
      'keycloak_create_readiness_blocked:keycloak_admin_access'
    );

    expect(repository.createInstance).not.toHaveBeenCalled();
    expect(repository.createProvisioningRun).not.toHaveBeenCalled();
    expect(repository.appendAuditEvent).not.toHaveBeenCalled();
  });

  it('rechecks a stale UI preflight and rejects a concurrent realm assignment', async () => {
    const repository = {
      listInstances: vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ instanceId: 'other', authRealm: 'demo' }]),
      getInstanceById: vi.fn(async () => null),
      resolvePrimaryHostname: vi.fn(async () => null),
      createInstance: vi.fn(),
      createProvisioningRun: vi.fn(),
      appendAuditEvent: vi.fn(),
    };
    const deps = {
      repository,
      invalidateHost: vi.fn(),
      readKeycloakStateViaProvisioner: vi.fn(async () => readableRealmState),
    } as never;

    const advisoryReadiness = await createDraftReadinessHandler(deps)(createInput);
    expect(advisoryReadiness.createBlockers).toEqual([]);

    await expect(createProvisioningRequestHandler(deps)(createInput)).rejects.toThrow(
      'keycloak_create_readiness_blocked:realm_selection'
    );
    expect(repository.createInstance).not.toHaveBeenCalled();
    expect(repository.createProvisioningRun).not.toHaveBeenCalled();
    expect(repository.appendAuditEvent).not.toHaveBeenCalled();
  });
});
