import { randomUUID } from 'node:crypto';

import type {
  StudioJobCreateInput,
  StudioJobProgress,
  StudioJobRecord,
  StudioPluginOperationStartRequest,
  StudioJobSource,
} from '@sva/core';

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

export const createStudioJob = async (input: {
  readonly instanceId: string;
  readonly create: Omit<StudioJobCreateInput, 'id' | 'instanceId' | 'status' | 'attempts' | 'createdAt' | 'updatedAt'> & {
    readonly source: StudioJobSource;
    readonly queueName: string;
    readonly inputPayload: Readonly<Record<string, unknown>>;
    readonly maxAttempts: number;
    readonly scheduledAt: string;
  };
  readonly initialProgress?: StudioJobProgress;
}) =>
  withStudioJobRepository(input.instanceId, async (repository) => {
    const createdJob = await repository.createJob({
      id: randomUUID(),
      instanceId: input.instanceId,
      status: 'queued',
      attempts: 0,
      progress: input.initialProgress,
      ...input.create,
    });

    await repository.appendJobEvent({
      id: randomUUID(),
      jobId: createdJob.id,
      instanceId: input.instanceId,
      eventType: 'job.queued',
      status: 'queued',
      progress: input.initialProgress,
      attempts: 0,
    });

    return createdJob;
  });

export const createPluginOperationJob = async (input: {
  readonly instanceId: string;
  readonly actorAccountId: string;
  readonly idempotencyKey: string;
  readonly requestId?: string;
  readonly scheduledAt: string;
  readonly queueName: string;
  readonly data: StudioPluginOperationStartRequest;
}) =>
  createStudioJob({
    instanceId: input.instanceId,
    initialProgress: { completedSteps: 0, totalSteps: 1 },
    create: {
      source: 'plugin',
      pluginId: input.data.pluginId,
      jobTypeId: input.data.jobTypeId,
      importProfileId: input.data.importProfileId,
      queueName: input.queueName,
      inputPayload: input.data.input,
      maxAttempts: 5,
      idempotencyKey: input.idempotencyKey,
      requestId: input.requestId,
      actorAccountId: input.actorAccountId,
      correlationId: input.data.correlationId,
      parentJobId: input.data.parentJobId,
      scheduledAt: input.scheduledAt,
    },
  });

export const markStudioJobEnqueueFailed = async (input: {
  readonly instanceId: string;
  readonly job: Pick<StudioJobRecord, 'id' | 'attempts' | 'startedAt' | 'progress'> & {
    readonly progress?: StudioJobProgress;
  };
  readonly errorCode: string;
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
        code: input.errorCode,
        category: 'permanent',
      },
    });
  }).catch(() => undefined);

export const markPluginOperationEnqueueFailed = async (input: {
  readonly instanceId: string;
  readonly job: Pick<StudioJobRecord, 'id' | 'attempts' | 'startedAt' | 'progress'> & {
    readonly progress?: StudioJobProgress;
  };
}): Promise<void> =>
  markStudioJobEnqueueFailed({
    ...input,
    errorCode: 'plugin_operation_enqueue_failed',
  });
