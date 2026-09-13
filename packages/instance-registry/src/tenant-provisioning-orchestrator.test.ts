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
import { buildTenantProvisioningSnapshot } from './tenant-provisioning-snapshot.js';

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
  snapshotVersion: '2.0',
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
  steps: [],
});

const createHarness = () => {
  let currentRun = createRun();
  let currentInstance = instance;
  let keycloakStatus: InstanceKeycloakProvisioningRun['overallStatus'] = 'planned';
  let readiness: 'ready' | 'pending' | 'blocked' = 'pending';

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
    setInstanceStatus: vi.fn(async ({ status }) => {
      currentInstance = { ...currentInstance, status };
      return currentInstance;
    }),
  } as unknown as InstanceRegistryRepository;

  const deps: InstanceRegistryServiceDeps = {
    repository,
    invalidateHost: vi.fn(),
    revealSecret: vi.fn(() => undefined),
    readPluginOidcClientRequirements: vi.fn(() => []),
    publishTenantIngress: vi.fn(async () => ({
      routerName: 'studio-tenant-tenant-a',
      configHash: 'sha256:router',
    })),
    probeTenantEndpoint: vi.fn(async ({ kind }) => ({ [`${kind}Status`]: 200 })),
    readProvisioningModuleReadiness: vi.fn(async () => ({
      status: readiness,
      evidence: { moduleStatus: readiness },
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
    changeInstance: (changes: Partial<InstanceRegistryRecord>) => {
      currentInstance = { ...currentInstance, ...changes };
    },
  };
};

describe('tenant provisioning parent orchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reaches terminal success only after Keycloak, ingress, login, and module readiness', async () => {
    const harness = createHarness();
    const iterate = () =>
      processNextTenantProvisioningRun(harness.deps, { workerId: 'worker-1', now });

    await iterate();
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
    await iterate();
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
    expect(harness.getRun().stepKey).toBe('activate');
    expect(harness.deps.probeTenantEndpoint).toHaveBeenLastCalledWith(
      expect.objectContaining({
        expectedRouterName: 'studio-tenant-tenant-a',
        expectedConfigHash: 'sha256:router',
      })
    );
    expect(harness.getInstance().status).toBe('provisioning');
    await iterate();
    expect(harness.getRun()).toMatchObject({
      status: 'active',
      stepKey: 'completed',
      completedAt: now.toISOString(),
      terminalEvidence: {
        routerName: 'studio-tenant-tenant-a',
        ingressStatus: 200,
        loginStatus: 200,
        moduleStatus: 'ready',
      },
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

  it('fails a recovered nonterminal run after its deadline', async () => {
    const harness = createHarness();
    Object.assign(harness.getRun(), {
      stepKey: 'login',
      deadlineAt: now.toISOString(),
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

  it('retries transient ingress availability failures until the deadline', async () => {
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
  });

  it('logs a redacted error and cause chain at the tenant ingress publish boundary', async () => {
    const harness = createHarness();
    Object.assign(harness.getRun(), {
      status: 'provisioning',
      stepKey: 'ingress',
    });
    const cause = new Error('authorization: Bearer inner-secret');
    const publishError = Object.assign(new Error('open failed password=outer-secret'), {
      code: 'EACCES',
      syscall: 'open',
      path: '/var/lib/sva-studio/traefik-dynamic/.tenant.tmp',
      dest: '/var/lib/sva-studio/traefik-dynamic/tenant.yml',
      cause,
    });
    vi.mocked(harness.deps.publishTenantIngress).mockRejectedValueOnce(publishError);

    await processNextTenantProvisioningRun(harness.deps, { workerId: 'worker-1', now });

    expect(state.logger.warn).toHaveBeenCalledWith(
      'tenant_ingress_publish_failed',
      expect.objectContaining({
        operation: 'publish_tenant_ingress',
        result: 'failed',
        instance_id: 'tenant-a',
        run_id: '00000000-0000-4000-8000-000000000001',
        step_key: 'ingress',
        diagnostic_error: expect.objectContaining({
          name: 'Error',
          message: 'open failed password=[REDACTED]',
          code: 'EACCES',
          syscall: 'open',
          path: '/var/lib/sva-studio/traefik-dynamic/.tenant.tmp',
          dest: '/var/lib/sva-studio/traefik-dynamic/tenant.yml',
          stack: expect.any(String),
        }),
        diagnostic_causes: [
          expect.objectContaining({
            name: 'Error',
            message: 'authorization: [REDACTED]',
            stack: expect.any(String),
          }),
        ],
      })
    );
    const logged = JSON.stringify(state.logger.warn.mock.calls);
    expect(logged).not.toContain('outer-secret');
    expect(logged).not.toContain('inner-secret');
    expect(harness.getRun()).toMatchObject({
      status: 'provisioning',
      stepKey: 'ingress',
      errorCode: 'tenant_provisioning_step_failed',
      completedAt: undefined,
    });
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

  it('fails closed when the persisted Kassel plugin composition is empty', async () => {
    const harness = createHarness();
    Object.assign(harness.getRun(), {
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
        'kassel-traefik-file'
      ),
    });

    await processNextTenantProvisioningRun(harness.deps, { workerId: 'worker-1', now });

    expect(harness.getRun()).toMatchObject({
      status: 'failed',
      errorCode: 'provisioning_plugin_snapshot_missing',
    });
    expect(harness.repository.createKeycloakProvisioningRun).not.toHaveBeenCalled();
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

  it('propagates claim loss after activation so the enclosing transaction rolls back', async () => {
    vi.useFakeTimers({ now });
    try {
      const harness = createHarness();
      Object.assign(harness.getRun(), { status: 'provisioning', stepKey: 'activate' });
      vi.mocked(harness.repository.renewProvisioningRunLease)
        .mockResolvedValueOnce(harness.getRun())
        .mockResolvedValueOnce(null);
      vi.mocked(harness.repository.setInstanceStatus).mockImplementation(async ({ status }) => {
        if (status === 'active') await new Promise((resolve) => setTimeout(resolve, 15_000));
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

  it('rechecks the actual deadline before committing activation', async () => {
    vi.useFakeTimers({ now });
    try {
      const harness = createHarness();
      Object.assign(harness.getRun(), {
        status: 'provisioning',
        stepKey: 'activate',
        deadlineAt: new Date(now.getTime() + 10_000).toISOString(),
      });
      vi.mocked(harness.repository.setInstanceStatus).mockImplementation(async ({ status }) => {
        if (status === 'active') await new Promise((resolve) => setTimeout(resolve, 15_000));
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
