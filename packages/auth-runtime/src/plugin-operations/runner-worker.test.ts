import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  runMigrations: vi.fn(),
  run: vi.fn(),
  resolvePool: vi.fn(),
  bootstrapStudioAppDbUserIfNeeded: vi.fn(),
  createStudioJobTaskList: vi.fn(),
  getRegisteredStudioJobExecutionRegistry: vi.fn(),
  logger: {
    error: vi.fn(),
  },
}));

vi.mock('graphile-worker', () => ({
  runMigrations: state.runMigrations,
  run: state.run,
}));

vi.mock('../db.js', () => ({
  resolvePool: state.resolvePool,
}));

vi.mock('../postgres-app-user-bootstrap.js', () => ({
  bootstrapStudioAppDbUserIfNeeded: state.bootstrapStudioAppDbUserIfNeeded,
}));

vi.mock('./runner-registry.js', () => ({
  createStudioJobTaskList: state.createStudioJobTaskList,
  getRegisteredStudioJobExecutionRegistry: state.getRegisteredStudioJobExecutionRegistry,
  studioJobTaskIdentifier: 'studio_job_execute',
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => state.logger,
}));

describe('plugin operation runner worker', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.SVA_PLUGIN_OPERATION_WORKER_CONCURRENCY;
    state.resolvePool.mockReturnValue({ id: 'pool-1' });
    state.bootstrapStudioAppDbUserIfNeeded.mockResolvedValue(false);
    state.createStudioJobTaskList.mockReturnValue({ studio_job_execute: vi.fn() });
    state.runMigrations.mockResolvedValue(undefined);
    state.run.mockResolvedValue({
      addJob: vi.fn(async () => undefined),
      stop: vi.fn(async () => undefined),
    });
  });

  it('starts the worker, clamps concurrency, queues jobs, and stops cleanly', async () => {
    process.env.SVA_PLUGIN_OPERATION_WORKER_CONCURRENCY = '99';
    const { ensureStudioJobWorkerStarted, queueStudioJob, stopStudioJobWorker } = await import('./runner-worker.js');

    await ensureStudioJobWorkerStarted();
    await queueStudioJob({
      instanceId: 'tenant-a',
      jobId: 'job-1',
      queueName: 'plugin-operations',
      maxAttempts: 5,
    });
    await stopStudioJobWorker();

    expect(state.run).toHaveBeenCalledWith(
      expect.objectContaining({
        pgPool: { id: 'pool-1' },
        concurrency: 16,
        noHandleSignals: true,
        taskList: { studio_job_execute: expect.any(Function) },
      })
    );
    const runner = await state.run.mock.results[0]?.value;
    expect(runner.addJob).toHaveBeenCalledWith(
      'studio_job_execute',
      {
        instanceId: 'tenant-a',
        jobId: 'job-1',
      },
      {
        queueName: 'plugin-operations',
        maxAttempts: 5,
        jobKey: 'studio-job:job-1',
      }
    );
    expect(runner.stop).toHaveBeenCalledTimes(1);
  });

  it('falls back to concurrency 1 for missing or invalid env values and rejects missing pools', async () => {
    process.env.SVA_PLUGIN_OPERATION_WORKER_CONCURRENCY = '0';
    const { ensureStudioJobWorkerStarted } = await import('./runner-worker.js');

    await ensureStudioJobWorkerStarted();
    expect(state.run).toHaveBeenCalledWith(expect.objectContaining({ concurrency: 1 }));

    await (await import('./runner-worker.js')).stopStudioJobWorker();
    vi.resetModules();
    state.resolvePool.mockReturnValue(null);

    await expect((await import('./runner-worker.js')).ensureStudioJobWorkerStarted()).rejects.toThrow(
      'studio_job_worker_database_unavailable'
    );
  });

  it('resets startup state and logs when worker startup fails without bootstrap recovery', async () => {
    state.runMigrations.mockRejectedValue(new Error('boom'));
    const { ensureStudioJobWorkerStarted } = await import('./runner-worker.js');

    await expect(ensureStudioJobWorkerStarted()).rejects.toThrow('boom');
    await expect(ensureStudioJobWorkerStarted()).rejects.toThrow('boom');

    expect(state.runMigrations).toHaveBeenCalledTimes(2);
    expect(state.logger.error).toHaveBeenCalledWith(
      'Studio-Job-Worker konnte nicht gestartet werden',
      expect.objectContaining({
        operation: 'studio_job_worker_start_failed',
        error: 'boom',
      })
    );
  });

  it('returns early when stop is called before the worker was started', async () => {
    const { stopStudioJobWorker } = await import('./runner-worker.js');
    await expect(stopStudioJobWorker()).resolves.toBeUndefined();
  });
});
