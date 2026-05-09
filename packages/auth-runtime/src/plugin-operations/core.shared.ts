import { randomUUID } from 'node:crypto';

import type { StudioJobProgress, StudioJobRecord, StudioJobStartRequest } from '@sva/core';

import { asApiItem } from '../shared/request-helpers.js';
import { withStudioJobRepository } from './repository.js';

export const createJsonItemResponse = (
  status: number,
  item: unknown,
  requestId: string | undefined
): Response =>
  new Response(JSON.stringify(asApiItem(item, requestId)), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const createPluginOperationJob = async (input: {
  readonly instanceId: string;
  readonly actorAccountId: string;
  readonly idempotencyKey: string;
  readonly requestId?: string;
  readonly scheduledAt: string;
  readonly queueName: string;
  readonly data: StudioJobStartRequest;
}) =>
  withStudioJobRepository(input.instanceId, async (repository) => {
    const createdJob = await repository.createJob({
      id: randomUUID(),
      instanceId: input.instanceId,
      pluginId: input.data.pluginId,
      jobTypeId: input.data.jobTypeId,
      importProfileId: input.data.importProfileId,
      queueName: input.queueName,
      status: 'queued',
      progress: { completedSteps: 0, totalSteps: 1 },
      inputPayload: input.data.input,
      attempts: 0,
      maxAttempts: 5,
      idempotencyKey: input.idempotencyKey,
      requestId: input.requestId,
      actorAccountId: input.actorAccountId,
      correlationId: input.data.correlationId,
      parentJobId: input.data.parentJobId,
      scheduledAt: input.scheduledAt,
    });

    await repository.appendJobEvent({
      id: randomUUID(),
      jobId: createdJob.id,
      instanceId: input.instanceId,
      eventType: 'job.queued',
      status: 'queued',
      progress: {
        completedSteps: 0,
        totalSteps: 1,
      },
      attempts: 0,
    });

    return createdJob;
  });

export const markPluginOperationEnqueueFailed = async (input: {
  readonly instanceId: string;
  readonly job: Pick<StudioJobRecord, 'id' | 'attempts' | 'startedAt' | 'progress'> & {
    readonly progress?: StudioJobProgress;
  };
}): Promise<void> =>
  withStudioJobRepository(input.instanceId, async (repository) => {
    await repository.updateJobState({
      jobId: input.job.id,
      instanceId: input.instanceId,
      status: 'failed',
      attempts: input.job.attempts,
      startedAt: input.job.startedAt,
      finishedAt: new Date().toISOString(),
      progress: input.job.progress,
      errorPayload: {
        code: 'plugin_operation_enqueue_failed',
        category: 'permanent',
      },
    });
  }).catch(() => undefined);
