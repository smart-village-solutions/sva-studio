import type { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  runTaskList: vi.fn(),
  resolvePool: vi.fn(),
  resolveStudioJobWorkerPool: vi.fn(),
  createStudioJobTaskList: vi.fn(),
  getRegisteredStudioJobExecutionRegistry: vi.fn(),
  logger: {
    error: vi.fn(),
  },
}));

vi.mock('graphile-worker', () => ({
  runTaskList: state.runTaskList,
}));

vi.mock('../db.js', () => ({
  resolvePool: state.resolvePool,
  resolveStudioJobWorkerPool: state.resolveStudioJobWorkerPool,
}));

vi.mock('./runner-registry.js', () => ({
  createStudioJobTaskList: state.createStudioJobTaskList,
  getRegisteredStudioJobExecutionRegistry: state.getRegisteredStudioJobExecutionRegistry,
  studioJobTaskIdentifier: 'studio_job_execute',
  privilegedStudioJobTaskIdentifier: 'studio_job_execute_privileged',
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => state.logger,
}));

describe('plugin operation runner worker', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.SVA_PLUGIN_OPERATION_WORKER_CONCURRENCY;
    delete process.env.SVA_PLUGIN_OPERATION_WORKER_LANE;
    state.resolvePool.mockReturnValue({ query: vi.fn(async () => undefined) });
    state.resolveStudioJobWorkerPool.mockReturnValue({ id: 'worker-pool-1' });
    state.createStudioJobTaskList.mockReturnValue({ studio_job_execute: vi.fn() });
    state.runTaskList.mockImplementation((options: { events: EventEmitter }) => {
      queueMicrotask(() => {
        options.events.emit('pool:listen:success', {});
        options.events.emit('worker:getJob:empty', {});
      });
      return {
        gracefulShutdown: vi.fn(async () => undefined),
        promise: Promise.resolve(),
      };
    });
  });

  it('starts the worker, clamps concurrency, queues jobs, and stops cleanly', async () => {
    process.env.SVA_PLUGIN_OPERATION_WORKER_CONCURRENCY = '99';
    const {
      ensureStudioJobWorkerStarted,
      getStudioJobWorkerHealth,
      queueStudioJob,
      stopStudioJobWorker,
    } = await import('./runner-worker.js');

    await ensureStudioJobWorkerStarted();
    expect(getStudioJobWorkerHealth()).toEqual({ ready: true, status: 'running' });
    await queueStudioJob({
      instanceId: 'tenant-a',
      jobId: 'job-1',
      queueName: 'plugin-operations',
      maxAttempts: 5,
      runAt: new Date('2026-05-01T10:00:00.000Z'),
    });
    await stopStudioJobWorker();
    expect(getStudioJobWorkerHealth()).toEqual({
      ready: false,
      reasonCode: 'studio_job_worker_stopped',
      status: 'stopped',
    });

    expect(state.runTaskList).toHaveBeenCalledWith(
      expect.objectContaining({
        concurrency: 16,
        noHandleSignals: true,
      }),
      { studio_job_execute: expect.any(Function) },
      { id: 'worker-pool-1' }
    );
    expect(state.resolvePool.mock.results[0]?.value.query).toHaveBeenCalledWith(
      expect.stringContaining('graphile_worker.sva_enqueue_job'),
      [
        'studio_job_execute',
        JSON.stringify({ instanceId: 'tenant-a', jobId: 'job-1' }),
        'plugin-operations',
        5,
        'studio-job:job-1',
        new Date('2026-05-01T10:00:00.000Z'),
      ]
    );
    expect(state.runTaskList.mock.results[0]?.value.gracefulShutdown).toHaveBeenCalledTimes(1);
  });

  it('persists independent deadline-driven lifecycle retries per plugin', async () => {
    const { enqueuePluginTenantLifecycleRetry } = await import('./runner-queue.js');
    const runAt = new Date('2026-08-30T12:10:00.000Z');
    const pool = state.resolvePool();

    await enqueuePluginTenantLifecycleRetry(pool, {
      instanceId: 'tenant-a',
      pluginId: 'waste-management',
      runAt,
    });
    await enqueuePluginTenantLifecycleRetry(pool, {
      instanceId: 'tenant-a',
      pluginId: 'speech-flow',
      runAt,
    });

    expect(state.resolvePool.mock.results[0]?.value.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('graphile_worker.sva_enqueue_job'),
      [
        'plugin_tenant_lifecycle_retry',
        JSON.stringify({ instanceId: 'tenant-a', pluginId: 'waste-management' }),
        'plugin-tenant-lifecycle',
        5,
        'plugin-tenant-lifecycle-retry:tenant-a:waste-management',
        runAt,
      ]
    );
    expect(state.resolvePool.mock.results[0]?.value.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('graphile_worker.sva_enqueue_job'),
      expect.arrayContaining(['plugin-tenant-lifecycle-retry:tenant-a:speech-flow'])
    );
  });

  it('uses a separate durable job key for lifecycle enqueue recovery', async () => {
    const { enqueuePluginTenantLifecycleRecovery } = await import('./runner-queue.js');
    const runAt = new Date('2026-08-30T12:01:00.000Z');
    const pool = state.resolvePool();

    await enqueuePluginTenantLifecycleRecovery(pool, {
      instanceId: 'tenant-a',
      pluginId: 'speech-flow',
      runAt,
    });

    expect(state.resolvePool.mock.results[0]?.value.query).toHaveBeenCalledWith(
      expect.stringContaining('graphile_worker.sva_enqueue_job'),
      [
        'plugin_tenant_lifecycle_retry',
        JSON.stringify({ instanceId: 'tenant-a', pluginId: 'speech-flow' }),
        'plugin-tenant-lifecycle',
        5,
        'plugin-tenant-lifecycle-recovery:tenant-a:speech-flow',
        runAt,
      ]
    );
  });

  it('runs privileged jobs on a dedicated task identifier that the default worker cannot claim', async () => {
    state.createStudioJobTaskList.mockImplementation((_registry, taskIdentifier) => ({
      [taskIdentifier]: vi.fn(),
    }));
    const {
      ensurePrivilegedStudioJobWorkerStarted,
      queueStudioJob,
      stopPrivilegedStudioJobWorker,
    } = await import('./runner-worker.js');

    await ensurePrivilegedStudioJobWorkerStarted();
    await queueStudioJob({
      instanceId: 'tenant-a',
      jobId: 'job-privileged',
      queueName: 'waste-provisioning',
      maxAttempts: 5,
      executionLane: 'privileged',
    });
    await stopPrivilegedStudioJobWorker();

    expect(state.createStudioJobTaskList).toHaveBeenCalledWith(
      state.getRegisteredStudioJobExecutionRegistry,
      'studio_job_execute_privileged'
    );
    const privilegedRunner = state.runTaskList.mock.results[0]?.value;
    expect(privilegedRunner.gracefulShutdown).toHaveBeenCalledOnce();
    expect(state.resolvePool.mock.results[0]?.value.query).toHaveBeenCalledWith(
      expect.stringContaining('graphile_worker.sva_enqueue_job'),
      expect.arrayContaining(['studio_job_execute_privileged', 'waste-provisioning'])
    );
  });

  it('reports privileged worker startup and asynchronous runtime failures', async () => {
    process.env.SVA_PLUGIN_OPERATION_WORKER_LANE = 'privileged';
    state.runTaskList.mockImplementationOnce(() => {
      throw new Error('privileged startup failed');
    });
    const { ensurePrivilegedStudioJobWorkerStarted, getStudioJobWorkerHealth } =
      await import('./runner-worker.js');

    await expect(ensurePrivilegedStudioJobWorkerStarted()).rejects.toThrow(
      'privileged startup failed'
    );
    expect(getStudioJobWorkerHealth()).toMatchObject({
      ready: false,
      reasonCode: 'privileged_studio_job_worker_start_failed',
      status: 'failed',
    });
    expect(state.logger.error).toHaveBeenCalledWith(
      'Privilegierter Studio-Job-Worker konnte nicht gestartet werden',
      expect.objectContaining({ operation: 'privileged_studio_job_worker_start_failed' })
    );

    let rejectWorker!: (error: Error) => void;
    state.runTaskList.mockReturnValueOnce({
      gracefulShutdown: vi.fn(async () => undefined),
      promise: new Promise<void>((_resolve, reject) => {
        rejectWorker = reject;
      }),
    });
    await ensurePrivilegedStudioJobWorkerStarted();
    rejectWorker(new Error('privileged connection lost'));

    await vi.waitFor(() => {
      expect(getStudioJobWorkerHealth()).toMatchObject({
        reasonCode: 'privileged_studio_job_worker_runtime_failed',
        status: 'failed',
      });
    });

    await ensurePrivilegedStudioJobWorkerStarted();
    const restartedRunner = state.runTaskList.mock.results[2]?.value;
    const events = state.runTaskList.mock.calls[2]?.[0].events as EventEmitter;
    events.emit('worker:fatalError', { error: new Error('privileged worker crashed') });
    await vi.waitFor(() => {
      expect(restartedRunner.gracefulShutdown).toHaveBeenCalledOnce();
    });
  });

  it('falls back to concurrency 1 for missing or invalid env values and rejects missing pools', async () => {
    process.env.SVA_PLUGIN_OPERATION_WORKER_CONCURRENCY = '0';
    const { ensureStudioJobWorkerStarted } = await import('./runner-worker.js');

    await ensureStudioJobWorkerStarted();
    expect(state.runTaskList).toHaveBeenCalledWith(
      expect.objectContaining({ concurrency: 1 }),
      expect.any(Object),
      expect.any(Object)
    );

    await (await import('./runner-worker.js')).stopStudioJobWorker();
    vi.resetModules();
    state.resolveStudioJobWorkerPool.mockReturnValue(null);

    await expect(
      (await import('./runner-worker.js')).ensureStudioJobWorkerStarted()
    ).rejects.toThrow('studio_job_worker_database_unavailable');
  });

  it('resets startup state and logs when worker startup fails', async () => {
    state.runTaskList.mockImplementation(() => {
      throw new Error('boom');
    });
    const { ensureStudioJobWorkerStarted, getStudioJobWorkerHealth } =
      await import('./runner-worker.js');

    await expect(ensureStudioJobWorkerStarted()).rejects.toThrow('boom');
    expect(getStudioJobWorkerHealth()).toEqual({
      ready: false,
      reasonCode: 'studio_job_worker_start_failed',
      status: 'failed',
    });
    await expect(ensureStudioJobWorkerStarted()).rejects.toThrow('boom');

    expect(state.runTaskList).toHaveBeenCalledTimes(2);
    expect(state.logger.error).toHaveBeenCalledWith(
      'Studio-Job-Worker konnte nicht gestartet werden',
      expect.objectContaining({
        operation: 'studio_job_worker_start_failed',
        error: 'boom',
      })
    );
  });

  it('logs asynchronous worker failures and allows a clean restart', async () => {
    let rejectWorker!: (error: Error) => void;
    state.runTaskList.mockReturnValueOnce({
      gracefulShutdown: vi.fn(async () => undefined),
      promise: new Promise<void>((_resolve, reject) => {
        rejectWorker = reject;
      }),
    });
    const { ensureStudioJobWorkerStarted, getStudioJobWorkerHealth } =
      await import('./runner-worker.js');
    const terminalFailure = vi.fn();

    await ensureStudioJobWorkerStarted({ onTerminalFailure: terminalFailure });
    const runtimeError = new Error('connection lost');
    rejectWorker(runtimeError);
    await vi.waitFor(() => {
      expect(state.logger.error).toHaveBeenCalledWith(
        'Studio-Job-Worker wurde unerwartet beendet',
        expect.objectContaining({
          operation: 'studio_job_worker_runtime_failed',
          error: 'connection lost',
        })
      );
    });
    expect(getStudioJobWorkerHealth()).toEqual({
      ready: false,
      reasonCode: 'studio_job_worker_runtime_failed',
      status: 'failed',
    });
    await vi.waitFor(() =>
      expect(terminalFailure).toHaveBeenCalledWith({ error: runtimeError, lane: 'default' })
    );
    await ensureStudioJobWorkerStarted();

    expect(state.runTaskList).toHaveBeenCalledTimes(2);
  });

  it('marks internal claim failures not ready and recovers after a successful poll', async () => {
    const { ensureStudioJobWorkerStarted, getStudioJobWorkerHealth } =
      await import('./runner-worker.js');

    await ensureStudioJobWorkerStarted();
    const events = state.runTaskList.mock.calls[0]?.[0].events as EventEmitter;
    events.emit('worker:getJob:error', { error: new Error('permission denied') });

    expect(getStudioJobWorkerHealth()).toMatchObject({
      ready: false,
      reasonCode: 'studio_job_worker_claim_failed',
      status: 'failed',
    });

    events.emit('pool:listen:success', {});
    expect(getStudioJobWorkerHealth()).toMatchObject({
      ready: false,
      reasonCode: 'studio_job_worker_claim_failed',
      status: 'failed',
    });

    events.emit('worker:getJob:empty', {});
    expect(getStudioJobWorkerHealth()).toEqual({ ready: true, status: 'running' });
  });

  it('retires a fatally failed worker so a later ensure starts a new pool', async () => {
    const { ensureStudioJobWorkerStarted, getStudioJobWorkerHealth } =
      await import('./runner-worker.js');

    await ensureStudioJobWorkerStarted();
    const events = state.runTaskList.mock.calls[0]?.[0].events as EventEmitter;
    events.emit('worker:fatalError', { error: new Error('worker crashed') });

    expect(getStudioJobWorkerHealth()).toMatchObject({
      ready: false,
      reasonCode: 'studio_job_worker_runtime_failed',
      status: 'failed',
    });
    events.emit('job:start', {});
    expect(getStudioJobWorkerHealth()).toMatchObject({
      ready: false,
      reasonCode: 'studio_job_worker_runtime_failed',
      status: 'failed',
    });
    await vi.waitFor(() => {
      expect(state.runTaskList.mock.results[0]?.value.gracefulShutdown).toHaveBeenCalledOnce();
    });

    await vi.waitFor(async () => {
      await ensureStudioJobWorkerStarted();
      expect(state.runTaskList).toHaveBeenCalledTimes(2);
    });
  });

  it.each([
    {
      ensureExport: 'ensureStudioJobWorkerStarted',
      lane: 'default',
      reasonCode: 'studio_job_worker_runtime_failed',
    },
    {
      ensureExport: 'ensurePrivilegedStudioJobWorkerStarted',
      lane: 'privileged',
      reasonCode: 'privileged_studio_job_worker_runtime_failed',
    },
  ] as const)(
    'signals a terminal $lane worker failure once after retiring its pool',
    async ({ ensureExport, lane, reasonCode }) => {
      process.env.SVA_PLUGIN_OPERATION_WORKER_LANE = lane;
      let rejectWorker!: (error: Error) => void;
      const gracefulShutdown = vi.fn(async () => undefined);
      state.runTaskList.mockReturnValueOnce({
        gracefulShutdown,
        promise: new Promise<void>((_resolve, reject) => {
          rejectWorker = reject;
        }),
      });
      const terminalFailure = vi.fn();
      const worker = await import('./runner-worker.js');
      const ensureWorker = worker[ensureExport];

      await ensureWorker({ onTerminalFailure: terminalFailure });
      const events = state.runTaskList.mock.calls[0]?.[0].events as EventEmitter;
      const fatalError = new Error(`${lane} worker crashed`);
      events.emit('worker:fatalError', { error: fatalError });

      expect(worker.getStudioJobWorkerHealth()).toEqual({
        ready: false,
        reasonCode,
        status: 'failed',
      });
      await vi.waitFor(() => expect(gracefulShutdown).toHaveBeenCalledOnce());
      await vi.waitFor(() =>
        expect(terminalFailure).toHaveBeenCalledWith({ error: fatalError, lane })
      );

      rejectWorker(new Error(`${lane} pool rejected after retirement`));
      await Promise.resolve();
      expect(terminalFailure).toHaveBeenCalledOnce();
    }
  );

  it('keeps the healthy lane isolated when the other lane fails terminally', async () => {
    const defaultTerminalFailure = vi.fn();
    const privilegedTerminalFailure = vi.fn();
    const worker = await import('./runner-worker.js');

    await worker.ensureStudioJobWorkerStarted({
      onTerminalFailure: defaultTerminalFailure,
    });
    await worker.ensurePrivilegedStudioJobWorkerStarted({
      onTerminalFailure: privilegedTerminalFailure,
    });
    await vi.waitFor(() => {
      process.env.SVA_PLUGIN_OPERATION_WORKER_LANE = 'privileged';
      expect(worker.getStudioJobWorkerHealth()).toEqual({ ready: true, status: 'running' });
    });

    const defaultEvents = state.runTaskList.mock.calls[0]?.[0].events as EventEmitter;
    defaultEvents.emit('worker:fatalError', { error: new Error('default lane failed') });

    await vi.waitFor(() => expect(defaultTerminalFailure).toHaveBeenCalledOnce());
    expect(privilegedTerminalFailure).not.toHaveBeenCalled();
    process.env.SVA_PLUGIN_OPERATION_WORKER_LANE = 'privileged';
    expect(worker.getStudioJobWorkerHealth()).toEqual({ ready: true, status: 'running' });
  });

  it('stops both lanes explicitly without signaling a terminal failure', async () => {
    const defaultTerminalFailure = vi.fn();
    const privilegedTerminalFailure = vi.fn();
    const worker = await import('./runner-worker.js');

    await worker.ensureStudioJobWorkerStarted({
      onTerminalFailure: defaultTerminalFailure,
    });
    await worker.ensurePrivilegedStudioJobWorkerStarted({
      onTerminalFailure: privilegedTerminalFailure,
    });
    await worker.stopStudioJobWorker();
    await worker.stopPrivilegedStudioJobWorker();

    process.env.SVA_PLUGIN_OPERATION_WORKER_LANE = 'default';
    expect(worker.getStudioJobWorkerHealth()).toEqual({
      ready: false,
      reasonCode: 'studio_job_worker_stopped',
      status: 'stopped',
    });
    process.env.SVA_PLUGIN_OPERATION_WORKER_LANE = 'privileged';
    expect(worker.getStudioJobWorkerHealth()).toEqual({
      ready: false,
      reasonCode: 'privileged_studio_job_worker_stopped',
      status: 'stopped',
    });
    expect(defaultTerminalFailure).not.toHaveBeenCalled();
    expect(privilegedTerminalFailure).not.toHaveBeenCalled();
  });

  it('ignores delayed failures from a replaced worker pool', async () => {
    let rejectOldWorker!: (error: Error) => void;
    state.runTaskList.mockReturnValueOnce({
      gracefulShutdown: vi.fn(async () => undefined),
      promise: new Promise<void>((_resolve, reject) => {
        rejectOldWorker = reject;
      }),
    });
    const { ensureStudioJobWorkerStarted, getStudioJobWorkerHealth } =
      await import('./runner-worker.js');

    await ensureStudioJobWorkerStarted();
    const oldEvents = state.runTaskList.mock.calls[0]?.[0].events as EventEmitter;
    rejectOldWorker(new Error('old connection lost'));
    await vi.waitFor(() => expect(getStudioJobWorkerHealth().status).toBe('failed'));

    await ensureStudioJobWorkerStarted();
    await vi.waitFor(() =>
      expect(getStudioJobWorkerHealth()).toEqual({ ready: true, status: 'running' })
    );
    oldEvents.emit('worker:fatalError', { error: new Error('late old failure') });

    expect(getStudioJobWorkerHealth()).toEqual({ ready: true, status: 'running' });
    await ensureStudioJobWorkerStarted();
    expect(state.runTaskList).toHaveBeenCalledTimes(2);
  });

  it('returns early when stop is called before the worker was started', async () => {
    const { stopStudioJobWorker } = await import('./runner-worker.js');
    await expect(stopStudioJobWorker()).resolves.toBeUndefined();
  });

  it('records the last successful processing time for the owning lane only', async () => {
    process.env.SVA_PLUGIN_OPERATION_WORKER_LANE = 'privileged';
    const worker = await import('./runner-worker.js');
    const observability = await import('../plugin-tenant-lifecycle/observability.js');

    await worker.ensurePrivilegedStudioJobWorkerStarted();
    const events = state.runTaskList.mock.calls[0]?.[0].events as EventEmitter;
    events.emit('job:success', {
      job: { task_identifier: 'studio_job_execute_privileged' },
      worker: {},
    });

    expect(
      observability.readPluginTenantLifecycleLaneSnapshot('privileged').lastSuccessAtMs
    ).toEqual(expect.any(Number));
    expect(
      observability.readPluginTenantLifecycleLaneSnapshot('default').lastSuccessAtMs
    ).toBeNull();
  });

  it('treats an explicitly disabled worker as ready', async () => {
    process.env.SVA_PLUGIN_OPERATION_WORKER_ENABLED = 'false';
    const { getStudioJobWorkerHealth } = await import('./runner-worker.js');

    expect(getStudioJobWorkerHealth()).toEqual({ ready: true, status: 'disabled' });
  });
});
