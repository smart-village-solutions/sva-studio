import sharp from 'sharp';
import { fileTypeFromBuffer } from 'file-type';
import { defaultMediaPresets, type MediaCrop, type MediaFocusPoint, type MediaPreset } from '@sva/media';
import { MediaStorageUnavailableError } from './storage-port.js';
import type { MediaService } from './service.js';

const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

type MediaUploadProcessingFailureCode =
  | 'upload_session_not_found'
  | 'asset_not_found'
  | 'invalid_media_content'
  | 'upload_size_exceeded';

type MediaUploadProcessingResult =
  | Readonly<{
      ok: true;
      asset: Record<string, any>;
      uploadSessionId: string;
    }>
  | Readonly<{
      ok: false;
      status: number;
      errorCode: MediaUploadProcessingFailureCode;
    }>;

const asErrorResult = (status: number, errorCode: MediaUploadProcessingFailureCode): Extract<MediaUploadProcessingResult, { ok: false }> => ({
  ok: false,
  status,
  errorCode,
});

const buildVariantStorageKey = (input: {
  readonly instanceId: string;
  readonly assetId: string;
  readonly variantKey: string;
  readonly format: string;
}): string => `${input.instanceId}/variants/${input.assetId}/${input.variantKey}.${input.format}`;

const isMediaFocusPoint = (value: unknown): value is MediaFocusPoint =>
  typeof value === 'object'
  && value !== null
  && typeof (value as { x?: unknown }).x === 'number'
  && typeof (value as { y?: unknown }).y === 'number';

const isMediaCrop = (value: unknown): value is MediaCrop =>
  typeof value === 'object'
  && value !== null
  && typeof (value as { x?: unknown }).x === 'number'
  && typeof (value as { y?: unknown }).y === 'number'
  && typeof (value as { width?: unknown }).width === 'number'
  && typeof (value as { height?: unknown }).height === 'number';

const readMediaFocusPoint = (metadata: Record<string, unknown> | undefined): MediaFocusPoint | undefined => {
  const focusPoint = metadata?.focusPoint;
  return isMediaFocusPoint(focusPoint) ? focusPoint : undefined;
};

const readMediaCrop = (metadata: Record<string, unknown> | undefined): MediaCrop | undefined => {
  const crop = metadata?.crop;
  return isMediaCrop(crop) ? crop : undefined;
};

const resolvePresetContentType = (format: MediaPreset['format']): string => {
  switch (format) {
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    default:
      return 'image/webp';
  }
};

const shouldDeleteFailedUploadBlob = (errorCode: MediaUploadProcessingFailureCode): boolean =>
  errorCode === 'invalid_media_content' || errorCode === 'upload_size_exceeded';

const isRecoverableValidationError = (error: unknown): error is Error => {
  if (!(error instanceof Error)) {
    return false;
  }

  if (error.message === 'upload_size_mismatch') {
    return true;
  }

  // Sharp uses these messages for malformed or unsupported image payloads.
  return (
    error.message.includes('unsupported image format')
    || error.message.includes('Input buffer')
    || error.message.includes('Vips')
    || error.message.includes('corrupt')
  );
};

const createVariantBuffer = async (input: {
  readonly buffer: Uint8Array;
  readonly preset: MediaPreset;
  readonly crop?: MediaCrop;
  readonly focusPoint?: MediaFocusPoint;
}): Promise<Buffer> => {
  const image = sharp(input.buffer, { failOn: 'error' }).rotate();
  const metadata = await image.metadata();
  if (input.crop) {
    image.extract({
      left: Math.max(0, Math.round(input.crop.x)),
      top: Math.max(0, Math.round(input.crop.y)),
      width: Math.max(1, Math.round(input.crop.width)),
      height: Math.max(1, Math.round(input.crop.height)),
    });
  } else if (input.focusPoint && input.preset.height && metadata.width && metadata.height) {
    const targetAspectRatio = input.preset.width / input.preset.height;
    const sourceAspectRatio = metadata.width / metadata.height;

    if (Math.abs(sourceAspectRatio - targetAspectRatio) > 0.001) {
      if (sourceAspectRatio > targetAspectRatio) {
        const cropWidth = Math.max(1, Math.round(metadata.height * targetAspectRatio));
        const focusX = Math.round(input.focusPoint.x * metadata.width);
        const left = Math.min(Math.max(0, focusX - Math.round(cropWidth / 2)), metadata.width - cropWidth);
        image.extract({
          left,
          top: 0,
          width: cropWidth,
          height: metadata.height,
        });
      } else {
        const cropHeight = Math.max(1, Math.round(metadata.width / targetAspectRatio));
        const focusY = Math.round(input.focusPoint.y * metadata.height);
        const top = Math.min(Math.max(0, focusY - Math.round(cropHeight / 2)), metadata.height - cropHeight);
        image.extract({
          left: 0,
          top,
          width: metadata.width,
          height: cropHeight,
        });
      }
    }
  }

  const resized = image.resize({
    width: input.preset.width,
    ...(input.preset.height
      ? {
          height: input.preset.height,
          fit: 'cover' as const,
          position: 'centre' as const,
        }
      : {}),
    withoutEnlargement: true,
  });

  switch (input.preset.format) {
    case 'jpeg':
      return resized.jpeg({ quality: 82 }).toBuffer();
    case 'png':
      return resized.png().toBuffer();
    default:
      return resized.webp({ quality: 82 }).toBuffer();
  }
};

const markProcessingFailure = async (input: {
  readonly deps: {
    readonly service: Pick<MediaService, 'upsertAsset' | 'upsertUploadSession'>;
    readonly storagePort: Pick<
      {
        deleteObject: (input: { instanceId: string; storageKey: string }) => Promise<void>;
      },
      'deleteObject'
    >;
  };
  readonly asset: Awaited<ReturnType<MediaService['getAssetById']>>;
  readonly uploadSession: Awaited<ReturnType<MediaService['getUploadSessionById']>>;
  readonly errorCode: MediaUploadProcessingFailureCode;
}): Promise<Extract<MediaUploadProcessingResult, { ok: false }>> => {
  if (!input.asset || !input.uploadSession) {
    return asErrorResult(404, 'asset_not_found');
  }

  if (shouldDeleteFailedUploadBlob(input.errorCode)) {
    await input.deps.storagePort.deleteObject({
      instanceId: String(input.asset.instanceId),
      storageKey: String(input.uploadSession.storageKey),
    });
  }

  await input.deps.service.upsertAsset({
    ...input.asset,
    uploadStatus: 'failed',
    processingStatus: 'failed',
    technical: {
      ...(input.asset.technical ?? {}),
      lastError: {
        code: input.errorCode,
      },
    },
  });
  await input.deps.service.upsertUploadSession({
    ...input.uploadSession,
    status: 'failed',
  });

  return asErrorResult(input.errorCode === 'upload_size_exceeded' ? 413 : 422, input.errorCode);
};

export const createMediaUploadProcessingService = (deps: {
  readonly service: MediaService;
  readonly storagePort: {
    readObject: (input: {
      readonly instanceId: string;
      readonly storageKey: string;
    }) => Promise<{
      body: Uint8Array;
      byteSize: number;
      contentType?: string;
      etag?: string;
    }>;
    writeObject: (input: {
      readonly instanceId: string;
      readonly storageKey: string;
      readonly body: Uint8Array;
      readonly contentType: string;
    }) => Promise<{
      byteSize: number;
      etag?: string;
    }>;
    deleteObject: (input: {
      readonly instanceId: string;
      readonly storageKey: string;
    }) => Promise<void>;
  };
  readonly createId: () => string;
}) => ({
  async completeUpload(input: { readonly instanceId: string; readonly uploadSessionId: string }): Promise<MediaUploadProcessingResult> {
    const uploadSession = await deps.service.getUploadSessionById(input.instanceId, input.uploadSessionId);
    if (!uploadSession) {
      return asErrorResult(404, 'upload_session_not_found');
    }

    const asset = await deps.service.getAssetById(input.instanceId, String(uploadSession.assetId));
    if (!asset) {
      return asErrorResult(404, 'asset_not_found');
    }
    if (asset.uploadStatus === 'processed' && asset.processingStatus === 'ready') {
      if (uploadSession.status !== 'validated') {
        await deps.service.upsertUploadSession({
          ...uploadSession,
          status: 'validated',
        });
      }
      return {
        ok: true,
        asset,
        uploadSessionId: String(uploadSession.id),
      };
    }

    try {
      const object = await deps.storagePort.readObject({
        instanceId: input.instanceId,
        storageKey: String(uploadSession.storageKey),
      });
      if (object.byteSize > Number(uploadSession.byteSize)) {
        throw new Error('upload_size_mismatch');
      }

      const detectedFileType = await fileTypeFromBuffer(object.body);
      const detectedMimeType = detectedFileType?.mime ?? object.contentType ?? String(asset.mimeType);
      if (!ALLOWED_IMAGE_MIME_TYPES.has(detectedMimeType) || detectedMimeType !== asset.mimeType) {
        return markProcessingFailure({
          deps,
          asset,
          uploadSession,
          errorCode: 'invalid_media_content',
        });
      }

      const metadata = await sharp(object.body, { failOn: 'error' }).rotate().metadata();
      const technical = {
        ...(asset.technical ?? {}),
        width: metadata.width,
        height: metadata.height,
        contentType: detectedMimeType,
        etag: object.etag,
      };

      let variantBytes = 0;
      for (const preset of defaultMediaPresets) {
        const variantBuffer = await createVariantBuffer({
          buffer: object.body,
          preset,
          crop: readMediaCrop(asset.metadata),
          focusPoint: readMediaFocusPoint(asset.metadata),
        });
        const storageKey = buildVariantStorageKey({
          instanceId: input.instanceId,
          assetId: String(asset.id),
          variantKey: preset.key,
          format: preset.format,
        });
        const writeResult = await deps.storagePort.writeObject({
          instanceId: input.instanceId,
          storageKey,
          body: variantBuffer,
          contentType: resolvePresetContentType(preset.format),
        });
        variantBytes += writeResult.byteSize;
        const variantMetadata = await sharp(variantBuffer).metadata();
        await deps.service.upsertVariant(input.instanceId, {
          id: deps.createId(),
          assetId: asset.id,
          variantKey: preset.key,
          presetKey: preset.key,
          format: preset.format,
          width: variantMetadata.width ?? preset.width,
          height: variantMetadata.height,
          storageKey,
          generationStatus: 'ready',
        });
      }

      const nextAsset = {
        ...asset,
        mimeType: detectedMimeType,
        uploadStatus: 'processed',
        processingStatus: 'ready',
        technical: {
          ...technical,
          variantTotalBytes: variantBytes,
        },
      };

      await deps.service.upsertAsset(nextAsset);
      await deps.service.upsertUploadSession({
        ...uploadSession,
        status: 'validated',
      });

      const currentUsage = await deps.service.getStorageUsage(input.instanceId);
      await deps.service.upsertStorageUsage({
        instanceId: input.instanceId,
        totalBytes: (currentUsage?.totalBytes ?? 0) + object.byteSize + variantBytes,
        assetCount: (currentUsage?.assetCount ?? 0) + 1,
      });

      return {
        ok: true,
        asset: nextAsset,
        uploadSessionId: String(uploadSession.id),
      };
    } catch (error) {
      if (error instanceof MediaStorageUnavailableError) {
        throw error;
      }
      if (!isRecoverableValidationError(error)) {
        throw error;
      }

      return markProcessingFailure({
        deps,
        asset,
        uploadSession,
        errorCode: error instanceof Error && error.message === 'upload_size_mismatch' ? 'upload_size_exceeded' : 'invalid_media_content',
      });
    }
  },
});
