import { describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { scanConfiguredMedia, MediaScanError } from './clamav.js';
import { mp3WithId3, mp3WithoutTags } from '../../tests/iam-media-mp3.test-fixtures.js';

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

const setup = async (audio?: Buffer, storedMime = 'audio/mpeg', quarantined = true) => {
  const body =
    audio ??
    (await sharp({ create: { width: 24, height: 24, channels: 3, background: 'red' } })
      .jpeg()
      .toBuffer());
  const uploadAsset = audio
    ? {
        ...asset,
        storageKey: quarantined ? '.quarantine/tenant-a/asset-1/session' : asset.storageKey,
        mediaType: 'audio',
        mimeType: 'audio/mpeg',
        byteSize: body.length,
      }
    : asset;
  const uploadSession = audio
    ? {
        ...session,
        storageKey: uploadAsset.storageKey,
        mimeType: uploadAsset.mimeType,
        byteSize: body.length,
        replacedClaimToken: undefined,
      }
    : session;
  const service = {
    getUploadSessionById: vi.fn(async () => uploadSession),
    getAssetById: vi.fn(async () => uploadAsset),
    claimUploadSession: vi.fn(async () => uploadSession),
    lockUploadSessionClaim: vi.fn(async () => true),
    lockOpenContentSaveOperationForUpload: vi.fn(async () => true),
    tryApplyStorageUsageWithinQuota: vi.fn(async () => true),
    upsertAsset: vi.fn(),
    upsertUploadSession: vi.fn(),
    upsertVariant: vi.fn(),
  };
  const storage = {
    listObjects: vi.fn(async () => ({ items: [], nextCursor: null })),
    readObject: vi.fn(async () => ({
      body,
      byteSize: body.length,
      contentType: audio ? storedMime : 'image/jpeg',
    })),
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
  it.each([mp3WithId3, mp3WithoutTags])(
    'publishes a scanned MP3 as an immutable original without image variants',
    async (body) => {
      vi.mocked(scanConfiguredMedia).mockClear();
      const { service, storage, run } = await setup(body);

      await run();

      expect(storage.readObject).toHaveBeenCalledWith({
        instanceId,
        storageKey: '.quarantine/tenant-a/asset-1/session',
        maxBytes: body.length,
      });
      expect(scanConfiguredMedia).toHaveBeenCalledExactlyOnceWith(body);
      expect(storage.writeObject).toHaveBeenCalledExactlyOnceWith({
        instanceId,
        storageKey: 'tenant-a/variants/asset-1/claim-new/original.mp3',
        body,
        contentType: 'audio/mpeg',
      });
      expect(service.upsertAsset).toHaveBeenCalledWith(
        expect.objectContaining({
          mediaType: 'audio',
          processingStatus: 'ready',
          technical: expect.objectContaining({ scanStatus: 'clean', variantBytes: 0 }),
        })
      );
      expect(service.upsertVariant).not.toHaveBeenCalled();
    }
  );

  it.each([
    ['a truncated ID3 tag', Buffer.from('494433030000007f7f7f', 'hex'), 'audio/mpeg', true],
    ['a truncated frame', mp3WithoutTags.subarray(0, 20), 'audio/mpeg', true],
    ['incorrect object MIME', mp3WithoutTags, 'image/jpeg', true],
    ['an unquarantined upload', mp3WithoutTags, 'audio/mpeg', false],
  ] as const)(
    'rejects %s before scanning or publishing',
    async (_label, body, mime, quarantined) => {
      vi.mocked(scanConfiguredMedia).mockClear();
      const { service, storage, run } = await setup(body, mime, quarantined);

      await expect(run()).rejects.toThrow('invalid_media_content');

      expect(scanConfiguredMedia).not.toHaveBeenCalled();
      expect(storage.writeObject).not.toHaveBeenCalled();
      expect(service.tryApplyStorageUsageWithinQuota).not.toHaveBeenCalled();
    }
  );

  it('never publishes an MP3 when the scanner is unavailable', async () => {
    vi.mocked(scanConfiguredMedia).mockRejectedValueOnce(
      new MediaScanError('media_scan_unavailable')
    );
    const { service, storage, context, run } = await setup(mp3WithoutTags);
    context.job.attempts = context.job.maxAttempts - 1;

    await expect(run()).rejects.toThrow('media_processing_unavailable');

    expect(storage.writeObject).not.toHaveBeenCalled();
    expect(service.tryApplyStorageUsageWithinQuota).not.toHaveBeenCalled();
    expect(service.upsertAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        processingStatus: 'failed',
        technical: expect.objectContaining({ lastError: { code: 'media_scan_unavailable' } }),
      })
    );
  });

  it('rejects audio that exceeds the authorized size after transfer', async () => {
    vi.mocked(scanConfiguredMedia).mockClear();
    const { storage, run } = await setup(mp3WithoutTags);
    const oversized = Buffer.concat([mp3WithoutTags, Buffer.from([0])]);
    storage.readObject.mockResolvedValueOnce({
      body: oversized,
      byteSize: oversized.length,
      contentType: 'audio/mpeg',
    });

    await expect(run()).rejects.toThrow('upload_size_exceeded');

    expect(scanConfiguredMedia).not.toHaveBeenCalled();
    expect(storage.writeObject).not.toHaveBeenCalled();
  });

  it('records the rejected asset in the scan failure audit without quota booking', async () => {
    const { service, run, emitAuditEvent } = await setup();
    service.getUploadSessionById.mockResolvedValue({
      ...session,
      storageKey: '.quarantine/tenant-a/asset-1/session',
    });
    vi.mocked(scanConfiguredMedia).mockRejectedValueOnce(new MediaScanError('media_scan_infected'));
    await expect(run()).rejects.toThrow('media_scan_infected');
    expect(service.tryApplyStorageUsageWithinQuota).not.toHaveBeenCalled();
    expect(emitAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: { kind: 'instance', instanceId },
        pluginAction: expect.objectContaining({
          result: 'failure',
          reasonCode: 'media_scan_infected',
          resourceType: 'media_asset',
          resourceId: asset.id,
        }),
      })
    );
  });

  it('keeps a legacy public upload outside the scan proof after activation', async () => {
    vi.stubEnv('MEDIA_SCAN_ENABLED', 'true');
    vi.mocked(scanConfiguredMedia).mockClear();
    try {
      const { service, run } = await setup();
      await run();
      expect(scanConfiguredMedia).not.toHaveBeenCalled();
      expect(service.upsertAsset).toHaveBeenCalledWith(
        expect.objectContaining({
          storageKey: asset.storageKey,
          processingStatus: 'ready',
          technical: expect.not.objectContaining({ scanStatus: 'clean' }),
        })
      );
      expect(service.tryApplyStorageUsageWithinQuota).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it.each(['true', 'false'])(
    'scans private intake when the upload switch is %s',
    async (enabled) => {
      vi.stubEnv('MEDIA_SCAN_ENABLED', enabled);
      vi.mocked(scanConfiguredMedia).mockClear();
      try {
        const { service, run } = await setup();
        const quarantinedSession = {
          ...session,
          storageKey: '.quarantine/tenant-a/asset-1/session-1',
        };
        service.getUploadSessionById.mockResolvedValue(quarantinedSession);
        service.claimUploadSession.mockResolvedValue(quarantinedSession);
        service.getAssetById.mockResolvedValue({
          ...asset,
          storageKey: quarantinedSession.storageKey,
        });
        await run();
        expect(scanConfiguredMedia).toHaveBeenCalledOnce();
        expect(service.upsertAsset).toHaveBeenCalledWith(
          expect.objectContaining({
            processingStatus: 'ready',
            technical: expect.objectContaining({ scanStatus: 'clean' }),
          })
        );
      } finally {
        vi.unstubAllEnvs();
      }
    }
  );

  it('retries cleanup of a local editing source without treating private storage as scan proof', async () => {
    const { storage, service, emitAuditEvent, run } = await setup();
    const outputIntake = '.protected/tenant-a/intake/output';
    const sourceIntake = '.protected/tenant-a/intake/source';
    service.getUploadSessionById.mockResolvedValue({
      ...session,
      status: 'validated',
      storageKey: outputIntake,
    });
    service.getAssetById.mockResolvedValue({
      ...asset,
      uploadStatus: 'processed',
      processingStatus: 'ready',
      editingSourceKey: '.protected/tenant-a/variants/asset-1/claim/source.jpg',
      technical: { editingSourceIntakeKey: sourceIntake, editingOutputIntakeKey: outputIntake },
    });
    storage.deleteObject
      .mockImplementationOnce(async () => undefined)
      .mockRejectedValueOnce(new Error('cleanup interrupted'));
    await expect(run()).rejects.toThrow('media_processing_unavailable');
    storage.deleteObject.mockResolvedValue(undefined);
    await expect(run()).resolves.toEqual({});
    expect(storage.deleteObject).toHaveBeenCalledWith({ instanceId, storageKey: sourceIntake });
    expect(storage.deleteObject).not.toHaveBeenCalledWith({
      instanceId,
      storageKey: '.protected/tenant-a/variants/asset-1/claim/source.jpg',
    });
    expect(emitAuditEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({
        pluginAction: expect.objectContaining({ reasonCode: 'media_scan_clean' }),
      })
    );
    expect(service.tryApplyStorageUsageWithinQuota).not.toHaveBeenCalled();
    expect(storage.writeObject).not.toHaveBeenCalled();
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
