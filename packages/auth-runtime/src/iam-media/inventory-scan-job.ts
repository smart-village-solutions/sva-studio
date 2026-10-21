import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  mediaScanLimits,
  type MediaInventoryScanEntry,
  type MediaInventoryScanReason,
  type MediaInventoryScanReport,
} from '@sva/media';
import { emitAuthAuditEvent } from '../audit-events.js';
import type {
  StudioJobExecutionHandler,
  StudioJobExecutionRegistration,
} from '../plugin-operations/runner.js';
import { scanConfiguredMedia, MediaScanError } from './clamav.js';
import { withStudioJobRepository } from '../plugin-operations/repository.js';
import { withMediaUploadJobRepositories } from './repository.js';
import { createConfiguredMediaStoragePortForInstance } from './storage-s3.js';
import {
  MediaStorageSizeLimitError,
  type MediaStoragePort,
  type MediaStorageObjectSummary,
} from './storage-port.js';

export const mediaInventoryScanJobTypeId = 'media.scan-existing';
export const inventoryScanOptionsSchema = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(mediaScanLimits.maxInventoryFiles)
    .default(mediaScanLimits.maxInventoryFiles),
  cursor: z.string().min(1).max(4096).optional(),
});
const queueName = 'media-processing';
type ReadOnlyStorage = Pick<MediaStoragePort, 'listObjects' | 'statObject' | 'readObject'>;

const scanFailure = (error: unknown): Pick<MediaInventoryScanEntry, 'verdict' | 'reason'> => {
  if (error instanceof MediaStorageSizeLimitError)
    return { verdict: 'unscannable', reason: 'size_limit' };
  if (!(error instanceof MediaScanError)) return { verdict: 'unscannable', reason: 'read_failed' };
  if (error.code === 'media_scan_infected') return { verdict: 'infected' };
  const reason: Record<
    Exclude<MediaScanError['code'], 'media_scan_infected'>,
    MediaInventoryScanReason
  > = {
    media_scan_unavailable: 'scanner_unavailable',
    media_scan_stale: 'signatures_stale',
    media_scan_incomplete: 'scan_incomplete',
  };
  return { verdict: 'unscannable', reason: reason[error.code] };
};

const scanEntry = async (
  storage: ReadOnlyStorage,
  instanceId: string,
  item: MediaStorageObjectSummary
): Promise<MediaInventoryScanEntry> => {
  let base: Pick<MediaInventoryScanEntry, 'storageKey' | 'byteSize' | 'checkedAt' | 'etag'> = {
    storageKey: item.storageKey,
    byteSize: item.byteSize,
    checkedAt: new Date().toISOString(),
  };
  if (item.byteSize > mediaScanLimits.maxBytes)
    return { ...base, verdict: 'unscannable', reason: 'size_limit' };
  try {
    const stat = await storage.statObject({ instanceId, storageKey: item.storageKey });
    if (stat.byteSize > mediaScanLimits.maxBytes)
      return { ...base, byteSize: stat.byteSize, verdict: 'unscannable', reason: 'size_limit' };
    const object = await storage.readObject({
      instanceId,
      storageKey: item.storageKey,
      maxBytes: mediaScanLimits.maxBytes,
    });
    if (
      object.byteSize > mediaScanLimits.maxBytes ||
      object.body.byteLength > mediaScanLimits.maxBytes
    )
      throw new MediaStorageSizeLimitError();
    base = { ...base, byteSize: object.byteSize, etag: object.etag };
    await scanConfiguredMedia(object.body);
    return {
      ...base,
      byteSize: object.byteSize,
      etag: object.etag,
      checkedAt: new Date().toISOString(),
      verdict: 'clean',
    };
  } catch (error) {
    return { ...base, ...scanFailure(error), checkedAt: new Date().toISOString() };
  }
};

export const scheduleMediaInventoryScan = async (
  input: { instanceId: string; jobId: string; limit: number; cursor?: string; requestId?: string },
  withRepositories = withMediaUploadJobRepositories
): Promise<{ id: string; status: string }> =>
  withRepositories(input.instanceId, async ({ jobs, enqueue }) => {
    const job = await jobs.createJob({
      id: input.jobId,
      instanceId: input.instanceId,
      source: 'host',
      jobTypeId: mediaInventoryScanJobTypeId,
      queueName,
      status: 'queued',
      attempts: 0,
      maxAttempts: 1,
      inputPayload: { limit: input.limit, ...(input.cursor ? { cursor: input.cursor } : {}) },
      idempotencyKey: `media-inventory:${input.jobId}`,
      requestId: input.requestId,
      correlationId: input.jobId,
      scheduledAt: new Date().toISOString(),
    });
    await jobs.appendJobEvent({
      id: randomUUID(),
      jobId: job.id,
      instanceId: input.instanceId,
      eventType: 'job.queued',
      status: 'queued',
      attempts: 0,
    });
    await enqueue({ instanceId: input.instanceId, jobId: job.id, queueName, maxAttempts: 1 });
    return { id: job.id, status: job.status };
  });

export const createMediaInventoryScanHandler =
  (deps: {
    resolveStoragePort: (instanceId: string) => Promise<ReadOnlyStorage>;
    emitAuditEvent: typeof emitAuthAuditEvent;
  }): StudioJobExecutionHandler =>
  async ({ job, progressReporter }) => {
    const options = inventoryScanOptionsSchema.safeParse(job.inputPayload);
    if (!options.success) throw new Error('media_inventory_invalid');
    try {
      const storage = await deps.resolveStoragePort(job.instanceId);
      const page = await storage.listObjects({ instanceId: job.instanceId, ...options.data });
      const items = page.items.slice(0, options.data.limit);
      const entries: MediaInventoryScanEntry[] = [];
      let unavailable: 'scanner_unavailable' | 'signatures_stale' | undefined;
      for (const item of items) {
        const entry: MediaInventoryScanEntry = unavailable
          ? {
              storageKey: item.storageKey,
              byteSize: item.byteSize,
              verdict: 'unscannable',
              reason: unavailable,
              checkedAt: new Date().toISOString(),
            }
          : await scanEntry(storage, job.instanceId, item);
        entries.push(entry);
        if (entry.reason === 'scanner_unavailable' || entry.reason === 'signatures_stale')
          unavailable = entry.reason;
        await progressReporter.reportProgress({
          jobId: job.id,
          instanceId: job.instanceId,
          progress: {
            completedSteps: entries.length,
            totalSteps: items.length,
            currentPhase: 'scanning',
          },
        });
      }
      const report: MediaInventoryScanReport = {
        entries,
        nextCursor: page.nextCursor,
        completedAt: new Date().toISOString(),
      };
      await deps.emitAuditEvent({
        eventType: 'plugin_action_authorized',
        scope: { kind: 'instance', instanceId: job.instanceId },
        workspaceId: job.instanceId,
        requestId: job.requestId,
        outcome: 'success',
        pluginAction: {
          actionId: 'media.inventoryScanCompleted',
          actionNamespace: 'media',
          actionOwner: 'host',
          result: 'success',
          reasonCode: 'inventory_scan_reported',
          resourceType: 'studio_job',
          resourceId: job.id,
        },
      });
      return { resultPayload: { plugin: { report } } };
    } catch {
      throw new Error('media_inventory_scan_failed');
    }
  };

export const mediaInventoryScanStudioJobRegistration: StudioJobExecutionRegistration = {
  source: 'host',
  jobTypeId: mediaInventoryScanJobTypeId,
  queueName,
  handler: createMediaInventoryScanHandler({
    resolveStoragePort: createConfiguredMediaStoragePortForInstance,
    emitAuditEvent: emitAuthAuditEvent,
  }),
};

export const getMediaInventoryScan = async (instanceId: string, jobId: string) =>
  withStudioJobRepository(instanceId, async (jobs) => {
    const job = await jobs.getJobById(instanceId, jobId);
    if (!job || job.source !== 'host' || job.jobTypeId !== mediaInventoryScanJobTypeId) return null;
    return { id: job.id, status: job.status, report: job.resultPayload?.plugin?.report ?? null };
  });
