import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  InstanceKeycloakProvisioningRun,
  InstanceProvisioningRun,
  InstanceRegistryRecord,
} from '@sva/core';
import type { InstanceRegistryRepository } from '@sva/data-repositories';

const state = vi.hoisted(() => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    isLevelEnabled: vi.fn(() => true),
  },
}));

vi.mock('@sva/server-runtime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@sva/server-runtime')>()),
  createSdkLogger: () => state.logger,
}));

import { processNextTenantProvisioningRun } from './tenant-provisioning-orchestrator.js';
import type { InstanceRegistryServiceDeps } from './service-types.js';
import {
  buildTenantProvisioningSnapshot,
  TENANT_PROVISIONING_SNAPSHOT_VERSION,
} from './tenant-provisioning-snapshot.js';
import { createInstanceRegistryRuntime } from './runtime-wiring.js';

const now = new Date('2026-09-12T12:00:00.000Z');
const pluginSnapshot = {
  lifecycles: [
    {
      pluginId: 'ssf',
      contractVersion: 1 as const,
      contractRevision: 'ssf-1:contract',
      operations: [{ operation: 'provision' as const, jobTypeId: 'ssf.provision' }],
      readinessChecks: [{ checkId: 'login', titleKey: 'ssf.login', required: true }],
    },
  ],
  oidcClients: [],
  activationPolicies: [
    {
      moduleId: 'ssf',
      activationPolicy: 'automatic' as const,
      manifestVersion: 1,
      policyRevision: 'ssf-1',
    },
  ],
};

const instance: InstanceRegistryRecord = {
  instanceId: 'tenant-a',
  displayName: 'Tenant A',
  timeZone: 'Europe/Berlin',
  status: 'requested',
  parentDomain: 'dialog.kassel.de',
  primaryHostname: 'tenant-a.dialog.kassel.de',
  realmMode: 'existing',
  authRealm: 'smartcity',
  authClientId: 'sva-studio-login',
  authIssuerUrl: 'https://auth.dialog.kassel.de/realms/smartcity',
  authClientSecretConfigured: false,
  featureFlags: {},
  assignedModules: ['ssf'],
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
};

const createRun = (): InstanceProvisioningRun => ({
  id: '00000000-0000-4000-8000-000000000001',
  instanceId: instance.instanceId,
  operation: 'create',
  status: 'requested',
  idempotencyKey: 'idem-1',
  payloadFingerprint: 'fingerprint-1',
  snapshotVersion: TENANT_PROVISIONING_SNAPSHOT_VERSION,
  desiredSnapshot: buildTenantProvisioningSnapshot(
    instance,
    {
      instanceId: instance.instanceId,
      displayName: instance.displayName,
      parentDomain: instance.parentDomain,
      realmMode: instance.realmMode,
      authRealm: instance.authRealm,
      authClientId: instance.authClientId,
      authIssuerUrl: instance.authIssuerUrl,
      idempotencyKey: 'idem-1',
      featureFlags: instance.featureFlags,
    },
    'fingerprint-1',
    'kassel-traefik-file',
    pluginSnapshot
  ),
  attemptCount: 0,
  nextAttemptAt: now.toISOString(),
  deadlineAt: new Date(now.getTime() + 60_000).toISOString(),
  terminalEvidence: {},
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
});

const childRun = (overallStatus: InstanceKeycloakProvisioningRun['overallStatus']) => ({
  id: '00000000-0000-4000-8000-000000000002',
  instanceId: instance.instanceId,
  mutation: 'executeKeycloakProvisioning' as const,
  idempotencyKey: 'parent:00000000-0000-4000-8000-000000000001:keycloak:2026-09-12T12:01:00.000Z',
  payloadFingerprint: 'child-fingerprint',
  mode: instance.realmMode,
  intent: 'provision' as const,
  overallStatus,
  driftSummary: 'queued',
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
  steps: [
    {
      stepKey: 'queued',
      title: 'Queued',
      status: 'done' as const,
      summary: 'Queued',
      details: { confirmedRoleCatalogFingerprint: 'c'.repeat(64) },
    },
  ],
});

const createHarness = () => {
  let currentRun = createRun();
  let currentInstance = instance;
  let keycloakStatus: InstanceKeycloakProvisioningRun['overallStatus'] = 'planned';
  let readiness: 'ready' | 'pending' | 'blocked' = 'pending';
  let activationPolicies = {
    revision: 'catalog-1',
    modules: [
      {
        moduleId: 'ssf',
        activationPolicy: 'automatic' as const,
        manifestVersion: 1,
        policyRevision: 'ssf-1',
      },
    ],
  };

  const repository = {
    claimNextProvisioningRun: vi.fn(async ({ workerId, leaseExpiresAt }) => {
      if (['active', 'failed'].includes(currentRun.status)) return null;
      currentRun = {
        ...currentRun,
        status: 'provisioning',
        leaseOwner: workerId,
        leaseExpiresAt,
        attemptCount: currentRun.attemptCount + 1,
      };
      return currentRun;
    }),
    listProvisioningRuns: vi.fn(async () => [currentRun]),
    renewProvisioningRunLease: vi.fn(async ({ leaseOwner, leaseExpiresAt }) => {
      if (currentRun.leaseOwner !== leaseOwner) return null;
      currentRun = { ...currentRun, leaseExpiresAt };
      return currentRun;
    }),
    updateProvisioningRun: vi.fn(async (input) => {
      if (currentRun.leaseOwner !== input.leaseOwner) return null;
      currentRun = {
        ...currentRun,
        status: input.status,
        stepKey: input.stepKey,
        childKeycloakRunId: input.childKeycloakRunId ?? currentRun.childKeycloakRunId,
        nextAttemptAt: input.nextAttemptAt ?? currentRun.nextAttemptAt,
        terminalEvidence: {
          ...currentRun.terminalEvidence,
          ...input.terminalEvidence,
        },
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
        completedAt: input.completedAt,
        leaseOwner: undefined,
        leaseExpiresAt: undefined,
      };
      return currentRun;
    }),
    getInstanceById: vi.fn(async () => currentInstance),
    getAuthClientSecretCiphertext: vi.fn(async () => null),
    getTenantAdminClientSecretCiphertext: vi.fn(async () => null),
    createKeycloakProvisioningRun: vi.fn(async () => ({
      created: true,
      run: childRun(keycloakStatus),
    })),
    appendKeycloakProvisioningStep: vi.fn(async () => ({
      stepKey: 'queued',
      title: 'queued',
      status: 'pending' as const,
      summary: 'queued',
      details: {},
    })),
    getKeycloakProvisioningRun: vi.fn(async () => childRun(keycloakStatus)),
    listKeycloakProvisioningRuns: vi.fn(async () => []),
    reconcileModuleActivationPolicies: vi.fn(async () => ({
      changedModuleIds: ['ssf'],
      conflictModuleIds: [],
      unchangedModuleIds: [],
    })),
    listAssignedModules: vi.fn(async () => ['ssf']),
    syncAssignedModuleIam: vi.fn(async () => ({
      permissionsInserted: 1,
      permissionsUpdated: 0,
      permissionsUnchanged: 0,
      grantsInserted: 1,
      grantsUnchanged: 0,
    })),
    persistPluginTenantLifecycleReconcileIntents: vi.fn(async () => ['ssf']),
    syncProtectedSystemRolePermissions: vi.fn(async () => ({
      permissionsInserted: 1,
      permissionsUpdated: 0,
      permissionsUnchanged: 0,
      grantsInserted: 1,
      grantsUnchanged: 0,
    })),
    appendAuditEvent: vi.fn(async () => undefined),
    setInstanceStatus: vi.fn(async ({ status }) => {
      currentInstance = { ...currentInstance, status };
      return currentInstance;
    }),
  } as unknown as InstanceRegistryRepository;

  const deps: InstanceRegistryServiceDeps = {
    repository,
    invalidateHost: vi.fn(),
    revealSecret: vi.fn(() => undefined),
    invalidatePermissionSnapshots: vi.fn(async () => undefined),
    moduleIamRegistry: new Map([
      [
        'ssf',
        {
          moduleId: 'ssf',
          permissionIds: ['ssf.configuration.tenant.read'],
          tenantBootstrapRoles: [
            { roleName: 'system_admin', permissionIds: ['ssf.configuration.tenant.read'] },
          ],
        },
      ],
    ]),
    pluginTenantLifecycleRegistry: new Map([
      ['ssf', { pluginId: 'ssf', contractRevision: 'ssf-1:contract' }],
    ]),
    readModuleActivationPolicySnapshot: () => activationPolicies,
    readPluginOidcClientRequirements: vi.fn(() => []),
    readRoleCatalogFingerprint: vi.fn(async () => 'c'.repeat(64)),
    publishTenantIngress: vi.fn(async () => ({
      routerName: 'studio-tenant-tenant-a',
      configHash: 'sha256:router',
    })),
    probeTenantEndpoint: vi.fn(async ({ kind }) => ({ [`${kind}Status`]: 200 })),
    readProvisioningModuleReadiness: vi.fn(async () => ({
      status: readiness,
      evidence: { moduleStatus: readiness },
    })),
    reconcileTenantIamRoles: vi.fn(async () => ({
      outcome: 'success' as const,
      checkedCount: 1,
      correctedCount: 1,
      failedCount: 0,
      requiresManualActionCount: 0,
    })),
    probeTenantIamAccess: vi.fn(async () => ({
      status: 'ready' as const,
      summary: 'Tenant IAM access is ready.',
      source: 'access_probe' as const,
      serviceIdentity: 'sva-studio-tenant-iam' as const,
      classification: 'ready' as const,
      checkedAt: now.toISOString(),
      requestId: 'tenant-iam-probe-1',
    })),
    withInstanceProvisioningLock: async (_instanceId, work) => work(deps),
  };

  return {
    deps,
    repository,
    getRun: () => currentRun,
    getInstance: () => currentInstance,
    setKeycloakStatus: (status: InstanceKeycloakProvisioningRun['overallStatus']) => {
      keycloakStatus = status;
    },
    setReadiness: (status: typeof readiness) => {
      readiness = status;
    },
    addLiveActivationPolicy: () => {
      activationPolicies = {
        ...activationPolicies,
        revision: 'catalog-2',
        modules: [
          ...activationPolicies.modules,
          {
            moduleId: 'news',
            activationPolicy: 'automatic',
            manifestVersion: 1,
            policyRevision: 'news-1',
          },
        ],
      };
    },
    changeInstance: (changes: Partial<InstanceRegistryRecord>) => {
      currentInstance = { ...currentInstance, ...changes };
    },
  };
};

describe('tenant provisioning parent orchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    { step: 'ingress', next: 'tls', callback: 'publishTenantIngress' },
    { step: 'tls', next: 'module_readiness', callback: 'probeTenantEndpoint' },
    { step: 'module_readiness', next: 'login', callback: 'readProvisioningModuleReadiness' },
    { step: 'login', next: 'tenant_iam_roles', callback: 'probeTenantEndpoint' },
    { step: 'tenant_iam_roles', next: 'tenant_iam_access', callback: 'reconcileTenantIamRoles' },
    { step: 'tenant_iam_access', next: 'activate', callback: 'probeTenantIamAccess' },
  ] as const)(
    'preserves $callback across the real runtime lock for $step',
    async ({ step, next, callback }) => {
      const harness = createHarness();
      harness.setReadiness('ready');
      Object.assign(harness.getRun(), {
        status: 'provisioning',
        stepKey: step,
        childKeycloakRunId: childRun('succeeded').id,
        terminalEvidence: {
          routerName: 'studio-tenant-tenant-a',
          configHash: 'sha256:router',
        },
      });
      const globalRepository = {
        ...harness.repository,
        getInstanceById: vi.fn<InstanceRegistryRepository['getInstanceById']>(),
        listProvisioningRuns: vi.fn<InstanceRegistryRepository['listProvisioningRuns']>(),
        updateProvisioningRun: vi.fn<InstanceRegistryRepository['updateProvisioningRun']>(),
      };
      const scopedRepository = {
        ...harness.repository,
        renewProvisioningRunLease: vi.fn<InstanceRegistryRepository['renewProvisioningRunLease']>(),
      };
      const globalClient = {
        query: vi.fn(async () => ({ rowCount: 0, rows: [] })),
        release: vi.fn(),
      };
      const scopedClient = {
        query: vi.fn(async () => ({ rowCount: 0, rows: [] })),
        release: vi.fn(),
      };
      const connect = vi
        .fn()
        .mockResolvedValueOnce(globalClient)
        .mockResolvedValueOnce(scopedClient);
      const runtime = createInstanceRegistryRuntime({
        resolvePool: () => ({ connect }),
        createRepository: vi
          .fn()
          .mockReturnValueOnce(globalRepository)
          .mockReturnValueOnce(scopedRepository),
        serviceDeps: { invalidateHost: vi.fn() },
      });

      await runtime.withRegistryProvisioningWorkerDeps((workerDeps) =>
        processNextTenantProvisioningRun(
          {
            ...workerDeps,
            publishTenantIngress: harness.deps.publishTenantIngress,
            probeTenantEndpoint: harness.deps.probeTenantEndpoint,
            readProvisioningModuleReadiness: harness.deps.readProvisioningModuleReadiness,
            reconcileTenantIamRoles: harness.deps.reconcileTenantIamRoles,
            probeTenantIamAccess: harness.deps.probeTenantIamAccess,
          },
          { workerId: 'worker-1', now }
        )
      );

      expect(harness.deps[callback]).toHaveBeenCalledOnce();
      expect(harness.getRun()).toMatchObject({
        status: 'provisioning',
        stepKey: next,
        errorCode: undefined,
      });
      expect(scopedRepository.getInstanceById).toHaveBeenCalledWith('tenant-a');
      expect(scopedRepository.listProvisioningRuns).toHaveBeenCalledWith('tenant-a');
      expect(scopedRepository.updateProvisioningRun).toHaveBeenCalledOnce();
      expect(globalRepository.getInstanceById).not.toHaveBeenCalled();
      expect(globalRepository.listProvisioningRuns).not.toHaveBeenCalled();
      expect(globalRepository.updateProvisioningRun).not.toHaveBeenCalled();
      expect(globalRepository.renewProvisioningRunLease).toHaveBeenCalledOnce();
      expect(scopedRepository.renewProvisioningRunLease).not.toHaveBeenCalled();
      expect(scopedClient.query.mock.calls).toEqual([
        ['BEGIN'],
        ['SELECT pg_advisory_xact_lock(hashtextextended($1, 0));', ['tenant-a']],
        ['SET LOCAL ROLE iam_app;'],
        ['SELECT set_config($1, $2, true);', ['app.instance_id', 'tenant-a']],
        ['COMMIT'],
      ]);
      expect(globalClient.release).toHaveBeenCalledOnce();
      expect(scopedClient.release).toHaveBeenCalledOnce();
    }
  );

  it('reaches terminal success only after Keycloak, ingress, login, module readiness, and tenant IAM postflight', async () => {
    const harness = createHarness();
    const iterate = () =>
      processNextTenantProvisioningRun(harness.deps, { workerId: 'worker-1', now });

    await iterate();
    expect(harness.repository.syncProtectedSystemRolePermissions).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'tenant-a',
        role: expect.objectContaining({ roleKey: 'system_admin' }),
      })
    );
    expect(
      vi.mocked(harness.repository.syncProtectedSystemRolePermissions).mock.invocationCallOrder[0]
    ).toBeLessThan(
      vi.mocked(harness.repository.createKeycloakProvisioningRun).mock.invocationCallOrder[0] ?? 0
    );
    expect(harness.getRun()).toMatchObject({
      status: 'provisioning',
      stepKey: 'keycloak',
      childKeycloakRunId: '00000000-0000-4000-8000-000000000002',
      errorCode: undefined,
    });

    await iterate();
    expect(harness.getRun().stepKey).toBe('keycloak');
    expect(harness.repository.renewProvisioningRunLease).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: '00000000-0000-4000-8000-000000000001',
        leaseOwner: 'worker-1',
      })
    );
    harness.setKeycloakStatus('succeeded');
    await iterate();
    harness.addLiveActivationPolicy();
    await iterate();
    expect(harness.repository.reconcileModuleActivationPolicies).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'tenant-a',
        reconcileId: 'provisioning:00000000-0000-4000-8000-000000000001',
        policies: [expect.objectContaining({ moduleId: 'ssf' })],
      })
    );
    expect(harness.repository.syncAssignedModuleIam).toHaveBeenCalledWith(
      expect.objectContaining({ instanceId: 'tenant-a' })
    );
    await iterate();
    await iterate();

    expect(harness.getInstance().status).toBe('provisioning');
    expect(harness.getRun()).toMatchObject({
      status: 'provisioning',
      stepKey: 'module_readiness',
      completedAt: undefined,
    });

    harness.setReadiness('ready');
    await iterate();
    expect(harness.getRun().stepKey).toBe('login');
    expect(harness.getInstance().status).toBe('provisioning');
    await iterate();
    expect(harness.getRun().stepKey).toBe('tenant_iam_roles');
    expect(harness.deps.probeTenantEndpoint).toHaveBeenLastCalledWith(
      expect.objectContaining({
        expectedRouterName: 'studio-tenant-tenant-a',
        expectedConfigHash: 'sha256:router',
      })
    );
    expect(harness.getInstance().status).toBe('provisioning');
    await iterate();
    expect(harness.getRun().stepKey).toBe('tenant_iam_access');
    expect(harness.deps.reconcileTenantIamRoles).toHaveBeenCalledWith(
      expect.objectContaining({ expectedRoleCatalogFingerprint: 'c'.repeat(64) })
    );
    expect(harness.getInstance().status).toBe('provisioning');
    await iterate();
    expect(harness.getRun().stepKey).toBe('activate');
    expect(harness.deps.probeTenantIamAccess).toHaveBeenCalledWith(
      expect.objectContaining({ authClientId: instance.authClientId })
    );
    expect(harness.repository.appendAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'tenant-a',
        eventType: 'tenant_iam_access_probed',
      })
    );
    expect(harness.getInstance().status).toBe('provisioning');
    await iterate();
    expect(harness.getRun()).toMatchObject({
      status: 'validated',
      stepKey: 'completed',
      completedAt: now.toISOString(),
      terminalEvidence: {
        routerName: 'studio-tenant-tenant-a',
        ingressStatus: 200,
        loginStatus: 200,
        moduleStatus: 'ready',
        tenantIamRoleReconcile: {
          outcome: 'success',
          checkedCount: 1,
          correctedCount: 1,
        },
        tenantIamAccess: {
          status: 'ready',
        },
      },
    });
    expect(harness.getInstance().status).toBe('validated');
    expect(harness.repository.setInstanceStatus).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: 'active' })
    );
  });

  it('recovers a plugin snapshot v1 run without persisted activation policies', async () => {
    const harness = createHarness();
    const { pluginActivationPolicies, ...legacyDesiredSnapshot } = harness.getRun().desiredSnapshot;
    void pluginActivationPolicies;
    Object.assign(harness.getRun(), {
      status: 'provisioning',
      stepKey: 'lifecycle',
      desiredSnapshot: {
        ...legacyDesiredSnapshot,
        pluginSnapshotVersion: '1.0',
      },
    });

    await processNextTenantProvisioningRun(harness.deps, { workerId: 'worker-1', now });

    expect(harness.getRun()).toMatchObject({ status: 'provisioning', stepKey: 'ingress' });
    expect(harness.repository.reconcileModuleActivationPolicies).toHaveBeenCalledWith(
      expect.objectContaining({
        policies: [expect.objectContaining({ moduleId: 'ssf', policyRevision: 'ssf-1' })],
      })
    );
  });

  it('keeps the instance fail-closed when tenant IAM role reconciliation is incomplete', async () => {
    const harness = createHarness();
    Object.assign(harness.getRun(), {
      status: 'provisioning',
      stepKey: 'tenant_iam_roles',
      childKeycloakRunId: childRun('succeeded').id,
    });
    vi.mocked(harness.deps.reconcileTenantIamRoles).mockResolvedValue({
      outcome: 'partial_failure',
      checkedCount: 1,
      correctedCount: 0,
      failedCount: 1,
      requiresManualActionCount: 0,
    });

    await processNextTenantProvisioningRun(harness.deps, { workerId: 'worker-1', now });

    expect(harness.getInstance().status).toBe('requested');
    expect(harness.getRun()).toMatchObject({
      status: 'provisioning',
      stepKey: 'tenant_iam_roles',
      errorCode: 'tenant_iam_roles_reconcile_not_ready',
    });
    expect(harness.deps.probeTenantIamAccess).not.toHaveBeenCalled();
  });

  it('fails closed before role reconciliation without a confirmed catalog fingerprint', async () => {
    const harness = createHarness();
    Object.assign(harness.getRun(), {
      status: 'provisioning',
      stepKey: 'tenant_iam_roles',
      childKeycloakRunId: childRun('succeeded').id,
    });
    vi.mocked(harness.repository.getKeycloakProvisioningRun).mockResolvedValue({
      ...childRun('succeeded'),
      steps: [],
    });

    await processNextTenantProvisioningRun(harness.deps, { workerId: 'worker-1', now });

    expect(harness.getRun()).toMatchObject({
      status: 'failed',
      stepKey: 'tenant_iam_roles',
      errorCode: 'role_catalog_fingerprint_missing_or_invalid',
    });
    expect(harness.deps.reconcileTenantIamRoles).not.toHaveBeenCalled();
  });

  it('routes a recovered legacy activate step through the tenant IAM postflight', async () => {
    const harness = createHarness();
    Object.assign(harness.getRun(), {
      status: 'provisioning',
      stepKey: 'activate',
      snapshotVersion: '2.0',
    });

    await processNextTenantProvisioningRun(harness.deps, { workerId: 'worker-1', now });

    expect(harness.getInstance().status).toBe('requested');
    expect(harness.getRun()).toMatchObject({
      status: 'provisioning',
      stepKey: 'tenant_iam_roles',
    });
    expect(harness.repository.setInstanceStatus).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: 'active' })
    );
  });

  it('persists a degraded tenant IAM probe and does not activate the instance', async () => {
    const harness = createHarness();
    Object.assign(harness.getRun(), { status: 'provisioning', stepKey: 'tenant_iam_access' });
    vi.mocked(harness.deps.probeTenantIamAccess).mockResolvedValue({
      status: 'degraded',
      summary: 'Tenant IAM access is unavailable.',
      source: 'access_probe',
      serviceIdentity: 'sva-studio-tenant-iam',
      classification: 'unavailable',
      errorCode: 'tenant_iam_unavailable',
    });

    await processNextTenantProvisioningRun(harness.deps, { workerId: 'worker-1', now });

    expect(harness.repository.appendAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'tenant_iam_access_probed',
        details: expect.objectContaining({ status: 'degraded' }),
      })
    );
    expect(harness.getInstance().status).toBe('requested');
    expect(harness.getRun()).toMatchObject({
      status: 'provisioning',
      stepKey: 'tenant_iam_access',
      errorCode: 'tenant_iam_access_not_ready',
    });
  });

  it('stores a terminal failure and retains generated artifacts when readiness is blocked', async () => {
    const harness = createHarness();
    harness.setReadiness('blocked');
    const run = harness.getRun();
    Object.assign(run, {
      status: 'provisioning',
      stepKey: 'module_readiness',
      terminalEvidence: { routerName: 'studio-tenant-tenant-a' },
    });

    await processNextTenantProvisioningRun(harness.deps, {
      workerId: 'worker-1',
      now,
    });

    expect(harness.getInstance().status).toBe('failed');
    expect(harness.getRun()).toMatchObject({
      status: 'failed',
      stepKey: 'module_readiness',
      errorCode: 'module_readiness_blocked',
      terminalEvidence: {
        routerName: 'studio-tenant-tenant-a',
        failedStep: 'module_readiness',
      },
    });
    expect(harness.deps.publishTenantIngress).not.toHaveBeenCalled();
  });

  it.each([
    'ssf.tenant-instance-id-invalid',
    'ssf.root-database-not-configured',
    'ssf.authorization-profile-integrity-failed',
  ])('preserves terminal module cause %s in the parent provisioning run', async (errorCode) => {
    const harness = createHarness();
    Object.assign(harness.getRun(), {
      status: 'provisioning',
      stepKey: 'module_readiness',
    });
    vi.mocked(harness.deps.readProvisioningModuleReadiness).mockResolvedValueOnce({
      status: 'blocked',
      evidence: { moduleStatus: 'blocked' },
      errorCode,
    });

    await processNextTenantProvisioningRun(harness.deps, { workerId: 'worker-1', now });

    expect(harness.getRun()).toMatchObject({
      status: 'failed',
      errorCode,
      terminalEvidence: {
        failedStep: 'module_readiness',
        errorCode,
      },
    });
  });

  it('fails a recovered nonterminal run after its deadline', async () => {
    const harness = createHarness();
    Object.assign(harness.getRun(), {
      stepKey: 'login',
      deadlineAt: now.toISOString(),
      errorCode: 'kassel_login_probe_failed',
      terminalEvidence: {
        loginStatus: 503,
        loginClassification: 'upstream_unavailable',
      },
    });

    await processNextTenantProvisioningRun(harness.deps, {
      workerId: 'recovery-worker',
      now,
    });

    expect(harness.getRun()).toMatchObject({
      status: 'failed',
      stepKey: 'login',
      errorCode: 'provisioning_deadline_exceeded',
      completedAt: now.toISOString(),
      terminalEvidence: {
        loginStatus: 503,
        loginClassification: 'upstream_unavailable',
        errorCode: 'provisioning_deadline_exceeded',
        lastDependencyErrorCode: 'kassel_login_probe_failed',
        deadlineAt: now.toISOString(),
        elapsedMs: 0,
      },
    });
  });

  it('fails closed on an unknown persisted step without replaying side effects', async () => {
    const harness = createHarness();
    Object.assign(harness.getRun(), {
      status: 'provisioning',
      stepKey: 'future-unknown-step',
    });

    await processNextTenantProvisioningRun(harness.deps, {
      workerId: 'recovery-worker',
      now,
    });

    expect(harness.getRun()).toMatchObject({
      status: 'failed',
      errorCode: 'provisioning_step_invalid',
      completedAt: now.toISOString(),
    });
    expect(harness.repository.createKeycloakProvisioningRun).not.toHaveBeenCalled();
    expect(harness.deps.publishTenantIngress).not.toHaveBeenCalled();
  });

  it('retries transient ingress availability failures and advances after recovery', async () => {
    const harness = createHarness();
    Object.assign(harness.getRun(), {
      status: 'provisioning',
      stepKey: 'tls',
      terminalEvidence: {
        routerName: 'studio-tenant-tenant-a',
        configHash: 'sha256:router',
      },
    });
    const probeTenantEndpoint = harness.deps.probeTenantEndpoint;
    expect(probeTenantEndpoint).toBeDefined();
    if (!probeTenantEndpoint) {
      throw new Error('probeTenantEndpoint test dependency is missing');
    }
    vi.mocked(probeTenantEndpoint).mockRejectedValueOnce(new Error('kassel_ingress_probe_failed'));

    await processNextTenantProvisioningRun(harness.deps, { workerId: 'worker-1', now });

    expect(harness.getRun()).toMatchObject({
      status: 'provisioning',
      stepKey: 'tls',
      errorCode: 'kassel_ingress_probe_failed',
      completedAt: undefined,
    });
    expect(harness.getInstance().status).toBe('requested');

    await processNextTenantProvisioningRun(harness.deps, { workerId: 'worker-1', now });

    expect(probeTenantEndpoint).toHaveBeenCalledTimes(2);
    expect(harness.getRun()).toMatchObject({
      status: 'provisioning',
      stepKey: 'module_readiness',
      errorCode: undefined,
      completedAt: undefined,
    });
    expect(harness.getInstance().status).toBe('requested');
  });

  it.each([
    ['ingress', 'publishTenantIngress', 'tenant_ingress_publish_invalid'],
    ['tls', 'probeTenantEndpoint', 'tenant_ingress_probe_invalid'],
    ['login', 'probeTenantEndpoint', 'tenant_login_probe_invalid'],
    ['module_readiness', 'readProvisioningModuleReadiness', 'module_readiness_probe_invalid'],
  ] as const)(
    'terminalizes an invalid %s boundary result',
    async (stepKey, callback, expectedErrorCode) => {
      const harness = createHarness();
      Object.assign(harness.getRun(), {
        status: 'provisioning',
        stepKey,
        terminalEvidence: {
          routerName: 'studio-tenant-tenant-a',
          configHash: 'sha256:router',
        },
      });
      vi.mocked(harness.deps[callback]).mockRejectedValueOnce(new TypeError('invalid response'));

      await processNextTenantProvisioningRun(harness.deps, { workerId: 'worker-1', now });

      expect(harness.getRun()).toMatchObject({
        status: 'failed',
        stepKey,
        errorCode: expectedErrorCode,
      });
    }
  );

  it('logs redacted primitive diagnostics at the tenant ingress publish boundary', async () => {
    const harness = createHarness();
    Object.assign(harness.getRun(), {
      status: 'provisioning',
      stepKey: 'ingress',
      requestId: 'request-ingress-1',
    });
    const publishError = Object.assign(new Error('open failed password=outer-secret'), {
      code: 'EPERM',
      syscall: 'open',
      path: '/var/lib/sva-studio/traefik-dynamic/.tenant.tmp',
      dest: '/var/lib/sva-studio/traefik-dynamic/tenant.yml',
    });
    vi.mocked(harness.deps.publishTenantIngress).mockRejectedValueOnce(publishError);

    await processNextTenantProvisioningRun(harness.deps, { workerId: 'worker-1', now });

    expect(state.logger.warn).toHaveBeenCalledWith(
      'tenant_ingress_publish_failed',
      expect.objectContaining({
        operation: 'publish_tenant_ingress',
        result: 'failed',
        request_id: 'request-ingress-1',
        instance_id: 'tenant-a',
        run_id: '00000000-0000-4000-8000-000000000001',
        step_key: 'ingress',
        error_type: 'Error',
        error_code: 'EPERM',
        classification: 'tenant_provisioning_step_failed',
        diagnostic_error: expect.objectContaining({
          name: 'Error',
          code: 'EPERM',
          syscall: 'open',
          path: '/var/lib/sva-studio/traefik-dynamic/.tenant.tmp',
          dest: '/var/lib/sva-studio/traefik-dynamic/tenant.yml',
        }),
      })
    );
    const logged = JSON.stringify(state.logger.warn.mock.calls);
    expect(logged).not.toContain('outer-secret');
    expect(harness.getRun()).toMatchObject({
      status: 'failed',
      stepKey: 'ingress',
      errorCode: 'tenant_provisioning_step_failed',
      completedAt: now.toISOString(),
    });
  });

  it('uses the validated domain message as the ingress error code fallback', async () => {
    const harness = createHarness();
    Object.assign(harness.getRun(), {
      status: 'provisioning',
      stepKey: 'ingress',
    });
    const publishError = new Error('kassel_traefik_dynamic_dir_missing');
    vi.mocked(harness.deps.publishTenantIngress).mockRejectedValueOnce(publishError);

    await processNextTenantProvisioningRun(harness.deps, { workerId: 'worker-1', now });

    expect(state.logger.warn).toHaveBeenCalledWith(
      'tenant_ingress_publish_failed',
      expect.objectContaining({ error_code: 'kassel_traefik_dynamic_dir_missing' })
    );
    expect(harness.getRun()).toMatchObject({
      status: 'failed',
      errorCode: 'kassel_traefik_dynamic_dir_missing',
    });
  });

  it('logs the outer failure phase when persistence fails after ingress publication', async () => {
    const harness = createHarness();
    Object.assign(harness.getRun(), {
      status: 'provisioning',
      stepKey: 'ingress',
      requestId: 'request-ingress-persist-1',
    });
    const persistenceError = Object.assign(new Error('database update failed database-secret'), {
      code: 'XX001',
      table: 'instance_provisioning_runs',
      column: 'terminal_evidence',
      constraint: 'instance_provisioning_runs_pkey',
      detail: 'database-detail-secret',
      hint: 'database-hint-secret',
      query: 'UPDATE secret_table SET password = $1',
      parameters: ['database-parameter-secret'],
      stack: 'database-stack-secret',
    });
    vi.mocked(harness.repository.updateProvisioningRun).mockRejectedValueOnce(persistenceError);

    await processNextTenantProvisioningRun(harness.deps, { workerId: 'worker-1', now });

    expect(harness.deps.publishTenantIngress).toHaveBeenCalledOnce();
    expect(state.logger.warn).not.toHaveBeenCalledWith(
      'tenant_ingress_publish_failed',
      expect.anything()
    );
    expect(state.logger.warn).toHaveBeenCalledWith(
      'tenant_provisioning_step_exception',
      expect.objectContaining({
        operation: 'create_instance',
        result: 'failed',
        request_id: 'request-ingress-persist-1',
        instance_id: 'tenant-a',
        run_id: '00000000-0000-4000-8000-000000000001',
        step_key: 'ingress',
        failure_phase: 'step_execution',
        error_type: 'Error',
        error_code: 'tenant_provisioning_step_failed',
        classification: 'tenant_provisioning_step_failed',
        diagnostic_error: {
          name: 'Error',
          code: 'XX001',
        },
      })
    );
    const logged = JSON.stringify(state.logger.warn.mock.calls);
    expect(logged).not.toContain('database-secret');
    expect(logged).not.toContain('database-detail-secret');
    expect(logged).not.toContain('database-hint-secret');
    expect(logged).not.toContain('secret_table');
    expect(logged).not.toContain('database-parameter-secret');
    expect(logged).not.toContain('database-stack-secret');
    expect(harness.getRun()).toMatchObject({
      status: 'failed',
      stepKey: 'ingress',
      errorCode: 'tenant_provisioning_step_failed',
    });
  });

  it('excludes untrusted provider details and fails an unknown error without retry', async () => {
    const harness = createHarness();
    Object.assign(harness.getRun(), { status: 'provisioning', stepKey: 'ingress' });
    vi.mocked(harness.repository.updateProvisioningRun).mockRejectedValueOnce(
      Object.assign(new Error('provider response for user@example.org password=outer-secret'), {
        name: 'Provider response for user@example.org',
        code: 'provider_user_example',
      })
    );

    await processNextTenantProvisioningRun(harness.deps, { workerId: 'worker-1', now });

    expect(state.logger.warn).toHaveBeenCalledWith(
      'tenant_provisioning_step_exception',
      expect.objectContaining({
        failure_phase: 'step_execution',
        diagnostic_error: {
          name: 'object',
        },
      })
    );
    const logged = JSON.stringify(state.logger.warn.mock.calls);
    expect(logged).not.toContain('outer-secret');
    expect(logged).not.toContain('user@example.org');
    expect(logged).not.toContain('provider_user_example');
    expect(harness.getRun()).toMatchObject({
      status: 'failed',
      stepKey: 'ingress',
      errorCode: 'tenant_provisioning_step_failed',
      completedAt: now.toISOString(),
    });
  });

  it('preserves fail-closed handling when outer diagnostic logging throws', async () => {
    const harness = createHarness();
    Object.assign(harness.getRun(), { status: 'provisioning', stepKey: 'ingress' });
    vi.mocked(harness.repository.updateProvisioningRun).mockRejectedValueOnce(
      new Error('update failed')
    );
    state.logger.warn.mockImplementationOnce(() => {
      throw new Error('logging_failed');
    });

    await processNextTenantProvisioningRun(harness.deps, { workerId: 'worker-1', now });

    expect(harness.getRun()).toMatchObject({
      status: 'failed',
      stepKey: 'ingress',
      errorCode: 'tenant_provisioning_step_failed',
      completedAt: now.toISOString(),
    });
  });

  it('preserves the provisioning failure when ingress diagnostics throw', async () => {
    const harness = createHarness();
    Object.assign(harness.getRun(), {
      status: 'provisioning',
      stepKey: 'ingress',
    });
    const publishError = new Error('kassel_traefik_dynamic_dir_missing');
    vi.mocked(harness.deps.publishTenantIngress).mockRejectedValueOnce(publishError);
    state.logger.warn.mockImplementationOnce(() => {
      throw new Error('logging_failed');
    });

    await processNextTenantProvisioningRun(harness.deps, { workerId: 'worker-1', now });

    expect(harness.getRun()).toMatchObject({
      status: 'failed',
      errorCode: 'kassel_traefik_dynamic_dir_missing',
    });
    expect(state.logger.error).toHaveBeenLastCalledWith(
      'tenant_provisioning_failed',
      expect.objectContaining({ error_code: 'kassel_traefik_dynamic_dir_missing' })
    );
  });

  it('fails closed when mutable registry configuration drifts from the snapshot', async () => {
    const harness = createHarness();
    harness.changeInstance({ displayName: 'Changed during provisioning' });

    await processNextTenantProvisioningRun(harness.deps, { workerId: 'worker-1', now });

    expect(harness.getRun()).toMatchObject({
      status: 'failed',
      errorCode: 'provisioning_snapshot_drift',
      completedAt: now.toISOString(),
    });
  });

  it('accepts an explicitly empty plugin snapshot for a tenant without assigned modules', async () => {
    const harness = createHarness();
    const instanceWithoutModules = { ...harness.getInstance(), assignedModules: [] };
    harness.changeInstance(instanceWithoutModules);
    Object.assign(harness.getRun(), {
      desiredSnapshot: buildTenantProvisioningSnapshot(
        instanceWithoutModules,
        {
          instanceId: instanceWithoutModules.instanceId,
          displayName: instanceWithoutModules.displayName,
          parentDomain: instanceWithoutModules.parentDomain,
          realmMode: instanceWithoutModules.realmMode,
          authRealm: instanceWithoutModules.authRealm,
          authClientId: instanceWithoutModules.authClientId,
          authIssuerUrl: instanceWithoutModules.authIssuerUrl,
          idempotencyKey: 'idem-1',
          featureFlags: instanceWithoutModules.featureFlags,
        },
        'fingerprint-1',
        'kassel-traefik-file'
      ),
    });

    await processNextTenantProvisioningRun(harness.deps, { workerId: 'worker-1', now });

    expect(harness.getRun()).toMatchObject({
      status: 'provisioning',
      stepKey: 'keycloak',
      errorCode: undefined,
    });
    expect(harness.repository.createKeycloakProvisioningRun).toHaveBeenCalledOnce();
  });

  it('accepts only the correlated Keycloak new-to-existing realm transition', async () => {
    const harness = createHarness();
    const newRealmInstance = { ...harness.getInstance(), realmMode: 'new' as const };
    harness.changeInstance(newRealmInstance);
    Object.assign(harness.getRun(), {
      status: 'provisioning',
      stepKey: 'keycloak',
      childKeycloakRunId: '00000000-0000-4000-8000-000000000002',
      desiredSnapshot: buildTenantProvisioningSnapshot(
        newRealmInstance,
        {
          instanceId: newRealmInstance.instanceId,
          displayName: newRealmInstance.displayName,
          parentDomain: newRealmInstance.parentDomain,
          realmMode: 'new',
          authRealm: newRealmInstance.authRealm,
          authClientId: newRealmInstance.authClientId,
          authIssuerUrl: newRealmInstance.authIssuerUrl,
          idempotencyKey: 'idem-1',
          featureFlags: newRealmInstance.featureFlags,
        },
        'fingerprint-1',
        'kassel-traefik-file',
        pluginSnapshot
      ),
    });
    harness.changeInstance({ realmMode: 'existing' });
    harness.setKeycloakStatus('succeeded');

    await processNextTenantProvisioningRun(harness.deps, { workerId: 'worker-1', now });

    expect(harness.getRun().stepKey).toBe('lifecycle');
  });

  it('replaces the transition evidence when an OIDC retry starts at registry', async () => {
    const harness = createHarness();
    const newRealmInstance = { ...harness.getInstance(), realmMode: 'new' as const };
    Object.assign(harness.getRun(), {
      status: 'requested',
      stepKey: 'registry',
      childKeycloakRunId: '00000000-0000-4000-8000-000000000003',
      desiredSnapshot: buildTenantProvisioningSnapshot(
        newRealmInstance,
        {
          instanceId: newRealmInstance.instanceId,
          displayName: newRealmInstance.displayName,
          parentDomain: newRealmInstance.parentDomain,
          realmMode: 'new',
          authRealm: newRealmInstance.authRealm,
          authClientId: newRealmInstance.authClientId,
          authIssuerUrl: newRealmInstance.authIssuerUrl,
          idempotencyKey: 'idem-1',
          featureFlags: newRealmInstance.featureFlags,
        },
        'fingerprint-1',
        'kassel-traefik-file',
        pluginSnapshot
      ),
    });
    harness.changeInstance({ realmMode: 'existing' });

    await processNextTenantProvisioningRun(harness.deps, { workerId: 'worker-1', now });

    expect(harness.getRun()).toMatchObject({
      status: 'provisioning',
      stepKey: 'keycloak',
      childKeycloakRunId: '00000000-0000-4000-8000-000000000002',
      errorCode: undefined,
    });
    expect(harness.repository.createKeycloakProvisioningRun).toHaveBeenCalledOnce();
  });

  it('renews the lease while a provisioning step is still running', async () => {
    vi.useFakeTimers({ now });
    try {
      const harness = createHarness();
      Object.assign(harness.getRun(), { status: 'provisioning', stepKey: 'ingress' });
      vi.mocked(harness.deps.publishTenantIngress).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 15_000))
      );

      const processing = processNextTenantProvisioningRun(harness.deps, {
        workerId: 'worker-1',
      });
      await vi.advanceTimersByTimeAsync(15_000);
      await processing;

      expect(harness.repository.renewProvisioningRunLease).toHaveBeenCalledTimes(2);
      expect(harness.getRun().stepKey).toBe('tls');
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not hold the provisioning transaction open for an in-flight heartbeat', async () => {
    vi.useFakeTimers({ now });
    try {
      const harness = createHarness();
      Object.assign(harness.getRun(), { status: 'provisioning', stepKey: 'ingress' });
      let releaseHeartbeat!: () => void;
      const heartbeat = new Promise<void>((resolve) => {
        releaseHeartbeat = resolve;
      });
      vi.mocked(harness.repository.renewProvisioningRunLease)
        .mockResolvedValueOnce(harness.getRun())
        .mockImplementationOnce(async () => {
          await heartbeat;
          return harness.getRun();
        });
      vi.mocked(harness.deps.publishTenantIngress).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 11_000))
      );

      const processing = processNextTenantProvisioningRun(harness.deps, {
        workerId: 'worker-1',
      });
      await vi.advanceTimersByTimeAsync(11_000);

      await expect(processing).resolves.toEqual(expect.objectContaining({ stepKey: 'tls' }));
      releaseHeartbeat();
      await Promise.resolve();
    } finally {
      vi.useRealTimers();
    }
  });

  it('stops advancing after a heartbeat loses the provisioning claim', async () => {
    vi.useFakeTimers({ now });
    try {
      const harness = createHarness();
      Object.assign(harness.getRun(), { status: 'provisioning', stepKey: 'ingress' });
      vi.mocked(harness.repository.renewProvisioningRunLease)
        .mockResolvedValueOnce(harness.getRun())
        .mockResolvedValueOnce(null);
      vi.mocked(harness.deps.publishTenantIngress).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 15_000))
      );

      const processing = processNextTenantProvisioningRun(harness.deps, {
        workerId: 'worker-1',
      });
      const rejected = expect(processing).rejects.toThrow('provisioning_claim_lost');
      await vi.advanceTimersByTimeAsync(15_000);

      await rejected;
      expect(harness.getRun().stepKey).toBe('ingress');
      expect(harness.deps.publishTenantIngress).toHaveBeenCalledOnce();
      expect(harness.deps.probeTenantEndpoint).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('propagates claim loss after final validation so the enclosing transaction rolls back', async () => {
    vi.useFakeTimers({ now });
    try {
      const harness = createHarness();
      Object.assign(harness.getRun(), {
        status: 'provisioning',
        stepKey: 'activate',
        terminalEvidence: {
          tenantIamRoleReconcile: { outcome: 'success' },
          tenantIamAccess: { status: 'ready' },
        },
      });
      vi.mocked(harness.repository.renewProvisioningRunLease)
        .mockResolvedValueOnce(harness.getRun())
        .mockResolvedValueOnce(null);
      vi.mocked(harness.repository.setInstanceStatus).mockImplementation(async ({ status }) => {
        if (status === 'validated') await new Promise((resolve) => setTimeout(resolve, 15_000));
        harness.changeInstance({ status });
        return harness.getInstance();
      });

      const processing = processNextTenantProvisioningRun(harness.deps, {
        workerId: 'worker-1',
      });
      const rejected = expect(processing).rejects.toThrow('provisioning_claim_lost');
      await vi.advanceTimersByTimeAsync(15_000);

      await rejected;
      expect(harness.getRun().stepKey).toBe('activate');
    } finally {
      vi.useRealTimers();
    }
  });

  it('rechecks the actual deadline before committing final validation', async () => {
    vi.useFakeTimers({ now });
    try {
      const harness = createHarness();
      Object.assign(harness.getRun(), {
        status: 'provisioning',
        stepKey: 'activate',
        deadlineAt: new Date(now.getTime() + 10_000).toISOString(),
        terminalEvidence: {
          tenantIamRoleReconcile: { outcome: 'success' },
          tenantIamAccess: { status: 'ready' },
        },
      });
      vi.mocked(harness.repository.setInstanceStatus).mockImplementation(async ({ status }) => {
        if (status === 'validated') await new Promise((resolve) => setTimeout(resolve, 15_000));
        harness.changeInstance({ status });
        return harness.getInstance();
      });

      const processing = processNextTenantProvisioningRun(harness.deps, {
        workerId: 'worker-1',
      });
      await vi.advanceTimersByTimeAsync(15_000);
      await processing;

      expect(harness.getInstance().status).toBe('failed');
      expect(harness.getRun()).toMatchObject({
        status: 'failed',
        stepKey: 'activate',
        errorCode: 'provisioning_deadline_exceeded',
        completedAt: new Date(now.getTime() + 15_000).toISOString(),
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
