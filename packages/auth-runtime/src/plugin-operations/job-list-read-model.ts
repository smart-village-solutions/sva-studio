import type { StudioJobEventRecord, StudioJobListItem } from '@sva/core';
import type { StudioJobListResultItem } from '@sva/data-repositories';

import {
  createStudioJobEventPresentation,
  createStudioJobRuntimeDiagnostics,
  normalizeStudioJobEventDetails,
} from './job-detail-read-model.js';

type NormalizeStudioJobListItemOptions = {
  readonly now?: () => string;
  readonly staleAfterSeconds?: number;
};

const normalizeLatestEvent = (
  job: StudioJobListResultItem
): StudioJobEventRecord | undefined =>
  job.latestEvent
    ? {
        ...job.latestEvent,
        message: job.latestEvent.message,
        details: normalizeStudioJobEventDetails(job, job.latestEvent),
        presentation: job.latestEvent.presentation ?? createStudioJobEventPresentation(job.latestEvent),
      }
    : undefined;

export const normalizeStudioJobListItem = (
  job: StudioJobListResultItem,
  options?: NormalizeStudioJobListItemOptions
): StudioJobListItem => {
  const latestEvent = normalizeLatestEvent(job);

  return {
    id: job.id,
    instanceId: job.instanceId,
    source: job.source,
    pluginId: job.pluginId,
    jobTypeId: job.jobTypeId,
    status: job.status,
    progress: job.progress,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    correlationId: job.correlationId,
    parentJobId: job.parentJobId,
    workerId: job.workerId,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    lastProgressAt: job.lastProgressAt,
    heartbeatAt: job.heartbeatAt,
    latestEvent,
    runtime: createStudioJobRuntimeDiagnostics(job, options),
  };
};
