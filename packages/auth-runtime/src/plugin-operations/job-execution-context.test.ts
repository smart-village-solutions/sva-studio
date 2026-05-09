import { describe, expect, it } from 'vitest';

import { createJobExecutionContext } from './job-execution-context.js';

describe('job execution context', () => {
  it('creates an aborted signal when a cancel request already exists', () => {
    const context = createJobExecutionContext({
      job: {
        id: 'job-1',
        requestId: 'req-1',
        actorAccountId: 'user-1',
        cancelRequestedAt: '2026-05-09T12:03:00.000Z',
      },
      logger: { info: () => undefined },
      progressReporter: { reportProgress: async () => undefined },
      isCancellationRequested: async () => true,
    });

    expect(context.requestId).toBe('req-1');
    expect(context.actorAccountId).toBe('user-1');
    expect(context.abortSignal.aborted).toBe(true);
  });

  it('exposes cooperative cancellation helpers for handlers', async () => {
    const context = createJobExecutionContext({
      job: {
        id: 'job-1',
        requestId: 'req-1',
        actorAccountId: 'user-1',
        cancelRequestedAt: '2026-05-09T12:03:00.000Z',
      },
      logger: { info: () => undefined },
      progressReporter: { reportProgress: async () => undefined },
      isCancellationRequested: async () => true,
    });

    await expect(context.isCancellationRequested()).resolves.toBe(true);
    await expect(context.throwIfCancellationRequested()).rejects.toMatchObject({
      name: 'PluginOperationCancellationError',
      cancelRequestedAt: '2026-05-09T12:03:00.000Z',
    });
  });
});
