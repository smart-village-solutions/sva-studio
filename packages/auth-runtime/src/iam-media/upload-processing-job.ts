import { randomUUID } from 'node:crypto';

import { withStudioJobRepository } from '../plugin-operations/repository.js';
import { emitAuthAuditEvent } from '../audit-events.js';
import type {
  StudioJobExecutionHandler,
  StudioJobExecutionRegistration,
} from '../plugin-operations/runner.js';
import { withMediaService, withMediaUploadJobRepositories } from './repository.js';
import { createConfiguredMediaStoragePortForInstance } from './storage-s3.js';
import { cleanupReplacedClaimVariants } from './processing-variants.js';
import { createMediaUploadProcessingService } from './processing.js';
import { getMediaEditingIntakeKeys } from './processing-editing.js';
import { failClaimedUpload, finalizeProcessedUpload } from './upload-finalization.js';
import type { MediaHttpHandlerDeps } from './http-support.js';
import type { MediaService } from './service.js';
import { MediaScanError } from './clamav.js';
import { isMediaQuarantineKey, isPrivateMediaStorageKey } from './storage-key-paths.js';

export const mediaUploadProcessingJobTypeId = 'media.process-upload';
const queueName = 'media-processing';

export const scheduleMediaUploadProcessing = async (
  input: {
    readonly instanceId: string;
    readonly uploadSessionId: string;
    readonly requestId?: string;
  },
  withRepositories = withMediaUploadJobRepositories
): Promise<string> =>
  withRepositories(input.instanceId, async ({ media, jobs, enqueue }) => {
    // The session UUID is also the job UUID, so completion retries find the same durable job.
    const existing = await jobs.getJobById(input.instanceId, input.uploadSessionId);
    if (existing) return existing.status;
    const session = await media.claimUploadSession(input.instanceId, input.uploadSessionId);
    if (!session?.claimToken) {
      const accepted = await jobs.getJobById(input.instanceId, input.uploadSessionId);
      if (accepted) return accepted.status;
      throw new Error('media_upload_not_claimable');
    }
    const job = await jobs.createJob({
      id: input.uploadSessionId,
      instanceId: input.instanceId,
      source: 'host',
      jobTypeId: mediaUploadProcessingJobTypeId,
      queueName,
      status: 'queued',
      attempts: 0,
      maxAttempts: 5,
      inputPayload: {
        uploadSessionId: input.uploadSessionId,
        ...(session.replacedClaimToken ? { replacedClaimToken: session.replacedClaimToken } : {}),
      },
      idempotencyKey: `media-upload:${input.uploadSessionId}`,
      requestId: input.requestId,
      correlationId: input.uploadSessionId,
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
    await enqueue({
      instanceId: input.instanceId,
      jobId: job.id,
      queueName,
      maxAttempts: job.maxAttempts,
    });
    return job.status;
  });

const permanentFailure = (code: string) =>
  Object.assign(new Error(code), { cause: { category: 'permanent' } });

type ProcessingDeps = Pick<
  MediaHttpHandlerDeps,
  'withMediaService' | 'createId' | 'emitAuditEvent'
> & {
  readonly resolveStoragePort: typeof createConfiguredMediaStoragePortForInstance;
  readonly getJobAttempts: (instanceId: string, jobId: string) => Promise<number>;
};

type ProcessingJob = Parameters<StudioJobExecutionHandler>[0]['job'];
type UploadSession = NonNullable<Awaited<ReturnType<MediaService['getUploadSessionById']>>>;
type UploadAsset = NonNullable<Awaited<ReturnType<MediaService['getAssetById']>>>;

const emitUploadCompletion = (
  deps: ProcessingDeps,
  job: ProcessingJob,
  session: UploadSession,
  asset: UploadAsset
) =>
  deps.emitAuditEvent({
    eventType: 'plugin_action_authorized',
    scope: { kind: 'instance', instanceId: job.instanceId },
    workspaceId: job.instanceId,
    requestId: job.requestId,
    outcome: 'success',
    pluginAction: {
      actionId:
        asset.lifecycleStatus === 'provisional'
          ? 'media.contentDraftUploaded'
          : 'media.uploadComplete',
      actionNamespace: 'media',
      actionOwner: 'host',
      result: 'success',
      reasonCode: isMediaQuarantineKey(session.storageKey)
        ? 'media_scan_clean'
        : 'variants_generated',
      resourceType: 'media_asset',
      resourceId: asset.id,
    },
  });

const isPermanentProcessingFailure = (error: unknown): boolean =>
  error instanceof Error &&
  'cause' in error &&
  typeof error.cause === 'object' &&
  error.cause !== null &&
  'category' in error.cause &&
  error.cause.category === 'permanent';

const failProcessingAttempt = async (
  deps: ProcessingDeps,
  job: ProcessingJob,
  session: UploadSession,
  asset: UploadAsset,
  claimed: UploadSession,
  claimToken: string,
  error: unknown
): Promise<never> => {
  const scanCode =
    error instanceof MediaScanError
      ? error.code
      : error instanceof Error && error.message === 'media_scan_infected'
        ? error.message
        : undefined;
  if (scanCode)
    await deps.emitAuditEvent({
      eventType: 'plugin_action_authorized',
      scope: { kind: 'instance', instanceId: job.instanceId },
      workspaceId: job.instanceId,
      requestId: job.requestId,
      outcome: 'failure',
      pluginAction: {
        actionId: 'media.uploadComplete',
        actionNamespace: 'media',
        actionOwner: 'host',
        result: 'failure',
        reasonCode: scanCode,
        resourceType: 'media_asset',
        resourceId: asset.id,
      },
    });
  const permanent = isPermanentProcessingFailure(error);
  const currentAsset = await deps.withMediaService(job.instanceId, (service) =>
    service.getAssetById(job.instanceId, asset.id)
  );
  if (
    !permanent &&
    currentAsset?.processingStatus !== 'ready' &&
    (await deps.getJobAttempts(job.instanceId, job.id)) >= job.maxAttempts
  ) {
    const failed = await failClaimedUpload(deps, {
      instanceId: job.instanceId,
      claimToken,
      asset,
      uploadSession: claimed,
      errorCode: error instanceof MediaScanError ? error.code : 'media_processing_failed',
    });
    if (failed === 'failed' && isPrivateMediaStorageKey(session.storageKey)) {
      try {
        const storage = await deps.resolveStoragePort(job.instanceId);
        await cleanupUploadIntakes(storage, job.instanceId, session, asset);
      } catch {
        /* The existing explicit job retry can repeat rejected-upload cleanup. */
      }
    }
  }
  // Storage errors may contain keys or signed URLs. Only the stable reason enters job diagnostics.
  throw permanent ? error : new Error('media_processing_unavailable');
};

const cleanupUploadIntakes = async (
  storage: Pick<MediaHttpHandlerDeps['storagePort'], 'deleteObject'>,
  instanceId: string,
  session: UploadSession,
  asset: UploadAsset
): Promise<void> => {
  for (const storageKey of new Set([session.storageKey, ...getMediaEditingIntakeKeys(asset)])) {
    await storage.deleteObject({ instanceId, storageKey });
  }
};

const recoverFinishedUpload = async (
  deps: ProcessingDeps,
  job: ProcessingJob,
  session: UploadSession,
  asset: UploadAsset
) => {
  if (session.status === 'validated' && asset.processingStatus === 'ready') {
    if (isPrivateMediaStorageKey(session.storageKey)) {
      try {
        await emitUploadCompletion(deps, job, session, asset);
        const storage = await deps.resolveStoragePort(job.instanceId);
        await cleanupUploadIntakes(storage, job.instanceId, session, asset);
      } catch {
        throw new Error('media_processing_unavailable');
      }
    }
    return {};
  }
  if (session.status === 'failed' && isPrivateMediaStorageKey(session.storageKey)) {
    try {
      const storage = await deps.resolveStoragePort(job.instanceId);
      await cleanupUploadIntakes(storage, job.instanceId, session, asset);
    } catch {
      throw new Error('media_processing_unavailable');
    }
    return { resultPayload: { plugin: { status: 'rejected_upload_cleaned' } } };
  }
};

export const createMediaUploadProcessingHandler =
  (deps: ProcessingDeps): StudioJobExecutionHandler =>
  async ({ job, progressReporter }) => {
    const uploadSessionId = job.inputPayload.uploadSessionId;
    if (typeof uploadSessionId !== 'string' || uploadSessionId !== job.id) {
      throw permanentFailure('media_upload_job_invalid');
    }
    const session = await deps.withMediaService(job.instanceId, (service) =>
      service.getUploadSessionById(job.instanceId, uploadSessionId)
    );
    const asset = session
      ? await deps.withMediaService(job.instanceId, (service) =>
          service.getAssetById(job.instanceId, session.assetId)
        )
      : null;
    if (!session || !asset) return { resultPayload: { plugin: { status: 'removed' } } };
    const completed = await recoverFinishedUpload(deps, job, session, asset);
    if (completed) return completed;
    // Renew even a fresh claim on a technical retry; obsolete attempts cannot publish or delete its variants.
    const claimed = await deps.withMediaService(job.instanceId, (service) =>
      service.claimUploadSession(job.instanceId, uploadSessionId, true)
    );
    if (!claimed?.claimToken) throw permanentFailure('media_upload_not_claimable');
    const claimToken = claimed.claimToken;
    try {
      await progressReporter.reportProgress({
        jobId: job.id,
        instanceId: job.instanceId,
        progress: { completedSteps: 0, totalSteps: 1, currentPhase: 'processing' },
      });
      const storagePort = await deps.resolveStoragePort(job.instanceId);
      if (typeof job.inputPayload.replacedClaimToken === 'string') {
        await cleanupReplacedClaimVariants({
          storagePort,
          instanceId: job.instanceId,
          assetId: asset.id,
          claimToken: job.inputPayload.replacedClaimToken,
          privateOutput:
            isPrivateMediaStorageKey(session.storageKey) && asset.visibility === 'protected',
          privateSource: Boolean(asset.editingSourceKey),
        });
      }
      const result = await createMediaUploadProcessingService({
        service: {
          getUploadSessionById: (instanceId, id) =>
            deps.withMediaService(instanceId, (service) =>
              service.getUploadSessionById(instanceId, id)
            ),
          getAssetById: (instanceId, id) =>
            deps.withMediaService(instanceId, (service) => service.getAssetById(instanceId, id)),
        },
        storagePort,
        createId: deps.createId,
        finalizeUpload: (input) => finalizeProcessedUpload(deps, input),
        failUpload: (input) => failClaimedUpload(deps, input),
      }).completeUpload({
        instanceId: job.instanceId,
        uploadSessionId,
        claimToken,
        ...(claimed.replacedClaimToken ? { replacedClaimToken: claimed.replacedClaimToken } : {}),
      });
      if (!result.ok) throw permanentFailure(result.errorCode);
      await emitUploadCompletion(deps, job, session, asset);
      if (isPrivateMediaStorageKey(session.storageKey))
        await cleanupUploadIntakes(storagePort, job.instanceId, session, asset);
      return { resultPayload: { plugin: { assetId: asset.id } } };
    } catch (error) {
      return failProcessingAttempt(deps, job, session, asset, claimed, claimToken, error);
    }
  };

export const mediaUploadProcessingStudioJobRegistration: StudioJobExecutionRegistration = {
  source: 'host',
  jobTypeId: mediaUploadProcessingJobTypeId,
  queueName,
  handler: createMediaUploadProcessingHandler({
    withMediaService,
    resolveStoragePort: createConfiguredMediaStoragePortForInstance,
    createId: randomUUID,
    emitAuditEvent: emitAuthAuditEvent,
    getJobAttempts: (instanceId, jobId) =>
      withStudioJobRepository(
        instanceId,
        async (repository) => (await repository.getJobById(instanceId, jobId))?.attempts ?? 0
      ),
  }),
};
