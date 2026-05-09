import { describe, expect, it, vi } from 'vitest';

import { createJobEventWriter } from './job-event-writer.js';

describe('job event writer', () => {
  it('writes stable host details separately from plugin details', async () => {
    const appendJobEvent = vi.fn(async () => null);
    const writer = createJobEventWriter({
      appendJobEvent,
      createId: () => 'event-1',
    });

    await writer.appendFailedEvent({
      jobId: 'job-1',
      instanceId: 'tenant-a',
      attempts: 2,
      errorPayload: {
        code: 'plugin_operation_execution_failed',
        category: 'retryable',
        message: 'temporarily unavailable',
        details: {
          plugin: {
            upstreamStatus: 503,
          },
        },
      },
      hostDetails: {
        workerId: 'graphile-worker:tenant-a:job-1',
      },
    });

    expect(appendJobEvent).toHaveBeenCalledWith({
      id: 'event-1',
      jobId: 'job-1',
      instanceId: 'tenant-a',
      eventType: 'job.failed',
      status: 'failed',
      attempts: 2,
      progress: undefined,
      message: 'temporarily unavailable',
      details: {
        host: {
          workerId: 'graphile-worker:tenant-a:job-1',
          errorCode: 'plugin_operation_execution_failed',
          errorCategory: 'retryable',
        },
        plugin: {
          upstreamStatus: 503,
        },
      },
    });
  });
});
