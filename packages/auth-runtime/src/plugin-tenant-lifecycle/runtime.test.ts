import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  createStudioJob: vi.fn(),
  markPluginOperationEnqueueFailed: vi.fn(async () => undefined),
  markStudioJobEnqueueFailed: vi.fn(async () => undefined),
  queuePluginOperationJob: vi.fn(async () => undefined),
  requestLifecycle: vi.fn(),
  claimLifecycle: vi.fn(),
  failUnclaimedLifecycle: vi.fn(),
  failLifecycle: vi.fn(),
  updateJobState: vi.fn(),
  withStudioJobLifecycleRepositories: vi.fn(),
  getLifecycle: vi.fn(),
  readinessChecks: [] as Array<{
    checkId: string;
    titleKey: string;
    required: boolean;
  }>,
  listModuleActivations: vi.fn(async () => [
    {
      moduleId: 'speech',
      activationPolicy: 'automatic' as const,
      effectiveActive: true,
      stateRevision: 1,
    },
  ]),
  getModuleActivationPolicy: vi.fn(async () => ({
    activationPolicy: 'automatic' as const,
    effectiveActive: true,
    stateRevision: 1,
  })),
}));

vi.mock('../iam-instance-registry/plugin-activation-policy-snapshot.js', () => ({
  readInstanceRegistryPluginActivationPolicies: () => ({
    revision: 'catalog-1',
    modules: [
      {
        moduleId: 'speech',
        activationPolicy: 'automatic',
        manifestVersion: 1,
        policyRevision: 'speech-1',
      },
    ],
  }),
  readInstanceRegistryPluginTenantLifecycleRegistry: () =>
    new Map([
      [
        'speech',
        {
          pluginId: 'speech',
          contractVersion: 1,
          operations: [{ operation: 'provision', jobTypeId: 'speech.provisionTenant' }],
          readinessChecks: state.readinessChecks,
        },
      ],
    ]),
}));

vi.mock('../iam-instance-registry/repository.js', () => ({
  withRegistryRepository: async (work: (repository: unknown) => Promise<unknown>) =>
    work({
      getModuleActivationPolicy: state.getModuleActivationPolicy,
      listModuleActivations: state.listModuleActivations,
    }),
}));

vi.mock('../plugin-operations/core.shared.js', () => ({
  createStudioJob: state.createStudioJob,
  markPluginOperationEnqueueFailed: state.markPluginOperationEnqueueFailed,
  markStudioJobEnqueueFailed: state.markStudioJobEnqueueFailed,
}));

vi.mock('../plugin-operations/repository.js', () => ({
  withPluginTenantLifecycleRepository: async (
    _instanceId: string,
    work: (repository: unknown) => Promise<unknown>
  ) =>
    work({
      requestLifecycle: state.requestLifecycle,
      claimLifecycle: state.claimLifecycle,
      failUnclaimedLifecycle: state.failUnclaimedLifecycle,
      failLifecycle: state.failLifecycle,
      getLifecycle: state.getLifecycle,
    }),
  withStudioJobLifecycleRepositories: state.withStudioJobLifecycleRepositories,
}));

vi.mock('../plugin-operations/runner.js', () => ({
  getRegisteredPluginOperationExecutionRegistry: () =>
    new Map([
      [
        'speech.provisionTenant',
        {
          handler: vi.fn(),
          queueName: 'plugin-operations',
          executionLane: 'privileged',
          supportsCancellation: false,
        },
      ],
    ]),
  queuePluginOperationJob: state.queuePluginOperationJob,
}));

const lifecycleRecord = {
  instanceId: 'tenant-a',
  pluginId: 'speech',
  accessState: 'active' as const,
  readinessStatus: 'pending' as const,
  desiredOperation: 'provision' as const,
  desiredGeneration: 3,
  completedGeneration: 2,
  readinessChecks: [],
  requestedAt: '2026-08-30T12:00:00.000Z',
  updatedAt: '2026-08-30T12:00:00.000Z',
};

const job = {
  id: '7dbe0bb5-4689-46b0-b21f-0d9ea3cd9489',
  instanceId: 'tenant-a',
  source: 'plugin' as const,
  pluginId: 'speech',
  jobTypeId: 'speech.provisionTenant',
  queueName: 'plugin-operations',
  status: 'queued' as const,
  inputPayload: {},
  attempts: 0,
  maxAttempts: 5,
  idempotencyKey: 'speech:tenant-lifecycle:provision:3',
  scheduledAt: '2026-08-30T12:00:00.000Z',
  createdAt: '2026-08-30T12:00:00.000Z',
  updatedAt: '2026-08-30T12:00:00.000Z',
};

describe('configured plugin tenant lifecycle runtime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.requestLifecycle.mockResolvedValue(lifecycleRecord);
    state.claimLifecycle.mockResolvedValue({
      ...lifecycleRecord,
      claimedGeneration: 3,
      activeJobId: job.id,
    });
    state.createStudioJob.mockResolvedValue(job);
    state.getLifecycle.mockResolvedValue(null);
    state.readinessChecks = [];
    state.updateJobState.mockResolvedValue(job);
    state.failLifecycle.mockResolvedValue(lifecycleRecord);
    state.withStudioJobLifecycleRepositories.mockImplementation(async (_instanceId, work) =>
      work({
        studioJobs: { updateJobState: state.updateJobState },
        tenantLifecycle: { failLifecycle: state.failLifecycle },
      })
    );
  });

  it('starts a declared active lifecycle operation through the shared job runtime', async () => {
    const { startConfiguredPluginTenantLifecycle } = await import('./runtime.js');

    await expect(
      startConfiguredPluginTenantLifecycle({
        instanceId: 'tenant-a',
        pluginId: 'speech',
        operation: 'provision',
        actorAccountId: 'account-a',
        requestId: 'request-a',
        scheduledAt: '2026-08-30T12:00:00.000Z',
      })
    ).resolves.toEqual({
      lifecycle: expect.objectContaining({ claimedGeneration: 3 }),
      job,
    });

    expect(state.getModuleActivationPolicy).toHaveBeenCalledWith('tenant-a', 'speech');
    expect(state.createStudioJob).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'tenant-a',
        create: expect.objectContaining({
          pluginId: 'speech',
          jobTypeId: 'speech.provisionTenant',
          idempotencyKey: 'speech:tenant-lifecycle:provision:3',
          inputPayload: {
            studioTenantLifecycle: { operation: 'provision', generation: 3 },
          },
        }),
      })
    );
    expect(state.queuePluginOperationJob).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      jobId: job.id,
      queueName: 'plugin-operations',
      maxAttempts: 5,
      executionLane: 'privileged',
    });
  });

  it('starts missing provisioning for an automatically activated lifecycle plugin', async () => {
    const { ensureConfiguredPluginTenantProvisioning } = await import('./runtime.js');

    await ensureConfiguredPluginTenantProvisioning('tenant-a');

    expect(state.getLifecycle).toHaveBeenCalledWith('tenant-a', 'speech');
    expect(state.createStudioJob).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'tenant-a',
        create: expect.objectContaining({
          pluginId: 'speech',
          jobTypeId: 'speech.provisionTenant',
        }),
      })
    );
  });

  it('does not repeat automatic provisioning with current readiness evidence', async () => {
    state.getLifecycle.mockResolvedValue({
      ...lifecycleRecord,
      readinessStatus: 'ready',
      desiredGeneration: 3,
      completedGeneration: 3,
    });
    const { ensureConfiguredPluginTenantProvisioning } = await import('./runtime.js');

    await ensureConfiguredPluginTenantProvisioning('tenant-a');

    expect(state.createStudioJob).not.toHaveBeenCalled();
  });

  it('does not retry automatic provisioning before the declared retry deadline', async () => {
    state.getLifecycle.mockResolvedValue({
      ...lifecycleRecord,
      retryKind: 'retryable',
      retryAfter: '2999-08-30T12:05:00.000Z',
    });
    const { ensureConfiguredPluginTenantProvisioning } = await import('./runtime.js');

    await ensureConfiguredPluginTenantProvisioning('tenant-a');

    expect(state.createStudioJob).not.toHaveBeenCalled();
  });

  it('re-provisions when persisted readiness no longer matches the current declaration', async () => {
    state.readinessChecks = [
      {
        checkId: 'speech.current-contract',
        titleKey: 'speech.readiness.currentContract',
        required: true,
      },
    ];
    state.getLifecycle.mockResolvedValue({
      ...lifecycleRecord,
      readinessStatus: 'ready',
      desiredGeneration: 3,
      completedGeneration: 3,
      readinessChecks: [],
    });
    const { ensureConfiguredPluginTenantProvisioning } = await import('./runtime.js');

    await ensureConfiguredPluginTenantProvisioning('tenant-a');

    expect(state.createStudioJob).toHaveBeenCalled();
  });

  it('provisions an effectively active optional lifecycle plugin', async () => {
    state.listModuleActivations.mockResolvedValueOnce([
      {
        moduleId: 'speech',
        activationPolicy: 'optional',
        effectiveActive: true,
        stateRevision: 2,
      },
    ]);
    const { ensureConfiguredPluginTenantProvisioning } = await import('./runtime.js');

    await ensureConfiguredPluginTenantProvisioning('tenant-a');

    expect(state.createStudioJob).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ jobTypeId: 'speech.provisionTenant' }),
      })
    );
  });

  it('does not auto-provision a suspended lifecycle', async () => {
    state.getLifecycle.mockResolvedValueOnce({
      ...lifecycleRecord,
      accessState: 'suspended',
      activeJobId: undefined,
    });
    const { ensureConfiguredPluginTenantProvisioning } = await import('./runtime.js');

    await ensureConfiguredPluginTenantProvisioning('tenant-a');

    expect(state.createStudioJob).not.toHaveBeenCalled();
  });

  it('persists job and lifecycle enqueue failure through one transaction', async () => {
    state.queuePluginOperationJob.mockRejectedValueOnce(new Error('queue unavailable'));
    const { startConfiguredPluginTenantLifecycle } = await import('./runtime.js');

    await expect(
      startConfiguredPluginTenantLifecycle({
        instanceId: 'tenant-a',
        pluginId: 'speech',
        operation: 'provision',
        scheduledAt: '2026-08-30T12:00:00.000Z',
      })
    ).rejects.toThrow('plugin_tenant_lifecycle_enqueue_failed:speech:provision');

    expect(state.withStudioJobLifecycleRepositories).toHaveBeenCalledWith(
      'tenant-a',
      expect.any(Function)
    );
    expect(state.failLifecycle).toHaveBeenCalledWith(
      expect.objectContaining({
        pluginId: 'speech',
        jobId: job.id,
        generation: 3,
        retryKind: 'retryable',
      })
    );
    expect(state.updateJobState).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: job.id,
        status: 'failed',
        errorPayload: {
          code: 'plugin_operation_enqueue_failed',
          category: 'permanent',
        },
      })
    );
  });
});
