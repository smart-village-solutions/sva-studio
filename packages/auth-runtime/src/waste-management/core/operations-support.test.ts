import { beforeEach, describe, expect, it, vi } from 'vitest';

const reserveIdempotencyMock = vi.hoisted(() => vi.fn());
const completeIdempotencyMock = vi.hoisted(() => vi.fn(async () => undefined));
const createPluginOperationJobMock = vi.hoisted(() => vi.fn());
const markPluginOperationEnqueueFailedMock = vi.hoisted(() => vi.fn(async () => undefined));
const queuePluginOperationJobMock = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock('../../iam-account-management/shared.js', () => ({
  reserveIdempotency: reserveIdempotencyMock,
  completeIdempotency: completeIdempotencyMock,
}));

vi.mock('../../plugin-operations/core.shared.js', () => ({
  createPluginOperationJob: createPluginOperationJobMock,
  markPluginOperationEnqueueFailed: markPluginOperationEnqueueFailedMock,
  createJsonItemResponse: (status: number, item: unknown, requestId: string | undefined) =>
    new Response(JSON.stringify({ data: item, requestId }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
}));

vi.mock('../../plugin-operations/runner.js', () => ({
  queuePluginOperationJob: queuePluginOperationJobMock,
}));

import { startPluginOperationJobFromFacade } from './operations-support.js';

describe('waste-management operations support', () => {
  const input = {
    instanceId: 'tenant-a',
    actorAccountId: 'account-1',
    endpoint: '/api/v1/waste-management/migrations',
    idempotencyKey: 'idem-1',
    requestId: 'req-test',
    scheduledAt: '2026-05-10T12:00:00.000Z',
    data: {
      pluginId: 'waste-management',
      jobTypeId: 'waste-management.apply-migrations',
      input: { targetSchema: 'wm' },
    },
  } as const;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('replays stored idempotent responses and rejects conflicting payload reuse', async () => {
    reserveIdempotencyMock.mockResolvedValueOnce({
      status: 'replay',
      responseStatus: 202,
      responseBody: { data: { id: 'job-replay' }, requestId: 'req-replay' },
    });

    const replay = await startPluginOperationJobFromFacade(input);
    expect(replay.status).toBe(202);
    await expect(replay.json()).resolves.toEqual({ data: { id: 'job-replay' }, requestId: 'req-replay' });

    reserveIdempotencyMock.mockResolvedValueOnce({
      status: 'conflict',
      message: 'Bereits mit anderem Payload verwendet.',
    });

    const conflict = await startPluginOperationJobFromFacade(input);
    expect(conflict.status).toBe(409);
    await expect(conflict.json()).resolves.toMatchObject({
      error: {
        code: 'idempotency_key_reuse',
      },
      requestId: 'req-test',
    });
  });

  it('creates and enqueues jobs successfully while completing idempotency records', async () => {
    reserveIdempotencyMock.mockResolvedValueOnce({ status: 'reserved' });
    createPluginOperationJobMock.mockResolvedValueOnce({
      id: 'job-1',
      queueName: 'plugin-operations',
      maxAttempts: 5,
    });

    const response = await startPluginOperationJobFromFacade(input);

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      data: { id: 'job-1', queueName: 'plugin-operations', maxAttempts: 5 },
      requestId: 'req-test',
    });
    expect(queuePluginOperationJobMock).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      jobId: 'job-1',
      queueName: 'plugin-operations',
      maxAttempts: 5,
    });
    expect(completeIdempotencyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'tenant-a',
        status: 'COMPLETED',
        responseStatus: 202,
      })
    );
  });

  it('marks enqueue failures and creation failures as failed idempotent responses', async () => {
    reserveIdempotencyMock.mockResolvedValueOnce({ status: 'reserved' });
    createPluginOperationJobMock.mockResolvedValueOnce({
      id: 'job-2',
      queueName: 'plugin-operations',
      maxAttempts: 5,
    });
    queuePluginOperationJobMock.mockRejectedValueOnce(new Error('queue down'));

    const enqueueFailed = await startPluginOperationJobFromFacade(input);
    expect(enqueueFailed.status).toBe(503);
    expect(markPluginOperationEnqueueFailedMock).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      job: { id: 'job-2', queueName: 'plugin-operations', maxAttempts: 5 },
    });

    reserveIdempotencyMock.mockResolvedValueOnce({ status: 'reserved' });
    createPluginOperationJobMock.mockRejectedValueOnce(new Error('create failed'));

    const createFailed = await startPluginOperationJobFromFacade(input);
    expect(createFailed.status).toBe(503);
    await expect(createFailed.json()).resolves.toMatchObject({
      error: {
        code: 'database_unavailable',
      },
      requestId: 'req-test',
    });
    expect(completeIdempotencyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'FAILED',
        responseStatus: 503,
      })
    );
  });
});
