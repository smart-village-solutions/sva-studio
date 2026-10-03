import { getWorkspaceContext } from '@sva/server-runtime';
import type { DsrExportFormat } from '@sva/iam-governance/dsr-export-payload';

import { createStudioJob, markStudioJobEnqueueFailed } from '../plugin-operations/core.shared.js';
import {
  queueStudioJob,
  type StudioJobExecutionRegistration,
} from '../plugin-operations/runner.js';
import { processDsrExportJob, withInstanceScopedDb } from './export-worker-execution.js';
import { markExportJobFailed } from './export-worker-persistence.js';

export const dsrExportStudioJobTypeId = 'dsr.export';

export const createAndQueueDsrExportStudioJob = async (input: {
  instanceId: string;
  exportJobId: string;
  requestedByAccountId: string;
  targetAccountId: string;
  format: DsrExportFormat;
}): Promise<{ id: string }> => {
  const job = await createStudioJob({
    instanceId: input.instanceId,
    initialProgress: {
      completedSteps: 0,
      totalSteps: 3,
      currentPhase: 'ingestion',
      currentStepKey: 'prepare-export',
    },
    create: {
      source: 'host',
      pluginId: undefined,
      jobTypeId: dsrExportStudioJobTypeId,
      queueName: 'host-operations',
      inputPayload: {
        exportJobId: input.exportJobId,
        targetAccountId: input.targetAccountId,
        format: input.format,
      },
      maxAttempts: 3,
      idempotencyKey: `dsr-export:${input.exportJobId}`,
      requestId: getWorkspaceContext().requestId ?? undefined,
      actorAccountId: input.requestedByAccountId,
      correlationId: input.exportJobId,
      scheduledAt: new Date().toISOString(),
    },
  });

  try {
    await queueStudioJob({
      instanceId: input.instanceId,
      jobId: job.id,
      queueName: job.queueName,
      maxAttempts: job.maxAttempts,
      executionLane: 'default',
    });
  } catch (error) {
    await markStudioJobEnqueueFailed({
      instanceId: input.instanceId,
      job,
      errorCode: 'studio_job_enqueue_failed',
    });
    throw error;
  }

  return { id: job.id };
};

export const dsrExportStudioJobRegistration: StudioJobExecutionRegistration = {
  source: 'host',
  jobTypeId: dsrExportStudioJobTypeId,
  queueName: 'host-operations',
  handler: async ({ job, progressReporter }) => {
    const exportJobId =
      typeof job.inputPayload.exportJobId === 'string' ? job.inputPayload.exportJobId : '';
    if (!exportJobId) {
      throw new Error('export_job_id_missing');
    }

    try {
      const alreadyCompleted = await processDsrExportJob(job, progressReporter, exportJobId);
      if (alreadyCompleted) {
        return {
          progress: {
            completedSteps: 3,
            totalSteps: 3,
            currentPhase: 'completed',
            currentStepKey: 'already-finished',
          },
          resultPayload: {
            summary: {
              processedItems: 1,
            },
          },
        };
      }
    } catch (error) {
      await withInstanceScopedDb(job.instanceId, async (client) => {
        await markExportJobFailed(client, {
          instanceId: job.instanceId,
          exportJobId,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }).catch(() => undefined);
      throw error;
    }

    await progressReporter.reportProgress({
      jobId: job.id,
      instanceId: job.instanceId,
      progress: {
        completedSteps: 3,
        totalSteps: 3,
        currentPhase: 'completed',
        currentStepKey: 'export-ready',
      },
    });

    return {
      progress: {
        completedSteps: 3,
        totalSteps: 3,
        currentPhase: 'completed',
        currentStepKey: 'export-ready',
      },
      resultPayload: {
        summary: {
          processedItems: 1,
          acceptedItems: 1,
        },
      },
    };
  },
};
