import { describe, expect, it, vi } from 'vitest';
import type {
  InstanceKeycloakProvisioningRun,
  InstanceProvisioningRun,
  InstanceRegistryRecord,
} from '@sva/core';
import type { InstanceRegistryRepository } from '@sva/data-repositories';

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    isLevelEnabled: vi.fn(() => true),
  }),
}));

import { processNextTenantProvisioningRun } from './tenant-provisioning-orchestrator.js';
import type { InstanceRegistryServiceDeps } from './service-types.js';

const now = new Date('2026-09-12T12:00:00.000Z');

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
  desiredSnapshot: {
    instanceId: instance.instanceId,
    parentDomain: instance.parentDomain,
    primaryHostname: instance.primaryHostname,
    realmMode: instance.realmMode,
    authRealm: instance.authRealm,
    authClientId: instance.authClientId,
    authIssuerUrl: instance.authIssuerUrl,
    payloadFingerprint: 'fingerprint-1',
  },
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
  idempotencyKey:
    'parent:00000000-0000-4000-8000-000000000001:keycloak:2026-09-12T12:01:00.000Z',
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
    scheduleProvisioningModuleReconcile: vi.fn(async () => undefined),
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
  };
};

describe('tenant provisioning parent orchestrator', () => {
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
});
