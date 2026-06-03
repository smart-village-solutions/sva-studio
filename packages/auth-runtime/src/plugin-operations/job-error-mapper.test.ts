import { describe, expect, it } from 'vitest';

import {
  createExecutionErrorPayload,
  createMissingHandlerPayload,
} from './job-error-mapper.js';

const baseJob = {
  id: 'job-1',
  instanceId: 'tenant-a',
  source: 'plugin',
  pluginId: 'news',
  jobTypeId: 'news.import-articles',
  queueName: 'plugin-operations',
  status: 'queued',
  inputPayload: {},
  attempts: 0,
  maxAttempts: 5,
  idempotencyKey: 'idem-1',
  scheduledAt: '2026-05-09T12:00:00.000Z',
  createdAt: '2026-05-09T12:00:00.000Z',
  updatedAt: '2026-05-09T12:00:00.000Z',
} as const;

describe('job error mapper', () => {
  it('creates a deterministic missing-handler payload', () => {
    expect(createMissingHandlerPayload(baseJob)).toEqual({
      code: 'plugin_operation_handler_missing',
      category: 'permanent',
      details: {
        host: {
          source: 'plugin',
          jobTypeId: 'news.import-articles',
          pluginId: 'news',
        },
      },
    });
  });

  it('maps runtime errors to retryable or permanent execution payloads', () => {
    const error = new Error('boom') as Error & { cause?: unknown };
    error.cause = { upstreamStatus: 503 };

    expect(createExecutionErrorPayload(baseJob, error, false)).toEqual({
      code: 'plugin_operation_execution_failed',
      category: 'retryable',
      message: 'boom',
      details: {
        plugin: {
          upstreamStatus: 503,
        },
      },
    });
    expect(createExecutionErrorPayload(baseJob, 'fatal', true)).toEqual({
      code: 'plugin_operation_execution_failed',
      category: 'permanent',
      message: 'fatal',
    });
  });
});
