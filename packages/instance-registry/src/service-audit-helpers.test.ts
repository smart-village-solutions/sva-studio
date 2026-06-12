import { describe, expect, it, vi } from 'vitest';

import { buildKeycloakChecks, resolveKeycloakStatus } from './service-audit-keycloak.js';
import { probeInstanceUrlReachability } from './service-audit-registry.js';
import { aggregateStatuses } from './service-audit-shared.js';
import { createRunInstanceAuditHandler } from './service-audit.js';
import type { InstanceRegistryServiceDeps } from './service-types.js';
import type { InstanceRegistryRepository } from '@sva/data-repositories';

const createRepository = (overrides: Partial<InstanceRegistryRepository> = {}): InstanceRegistryRepository =>
  ({
    getInstanceById: vi.fn(async () => null),
    listInstances: vi.fn(async () => []),
    listKeycloakProvisioningRuns: vi.fn(async () => []),
    getKeycloakProvisioningRun: vi.fn(async () => null),
    countLocalSystemAdminAssignments: vi.fn(async () => 0),
    getAuthClientSecretCiphertext: vi.fn(async () => null),
    getTenantAdminClientSecretCiphertext: vi.fn(async () => null),
    ...overrides,
  }) as InstanceRegistryRepository;

const createDeps = (repository: InstanceRegistryRepository, overrides: Partial<InstanceRegistryServiceDeps> = {}) =>
  ({
    repository,
    revealSecret: vi.fn(async (value: string | null) => value ?? undefined),
    protectSecret: vi.fn(),
    invalidateHost: vi.fn(),
    invalidatePermissionSnapshots: vi.fn(),
    loadWasteDataSourceRecord: vi.fn(),
    saveWasteDataSourceRecord: vi.fn(),
    moduleIamRegistry: new Map(),
    ...overrides,
  }) as unknown as InstanceRegistryServiceDeps;

describe('service-audit helpers', () => {
  const baseKeycloakStatus = {
    realmExists: true,
    clientExists: true,
    tenantAdminClientExists: true,
    tenantAdminExists: true,
    tenantAdminHasSystemAdmin: true,
    systemAdminRoleExists: true,
    redirectUrisMatch: true,
    logoutUrisMatch: true,
    webOriginsMatch: true,
    clientSecretConfigured: true,
    tenantClientSecretReadable: true,
    clientSecretAligned: true,
    tenantAdminClientSecretConfigured: true,
    tenantAdminClientSecretReadable: true,
    tenantAdminClientSecretAligned: true,
    runtimeSecretSource: 'tenant' as const,
  };

  it('aggregates pass, warn, fail and skip statuses deterministically', () => {
    expect(aggregateStatuses(['pass'])).toBe('pass');
    expect(aggregateStatuses(['warn'])).toBe('warn');
    expect(aggregateStatuses(['skip'])).toBe('skip');
    expect(aggregateStatuses(['pass', 'fail'])).toBe('fail');
  });

  it('reports fetch transport failures for instance url probes', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('network');
    }) as typeof fetch);

    const result = await probeInstanceUrlReachability('demo.example.org');

    expect(result.status).toBe('fail');
    expect(result.actual).toBe('TypeError');

    vi.unstubAllGlobals();
  });

  it('returns registry evidence when no secret-backed instance can be loaded', async () => {
    const repository = createRepository();

    const result = await resolveKeycloakStatus(createDeps(repository), 'missing');

    expect(result).toEqual({
      status: null,
      evidenceSource: 'instance_registry',
    });
  });

  it('falls back to the snapshot handler when no live keycloak reader exists', async () => {
    const repository = createRepository({
      getInstanceById: vi.fn(async () => ({
        instanceId: 'demo',
        primaryHostname: 'demo.example.org',
        realmMode: 'existing',
        authRealm: 'demo',
        authClientId: 'sva-studio',
        authIssuerUrl: 'https://auth.example.org/realms/demo',
        authClientSecretConfigured: false,
        tenantAdminClient: { clientId: 'tenant-admin', secretConfigured: false },
        tenantAdminBootstrap: { username: 'tenant-admin' },
      })),
    });

    const result = await resolveKeycloakStatus(createDeps(repository), 'demo');

    expect(result.evidenceSource).toBe('keycloak_snapshot');
    expect(result.status).toBeTruthy();
  });

  it('captures live keycloak access failures and exposes the snapshot fallback separately', async () => {
    const repository = createRepository({
      getInstanceById: vi.fn(async () => ({
        instanceId: 'demo',
        primaryHostname: 'demo.example.org',
        realmMode: 'existing',
        authRealm: 'demo',
        authClientId: 'sva-studio',
        authIssuerUrl: 'https://auth.example.org/realms/demo',
        authClientSecretConfigured: false,
        tenantAdminClient: { clientId: 'tenant-admin', secretConfigured: false },
        tenantAdminBootstrap: { username: 'tenant-admin' },
      })),
      listKeycloakProvisioningRuns: vi.fn(async () => []),
    });

    const result = await resolveKeycloakStatus(
      createDeps(repository, {
        getKeycloakStatus: vi.fn(async () => {
          throw new Error('HTTP 403 Forbidden');
        }),
      }),
      'demo',
    );

    expect(result).toMatchObject({
      status: null,
      evidenceSource: 'keycloak_live',
      error: 'HTTP 403 Forbidden',
      fallbackEvidenceSource: 'keycloak_snapshot',
    });
    expect(result.fallbackStatus).toBeTruthy();
  });

  it('reports separate fallback errors when live and snapshot keycloak reads both fail', async () => {
    const repository = createRepository({
      getInstanceById: vi.fn(async () => ({
        instanceId: 'demo',
        primaryHostname: 'demo.example.org',
        realmMode: 'existing',
        authRealm: 'demo',
        authClientId: 'sva-studio',
        authIssuerUrl: 'https://auth.example.org/realms/demo',
        authClientSecretConfigured: false,
        tenantAdminClient: { clientId: 'tenant-admin', secretConfigured: false },
        tenantAdminBootstrap: { username: 'tenant-admin' },
      })),
      listKeycloakProvisioningRuns: vi.fn(async () => {
        throw new Error('snapshot unavailable');
      }),
    });

    const result = await resolveKeycloakStatus(
      createDeps(repository, {
        getKeycloakStatus: vi.fn(async () => {
          throw new Error('HTTP 403 Forbidden');
        }),
      }),
      'demo',
    );

    expect(result).toMatchObject({
      status: null,
      evidenceSource: 'keycloak_live',
      error: 'HTTP 403 Forbidden',
      fallbackEvidenceSource: 'keycloak_snapshot',
      fallbackError: 'snapshot unavailable',
    });
    expect(result.fallbackStatus).toBeUndefined();
  });

  it('prefers live keycloak evidence when a direct reader is available', async () => {
    const liveStatus = {
      realmExists: true,
      clientExists: true,
      tenantAdminClientExists: true,
      systemAdminRoleExists: true,
      tenantAdminExists: true,
      tenantAdminHasSystemAdmin: true,
      redirectUrisMatch: true,
      logoutUrisMatch: true,
      webOriginsMatch: true,
      clientSecretConfigured: true,
      tenantClientSecretReadable: true,
      clientSecretAligned: true,
      tenantAdminClientSecretConfigured: true,
      tenantAdminClientSecretReadable: true,
      tenantAdminClientSecretAligned: true,
      runtimeSecretSource: 'tenant' as const,
    };
    const repository = createRepository({
      getInstanceById: vi.fn(async () => ({
        instanceId: 'demo',
        primaryHostname: 'demo.example.org',
        realmMode: 'existing',
        authRealm: 'demo',
        authClientId: 'sva-studio',
        authIssuerUrl: 'https://auth.example.org/realms/demo',
        authClientSecretConfigured: true,
        tenantAdminClient: { clientId: 'tenant-admin', secretConfigured: true },
        tenantAdminBootstrap: { username: 'tenant-admin' },
      })),
    });

    const result = await resolveKeycloakStatus(
      createDeps(repository, {
        getKeycloakStatus: vi.fn(async () => liveStatus),
      }),
      'demo',
    );

    expect(result).toEqual({
      status: liveStatus,
      evidenceSource: 'keycloak_live',
    });
  });

  it('returns realm-only checks when the keycloak status says the realm is missing', () => {
    const checks = buildKeycloakChecks({
      keycloakEvidenceSource: 'keycloak_live',
      keycloakStatus: {
        realmExists: false,
        clientExists: false,
        tenantAdminClientExists: false,
        systemAdminRoleExists: false,
        tenantAdminExists: false,
        tenantAdminHasSystemAdmin: false,
        redirectUrisMatch: false,
        logoutUrisMatch: false,
        webOriginsMatch: false,
        clientSecretConfigured: false,
        tenantClientSecretReadable: false,
        clientSecretAligned: false,
        tenantAdminClientSecretConfigured: false,
        tenantAdminClientSecretReadable: false,
        tenantAdminClientSecretAligned: false,
        runtimeSecretSource: 'tenant',
      },
    });

    expect(checks[0]?.status).toBe('fail');
    expect(checks.slice(1).every((check) => check.status === 'skip')).toBe(true);
  });

  it('reports live keycloak access drift as warn and exposes fallback details', () => {
    const checks = buildKeycloakChecks({
      keycloakEvidenceSource: 'keycloak_live',
      keycloakError: 'HTTP 403 Forbidden',
      keycloakStatus: null,
      fallbackEvidenceSource: 'keycloak_snapshot',
      fallbackStatus: {
        realmExists: false,
        clientExists: false,
        tenantAdminClientExists: false,
        systemAdminRoleExists: false,
        tenantAdminExists: false,
        tenantAdminHasSystemAdmin: false,
        redirectUrisMatch: false,
        logoutUrisMatch: false,
        webOriginsMatch: false,
        clientSecretConfigured: false,
        tenantClientSecretReadable: false,
        clientSecretAligned: false,
        tenantAdminClientSecretConfigured: false,
        tenantAdminClientSecretReadable: false,
        tenantAdminClientSecretAligned: false,
        runtimeSecretSource: 'global',
      },
    });

    expect(checks[0]).toMatchObject({
      checkId: 'keycloak.access.read',
      status: 'warn',
      actual: 'HTTP 403 Forbidden',
      details: expect.objectContaining({
        primaryEvidenceSource: 'keycloak_live',
        secondaryEvidenceSource: 'keycloak_snapshot',
        secondaryRuntimeSecretSource: 'global',
      }),
    });
    expect(checks[1]).toMatchObject({
      checkId: 'keycloak.realm.exists',
      status: 'warn',
      actual: 'live_nicht_verifiziert',
    });
    expect(checks.slice(2).every((check) => check.status === 'skip')).toBe(true);
  });

  it('keeps live and fallback read failures as hard audit failures', () => {
    const checks = buildKeycloakChecks({
      keycloakEvidenceSource: 'keycloak_live',
      keycloakError: 'HTTP 403 Forbidden',
      keycloakStatus: null,
      fallbackEvidenceSource: 'keycloak_snapshot',
      fallbackError: 'snapshot unavailable',
    });

    expect(checks[0]).toMatchObject({
      checkId: 'keycloak.access.read',
      status: 'fail',
      actual: 'HTTP 403 Forbidden',
      details: expect.objectContaining({
        primaryEvidenceSource: 'keycloak_live',
        primaryError: 'HTTP 403 Forbidden',
        secondaryEvidenceSource: 'keycloak_snapshot',
        secondaryError: 'snapshot unavailable',
      }),
    });
    expect(checks[1]).toMatchObject({
      checkId: 'keycloak.realm.exists',
      status: 'fail',
      actual: 'HTTP 403 Forbidden',
    });
  });

  it('reports missing clients and mismatched secrets explicitly for direct keycloak evidence', () => {
    const checks = buildKeycloakChecks({
      keycloakEvidenceSource: 'keycloak_live',
      keycloakStatus: {
        ...baseKeycloakStatus,
        clientExists: false,
        tenantAdminClientExists: true,
        tenantAdminClientSecretAligned: false,
      },
    });

    expect(checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ checkId: 'keycloak.client.login.exists', status: 'fail', actual: 'fehlt' }),
        expect.objectContaining({ checkId: 'keycloak.client.login.secretAligned', status: 'skip' }),
        expect.objectContaining({
          checkId: 'keycloak.client.tenantAdmin.secretAligned',
          status: 'fail',
          actual: 'abweichend',
        }),
      ]),
    );
  });

  it('distinguishes between missing system-admin role, missing tenant admin user, and missing role assignment', () => {
    const missingRoleChecks = buildKeycloakChecks({
      keycloakEvidenceSource: 'keycloak_live',
      keycloakStatus: {
        ...baseKeycloakStatus,
        systemAdminRoleExists: false,
      },
    });
    expect(missingRoleChecks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ checkId: 'keycloak.role.systemAdmin.exists', status: 'fail' }),
        expect.objectContaining({ checkId: 'keycloak.user.systemAdmin.exists', status: 'skip' }),
      ]),
    );

    const missingUserChecks = buildKeycloakChecks({
      keycloakEvidenceSource: 'keycloak_live',
      keycloakStatus: {
        ...baseKeycloakStatus,
        tenantAdminExists: false,
      },
    });
    expect(missingUserChecks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkId: 'keycloak.user.systemAdmin.exists',
          status: 'fail',
          actual: 'kein_benutzer_nachweis',
        }),
      ]),
    );

    const missingAssignmentChecks = buildKeycloakChecks({
      keycloakEvidenceSource: 'keycloak_live',
      keycloakStatus: {
        ...baseKeycloakStatus,
        tenantAdminHasSystemAdmin: false,
      },
    });
    expect(missingAssignmentChecks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkId: 'keycloak.user.systemAdmin.exists',
          status: 'fail',
          actual: 'benutzer_ohne_system_admin',
        }),
      ]),
    );
  });

  it('returns a failing run when requested instances resolve to none', async () => {
    const handler = createRunInstanceAuditHandler(createDeps(createRepository()));

    const result = await handler({
      instanceIds: ['missing'],
      includeOnlyActive: true,
    });

    expect(result.overallStatus).toBe('fail');
    expect(result.summary.totalInstances).toBe(0);
    expect(result.checks[0]?.status).toBe('fail');
  });

  it('accepts missing audit input and falls back to active instances', async () => {
    const repository = createRepository({
      listInstances: vi.fn(async () => []),
    });
    const handler = createRunInstanceAuditHandler(createDeps(repository));

    const result = await handler();

    expect(result.includeOnlyActive).toBe(true);
    expect(result.checks[0]?.status).toBe('fail');
    expect(repository.listInstances).toHaveBeenCalledWith({ status: 'active' });
  });

  it('preserves requested target ids and returns a passing run when an active instance is audited explicitly', async () => {
    const activeInstance = {
      instanceId: 'demo',
      displayName: 'Demo',
      status: 'active',
      primaryHostname: 'demo.example.org',
      authRealm: 'demo',
      authClientId: 'sva-studio',
      authClientSecretConfigured: true,
      tenantAdminClient: { clientId: 'tenant-admin', secretConfigured: true },
    };
    const repository = createRepository({
      getInstanceById: vi.fn(async () => activeInstance),
      countLocalSystemAdminAssignments: vi.fn(async () => 1),
    });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 200 })) as typeof fetch);

    const handler = createRunInstanceAuditHandler(createDeps(repository));
    const result = await handler({
      instanceIds: ['demo'],
      includeOnlyActive: true,
    });

    expect(result.checks[0]?.status).toBe('pass');
    expect(result.targetInstanceIds).toEqual(['demo']);
    expect(result.instances).toHaveLength(1);

    vi.unstubAllGlobals();
  });

  it('filters inactive requested instances when includeOnlyActive is enabled', async () => {
    const repository = createRepository({
      getInstanceById: vi.fn(async () => ({
        instanceId: 'inactive-demo',
        displayName: 'Inactive',
        status: 'suspended',
        primaryHostname: 'inactive.example.org',
        authRealm: 'inactive',
        authClientId: 'sva-studio',
        authClientSecretConfigured: false,
        tenantAdminClient: { clientId: 'tenant-admin', secretConfigured: false },
      })),
    });
    const handler = createRunInstanceAuditHandler(createDeps(repository));

    const result = await handler({
      instanceIds: ['inactive-demo'],
      includeOnlyActive: true,
    });

    expect(result.targetInstanceIds).toEqual(['inactive-demo']);
    expect(result.instances).toEqual([]);
    expect(result.checks[0]?.status).toBe('fail');
  });

  it('drops stale list entries when the instance disappears before the detailed audit build', async () => {
    const listedInstance = {
      instanceId: 'demo',
      displayName: 'Demo',
      status: 'active',
      primaryHostname: 'demo.example.org',
      authRealm: 'demo',
      authClientId: 'sva-studio',
      authClientSecretConfigured: false,
      tenantAdminClient: { clientId: 'tenant-admin', secretConfigured: false },
    };
    const repository = createRepository({
      listInstances: vi.fn(async () => [listedInstance]),
    });
    const getInstanceById = vi
      .fn()
      .mockResolvedValueOnce(null);
    repository.getInstanceById = getInstanceById as typeof repository.getInstanceById;

    const handler = createRunInstanceAuditHandler(createDeps(repository));
    const result = await handler({
      includeOnlyActive: true,
    });

    expect(result.checks[0]?.status).toBe('pass');
    expect(result.instances).toEqual([]);
  });

  it('limits concurrent per-instance audit builds to avoid request spikes', async () => {
    const listedInstances = Array.from({ length: 5 }, (_, index) => ({
      instanceId: `demo-${index + 1}`,
      displayName: `Demo ${index + 1}`,
      status: 'active' as const,
      primaryHostname: `demo-${index + 1}.example.org`,
      authRealm: `demo-${index + 1}`,
      authClientId: 'sva-studio',
      authClientSecretConfigured: true,
      tenantAdminClient: { clientId: 'tenant-admin', secretConfigured: true },
    }));
    let active = 0;
    let maxActive = 0;
    const repository = createRepository({
      listInstances: vi.fn(async () => listedInstances),
      getInstanceById: vi.fn(async (instanceId: string) => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active -= 1;
        return listedInstances.find((instance) => instance.instanceId === instanceId) ?? null;
      }),
      countLocalSystemAdminAssignments: vi.fn(async () => 1),
    });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 200 })) as typeof fetch);

    const handler = createRunInstanceAuditHandler(createDeps(repository));
    const result = await handler();

    expect(result.instances).toHaveLength(5);
    expect(maxActive).toBeLessThanOrEqual(3);

    vi.unstubAllGlobals();
  });
});
