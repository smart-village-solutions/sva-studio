import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  createJobLifecycleOrchestrator: vi.fn(),
  withPluginTenantLifecycleRepository: vi.fn(),
  withStudioJobLifecycleRepositories: vi.fn(),
  withStudioJobRepository: vi.fn(),
  runConfiguredPluginTenantProvisioningSchedule: vi.fn(async () => undefined),
  scheduleConfiguredPluginTenantProvisioning: vi.fn(),
  enqueuePluginTenantLifecycleRetry: vi.fn(async () => undefined),
  isConfiguredPluginTenantLifecycleJobType: vi.fn(() => false),
  getLifecycle: vi.fn(),
  readTenantAccess: vi.fn(async () => ({ allowed: true, reason: 'ready' })),
}));

vi.mock('./job-lifecycle-orchestrator.js', () => ({
  createJobLifecycleOrchestrator: state.createJobLifecycleOrchestrator,
}));

vi.mock('../plugin-tenant-lifecycle/access.js', () => ({
  isConfiguredPluginTenantEffectivelyActive: vi.fn(async () => true),
  isConfiguredPluginTenantLifecycleJobType: state.isConfiguredPluginTenantLifecycleJobType,
  readConfiguredPluginTenantAccess: state.readTenantAccess,
}));

vi.mock('../iam-instance-registry/plugin-activation-policy-snapshot.js', () => ({
  readInstanceRegistryPluginActivationPolicies: () => new Map(),
  readInstanceRegistryPluginTenantLifecycleRegistry: () =>
    new Map([
      [
        'waste-management',
        {
          pluginId: 'waste-management',
          contractVersion: 1,
          operations: [
            {
              operation: 'provision',
              jobTypeId: 'waste-management.provision-tenant-database',
            },
          ],
          readinessChecks: [],
        },
      ],
    ]),
}));

vi.mock('./repository.js', () => ({
  withPluginTenantLifecycleRepository: state.withPluginTenantLifecycleRepository,
  withStudioJobLifecycleRepositories: state.withStudioJobLifecycleRepositories,
  withStudioJobRepository: state.withStudioJobRepository,
}));

vi.mock('../iam-instance-registry/repository.js', () => ({
  runConfiguredPluginTenantProvisioningSchedule:
    state.runConfiguredPluginTenantProvisioningSchedule,
  scheduleConfiguredPluginTenantProvisioning: state.scheduleConfiguredPluginTenantProvisioning,
}));

describe('plugin operation runner registry', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    state.isConfiguredPluginTenantLifecycleJobType.mockReturnValue(false);
    state.getLifecycle.mockResolvedValue(null);
    state.readTenantAccess.mockResolvedValue({ allowed: true, reason: 'ready' });
  });

  it('rejects a lifecycle handler when its persisted claim no longer matches the job', async () => {
    const registry = await import('./runner-registry.js');
    const run = vi.fn(async () => undefined);
    const handler = vi.fn(async () => ({}));
    state.createJobLifecycleOrchestrator.mockReturnValue({ run });
    state.isConfiguredPluginTenantLifecycleJobType.mockReturnValue(true);
    state.withPluginTenantLifecycleRepository.mockImplementation(async (_instanceId, work) =>
      work({ getLifecycle: state.getLifecycle })
    );
    state.getLifecycle.mockResolvedValue({
      activeJobId: 'newer-job',
      claimedGeneration: 4,
      desiredOperation: 'provision',
    });
    const lifecycleJob = {
      id: 'stale-job',
      instanceId: 'tenant-a',
      source: 'plugin' as const,
      pluginId: 'waste-management',
      jobTypeId: 'waste-management.provision-tenant-database',
      inputPayload: {
        studioTenantLifecycle: { operation: 'provision', generation: 3 },
      },
    };
    const taskList = registry.createStudioJobTaskList(
      () =>
        new Map([
          [
            'plugin:waste-management.provision-tenant-database',
            {
              source: 'plugin' as const,
              jobTypeId: 'waste-management.provision-tenant-database',
              handler,
              queueName: 'plugin-operations',
            },
          ],
        ])
    );
    await taskList[registry.studioJobTaskIdentifier]?.(
      { instanceId: 'tenant-a', jobId: 'stale-job' },
      { job: { attempts: 1, max_attempts: 5 } } as never
    );
    const [{ resolveHandler }] = state.createJobLifecycleOrchestrator.mock.calls.at(0) ?? [];

    await expect(resolveHandler(lifecycleJob)?.({ job: lifecycleJob })).rejects.toThrow(
      'plugin_tenant_lifecycle_claim_stale'
    );
    expect(handler).not.toHaveBeenCalled();
  });

  it('treats a matching generic job without lifecycle metadata as a regular plugin job', async () => {
    const registry = await import('./runner-registry.js');
    const handler = vi.fn(async () => ({}));
    state.isConfiguredPluginTenantLifecycleJobType.mockReturnValue(true);
    const genericJob = {
      id: 'manual-retry-job',
      instanceId: 'tenant-a',
      source: 'plugin' as const,
      pluginId: 'waste-management',
      jobTypeId: 'waste-management.provision-tenant-database',
      inputPayload: { requestedBy: 'manual-retry' },
    };
    const taskList = registry.createStudioJobTaskList(
      () =>
        new Map([
          [
            'plugin:waste-management.provision-tenant-database',
            {
              source: 'plugin' as const,
              jobTypeId: 'waste-management.provision-tenant-database',
              handler,
              queueName: 'plugin-operations',
            },
          ],
        ])
    );
    await taskList[registry.studioJobTaskIdentifier]?.(
      { instanceId: 'tenant-a', jobId: genericJob.id },
      { job: { attempts: 1, max_attempts: 5 } } as never
    );
    const [{ resolveHandler }] = state.createJobLifecycleOrchestrator.mock.calls.at(0) ?? [];

    await expect(resolveHandler(genericJob)?.({ job: genericJob })).resolves.toEqual({});
    expect(state.readTenantAccess).toHaveBeenCalledWith('tenant-a', 'waste-management');
    expect(state.withPluginTenantLifecycleRepository).not.toHaveBeenCalled();
  });

  it('does not correlate reserved metadata on a non-lifecycle job', async () => {
    const registry = await import('./runner-registry.js');
    const run = vi.fn(async () => undefined);
    const updateJobState = vi.fn(async () => ({ status: 'succeeded' }));
    const genericJob = {
      id: 'generic-job',
      instanceId: 'tenant-a',
      source: 'plugin' as const,
      pluginId: 'news',
      jobTypeId: 'news.import-articles',
      inputPayload: {
        studioTenantLifecycle: { operation: 'provision', generation: 3 },
      },
    };
    state.createJobLifecycleOrchestrator.mockReturnValue({ run });
    state.isConfiguredPluginTenantLifecycleJobType.mockReturnValue(false);
    state.withStudioJobRepository.mockImplementation(async (_instanceId, work) =>
      work({ getJobById: vi.fn(async () => genericJob), updateJobState })
    );
    const taskList = registry.createStudioJobTaskList(() => new Map());

    await taskList[registry.studioJobTaskIdentifier]?.(
      { instanceId: 'tenant-a', jobId: genericJob.id },
      { job: { attempts: 1, max_attempts: 5 } } as never
    );
    const [{ loadRepository }] = state.createJobLifecycleOrchestrator.mock.calls.at(0) ?? [];
    const repository = await loadRepository('tenant-a');
    await repository.getJobById('tenant-a', genericJob.id);
    const succeededInput = {
      jobId: genericJob.id,
      instanceId: 'tenant-a',
      status: 'succeeded' as const,
      attempts: 1,
    };
    await repository.updateJobState(succeededInput);

    expect(updateJobState).toHaveBeenCalledWith(succeededInput);
    expect(state.withStudioJobLifecycleRepositories).not.toHaveBeenCalled();
  });

  it('registers host and plugin handlers separately and exposes plugin registrations in plugin shape', async () => {
    const registry = await import('./runner-registry.js');

    const hostHandler = vi.fn(async () => ({}));
    const pluginHandler = vi.fn(async () => undefined);

    registry.registerStudioJobExecutionHandlers([
      {
        source: 'host',
        jobTypeId: 'studio.cleanup',
        handler: hostHandler,
        queueName: 'host-queue',
      },
    ]);
    registry.registerPluginOperationExecutionHandlers({
      'waste.import': pluginHandler,
      'waste.sync': {
        handler: pluginHandler,
        queueName: 'custom-plugin-queue',
        executionLane: 'privileged',
        supportsCancellation: true,
      },
    });

    expect(registry.getRegisteredStudioJobExecutionRegistry()).toEqual(
      new Map([
        [
          'host:studio.cleanup',
          {
            source: 'host',
            jobTypeId: 'studio.cleanup',
            handler: hostHandler,
            queueName: 'host-queue',
          },
        ],
        [
          'plugin:waste.import',
          expect.objectContaining({
            source: 'plugin',
            jobTypeId: 'waste.import',
            queueName: 'plugin-operations',
          }),
        ],
        [
          'plugin:waste.sync',
          expect.objectContaining({
            source: 'plugin',
            jobTypeId: 'waste.sync',
            queueName: 'custom-plugin-queue',
            executionLane: 'privileged',
            supportsCancellation: true,
          }),
        ],
      ])
    );

    const pluginRegistry = registry.getRegisteredPluginOperationExecutionRegistry();
    expect(pluginRegistry.get('waste.import')).toEqual({
      handler: expect.any(Function),
      queueName: 'plugin-operations',
      executionLane: 'default',
      supportsCancellation: false,
    });
    expect(pluginRegistry.get('waste.sync')).toEqual({
      handler: expect.any(Function),
      queueName: 'custom-plugin-queue',
      executionLane: 'privileged',
      supportsCancellation: true,
    });
  });

  it('creates a studio job task that delegates lifecycle orchestration through the repository wrapper', async () => {
    const registry = await import('./runner-registry.js');
    const run = vi.fn(async () => undefined);
    state.createJobLifecycleOrchestrator.mockReturnValue({ run });
    state.withStudioJobRepository.mockImplementation(
      async (_instanceId, work) =>
        await work({
          getJobById: vi.fn(async () => ({ id: 'job-1' })),
          updateJobState: vi.fn(async () => undefined),
          updateJobProgress: vi.fn(async () => undefined),
          appendJobEvent: vi.fn(async () => undefined),
        })
    );

    const handler = vi.fn(async () => ({}));
    const taskList = registry.createStudioJobTaskList(
      () =>
        new Map([
          [
            'plugin:waste.import',
            {
              source: 'plugin',
              jobTypeId: 'waste.import',
              handler,
              queueName: 'plugin-operations',
            },
          ],
        ])
    );

    await taskList[registry.studioJobTaskIdentifier]?.({ instanceId: 'tenant-a', jobId: 'job-1' }, {
      job: { attempts: 2, max_attempts: 5 },
    } as never);

    expect(state.createJobLifecycleOrchestrator).toHaveBeenCalledWith(
      expect.objectContaining({
        resolveHandler: expect.any(Function),
        loadRepository: expect.any(Function),
        onExecutionSucceeded: expect.any(Function),
      })
    );
    const [{ resolveHandler, loadRepository }] =
      state.createJobLifecycleOrchestrator.mock.calls.at(0) ?? [];
    expect(resolveHandler({ source: 'plugin', jobTypeId: 'waste.import' })).toBe(handler);
    const repository = await loadRepository('tenant-a');
    await repository.getJobById('tenant-a', 'job-1');
    expect(state.withStudioJobRepository).toHaveBeenCalledWith('tenant-a', expect.any(Function));
    expect(run).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      jobId: 'job-1',
      attempts: 2,
      maxAttempts: 5,
    });
  });

  it('propagates durable lifecycle retry task failures to the worker', async () => {
    const registry = await import('./runner-registry.js');
    const taskList = registry.createStudioJobTaskList(() => new Map());
    state.runConfiguredPluginTenantProvisioningSchedule.mockRejectedValueOnce(
      new Error('registry unavailable')
    );

    await expect(
      taskList[registry.pluginTenantLifecycleRetryTaskIdentifier]?.(
        { instanceId: 'tenant-a' },
        {} as never
      )
    ).rejects.toThrow('registry unavailable');

    expect(state.runConfiguredPluginTenantProvisioningSchedule).toHaveBeenCalledWith('tenant-a');
  });

  it('persists lifecycle and successful job state through one repository transaction', async () => {
    const registry = await import('./runner-registry.js');
    const run = vi.fn(async () => undefined);
    const transitionJobStateAndAppendEvent = vi.fn(async () => ({
      outcome: 'applied' as const,
      job: { status: 'succeeded' },
    }));
    const completeLifecycle = vi.fn(async (input) => ({
      outcome: 'applied' as const,
      record: input,
    }));
    const lifecycleJob = {
      id: '7dbe0bb5-4689-46b0-b21f-0d9ea3cd9489',
      instanceId: 'tenant-a',
      source: 'plugin',
      pluginId: 'waste-management',
      jobTypeId: 'waste-management.provision-tenant-database',
      queueName: 'plugin-operations',
      status: 'running',
      inputPayload: { studioTenantLifecycle: { operation: 'provision', generation: 3 } },
      attempts: 1,
      maxAttempts: 5,
      idempotencyKey: 'waste-management:tenant-lifecycle:provision:3',
      scheduledAt: '2026-08-30T12:00:00.000Z',
      createdAt: '2026-08-30T12:00:00.000Z',
      updatedAt: '2026-08-30T12:00:00.000Z',
    };
    state.createJobLifecycleOrchestrator.mockReturnValue({ run });
    state.isConfiguredPluginTenantLifecycleJobType.mockReturnValue(true);
    state.withStudioJobRepository.mockImplementation(async (_instanceId, work) =>
      work({ getJobById: vi.fn(async () => lifecycleJob) })
    );
    state.withStudioJobLifecycleRepositories.mockImplementation(async (_instanceId, work) =>
      work({
        studioJobs: { transitionJobStateAndAppendEvent },
        tenantLifecycle: { completeLifecycle, getLifecycle: vi.fn() },
      })
    );

    const taskList = registry.createStudioJobTaskList(() => new Map());
    await taskList[registry.studioJobTaskIdentifier]?.(
      { instanceId: 'tenant-a', jobId: lifecycleJob.id },
      { job: { attempts: 1, max_attempts: 5 } } as never
    );
    const [{ loadRepository, onExecutionSucceeded }] =
      state.createJobLifecycleOrchestrator.mock.calls.at(0) ?? [];
    const repository = await loadRepository('tenant-a');
    await repository.getJobById('tenant-a', lifecycleJob.id);
    await onExecutionSucceeded({
      job: lifecycleJob,
      result: {
        tenantLifecycle: {
          revision: 'waste-db-v3',
          checks: [],
        },
      },
    });
    const succeededInput = {
      jobId: lifecycleJob.id,
      instanceId: 'tenant-a',
      status: 'succeeded' as const,
      attempts: 1,
    };
    await repository.persistTerminalState({
      state: { ...succeededInput, workerId: 'worker-1' },
      event: { eventType: 'job.succeeded', status: 'succeeded', attempts: 1 },
    });

    expect(completeLifecycle).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: lifecycleJob.id, generation: 3 })
    );
    expect(transitionJobStateAndAppendEvent).toHaveBeenCalledWith(
      expect.objectContaining({ ...succeededInput, expectedWorkerId: 'worker-1' })
    );
    expect(state.withStudioJobLifecycleRepositories).toHaveBeenCalledWith(
      'tenant-a',
      expect.any(Function)
    );
  });

  it('persists lifecycle failure and schedules its durable retry deadline', async () => {
    const registry = await import('./runner-registry.js');
    const run = vi.fn(async () => undefined);
    const transitionJobStateAndAppendEvent = vi.fn(async (input) => ({
      outcome: 'applied' as const,
      job: input,
    }));
    const failLifecycle = vi.fn(
      async (input: { readonly retryKind: 'retryable'; readonly retryAfter?: string }) => ({
        outcome: 'applied' as const,
        record: input,
      })
    );
    const lifecycleJob = {
      id: '7dbe0bb5-4689-46b0-b21f-0d9ea3cd9489',
      instanceId: 'tenant-a',
      source: 'plugin',
      pluginId: 'waste-management',
      jobTypeId: 'waste-management.provision-tenant-database',
      queueName: 'plugin-operations',
      status: 'running',
      inputPayload: {
        studioTenantLifecycle: { operation: 'provision', generation: 3 },
      },
      attempts: 5,
      maxAttempts: 5,
      idempotencyKey: 'waste-management:tenant-lifecycle:provision:3',
      scheduledAt: '2026-08-30T12:00:00.000Z',
      createdAt: '2026-08-30T12:00:00.000Z',
      updatedAt: '2026-08-30T12:00:00.000Z',
    };
    state.createJobLifecycleOrchestrator.mockReturnValue({ run });
    state.isConfiguredPluginTenantLifecycleJobType.mockReturnValue(true);
    state.withStudioJobRepository.mockImplementation(async (_instanceId, work) =>
      work({
        getJobById: vi.fn(async () => lifecycleJob),
        updateJobState: vi.fn(async () => undefined),
      })
    );
    state.withStudioJobLifecycleRepositories.mockImplementation(async (_instanceId, work) =>
      work({
        studioJobs: { transitionJobStateAndAppendEvent },
        tenantLifecycle: { failLifecycle },
        enqueuePluginTenantLifecycleRetry: state.enqueuePluginTenantLifecycleRetry,
      })
    );

    const taskList = registry.createStudioJobTaskList(() => new Map());
    await taskList[registry.studioJobTaskIdentifier]?.(
      { instanceId: 'tenant-a', jobId: lifecycleJob.id },
      { job: { attempts: 5, max_attempts: 5 } } as never
    );
    const [{ loadRepository }] = state.createJobLifecycleOrchestrator.mock.calls.at(0) ?? [];
    const repository = await loadRepository('tenant-a');
    await repository.getJobById('tenant-a', lifecycleJob.id);
    const terminalInput = {
      jobId: lifecycleJob.id,
      instanceId: 'tenant-a',
      status: 'failed' as const,
      attempts: 5,
      errorPayload: {
        code: 'provision_failed',
        category: 'transient' as const,
        details: {
          plugin: {
            code: 'waste-management.databaseUnavailable',
            messageKey: 'waste-management.errors.databaseUnavailable',
            retry: { kind: 'retryable' as const, retryAfterMs: 600_000 },
          },
        },
      },
    };
    await repository.persistTerminalState({
      state: { ...terminalInput, workerId: 'worker-1' },
      event: { eventType: 'job.failed', status: 'failed', attempts: 5 },
    });

    expect(failLifecycle).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: lifecycleJob.id,
        generation: 3,
        errorCode: 'waste-management.databaseUnavailable',
      })
    );
    expect(transitionJobStateAndAppendEvent).toHaveBeenCalledWith(
      expect.objectContaining({ ...terminalInput, expectedWorkerId: 'worker-1' })
    );
    expect(state.withStudioJobLifecycleRepositories).toHaveBeenCalledWith(
      'tenant-a',
      expect.any(Function)
    );
    const persistedRetryAfter = failLifecycle.mock.calls[0]?.[0].retryAfter;
    expect(persistedRetryAfter).toEqual(expect.any(String));
    expect(state.enqueuePluginTenantLifecycleRetry).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      pluginId: 'waste-management',
      runAt: new Date(persistedRetryAfter as string),
    });
    expect(state.scheduleConfiguredPluginTenantProvisioning).not.toHaveBeenCalled();
  });
});
