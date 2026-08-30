import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  createStudioJob: vi.fn(),
  markPluginOperationEnqueueFailed: vi.fn(async () => undefined),
  queuePluginOperationJob: vi.fn(async () => undefined),
  requestLifecycle: vi.fn(),
  claimLifecycle: vi.fn(),
  failLifecycle: vi.fn(),
  getModuleActivationPolicy: vi.fn(async () => ({
    activationPolicy: 'automatic' as const,
    effectiveActive: true,
    stateRevision: 1,
  })),
}));

vi.mock('../iam-instance-registry/plugin-activation-policy-snapshot.js', () => ({
  readInstanceRegistryPluginTenantLifecycleRegistry: () =>
    new Map([
      [
        'speech',
        {
          pluginId: 'speech',
          contractVersion: 1,
          operations: [{ operation: 'provision', jobTypeId: 'speech.provisionTenant' }],
          readinessChecks: [],
        },
      ],
    ]),
}));

vi.mock('../iam-instance-registry/repository.js', () => ({
  withRegistryRepository: async (work: (repository: unknown) => Promise<unknown>) =>
    work({ getModuleActivationPolicy: state.getModuleActivationPolicy }),
}));

vi.mock('../plugin-operations/core.shared.js', () => ({
  createStudioJob: state.createStudioJob,
  markPluginOperationEnqueueFailed: state.markPluginOperationEnqueueFailed,
}));

vi.mock('../plugin-operations/repository.js', () => ({
  withPluginTenantLifecycleRepository: async (
    _instanceId: string,
    work: (repository: unknown) => Promise<unknown>
  ) =>
    work({
      requestLifecycle: state.requestLifecycle,
      claimLifecycle: state.claimLifecycle,
      failLifecycle: state.failLifecycle,
    }),
}));

vi.mock('../plugin-operations/runner.js', () => ({
  getRegisteredPluginOperationExecutionRegistry: () =>
    new Map([
      [
        'speech.provisionTenant',
        { handler: vi.fn(), queueName: 'plugin-operations', supportsCancellation: false },
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
    });
  });
});
