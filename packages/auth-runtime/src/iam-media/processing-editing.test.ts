import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';
import { createMediaEditingDocument } from '@sva/media';
import {
  createMediaUploadProcessingService,
  type MediaUploadFinalizationResult,
} from './processing.js';
import { prepareMediaEditingData } from './processing-editing.js';

const { scan } = vi.hoisted(() => ({ scan: vi.fn(async () => undefined) }));
vi.mock('./clamav.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./clamav.js')>()),
  scanConfiguredMedia: scan,
}));

const asset = (editingDocument?: ReturnType<typeof createMediaEditingDocument>) => ({
  id: 'asset-1',
  instanceId: 'tenant-a',
  storageKey: '.protected/tenant-a/intake/output',
  mediaType: 'image',
  mimeType: 'image/png',
  byteSize: 100,
  visibility: 'public',
  uploadStatus: 'pending',
  processingStatus: 'pending',
  metadata: {},
  technical: {},
  editingDocument,
});

describe('editing resources in media processing', () => {
  it('does not perform extra reads for a normal upload or a reused foundation', async () => {
    const storage = { readObject: vi.fn() };
    expect(
      await prepareMediaEditingData({ asset: asset(), storage, scanRequired: true })
    ).toBeUndefined();
    const document = createMediaEditingDocument({ annotations: {} });
    expect(
      await prepareMediaEditingData({
        asset: { ...asset(document), editingSourceAssetId: 'root' },
        storage,
        scanRequired: true,
      })
    ).toEqual({ document, documentBytes: Buffer.byteLength(JSON.stringify(document)) });
    expect(storage.readObject).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    'validates and counts a private local source and deduplicated raster resources (scan: %s)',
    async (scanRequired) => {
      scan.mockClear();
      const body = await sharp({
        create: { width: 10, height: 10, channels: 3, background: 'blue' },
      })
        .png()
        .toBuffer();
      const inline = `data:image/png;base64,${body.toString('base64')}`;
      const document = createMediaEditingDocument({
        annotations: { one: { image: inline }, two: { image: inline } },
      });
      const storage = { readObject: vi.fn(async () => ({ body, byteSize: body.byteLength })) };
      const result = await prepareMediaEditingData({
        asset: {
          ...asset(document),
          editingSourceKey: '.quarantine/tenant-a/source',
          technical: {
            editingSourceUploadBytes: body.byteLength,
            editingSourceMimeType: 'image/png',
          },
        },
        storage,
        scanRequired,
      });
      expect(result?.source).toEqual({ body, contentType: 'image/png', extension: 'png' });
      expect(storage.readObject).toHaveBeenCalledWith({
        instanceId: 'tenant-a',
        storageKey: '.quarantine/tenant-a/source',
        maxBytes: body.byteLength,
      });
      expect(scan).toHaveBeenCalledTimes(scanRequired ? 2 : 0);
    }
  );

  it('rejects fake inline raster data even when its URL type is allowed', async () => {
    const document = createMediaEditingDocument({
      annotations: { one: { image: 'data:image/png;base64,YWJj' } },
    });
    await expect(
      prepareMediaEditingData({
        asset: asset(document),
        storage: { readObject: vi.fn() },
        scanRequired: false,
      })
    ).rejects.toThrow('invalid_media_editor_resource');
  });

  it.each([{}, { editingSourceUploadBytes: -1 }, { editingSourceUploadBytes: 100 }])(
    'rejects incomplete foundation declarations: %o',
    async (technical) => {
      const storage = { readObject: vi.fn() };
      await expect(
        prepareMediaEditingData({
          asset: {
            ...asset(createMediaEditingDocument({})),
            editingSourceKey: '.protected/tenant-a/source',
            technical,
          },
          storage,
          scanRequired: false,
        })
      ).rejects.toThrow('invalid_media_editor_source');
      expect(storage.readObject).not.toHaveBeenCalled();
    }
  );

  it('rejects oversized source content before decoding or storing it', async () => {
    const storage = { readObject: vi.fn(async () => ({ body: Buffer.alloc(2), byteSize: 2 })) };
    await expect(
      prepareMediaEditingData({
        asset: {
          ...asset(createMediaEditingDocument({})),
          editingSourceKey: '.protected/tenant-a/source',
          technical: { editingSourceUploadBytes: 1, editingSourceMimeType: 'image/png' },
        },
        storage,
        scanRequired: true,
      })
    ).rejects.toThrow('upload_size_mismatch');
  });

  it('propagates a failed scan without accepting the private document', async () => {
    scan.mockRejectedValueOnce(new Error('scan_failed'));
    const document = createMediaEditingDocument({
      annotations: { one: { image: 'data:image/png;base64,YWJj' } },
    });
    await expect(
      prepareMediaEditingData({
        asset: asset(document),
        storage: { readObject: vi.fn() },
        scanRequired: true,
      })
    ).rejects.toThrow('scan_failed');
  });
});

describe('publication of editable uploads', () => {
  it.each(['public', 'protected'] as const)(
    'publishes a sanitized %s output with a private immutable foundation and one quota claim',
    async (visibility) => {
      scan.mockReset().mockResolvedValue(undefined);
      const sourceBody = await sharp({
        create: { width: 16, height: 12, channels: 3, background: 'green' },
      })
        .withMetadata()
        .jpeg()
        .toBuffer();
      const outputBody = await sharp(sourceBody).withMetadata().png().toBuffer();
      const document = createMediaEditingDocument({
        annotations: { one: { image: `data:image/jpeg;base64,${sourceBody.toString('base64')}` } },
      });
      const pending = {
        ...asset(document),
        visibility,
        byteSize: outputBody.length,
        editingSourceKey: '.quarantine/tenant-a/asset/source',
        technical: {
          editingSourceMimeType: 'image/jpeg',
          editingSourceUploadBytes: sourceBody.length,
        },
      };
      const session = {
        id: 'session',
        instanceId: 'tenant-a',
        assetId: pending.id,
        mimeType: pending.mimeType,
        byteSize: outputBody.length,
        storageKey: '.quarantine/tenant-a/asset/output',
        status: 'uploaded',
      };
      const storage = {
        readObject: vi.fn(async ({ storageKey }) => {
          const body = storageKey.endsWith('/source') ? sourceBody : outputBody;
          return { body, byteSize: body.length };
        }),
        writeObject: vi.fn(async ({ body }) => ({ byteSize: body.length })),
        deleteObject: vi.fn(),
        listObjects: vi.fn(),
      };
      const finalizeUpload = vi.fn(async () => 'finalized' as const);
      const result = await createMediaUploadProcessingService({
        service: { getAssetById: async () => pending, getUploadSessionById: async () => session },
        storagePort: storage,
        finalizeUpload,
        failUpload: vi.fn(),
        createId: () => 'variant',
      }).completeUpload({
        instanceId: 'tenant-a',
        uploadSessionId: 'session',
        claimToken: 'claim',
      });
      expect(result.ok).toBe(true);
      expect(scan).toHaveBeenCalledTimes(3);
      const writes = storage.writeObject.mock.calls.map(([input]) => input);
      const sourceWrite = writes.find((write) => write.storageKey.endsWith('/source.jpg'));
      expect(sourceWrite?.storageKey).toBe('.protected/tenant-a/variants/asset-1/claim/source.jpg');
      expect(sourceWrite?.body).toEqual(sourceBody);
      const outputWrite = writes.find((write) => write.storageKey.endsWith('/original.png'));
      expect(outputWrite?.storageKey.startsWith('.protected/')).toBe(visibility === 'protected');
      expect((await sharp(outputWrite?.body).metadata()).exif).toBeUndefined();
      const finalization = finalizeUpload.mock.calls[0]?.[0];
      expect(finalization.asset.editingSourceKey).toBe(sourceWrite?.storageKey);
      expect(finalization.asset.editingDocument).toEqual(document);
      expect(finalization.asset.byteSize).toBe(outputWrite?.body.length);
      expect(finalization.totalBytes).toBe(
        writes.reduce((total, write) => total + write.body.length, 0) +
          Buffer.byteLength(JSON.stringify(document))
      );
    }
  );

  it.each(['quota_exceeded', 'claim_superseded'] as const)(
    'cleans its private generated source without publishing when finalization is %s',
    async (outcome) => {
      scan.mockReset().mockResolvedValue(undefined);
      const body = await sharp({ create: { width: 4, height: 4, channels: 3, background: 'blue' } })
        .png()
        .toBuffer();
      const pending = {
        ...asset(createMediaEditingDocument({})),
        byteSize: body.length,
        editingSourceKey: '.protected/tenant-a/intake/source',
        technical: {
          editingSourceMimeType: 'image/png',
          editingSourceUploadBytes: body.length,
          editingSourceIntakeKey: '.protected/tenant-a/intake/source',
          editingOutputIntakeKey: '.protected/tenant-a/intake/output',
        },
      };
      const storage = {
        readObject: vi.fn(async () => ({ body, byteSize: body.length })),
        writeObject: vi.fn(async ({ body }) => ({ byteSize: body.length })),
        deleteObject: vi.fn(),
        listObjects: vi.fn(),
      };
      const result = await createMediaUploadProcessingService({
        service: {
          getAssetById: async () => pending,
          getUploadSessionById: async () => ({
            id: 'session',
            instanceId: 'tenant-a',
            assetId: pending.id,
            mimeType: pending.mimeType,
            byteSize: body.length,
            storageKey: '.protected/tenant-a/intake/output',
            status: 'uploaded',
          }),
        },
        storagePort: storage,
        finalizeUpload: async (): Promise<MediaUploadFinalizationResult> => outcome,
        failUpload: vi.fn(),
        createId: () => 'variant',
      }).completeUpload({
        instanceId: 'tenant-a',
        uploadSessionId: 'session',
        claimToken: 'claim',
      });
      expect(result.ok).toBe(false);
      expect(storage.deleteObject).toHaveBeenCalledWith({
        instanceId: 'tenant-a',
        storageKey: '.protected/tenant-a/variants/asset-1/claim/source.png',
      });
      expect(
        storage.deleteObject.mock.calls.some(
          ([input]) => input.storageKey === '.protected/tenant-a/intake/source'
        )
      ).toBe(outcome === 'quota_exceeded');
    }
  );
});
