import { afterEach, describe, expect, it, vi } from 'vitest';

import { createJobExecutionContext } from './job-execution-context.js';

describe('job execution context', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates an aborted signal when a cancel request already exists', () => {
    const { context, dispose } = createJobExecutionContext({
      job: {
        id: 'job-1',
        pluginId: 'news',
        instanceId: 'tenant-a',
        requestId: 'req-1',
        actorAccountId: 'user-1',
        cancelRequestedAt: '2026-05-09T12:03:00.000Z',
      },
      logger: {
        debug: () => undefined,
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
      },
      progressReporter: { reportProgress: async () => undefined },
      isCancellationRequested: async () => true,
    });

    expect(context.kind).toBe('job');
    expect(context.pluginId).toBe('news');
    expect(context.instanceId).toBe('tenant-a');
    expect(context.requestId).toBe('req-1');
    expect(context.actorAccountId).toBe('user-1');
    expect(context.capabilities).toEqual({
      requestContext: true,
      auditReporter: false,
      progressReporter: true,
      secretAccess: false,
    });
    expect(context.abortSignal.aborted).toBe(true);
    dispose();
  });

  it('exposes cooperative cancellation helpers for handlers', async () => {
    const { context, dispose } = createJobExecutionContext({
      job: {
        id: 'job-1',
        pluginId: 'news',
        instanceId: 'tenant-a',
        requestId: 'req-1',
        actorAccountId: 'user-1',
        cancelRequestedAt: '2026-05-09T12:03:00.000Z',
      },
      logger: {
        debug: () => undefined,
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
      },
      progressReporter: { reportProgress: async () => undefined },
      isCancellationRequested: async () => true,
    });

    await expect(context.isCancellationRequested()).resolves.toBe(true);
    await expect(context.throwIfCancellationRequested()).rejects.toMatchObject({
      name: 'PluginOperationCancellationError',
      cancelRequestedAt: '2026-05-09T12:03:00.000Z',
    });
    dispose();
  });

  it('aborts the signal after a later cancellation request is observed', async () => {
    vi.useFakeTimers();

    let cancellationRequested = false;
    const { context, dispose } = createJobExecutionContext({
      job: {
        id: 'job-1',
        requestId: 'req-1',
        actorAccountId: 'user-1',
      },
      logger: { info: () => undefined },
      progressReporter: { reportProgress: async () => undefined },
      isCancellationRequested: async () => cancellationRequested,
    });

    expect(context.abortSignal.aborted).toBe(false);

    cancellationRequested = true;
    await vi.advanceTimersByTimeAsync(1_000);

    expect(context.abortSignal.aborted).toBe(true);
    dispose();
  });

  it('bounds diagnostics per cancellation poll failure period and reports each recovery', async () => {
    vi.useFakeTimers();
    const warn = vi.fn();
    const debug = vi.fn();
    const isCancellationRequested = vi
      .fn<() => Promise<boolean>>()
      .mockRejectedValueOnce(new TypeError('database unavailable'))
      .mockRejectedValueOnce(new TypeError('database still unavailable'))
      .mockResolvedValueOnce(false)
      .mockRejectedValueOnce(new TypeError('database unavailable again'))
      .mockRejectedValueOnce(new TypeError('database still unavailable again'))
      .mockResolvedValue(false);
    const { context, dispose } = createJobExecutionContext({
      job: {
        id: 'job-1',
        pluginId: 'news',
        instanceId: 'tenant-a',
        requestId: 'req-1',
        actorAccountId: 'user-1',
      },
      logger: { debug, warn, info: vi.fn(), error: vi.fn() },
      progressReporter: { reportProgress: async () => undefined },
      isCancellationRequested,
    });

    await vi.advanceTimersByTimeAsync(6_000);

    expect(context.abortSignal.aborted).toBe(false);
    expect(isCancellationRequested).toHaveBeenCalledTimes(6);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledWith(
      'plugin_operation_cancellation_poll_failed',
      expect.objectContaining({
        error_code: 'cancellation_poll_failed',
        context: {
          job_id: 'job-1',
          execution_id: 'job-1',
          instance_id: 'tenant-a',
        },
      })
    );
    expect(debug).toHaveBeenCalledTimes(2);
    expect(debug).toHaveBeenCalledWith(
      'plugin_operation_cancellation_poll_recovered',
      expect.objectContaining({
        result: 'recovered',
        context: {
          job_id: 'job-1',
          execution_id: 'job-1',
          instance_id: 'tenant-a',
        },
      })
    );
    dispose();
  });
});
