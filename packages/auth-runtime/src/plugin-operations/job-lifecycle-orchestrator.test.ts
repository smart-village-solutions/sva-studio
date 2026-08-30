import { describe, expect, it, vi } from 'vitest';

import type { StudioJobRecord } from '@sva/core';

import { createJobLifecycleOrchestrator } from './job-lifecycle-orchestrator.js';

const job: StudioJobRecord = {
  id: '7dbe0bb5-4689-46b0-b21f-0d9ea3cd9489',
  instanceId: 'tenant-a',
  source: 'plugin',
  pluginId: 'speech',
  jobTypeId: 'speech.provisionTenant',
  queueName: 'plugin-operations',
  status: 'queued',
  inputPayload: {},
  attempts: 0,
  maxAttempts: 5,
  idempotencyKey: 'speech:provision:3',
  scheduledAt: '2026-08-30T12:00:00.000Z',
  createdAt: '2026-08-30T12:00:00.000Z',
  updatedAt: '2026-08-30T12:00:00.000Z',
};

describe('job lifecycle orchestrator', () => {
  it('does not rerun a handler when the successful job state was committed before an uncertain return', async () => {
    const updateJobState = vi.fn(async (input: { readonly status: string }) => {
      if (input.status === 'succeeded') {
        throw new Error('connection_lost_after_commit');
      }
      return job;
    });
    const getJobById = vi
      .fn()
      .mockResolvedValueOnce(job)
      .mockResolvedValueOnce({ ...job, status: 'succeeded' });
    const handler = vi.fn(async () => ({ resultPayload: { ok: true } }));

    const orchestrator = createJobLifecycleOrchestrator({
      logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
      loadRepository: async () => ({
        getJobById,
        updateJobState,
        updateJobProgress: vi.fn(async () => job),
        appendJobEvent: vi.fn(async () => undefined),
      }),
      resolveHandler: () => handler,
      now: () => '2026-08-30T12:05:00.000Z',
    });

    await expect(
      orchestrator.run({
        instanceId: job.instanceId,
        jobId: job.id,
        attempts: 1,
        maxAttempts: 5,
      })
    ).resolves.toBeUndefined();

    expect(handler).toHaveBeenCalledOnce();
    expect(updateJobState).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'succeeded' })
    );
    expect(getJobById).toHaveBeenCalledTimes(2);
  });
});
