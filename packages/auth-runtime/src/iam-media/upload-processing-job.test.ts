import { describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';

import {
  createMediaUploadProcessingHandler,
  scheduleMediaUploadProcessing,
} from './upload-processing-job.js';

vi.mock('./clamav.js', async (original) => ({
  ...(await original<typeof import('./clamav.js')>()),
  scanConfiguredMedia: vi.fn(async () => undefined),
}));

const instanceId = 'tenant-a';
const uploadSessionId = '00000000-0000-4000-8000-000000000001';
const asset = {
  id: 'asset-1',
  instanceId,
  storageKey: 'tenant-a/original.jpg',
  mediaType: 'image',
  mimeType: 'image/jpeg',
  byteSize: 100000,
  visibility: 'public',
  uploadStatus: 'pending',
  processingStatus: 'pending',
  metadata: {},
  technical: {},
};
const session = {
  id: uploadSessionId,
  instanceId,
  assetId: asset.id,
  storageKey: asset.storageKey,
  mimeType: 'image/jpeg',
  byteSize: 100000,
  status: 'uploaded',
  claimToken: 'claim-new',
  replacedClaimToken: 'claim-old',
};

const setup = async () => {
  const body = await sharp({ create: { width: 24, height: 24, channels: 3, background: 'red' } })
    .jpeg()
    .toBuffer();
  const service = {
    getUploadSessionById: vi.fn(async () => session),
    getAssetById: vi.fn(async () => asset),
    claimUploadSession: vi.fn(async () => session),
    lockUploadSessionClaim: vi.fn(async () => true),
    lockOpenContentSaveOperationForUpload: vi.fn(async () => true),
    tryApplyStorageUsageWithinQuota: vi.fn(async () => true),
    upsertAsset: vi.fn(),
    upsertUploadSession: vi.fn(),
    upsertVariant: vi.fn(),
  };
  const storage = {
    listObjects: vi.fn(async () => ({ items: [], nextCursor: null })),
    readObject: vi.fn(async () => ({ body, byteSize: body.length, contentType: 'image/jpeg' })),
    writeObject: vi.fn(async ({ body }: { body: Uint8Array }) => ({ byteSize: body.length })),
    deleteObject: vi.fn(),
  };
  const emitAuditEvent = vi.fn();
  const handler = createMediaUploadProcessingHandler({
    withMediaService: async (_instanceId, work) => work(service as never),
    getJobAttempts: async () => context.job.attempts + 1,
    resolveStoragePort: async () => storage as never,
    createId: () => crypto.randomUUID(),
    emitAuditEvent,
  });
  const context = {
    job: {
      id: uploadSessionId,
      instanceId,
      attempts: 1,
      maxAttempts: 5,
      inputPayload: { uploadSessionId },
    },
    progressReporter: { reportProgress: vi.fn() },
  };
  return { service, storage, emitAuditEvent, run: () => handler(context as never), context };
};

describe('media processing job', () => {
  it('marks only successfully scanned intake files as clean when scanning is later disabled', async () => {
    const { service, run } = await setup();
    const quarantinedSession = { ...session, storageKey: '.quarantine/tenant-a/asset-1/session-1' };
    service.getUploadSessionById.mockResolvedValue(quarantinedSession);
    service.claimUploadSession.mockResolvedValue(quarantinedSession);
    service.getAssetById.mockResolvedValue({ ...asset, storageKey: quarantinedSession.storageKey });
    await run();
    expect(service.upsertAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        processingStatus: 'ready',
        technical: expect.objectContaining({ scanStatus: 'clean' }),
      })
    );
  });

  it('keeps finalized files and quota when intake cleanup fails, and retries only cleanup', async () => {
    const { storage, service, context, run } = await setup();
    const intake = '.quarantine/tenant-a/asset-1/session';
    service.getUploadSessionById.mockResolvedValue({ ...session, storageKey: intake });
    service.upsertAsset.mockImplementation(async (next) => {
      service.getAssetById.mockResolvedValue(next);
    });
    service.upsertUploadSession.mockImplementation(async (next) => {
      service.getUploadSessionById.mockResolvedValue(next);
    });
    context.job.attempts = 4;
    storage.deleteObject.mockImplementation(async ({ storageKey }) => {
      if (storageKey === intake) throw new Error('private-storage-error');
    });
    await expect(run()).rejects.toThrow('media_processing_unavailable');
    expect(service.tryApplyStorageUsageWithinQuota).toHaveBeenCalledOnce();
    expect(service.upsertAsset).toHaveBeenCalledOnce();
    expect(service.upsertAsset).toHaveBeenCalledWith(
      expect.objectContaining({ processingStatus: 'ready' })
    );
    const writes = storage.writeObject.mock.calls.length;
    storage.deleteObject.mockResolvedValue(undefined);
    await expect(run()).resolves.toEqual({});
    expect(storage.writeObject).toHaveBeenCalledTimes(writes);
    expect(service.tryApplyStorageUsageWithinQuota).toHaveBeenCalledOnce();
  });

  it('creates the claim, job, queued event and enqueue within the same transaction callback', async () => {
    const jobs = {
      getJobById: vi.fn(async () => null),
      createJob: vi.fn(async (input) => input),
      appendJobEvent: vi.fn(),
    };
    const media = { claimUploadSession: vi.fn(async () => session) };
    const enqueue = vi.fn();
    await expect(
      scheduleMediaUploadProcessing({ instanceId, uploadSessionId }, async (_id, work) =>
        work({ media, jobs, enqueue } as never)
      )
    ).resolves.toBe('queued');
    expect(jobs.createJob).toHaveBeenCalledWith(
      expect.objectContaining({
        id: uploadSessionId,
        source: 'host',
        jobTypeId: 'media.process-upload',
      })
    );
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: uploadSessionId, instanceId })
    );
    expect(jobs.appendJobEvent).toHaveBeenCalledOnce();
  });

  it('returns the durable job on repeated completion without a second enqueue or claim', async () => {
    const media = { claimUploadSession: vi.fn() };
    const enqueue = vi.fn();
    const jobs = { getJobById: vi.fn(async () => ({ status: 'running' })), createJob: vi.fn() };
    await expect(
      scheduleMediaUploadProcessing({ instanceId, uploadSessionId }, async (_id, work) =>
        work({ media, jobs, enqueue } as never)
      )
    ).resolves.toBe('running');
    expect(enqueue).not.toHaveBeenCalled();
    expect(media.claimUploadSession).not.toHaveBeenCalled();
  });

  it('propagates enqueue failures so its transaction cannot commit a half-created job', async () => {
    const jobs = {
      getJobById: vi.fn(async () => null),
      createJob: vi.fn(async (input) => input),
      appendJobEvent: vi.fn(),
    };
    await expect(
      scheduleMediaUploadProcessing({ instanceId, uploadSessionId }, async (_id, work) =>
        work({
          media: { claimUploadSession: async () => session },
          jobs,
          enqueue: async () => {
            throw new Error('queue unavailable');
          },
        } as never)
      )
    ).rejects.toThrow('queue unavailable');
  });

  it('reuses the real processor, renews its claim and publishes only after quota approval', async () => {
    const { service, storage, emitAuditEvent, run } = await setup();
    await run();
    expect(service.claimUploadSession).toHaveBeenCalledWith(instanceId, uploadSessionId, true);
    expect(storage.listObjects).toHaveBeenCalledWith(
      expect.objectContaining({ prefix: 'tenant-a/variants/asset-1/claim-old/' })
    );
    expect(service.upsertAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        processingStatus: 'ready',
        uploadStatus: 'processed',
        technical: expect.not.objectContaining({ scanStatus: 'clean' }),
      })
    );
    expect(service.tryApplyStorageUsageWithinQuota).toHaveBeenCalledOnce();
    expect(emitAuditEvent).toHaveBeenCalledOnce();
    service.getUploadSessionById.mockResolvedValue({ ...session, status: 'validated' });
    service.getAssetById.mockResolvedValue({ ...asset, processingStatus: 'ready' });
    await run();
    expect(storage.readObject).toHaveBeenCalledOnce();
    expect(service.tryApplyStorageUsageWithinQuota).toHaveBeenCalledOnce();
  });

  it('cleans the claim replaced during admission as well as the previous worker attempt', async () => {
    const { context, storage, run } = await setup();
    Object.assign(context.job.inputPayload, { replacedClaimToken: 'interrupted-admission-claim' });
    await run();
    expect(storage.listObjects).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ prefix: 'tenant-a/variants/asset-1/interrupted-admission-claim/' })
    );
    expect(storage.listObjects).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ prefix: 'tenant-a/variants/asset-1/claim-old/' })
    );
  });

  it('keeps transient failures retryable and redacts storage details, marking final failures on the asset', async () => {
    const { service, storage, context, run } = await setup();
    storage.readObject.mockRejectedValue(
      new (await import('./storage-port.js')).MediaStorageUnavailableError('private-storage-key')
    );
    await expect(run()).rejects.toThrow('media_processing_unavailable');
    expect(service.upsertAsset).not.toHaveBeenCalled();
    context.job.attempts = 4; // Handler context precedes markRunning; persisted attempt is already 5.
    await expect(run()).rejects.toThrow('media_processing_unavailable');
    expect(service.upsertAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        processingStatus: 'failed',
        technical: { lastError: { code: 'media_processing_failed' } },
      })
    );
  });

  it('fails permanently and removes generated objects when quota is exceeded', async () => {
    const { service, storage, run } = await setup();
    service.tryApplyStorageUsageWithinQuota.mockResolvedValue(false);
    await expect(run()).rejects.toMatchObject({
      message: 'storage_quota_exceeded',
      cause: { category: 'permanent' },
    });
    expect(service.upsertAsset).toHaveBeenCalledWith(
      expect.objectContaining({ processingStatus: 'failed' })
    );
    expect(storage.deleteObject).toHaveBeenCalledWith({ instanceId, storageKey: asset.storageKey });
  });

  it('does not publish or book bytes after a content-save operation was abandoned', async () => {
    const { service, storage, run } = await setup();
    service.getAssetById.mockResolvedValue({
      ...asset,
      provisionalOperationId: 'operation-1',
    } as typeof asset);
    service.lockOpenContentSaveOperationForUpload.mockResolvedValue(false);
    await expect(run()).rejects.toThrow('upload_processing_superseded');
    expect(service.tryApplyStorageUsageWithinQuota).not.toHaveBeenCalled();
    expect(service.upsertAsset).not.toHaveBeenCalled();
    expect(storage.deleteObject).toHaveBeenCalled();
  });

  it('handles a deleted upload without recreating its asset and scopes every lookup to its job tenant', async () => {
    const { service, storage, run } = await setup();
    service.getUploadSessionById.mockResolvedValue(null as never);
    await expect(run()).resolves.toMatchObject({
      resultPayload: { plugin: { status: 'removed' } },
    });
    expect(service.getUploadSessionById).toHaveBeenCalledWith(instanceId, uploadSessionId);
    expect(storage.writeObject).not.toHaveBeenCalled();
    expect(service.upsertAsset).not.toHaveBeenCalled();
  });
});
