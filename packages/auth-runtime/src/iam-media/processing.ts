import sharp from 'sharp';
import { fileTypeFromBuffer } from 'file-type';
import {
  defaultMediaPresets,
  type MediaCrop,
  type MediaFocusPoint,
  type MediaPreset,
} from '@sva/media';
import { MediaStorageUnavailableError } from './storage-port.js';
import type { MediaService } from './service.js';

const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

type MediaUploadProcessingFailureCode =
  | 'upload_session_not_found'
  | 'asset_not_found'
  | 'invalid_media_content'
  | 'upload_size_exceeded'
  | 'storage_quota_exceeded'
  | 'upload_processing_superseded';

export type MediaUploadFinalizationResult = 'finalized' | 'quota_exceeded' | 'claim_superseded';

export type MediaUploadFinalization = Readonly<{
  instanceId: string;
  claimToken: string;
  asset: Parameters<MediaService['upsertAsset']>[0];
  uploadSession: Parameters<MediaService['upsertUploadSession']>[0];
  variants: readonly Parameters<MediaService['upsertVariant']>[1][];
  totalBytes: number;
}>;

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

const asErrorResult = (
  status: number,
  errorCode: MediaUploadProcessingFailureCode
): Extract<MediaUploadProcessingResult, { ok: false }> => ({
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
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { x?: unknown }).x === 'number' &&
  typeof (value as { y?: unknown }).y === 'number';

const isMediaCrop = (value: unknown): value is MediaCrop =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { x?: unknown }).x === 'number' &&
  typeof (value as { y?: unknown }).y === 'number' &&
  typeof (value as { width?: unknown }).width === 'number' &&
  typeof (value as { height?: unknown }).height === 'number';

const readMediaFocusPoint = (
  metadata: Record<string, unknown> | undefined
): MediaFocusPoint | undefined => {
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

const createVariantBuffer = async (input: {
  readonly buffer: Uint8Array;
  readonly preset: MediaPreset;
  readonly crop?: MediaCrop;
  readonly focusPoint?: MediaFocusPoint;
}): Promise<Buffer> => {
  const image = sharp(input.buffer, { failOn: 'error' }).rotate();
  const sourceMetadata = await image.metadata();
  const sourceWidth = sourceMetadata.width;
  const sourceHeight = sourceMetadata.height;

  const extractAroundFocusPoint = () => {
    if (!input.focusPoint || !input.preset.height || !sourceWidth || !sourceHeight) {
      return;
    }

    const targetAspectRatio = input.preset.width / input.preset.height;
    const sourceAspectRatio = sourceWidth / sourceHeight;
    if (!Number.isFinite(targetAspectRatio) || !Number.isFinite(sourceAspectRatio)) {
      return;
    }

    if (sourceAspectRatio > targetAspectRatio) {
      const extractWidth = Math.max(
        1,
        Math.min(sourceWidth, Math.round(sourceHeight * targetAspectRatio))
      );
      const focusX = Math.max(0, Math.min(1, input.focusPoint.x));
      const left = Math.max(
        0,
        Math.min(sourceWidth - extractWidth, Math.round(focusX * sourceWidth - extractWidth / 2))
      );
      image.extract({
        left,
        top: 0,
        width: extractWidth,
        height: sourceHeight,
      });
      return;
    }

    if (sourceAspectRatio < targetAspectRatio) {
      const extractHeight = Math.max(
        1,
        Math.min(sourceHeight, Math.round(sourceWidth / targetAspectRatio))
      );
      const focusY = Math.max(0, Math.min(1, input.focusPoint.y));
      const top = Math.max(
        0,
        Math.min(
          sourceHeight - extractHeight,
          Math.round(focusY * sourceHeight - extractHeight / 2)
        )
      );
      image.extract({
        left: 0,
        top,
        width: sourceWidth,
        height: extractHeight,
      });
    }
  };

  if (input.crop) {
    image.extract({
      left: Math.max(0, Math.round(input.crop.x)),
      top: Math.max(0, Math.round(input.crop.y)),
      width: Math.max(1, Math.round(input.crop.width)),
      height: Math.max(1, Math.round(input.crop.height)),
    });
  } else {
    extractAroundFocusPoint();
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
        deleteObject: (input: {
          readonly instanceId: string;
          readonly storageKey: string;
        }) => Promise<void>;
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

  await Promise.allSettled([
    input.deps.storagePort.deleteObject({
      instanceId: String(input.uploadSession.instanceId),
      storageKey: String(input.uploadSession.storageKey),
    }),
  ]);

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

  return asErrorResult(
    input.errorCode === 'upload_size_exceeded'
      ? 413
      : input.errorCode === 'storage_quota_exceeded'
        ? 409
        : 422,
    input.errorCode
  );
};

export const createMediaUploadProcessingService = (deps: {
  readonly service: Pick<
    MediaService,
    'getUploadSessionById' | 'getAssetById' | 'upsertAsset' | 'upsertUploadSession'
  >;
  readonly storagePort: {
    readObject: (input: { readonly instanceId: string; readonly storageKey: string }) => Promise<{
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
  readonly finalizeUpload: (
    input: MediaUploadFinalization
  ) => Promise<MediaUploadFinalizationResult>;
}) => ({
  async completeUpload(input: {
    readonly instanceId: string;
    readonly uploadSessionId: string;
    readonly claimToken: string;
  }): Promise<MediaUploadProcessingResult> {
    const uploadSession = await deps.service.getUploadSessionById(
      input.instanceId,
      input.uploadSessionId
    );
    if (!uploadSession) {
      return asErrorResult(404, 'upload_session_not_found');
    }

    const asset = await deps.service.getAssetById(input.instanceId, String(uploadSession.assetId));
    if (!asset) {
      return asErrorResult(404, 'asset_not_found');
    }

    if (
      uploadSession.status === 'validated' &&
      asset.uploadStatus === 'processed' &&
      asset.processingStatus === 'ready'
    ) {
      return {
        ok: true,
        asset,
        uploadSessionId: String(uploadSession.id),
      };
    }

    let persistenceStarted = false;
    const persistedVariantStorageKeys: string[] = [];

    try {
      const object = await deps.storagePort.readObject({
        instanceId: input.instanceId,
        storageKey: String(uploadSession.storageKey),
      });
      if (object.byteSize > Number(uploadSession.byteSize)) {
        throw new Error('upload_size_mismatch');
      }

      const detectedFileType = await fileTypeFromBuffer(object.body);
      const detectedMimeType =
        detectedFileType?.mime ?? object.contentType ?? String(asset.mimeType);
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

      const variantsToPersist: Array<{
        id: string;
        assetId: string;
        variantKey: string;
        presetKey: string;
        format: string;
        width: number;
        height?: number;
        storageKey: string;
        generationStatus: 'ready';
        body: Buffer;
        contentType: string;
      }> = [];

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
        const variantMetadata = await sharp(variantBuffer).metadata();
        variantsToPersist.push({
          id: deps.createId(),
          assetId: asset.id,
          variantKey: preset.key,
          presetKey: preset.key,
          format: preset.format,
          width: variantMetadata.width ?? preset.width,
          height: variantMetadata.height,
          storageKey,
          generationStatus: 'ready',
          body: variantBuffer,
          contentType: resolvePresetContentType(preset.format),
        });
      }

      let variantBytes = 0;
      persistenceStarted = true;
      for (const variant of variantsToPersist) {
        const writeResult = await deps.storagePort.writeObject({
          instanceId: input.instanceId,
          storageKey: variant.storageKey,
          body: variant.body,
          contentType: variant.contentType,
        });
        persistedVariantStorageKeys.push(variant.storageKey);
        variantBytes += writeResult.byteSize;
      }

      const nextAsset = {
        ...asset,
        mimeType: detectedMimeType,
        uploadStatus: 'processed',
        processingStatus: 'ready',
        technical: {
          ...technical,
          variantBytes,
        },
      };

      const finalized = await deps.finalizeUpload({
        instanceId: input.instanceId,
        claimToken: input.claimToken,
        asset: nextAsset,
        uploadSession: { ...uploadSession, status: 'validated' },
        variants: variantsToPersist.map(
          ({ body: _body, contentType: _contentType, ...variant }) => variant
        ),
        totalBytes: object.byteSize + variantBytes,
      });
      if (finalized === 'claim_superseded') {
        return asErrorResult(409, 'upload_processing_superseded');
      }
      if (finalized === 'quota_exceeded') {
        await Promise.allSettled(
          [...persistedVariantStorageKeys, String(uploadSession.storageKey)].map((storageKey) =>
            deps.storagePort.deleteObject({ instanceId: input.instanceId, storageKey })
          )
        );
        return asErrorResult(409, 'storage_quota_exceeded');
      }

      return {
        ok: true,
        asset: nextAsset,
        uploadSessionId: String(uploadSession.id),
      };
    } catch (error) {
      if (persistenceStarted) {
        await Promise.allSettled(
          persistedVariantStorageKeys.map((storageKey) =>
            deps.storagePort.deleteObject({
              instanceId: input.instanceId,
              storageKey,
            })
          )
        );
      }
      if (error instanceof MediaStorageUnavailableError || persistenceStarted) {
        throw error;
      }
      return markProcessingFailure({
        deps,
        asset,
        uploadSession,
        errorCode:
          error instanceof Error && error.message === 'upload_size_mismatch'
            ? 'upload_size_exceeded'
            : 'invalid_media_content',
      });
    }
  },
});
