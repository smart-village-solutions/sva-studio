import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';

import { createMediaUploadProcessingService } from './processing.js';

const createAsset = (overrides: Record<string, unknown> = {}) => ({
  id: 'asset-1',
  instanceId: 'tenant-a',
  storageKey: 'tenant-a/originals/asset-1.png',
  mediaType: 'image',
  mimeType: 'image/png',
  byteSize: 1024,
  visibility: 'public',
  uploadStatus: 'pending',
  processingStatus: 'pending',
  metadata: {},
  technical: {},
  ...overrides,
});

const createUploadSession = (overrides: Record<string, unknown> = {}) => ({
  id: 'upload-1',
  instanceId: 'tenant-a',
  assetId: 'asset-1',
  storageKey: 'tenant-a/originals/asset-1.png',
  mimeType: 'image/png',
  byteSize: 1024,
  status: 'pending',
  ...overrides,
});

const createFinalizeUpload = (service: {
  upsertVariant: ReturnType<typeof vi.fn>;
  upsertAsset: ReturnType<typeof vi.fn>;
  upsertUploadSession: ReturnType<typeof vi.fn>;
  applyStorageUsageDelta: ReturnType<typeof vi.fn>;
}) =>
  vi.fn(
    async (input: {
      instanceId: string;
      asset: Record<string, unknown>;
      uploadSession: Record<string, unknown>;
      variants: readonly Record<string, unknown>[];
      totalBytes: number;
    }) => {
      for (const variant of input.variants) {
        await service.upsertVariant(input.instanceId, variant);
      }
      await service.upsertAsset(input.asset);
      await service.upsertUploadSession(input.uploadSession);
      await service.applyStorageUsageDelta({
        instanceId: input.instanceId,
        totalBytesDelta: input.totalBytes,
        assetCountDelta: 1,
      });
      return 'finalized' as const;
    }
  );

const createFailUpload = (service: {
  upsertAsset: ReturnType<typeof vi.fn>;
  upsertUploadSession: ReturnType<typeof vi.fn>;
}) =>
  vi.fn(
    async (input: {
      asset: Record<string, unknown>;
      uploadSession: Record<string, unknown>;
      errorCode: string;
    }) => {
      await service.upsertAsset({
        ...input.asset,
        uploadStatus: 'failed',
        processingStatus: 'failed',
        technical: {
          ...((input.asset.technical as Record<string, unknown> | undefined) ?? {}),
          lastError: { code: input.errorCode },
        },
      });
      await service.upsertUploadSession({ ...input.uploadSession, status: 'failed' });
      return 'failed' as const;
    }
  );

describe('media upload processing service', () => {
  it('validates an uploaded image, extracts metadata and persists eager variants', async () => {
    const originalBuffer = await sharp({
      create: {
        width: 2400,
        height: 1600,
        channels: 3,
        background: { r: 10, g: 20, b: 30 },
      },
    })
      .png()
      .toBuffer();

    const service = {
      getUploadSessionById: vi.fn(async () =>
        createUploadSession({ byteSize: originalBuffer.byteLength })
      ),
      getAssetById: vi.fn(async () =>
        createAsset({
          byteSize: originalBuffer.byteLength,
          metadata: {
            focusPoint: { x: 0.5, y: 0.5 },
          },
        })
      ),
      upsertAsset: vi.fn(async () => undefined),
      upsertUploadSession: vi.fn(async () => undefined),
      deleteVariantsByAssetId: vi.fn(async () => undefined),
      upsertVariant: vi.fn(async () => undefined),
      listVariantsByAssetId: vi.fn(async () => []),
      getStorageUsage: vi.fn(async () => null),
      upsertStorageUsage: vi.fn(async () => undefined),
      applyStorageUsageDelta: vi.fn(async () => undefined),
    };

    const storagePort = {
      readObject: vi.fn(async () => ({
        body: originalBuffer,
        byteSize: originalBuffer.byteLength,
        contentType: 'image/png',
        etag: 'etag-original',
      })),
      writeObject: vi.fn(async ({ body }: { body: Uint8Array }) => ({
        byteSize: body.byteLength,
        etag: 'etag-variant',
      })),
      deleteObject: vi.fn(async () => undefined),
    };

    const processor = createMediaUploadProcessingService({
      service: service as never,
      storagePort: storagePort as never,
      finalizeUpload: createFinalizeUpload(service),
      failUpload: createFailUpload(service),
      createId: vi
        .fn()
        .mockReturnValueOnce('variant-1')
        .mockReturnValueOnce('variant-2')
        .mockReturnValueOnce('variant-3'),
    });

    const result = await processor.completeUpload({
      instanceId: 'tenant-a',
      uploadSessionId: 'upload-1',
      claimToken: 'claim-1',
    });

    expect(result.ok).toBe(true);
    expect(storagePort.readObject).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      storageKey: 'tenant-a/originals/asset-1.png',
    });
    expect(storagePort.writeObject).toHaveBeenCalledTimes(3);
    expect(service.upsertVariant).toHaveBeenCalledTimes(3);
    expect(service.upsertAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'asset-1',
        uploadStatus: 'processed',
        processingStatus: 'ready',
        metadata: expect.objectContaining({
          focusPoint: { x: 0.5, y: 0.5 },
        }),
        technical: expect.objectContaining({
          width: 2400,
          height: 1600,
          etag: 'etag-original',
        }),
      })
    );
    expect(service.upsertUploadSession).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'upload-1',
        status: 'validated',
      })
    );
    expect(service.applyStorageUsageDelta).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      totalBytesDelta: expect.any(Number),
      assetCountDelta: 1,
    });
  });

  it('removes generated objects and fails the upload when the actual bytes exceed quota', async () => {
    const originalBuffer = await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: { r: 10, g: 20, b: 30 },
      },
    })
      .png()
      .toBuffer();
    const service = {
      getUploadSessionById: vi.fn(async () =>
        createUploadSession({ status: 'uploaded', byteSize: originalBuffer.byteLength })
      ),
      getAssetById: vi.fn(async () => createAsset({ byteSize: originalBuffer.byteLength })),
      upsertAsset: vi.fn(async () => undefined),
      upsertUploadSession: vi.fn(async () => undefined),
    };
    const storagePort = {
      readObject: vi.fn(async () => ({
        body: originalBuffer,
        byteSize: originalBuffer.byteLength,
        contentType: 'image/png',
      })),
      writeObject: vi.fn(async ({ body }: { body: Uint8Array }) => ({
        byteSize: body.byteLength,
      })),
      deleteObject: vi.fn(async () => undefined),
    };
    const finalizeUpload = vi.fn(async () => 'quota_exceeded' as const);
    const processor = createMediaUploadProcessingService({
      service: service as never,
      storagePort: storagePort as never,
      finalizeUpload,
      failUpload: createFailUpload(service),
      createId: vi
        .fn()
        .mockReturnValueOnce('variant-1')
        .mockReturnValueOnce('variant-2')
        .mockReturnValueOnce('variant-3'),
    });

    await expect(
      processor.completeUpload({
        instanceId: 'tenant-a',
        uploadSessionId: 'upload-1',
        claimToken: 'claim-1',
      })
    ).resolves.toEqual({
      ok: false,
      errorCode: 'storage_quota_exceeded',
      status: 409,
    });

    expect(finalizeUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'tenant-a',
        totalBytes: expect.any(Number),
        variants: expect.arrayContaining([
          expect.objectContaining({
            storageKey: 'tenant-a/variants/asset-1/claim-1/thumbnail.webp',
          }),
        ]),
      })
    );
    expect(storagePort.deleteObject).toHaveBeenCalledTimes(4);
    expect(service.upsertAsset).not.toHaveBeenCalled();
    expect(service.upsertUploadSession).not.toHaveBeenCalled();
  });

  it('deletes only claim-scoped variants when a newer claim supersedes finalization', async () => {
    const originalBuffer = await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: { r: 10, g: 20, b: 30 },
      },
    })
      .png()
      .toBuffer();
    const service = {
      getUploadSessionById: vi.fn(async () =>
        createUploadSession({ status: 'uploaded', byteSize: originalBuffer.byteLength })
      ),
      getAssetById: vi.fn(async () => createAsset({ byteSize: originalBuffer.byteLength })),
      upsertAsset: vi.fn(async () => undefined),
      upsertUploadSession: vi.fn(async () => undefined),
    };
    const storagePort = {
      readObject: vi.fn(async () => ({
        body: originalBuffer,
        byteSize: originalBuffer.byteLength,
        contentType: 'image/png',
      })),
      writeObject: vi.fn(async ({ body }: { body: Uint8Array }) => ({
        byteSize: body.byteLength,
      })),
      deleteObject: vi.fn(async () => undefined),
    };
    const processor = createMediaUploadProcessingService({
      service: service as never,
      storagePort: storagePort as never,
      finalizeUpload: vi.fn(async () => 'claim_superseded' as const),
      failUpload: createFailUpload(service),
      createId: vi
        .fn()
        .mockReturnValueOnce('variant-1')
        .mockReturnValueOnce('variant-2')
        .mockReturnValueOnce('variant-3'),
    });

    await expect(
      processor.completeUpload({
        instanceId: 'tenant-a',
        uploadSessionId: 'upload-1',
        claimToken: 'claim-1',
      })
    ).resolves.toEqual({
      ok: false,
      errorCode: 'upload_processing_superseded',
      status: 409,
    });

    expect(storagePort.deleteObject).toHaveBeenCalledTimes(3);
    expect(storagePort.deleteObject).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      storageKey: 'tenant-a/variants/asset-1/claim-1/thumbnail.webp',
    });
    expect(storagePort.deleteObject).not.toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      storageKey: 'tenant-a/originals/asset-1.png',
    });
    expect(service.upsertAsset).not.toHaveBeenCalled();
    expect(service.upsertUploadSession).not.toHaveBeenCalled();
  });

  it('applies crop metadata to eager variants and avoids enlarging smaller sources', async () => {
    const originalBuffer = await sharp({
      create: {
        width: 1200,
        height: 900,
        channels: 3,
        background: { r: 120, g: 90, b: 60 },
      },
    })
      .png()
      .toBuffer();

    const writtenVariants: Array<{ storageKey: string; body: Uint8Array }> = [];
    const service = {
      getUploadSessionById: vi.fn(async () =>
        createUploadSession({ byteSize: originalBuffer.byteLength })
      ),
      getAssetById: vi.fn(async () =>
        createAsset({
          byteSize: originalBuffer.byteLength,
          metadata: {
            focusPoint: { x: 0.25, y: 0.75 },
            crop: { x: 100, y: 80, width: 400, height: 300 },
          },
        })
      ),
      upsertAsset: vi.fn(async () => undefined),
      upsertUploadSession: vi.fn(async () => undefined),
      deleteVariantsByAssetId: vi.fn(async () => undefined),
      upsertVariant: vi.fn(async () => undefined),
      listVariantsByAssetId: vi.fn(async () => []),
      getStorageUsage: vi.fn(async () => null),
      upsertStorageUsage: vi.fn(async () => undefined),
      applyStorageUsageDelta: vi.fn(async () => undefined),
    };

    const storagePort = {
      readObject: vi.fn(async () => ({
        body: originalBuffer,
        byteSize: originalBuffer.byteLength,
        contentType: 'image/png',
        etag: 'etag-original',
      })),
      writeObject: vi.fn(async ({ storageKey, body }: { storageKey: string; body: Uint8Array }) => {
        writtenVariants.push({ storageKey, body });
        return {
          byteSize: body.byteLength,
          etag: `etag-${storageKey}`,
        };
      }),
      deleteObject: vi.fn(async () => undefined),
    };

    const processor = createMediaUploadProcessingService({
      service: service as never,
      storagePort: storagePort as never,
      finalizeUpload: createFinalizeUpload(service),
      failUpload: createFailUpload(service),
      createId: vi
        .fn()
        .mockReturnValueOnce('variant-1')
        .mockReturnValueOnce('variant-2')
        .mockReturnValueOnce('variant-3'),
    });

    const result = await processor.completeUpload({
      instanceId: 'tenant-a',
      uploadSessionId: 'upload-1',
      claimToken: 'claim-1',
    });

    expect(result.ok).toBe(true);
    expect(writtenVariants).toHaveLength(3);

    const thumbnailVariant = writtenVariants.find((entry) =>
      entry.storageKey.endsWith('/thumbnail.webp')
    );
    const teaserVariant = writtenVariants.find((entry) =>
      entry.storageKey.endsWith('/teaser.webp')
    );
    const heroVariant = writtenVariants.find((entry) => entry.storageKey.endsWith('/hero.webp'));

    expect(thumbnailVariant).toBeTruthy();
    expect(teaserVariant).toBeTruthy();
    expect(heroVariant).toBeTruthy();

    const thumbnailMetadata = await sharp(thumbnailVariant?.body).metadata();
    const teaserMetadata = await sharp(teaserVariant?.body).metadata();
    const heroMetadata = await sharp(heroVariant?.body).metadata();

    expect(thumbnailMetadata.width).toBe(320);
    expect(thumbnailMetadata.height).toBe(300);
    expect(teaserMetadata.width).toBe(400);
    expect(teaserMetadata.height).toBe(300);
    expect(heroMetadata.width).toBe(400);
    expect(heroMetadata.height).toBe(300);
  });

  it('fails closed with redacted error details when the uploaded content is invalid', async () => {
    const service = {
      getUploadSessionById: vi.fn(async () => createUploadSession()),
      getAssetById: vi.fn(async () => createAsset()),
      upsertAsset: vi.fn(async () => undefined),
      upsertUploadSession: vi.fn(async () => undefined),
      deleteVariantsByAssetId: vi.fn(async () => undefined),
      upsertVariant: vi.fn(async () => undefined),
      listVariantsByAssetId: vi.fn(async () => []),
      getStorageUsage: vi.fn(async () => null),
      upsertStorageUsage: vi.fn(async () => undefined),
      applyStorageUsageDelta: vi.fn(async () => undefined),
    };

    const storagePort = {
      readObject: vi.fn(async () => ({
        body: Buffer.from('not-an-image'),
        byteSize: 12,
        contentType: 'image/png',
      })),
      writeObject: vi.fn(),
      deleteObject: vi.fn(async () => undefined),
    };

    const processor = createMediaUploadProcessingService({
      service: service as never,
      storagePort: storagePort as never,
      finalizeUpload: createFinalizeUpload(service),
      failUpload: createFailUpload(service),
      createId: () => 'variant-1',
    });

    const result = await processor.completeUpload({
      instanceId: 'tenant-a',
      uploadSessionId: 'upload-1',
      claimToken: 'claim-1',
    });

    expect(result).toEqual({
      ok: false,
      errorCode: 'invalid_media_content',
      status: 422,
    });
    expect(service.upsertAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'asset-1',
        uploadStatus: 'failed',
        processingStatus: 'failed',
        technical: expect.objectContaining({
          lastError: {
            code: 'invalid_media_content',
          },
        }),
      })
    );
    expect(service.upsertUploadSession).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'upload-1',
        status: 'failed',
      })
    );
    expect(storagePort.deleteObject).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      storageKey: 'tenant-a/originals/asset-1.png',
    });
    expect(storagePort.writeObject).not.toHaveBeenCalled();
  });

  it('rethrows infrastructure failures after persistence has started', async () => {
    const originalBuffer = await sharp({
      create: {
        width: 1600,
        height: 900,
        channels: 3,
        background: { r: 30, g: 40, b: 50 },
      },
    })
      .png()
      .toBuffer();

    const service = {
      getUploadSessionById: vi.fn(async () =>
        createUploadSession({ byteSize: originalBuffer.byteLength })
      ),
      getAssetById: vi.fn(async () => createAsset({ byteSize: originalBuffer.byteLength })),
      upsertAsset: vi.fn(async () => undefined),
      upsertUploadSession: vi.fn(async () => undefined),
      deleteVariantsByAssetId: vi.fn(async () => undefined),
      upsertVariant: vi.fn(async () => undefined),
      listVariantsByAssetId: vi.fn(async () => []),
      getStorageUsage: vi.fn(async () => null),
      upsertStorageUsage: vi.fn(async () => undefined),
      applyStorageUsageDelta: vi.fn(async () => undefined),
    };

    const storagePort = {
      readObject: vi.fn(async () => ({
        body: originalBuffer,
        byteSize: originalBuffer.byteLength,
        contentType: 'image/png',
      })),
      deleteObject: vi.fn(async () => undefined),
      writeObject: vi
        .fn()
        .mockResolvedValueOnce({ byteSize: 128, etag: 'etag-variant-1' })
        .mockRejectedValueOnce(new Error('s3_write_failed')),
    };

    const processor = createMediaUploadProcessingService({
      service: service as never,
      storagePort: storagePort as never,
      finalizeUpload: createFinalizeUpload(service),
      failUpload: createFailUpload(service),
      createId: vi
        .fn()
        .mockReturnValueOnce('variant-1')
        .mockReturnValueOnce('variant-2')
        .mockReturnValueOnce('variant-3'),
    });

    await expect(
      processor.completeUpload({
        instanceId: 'tenant-a',
        uploadSessionId: 'upload-1',
        claimToken: 'claim-1',
      })
    ).rejects.toThrow('s3_write_failed');

    expect(storagePort.deleteObject).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      storageKey: 'tenant-a/variants/asset-1/claim-1/thumbnail.webp',
    });
    expect(service.deleteVariantsByAssetId).not.toHaveBeenCalled();
    expect(service.upsertAsset).not.toHaveBeenCalled();
    expect(service.upsertUploadSession).not.toHaveBeenCalled();
  });

  it('does not persist or clean up an invalid upload after its claim was superseded', async () => {
    const service = {
      getUploadSessionById: vi.fn(async () => createUploadSession({ status: 'uploaded' })),
      getAssetById: vi.fn(async () => createAsset()),
      upsertAsset: vi.fn(async () => undefined),
      upsertUploadSession: vi.fn(async () => undefined),
    };
    const storagePort = {
      readObject: vi.fn(async () => ({
        body: Buffer.from('not-an-image'),
        byteSize: 12,
        contentType: 'image/png',
      })),
      writeObject: vi.fn(),
      deleteObject: vi.fn(async () => undefined),
    };
    const failUpload = vi.fn(async () => 'claim_superseded' as const);
    const processor = createMediaUploadProcessingService({
      service: service as never,
      storagePort: storagePort as never,
      finalizeUpload: vi.fn(),
      failUpload,
      createId: () => 'variant-1',
    });

    await expect(
      processor.completeUpload({
        instanceId: 'tenant-a',
        uploadSessionId: 'upload-1',
        claimToken: 'claim-1',
      })
    ).resolves.toEqual({
      ok: false,
      errorCode: 'upload_processing_superseded',
      status: 409,
    });

    expect(failUpload).toHaveBeenCalledWith(
      expect.objectContaining({ claimToken: 'claim-1', errorCode: 'invalid_media_content' })
    );
    expect(storagePort.deleteObject).not.toHaveBeenCalled();
    expect(service.upsertAsset).not.toHaveBeenCalled();
    expect(service.upsertUploadSession).not.toHaveBeenCalled();
  });

  it('cleans up claim-scoped partial variants without making a transient failure terminal', async () => {
    const originalBuffer = await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: { r: 30, g: 40, b: 50 },
      },
    })
      .png()
      .toBuffer();
    const service = {
      getUploadSessionById: vi.fn(async () =>
        createUploadSession({ status: 'uploaded', byteSize: originalBuffer.byteLength })
      ),
      getAssetById: vi.fn(async () => createAsset({ byteSize: originalBuffer.byteLength })),
    };
    const storagePort = {
      readObject: vi.fn(async () => ({
        body: originalBuffer,
        byteSize: originalBuffer.byteLength,
        contentType: 'image/png',
      })),
      writeObject: vi
        .fn()
        .mockResolvedValueOnce({ byteSize: 128 })
        .mockRejectedValueOnce(new Error('s3_write_failed')),
      deleteObject: vi.fn(async () => undefined),
    };
    const failUpload = vi.fn(async () => 'claim_superseded' as const);
    const processor = createMediaUploadProcessingService({
      service: service as never,
      storagePort: storagePort as never,
      finalizeUpload: vi.fn(),
      failUpload,
      createId: () => 'variant-1',
    });

    await expect(
      processor.completeUpload({
        instanceId: 'tenant-a',
        uploadSessionId: 'upload-1',
        claimToken: 'claim-1',
      })
    ).rejects.toThrow('s3_write_failed');

    expect(failUpload).not.toHaveBeenCalled();
    expect(storagePort.deleteObject).toHaveBeenCalledOnce();
    expect(storagePort.deleteObject).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      storageKey: 'tenant-a/variants/asset-1/claim-1/thumbnail.webp',
    });
  });

  it('treats repeated completion of an already validated session as idempotent success', async () => {
    const asset = createAsset({
      uploadStatus: 'processed',
      processingStatus: 'ready',
      technical: {
        width: 1200,
        height: 800,
        variantBytes: 456,
      },
    });
    const service = {
      getUploadSessionById: vi.fn(async () => createUploadSession({ status: 'validated' })),
      getAssetById: vi.fn(async () => asset),
      upsertAsset: vi.fn(async () => undefined),
      upsertUploadSession: vi.fn(async () => undefined),
      deleteVariantsByAssetId: vi.fn(async () => undefined),
      upsertVariant: vi.fn(async () => undefined),
      listVariantsByAssetId: vi.fn(async () => []),
      getStorageUsage: vi.fn(async () => null),
      upsertStorageUsage: vi.fn(async () => undefined),
      applyStorageUsageDelta: vi.fn(async () => undefined),
    };

    const storagePort = {
      readObject: vi.fn(),
      writeObject: vi.fn(),
      deleteObject: vi.fn(async () => undefined),
    };

    const processor = createMediaUploadProcessingService({
      service: service as never,
      storagePort: storagePort as never,
      finalizeUpload: createFinalizeUpload(service),
      failUpload: createFailUpload(service),
      createId: () => 'variant-1',
    });

    await expect(
      processor.completeUpload({
        instanceId: 'tenant-a',
        uploadSessionId: 'upload-1',
        claimToken: 'claim-1',
      })
    ).resolves.toEqual({
      ok: true,
      asset,
      uploadSessionId: 'upload-1',
    });

    expect(storagePort.readObject).not.toHaveBeenCalled();
    expect(storagePort.writeObject).not.toHaveBeenCalled();
    expect(service.applyStorageUsageDelta).not.toHaveBeenCalled();
  });

  it('uses focus point metadata to keep off-center content in cover variants', async () => {
    const originalBuffer = await sharp({
      create: {
        width: 2000,
        height: 1000,
        channels: 3,
        background: { r: 0, g: 0, b: 255 },
      },
    })
      .composite([
        {
          input: {
            create: {
              width: 240,
              height: 1000,
              channels: 3,
              background: { r: 255, g: 0, b: 0 },
            },
          },
          left: 1760,
          top: 0,
        },
      ])
      .png()
      .toBuffer();

    const writtenVariants: Array<{ storageKey: string; body: Uint8Array }> = [];
    const service = {
      getUploadSessionById: vi.fn(async () =>
        createUploadSession({ byteSize: originalBuffer.byteLength })
      ),
      getAssetById: vi.fn(async () =>
        createAsset({
          byteSize: originalBuffer.byteLength,
          metadata: {
            focusPoint: { x: 0.95, y: 0.5 },
          },
        })
      ),
      upsertAsset: vi.fn(async () => undefined),
      upsertUploadSession: vi.fn(async () => undefined),
      deleteVariantsByAssetId: vi.fn(async () => undefined),
      upsertVariant: vi.fn(async () => undefined),
      listVariantsByAssetId: vi.fn(async () => []),
      getStorageUsage: vi.fn(async () => null),
      upsertStorageUsage: vi.fn(async () => undefined),
      applyStorageUsageDelta: vi.fn(async () => undefined),
    };

    const storagePort = {
      readObject: vi.fn(async () => ({
        body: originalBuffer,
        byteSize: originalBuffer.byteLength,
        contentType: 'image/png',
        etag: 'etag-original',
      })),
      writeObject: vi.fn(async ({ storageKey, body }: { storageKey: string; body: Uint8Array }) => {
        writtenVariants.push({ storageKey, body });
        return {
          byteSize: body.byteLength,
          etag: `etag-${storageKey}`,
        };
      }),
      deleteObject: vi.fn(async () => undefined),
    };

    const processor = createMediaUploadProcessingService({
      service: service as never,
      storagePort: storagePort as never,
      finalizeUpload: createFinalizeUpload(service),
      failUpload: createFailUpload(service),
      createId: vi
        .fn()
        .mockReturnValueOnce('variant-1')
        .mockReturnValueOnce('variant-2')
        .mockReturnValueOnce('variant-3'),
    });

    const result = await processor.completeUpload({
      instanceId: 'tenant-a',
      uploadSessionId: 'upload-1',
      claimToken: 'claim-1',
    });

    expect(result.ok).toBe(true);
    const thumbnailVariant = writtenVariants.find((entry) =>
      entry.storageKey.endsWith('/thumbnail.webp')
    );
    expect(thumbnailVariant).toBeTruthy();
    const { data, info } = await sharp(thumbnailVariant?.body)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const channels = info.channels;
    const centerRow = Math.floor(info.height / 2);
    const leftPixelIndex = (centerRow * info.width + 24) * channels;
    const rightPixelIndex = (centerRow * info.width + (info.width - 24)) * channels;

    expect(data[leftPixelIndex + 2]).toBeGreaterThan(data[leftPixelIndex]);
    expect(data[rightPixelIndex]).toBeGreaterThan(data[rightPixelIndex + 2]);
  });
});
