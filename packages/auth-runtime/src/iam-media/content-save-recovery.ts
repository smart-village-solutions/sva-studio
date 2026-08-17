import { randomUUID } from 'node:crypto';

import { createSdkLogger } from '@sva/server-runtime';

import { createStudioJob, markStudioJobEnqueueFailed } from '../plugin-operations/core.shared.js';
import {
  queueStudioJob,
  type StudioJobExecutionRegistration,
} from '../plugin-operations/runner.js';
import { withMediaService } from './repository.js';
import { createConfiguredMediaStoragePortForInstance } from './storage-s3.js';
import type { MediaStoragePort } from './storage-port.js';

const logger = createSdkLogger({ component: 'media-content-save-recovery', level: 'info' });

export const mediaContentSaveRecoveryJobTypeId = 'media.content-save-recovery';
const recoveryQueueName = 'media-content-save-recovery';
const recoveryLeaseMs = 5 * 60 * 1000;

type CleanupInput = Readonly<{
  instanceId: string;
  operationId: string;
  actorSubject: string;
  storagePort?: MediaStoragePort;
}>;

export const cleanupMediaContentSaveOperation = async (input: CleanupInput): Promise<void> => {
  const storagePort =
    input.storagePort ?? (await createConfiguredMediaStoragePortForInstance(input.instanceId));
  const assets = await withMediaService(input.instanceId, (service) =>
    service.listAssetsByOperation({
      instanceId: input.instanceId,
      operationId: input.operationId,
      actorSubject: input.actorSubject,
    })
  );

  for (const asset of assets) {
    const variants = await withMediaService(input.instanceId, (service) =>
      service.listVariantsByAssetId(input.instanceId, asset.id)
    );
    await storagePort.deleteObject({
      instanceId: input.instanceId,
      storageKey: asset.storageKey,
    });
    for (const variant of variants) {
      await storagePort.deleteObject({
        instanceId: input.instanceId,
        storageKey: variant.storageKey,
      });
    }
  }

  const finalized = await withMediaService(input.instanceId, (service) =>
    service.finalizeContentSaveOperationCleanup({
      instanceId: input.instanceId,
      operationId: input.operationId,
      actorSubject: input.actorSubject,
    })
  );
  if (!finalized) {
    throw new Error('media_content_save_cleanup_not_finalized');
  }
};

export const scheduleMediaContentSaveRecovery = async (input: {
  readonly instanceId: string;
  readonly operationId: string;
  readonly actorSubject: string;
  readonly expiresAt: string;
  readonly requestId?: string;
}): Promise<void> => {
  let job: Awaited<ReturnType<typeof createStudioJob>>;
  try {
    job = await createStudioJob({
      instanceId: input.instanceId,
      initialProgress: {
        completedSteps: 0,
        totalSteps: 1,
        currentPhase: 'cleanup',
        currentStepKey: 'wait-for-expiry',
      },
      create: {
        source: 'host',
        pluginId: undefined,
        jobTypeId: mediaContentSaveRecoveryJobTypeId,
        queueName: recoveryQueueName,
        inputPayload: {
          operationId: input.operationId,
          actorSubject: input.actorSubject,
        },
        maxAttempts: 5,
        idempotencyKey: `media-content-save-recovery:${input.operationId}`,
        requestId: input.requestId,
        actorAccountId: undefined,
        correlationId: input.operationId,
        scheduledAt: input.expiresAt,
      },
    });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      return;
    }
    throw error;
  }

  try {
    await queueStudioJob({
      instanceId: input.instanceId,
      jobId: job.id,
      queueName: job.queueName,
      maxAttempts: job.maxAttempts,
      executionLane: 'default',
      runAt: new Date(input.expiresAt),
    });
  } catch (error) {
    await markStudioJobEnqueueFailed({
      instanceId: input.instanceId,
      job,
      errorCode: 'media_content_save_recovery_enqueue_failed',
    });
    throw error;
  }
};

export const mediaContentSaveRecoveryStudioJobRegistration: StudioJobExecutionRegistration = {
  source: 'host',
  jobTypeId: mediaContentSaveRecoveryJobTypeId,
  queueName: recoveryQueueName,
  handler: async ({ job, progressReporter }) => {
    const operationId =
      typeof job.inputPayload.operationId === 'string' ? job.inputPayload.operationId : '';
    const actorSubject =
      typeof job.inputPayload.actorSubject === 'string' ? job.inputPayload.actorSubject : '';
    if (!operationId || !actorSubject) {
      throw new Error('media_content_save_recovery_input_invalid');
    }

    const now = new Date();
    const claimed = await withMediaService(job.instanceId, (service) =>
      service.claimContentSaveOperationRecovery({
        instanceId: job.instanceId,
        operationId,
        leaseOwner: job.id || randomUUID(),
        leaseExpiresAt: new Date(now.getTime() + recoveryLeaseMs).toISOString(),
        now: now.toISOString(),
      })
    );

    if (!claimed) {
      logger.info('Media-Content-Save-Recovery übersprungen', {
        operation: 'media_content_save_recovery_skipped',
        instance_id: job.instanceId,
        operation_id: operationId,
      });
      return {
        resultPayload: { plugin: { operationId, status: 'not_cleanup_eligible' } },
      };
    }

    await progressReporter.reportProgress({
      jobId: job.id,
      instanceId: job.instanceId,
      progress: {
        completedSteps: 0,
        totalSteps: 1,
        currentPhase: 'cleanup',
        currentStepKey: 'delete-provisional-assets',
      },
    });

    try {
      await cleanupMediaContentSaveOperation({
        instanceId: job.instanceId,
        operationId,
        actorSubject,
      });
    } catch (error) {
      logger.error('Media-Content-Save-Recovery fehlgeschlagen', {
        operation: 'media_content_save_recovery_failed',
        instance_id: job.instanceId,
        operation_id: operationId,
        error_code: error instanceof Error ? error.name : 'unknown_error',
      });
      throw error;
    }

    logger.info('Media-Content-Save-Recovery abgeschlossen', {
      operation: 'media_content_save_recovery_completed',
      instance_id: job.instanceId,
      operation_id: operationId,
    });
    return { resultPayload: { plugin: { operationId, status: 'abandoned' } } };
  },
};
