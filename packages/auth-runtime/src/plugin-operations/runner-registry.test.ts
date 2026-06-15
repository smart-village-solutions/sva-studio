import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  createJobLifecycleOrchestrator: vi.fn(),
  withStudioJobRepository: vi.fn(),
}));

vi.mock('./job-lifecycle-orchestrator.js', () => ({
  createJobLifecycleOrchestrator: state.createJobLifecycleOrchestrator,
}));

vi.mock('./repository.js', () => ({
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
          }),
        ],
      ])
    );

    const pluginRegistry = registry.getRegisteredPluginOperationExecutionRegistry();
    expect(pluginRegistry.get('waste.import')).toEqual({
      handler: expect.any(Function),
      queueName: 'plugin-operations',
    });
    expect(pluginRegistry.get('waste.sync')).toEqual({
      handler: expect.any(Function),
      queueName: 'custom-plugin-queue',
    });
  });

  it('creates a studio job task that delegates lifecycle orchestration through the repository wrapper', async () => {
    const registry = await import('./runner-registry.js');
    const run = vi.fn(async () => undefined);
    state.createJobLifecycleOrchestrator.mockReturnValue({ run });
    state.withStudioJobRepository.mockImplementation(async (_instanceId, work) =>
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

    await taskList[registry.studioJobTaskIdentifier]?.(
      { instanceId: 'tenant-a', jobId: 'job-1' },
      {
        job: { attempts: 2, max_attempts: 5 },
      } as never
    );

    expect(state.createJobLifecycleOrchestrator).toHaveBeenCalledWith(
      expect.objectContaining({
        resolveHandler: expect.any(Function),
        loadRepository: expect.any(Function),
      })
    );
    const [{ resolveHandler, loadRepository }] = state.createJobLifecycleOrchestrator.mock.calls.at(0) ?? [];
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
});
