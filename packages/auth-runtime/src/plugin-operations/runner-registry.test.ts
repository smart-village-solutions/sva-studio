import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  createJobLifecycleOrchestrator: vi.fn(),
  withPluginTenantLifecycleRepository: vi.fn(),
  withStudioJobLifecycleRepositories: vi.fn(),
  withStudioJobRepository: vi.fn(),
}));

vi.mock('./job-lifecycle-orchestrator.js', () => ({
  createJobLifecycleOrchestrator: state.createJobLifecycleOrchestrator,
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

describe('plugin operation runner registry', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
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

  it('persists lifecycle and job terminal state through one repository transaction', async () => {
    const registry = await import('./runner-registry.js');
    const run = vi.fn(async () => undefined);
    const updateJobState = vi.fn(async () => undefined);
    const failLifecycle = vi.fn(async () => undefined);
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
    state.withStudioJobRepository.mockImplementation(async (_instanceId, work) =>
      work({
        getJobById: vi.fn(async () => lifecycleJob),
        updateJobState: vi.fn(async () => undefined),
      })
    );
    state.withStudioJobLifecycleRepositories.mockImplementation(async (_instanceId, work) =>
      work({
        studioJobs: { updateJobState },
        tenantLifecycle: { failLifecycle },
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
      errorPayload: { code: 'provision_failed', category: 'permanent' as const },
    };
    await repository.updateJobState(terminalInput);

    expect(failLifecycle).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: lifecycleJob.id,
        generation: 3,
        errorCode: 'provision_failed',
      })
    );
    expect(updateJobState).toHaveBeenCalledWith(terminalInput);
    expect(state.withStudioJobLifecycleRepositories).toHaveBeenCalledWith(
      'tenant-a',
      expect.any(Function)
    );
  });
});
