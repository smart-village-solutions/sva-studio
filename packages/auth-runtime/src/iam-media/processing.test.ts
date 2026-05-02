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
      getUploadSessionById: vi.fn(async () => createUploadSession({ byteSize: originalBuffer.byteLength })),
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
      upsertVariant: vi.fn(async () => undefined),
      listVariantsByAssetId: vi.fn(async () => []),
      getStorageUsage: vi.fn(async () => null),
      upsertStorageUsage: vi.fn(async () => undefined),
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
    };

    const processor = createMediaUploadProcessingService({
      service: service as never,
      storagePort: storagePort as never,
      createId: vi
        .fn()
        .mockReturnValueOnce('variant-1')
        .mockReturnValueOnce('variant-2')
        .mockReturnValueOnce('variant-3'),
    });

    const result = await processor.completeUpload({
      instanceId: 'tenant-a',
      uploadSessionId: 'upload-1',
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
          variantTotalBytes: expect.any(Number),
        }),
      })
    );
    expect(service.upsertUploadSession).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'upload-1',
        status: 'validated',
      })
    );
    expect(service.upsertStorageUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'tenant-a',
        assetCount: 1,
      })
    );
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
      getUploadSessionById: vi.fn(async () => createUploadSession({ byteSize: originalBuffer.byteLength })),
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
      upsertVariant: vi.fn(async () => undefined),
      listVariantsByAssetId: vi.fn(async () => []),
      getStorageUsage: vi.fn(async () => null),
      upsertStorageUsage: vi.fn(async () => undefined),
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
    };

    const processor = createMediaUploadProcessingService({
      service: service as never,
      storagePort: storagePort as never,
      createId: vi
        .fn()
        .mockReturnValueOnce('variant-1')
        .mockReturnValueOnce('variant-2')
        .mockReturnValueOnce('variant-3'),
    });

    const result = await processor.completeUpload({
      instanceId: 'tenant-a',
      uploadSessionId: 'upload-1',
    });

    expect(result.ok).toBe(true);
    expect(writtenVariants).toHaveLength(3);

    const thumbnailVariant = writtenVariants.find((entry) => entry.storageKey.endsWith('/thumbnail.webp'));
    const teaserVariant = writtenVariants.find((entry) => entry.storageKey.endsWith('/teaser.webp'));
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

  it('uses the focus point when generating cover variants without an explicit crop', async () => {
    const leftHalf = await sharp({
      create: {
        width: 1000,
        height: 1000,
        channels: 3,
        background: { r: 220, g: 20, b: 20 },
      },
    })
      .png()
      .toBuffer();
    const rightHalf = await sharp({
      create: {
        width: 1000,
        height: 1000,
        channels: 3,
        background: { r: 20, g: 20, b: 220 },
      },
    })
      .png()
      .toBuffer();
    const originalBuffer = await sharp({
      create: {
        width: 2000,
        height: 1000,
        channels: 3,
        background: { r: 0, g: 0, b: 0 },
      },
    })
      .composite([
        { input: leftHalf, left: 0, top: 0 },
        { input: rightHalf, left: 1000, top: 0 },
      ])
      .png()
      .toBuffer();

    const writtenVariants: Array<{ storageKey: string; body: Uint8Array }> = [];
    const service = {
      getUploadSessionById: vi.fn(async () => createUploadSession({ byteSize: originalBuffer.byteLength })),
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
      upsertVariant: vi.fn(async () => undefined),
      listVariantsByAssetId: vi.fn(async () => []),
      getStorageUsage: vi.fn(async () => null),
      upsertStorageUsage: vi.fn(async () => undefined),
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
    };

    const processor = createMediaUploadProcessingService({
      service: service as never,
      storagePort: storagePort as never,
      createId: vi
        .fn()
        .mockReturnValueOnce('variant-1')
        .mockReturnValueOnce('variant-2')
        .mockReturnValueOnce('variant-3'),
    });

    const result = await processor.completeUpload({
      instanceId: 'tenant-a',
      uploadSessionId: 'upload-1',
    });

    expect(result.ok).toBe(true);
    const heroVariant = writtenVariants.find((entry) => entry.storageKey.endsWith('/hero.webp'));
    const heroSample = await sharp(heroVariant?.body)
      .extract({ left: 800, top: 450, width: 1, height: 1 })
      .raw()
      .toBuffer();

    expect(heroSample[2]).toBeGreaterThan(heroSample[0] ?? 0);
  });

  it('treats already validated uploads as idempotent completions', async () => {
    const service = {
      getUploadSessionById: vi.fn(async () => createUploadSession({ status: 'validated' })),
      getAssetById: vi.fn(async () =>
        createAsset({
          uploadStatus: 'processed',
          processingStatus: 'ready',
        })
      ),
      upsertAsset: vi.fn(async () => undefined),
      upsertUploadSession: vi.fn(async () => undefined),
      upsertVariant: vi.fn(async () => undefined),
      listVariantsByAssetId: vi.fn(async () => []),
      getStorageUsage: vi.fn(async () => null),
      upsertStorageUsage: vi.fn(async () => undefined),
    };
    const storagePort = {
      readObject: vi.fn(),
      writeObject: vi.fn(),
    };

    const processor = createMediaUploadProcessingService({
      service: service as never,
      storagePort: storagePort as never,
      createId: () => 'variant-1',
    });

    const result = await processor.completeUpload({
      instanceId: 'tenant-a',
      uploadSessionId: 'upload-1',
    });

    expect(result).toEqual({
      ok: true,
      asset: expect.objectContaining({
        id: 'asset-1',
        uploadStatus: 'processed',
        processingStatus: 'ready',
      }),
      uploadSessionId: 'upload-1',
    });
    expect(storagePort.readObject).not.toHaveBeenCalled();
    expect(service.upsertAsset).not.toHaveBeenCalled();
    expect(service.upsertStorageUsage).not.toHaveBeenCalled();
  });

  it('fails closed with redacted error details when the uploaded content is invalid', async () => {
    const service = {
      getUploadSessionById: vi.fn(async () => createUploadSession()),
      getAssetById: vi.fn(async () => createAsset()),
      upsertAsset: vi.fn(async () => undefined),
      upsertUploadSession: vi.fn(async () => undefined),
      upsertVariant: vi.fn(async () => undefined),
      listVariantsByAssetId: vi.fn(async () => []),
      getStorageUsage: vi.fn(async () => null),
      upsertStorageUsage: vi.fn(async () => undefined),
    };

    const storagePort = {
      readObject: vi.fn(async () => ({
        body: Buffer.from('not-an-image'),
        byteSize: 12,
        contentType: 'image/png',
      })),
      writeObject: vi.fn(),
    };

    const processor = createMediaUploadProcessingService({
      service: service as never,
      storagePort: storagePort as never,
      createId: () => 'variant-1',
    });

    const result = await processor.completeUpload({
      instanceId: 'tenant-a',
      uploadSessionId: 'upload-1',
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
    expect(storagePort.writeObject).not.toHaveBeenCalled();
  });
});
