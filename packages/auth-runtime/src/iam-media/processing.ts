import sharp from 'sharp';
import { fileTypeFromBuffer } from 'file-type';
import { MediaStorageUnavailableError, type MediaStoragePort } from './storage-port.js';
import type { MediaService } from './service.js';
import { cleanupReplacedClaimVariants, createMediaVariants } from './processing-variants.js';

const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

type MediaUploadProcessingFailureCode =
  | 'upload_session_not_found'
  | 'asset_not_found'
  | 'invalid_media_content'
  | 'upload_size_exceeded'
  | 'storage_quota_exceeded'
  | 'upload_processing_superseded';

export type MediaUploadFinalizationResult = 'finalized' | 'quota_exceeded' | 'claim_superseded';

export type MediaUploadFailureResult = 'failed' | 'claim_superseded';

export type MediaUploadFailure = Readonly<{
  instanceId: string;
  claimToken: string;
  asset: Parameters<MediaService['upsertAsset']>[0];
  uploadSession: Parameters<MediaService['upsertUploadSession']>[0];
  errorCode: string;
}>;

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

const markProcessingFailure = async (input: {
  readonly deps: {
    readonly storagePort: Pick<
      {
        deleteObject: (input: {
          readonly instanceId: string;
          readonly storageKey: string;
        }) => Promise<void>;
      },
      'deleteObject'
    >;
    readonly failUpload: (failure: MediaUploadFailure) => Promise<MediaUploadFailureResult>;
  };
  readonly claimToken: string;
  readonly asset: Awaited<ReturnType<MediaService['getAssetById']>>;
  readonly uploadSession: Awaited<ReturnType<MediaService['getUploadSessionById']>>;
  readonly errorCode: MediaUploadProcessingFailureCode;
}): Promise<Extract<MediaUploadProcessingResult, { ok: false }>> => {
  if (!input.asset || !input.uploadSession) {
    return asErrorResult(404, 'asset_not_found');
  }

  const failureResult = await input.deps.failUpload({
    instanceId: String(input.uploadSession.instanceId),
    claimToken: input.claimToken,
    asset: input.asset,
    uploadSession: input.uploadSession,
    errorCode: input.errorCode,
  });
  if (failureResult === 'claim_superseded') {
    return asErrorResult(409, 'upload_processing_superseded');
  }

  await Promise.allSettled([
    input.deps.storagePort.deleteObject({
      instanceId: String(input.uploadSession.instanceId),
      storageKey: String(input.uploadSession.storageKey),
    }),
  ]);

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
  readonly service: Pick<MediaService, 'getUploadSessionById' | 'getAssetById'>;
  readonly storagePort: Pick<
    MediaStoragePort,
    'listObjects' | 'readObject' | 'writeObject' | 'deleteObject'
  >;
  readonly createId: () => string;
  readonly finalizeUpload: (
    input: MediaUploadFinalization
  ) => Promise<MediaUploadFinalizationResult>;
  readonly failUpload: (failure: MediaUploadFailure) => Promise<MediaUploadFailureResult>;
}) => ({
  async completeUpload(input: {
    readonly instanceId: string;
    readonly uploadSessionId: string;
    readonly claimToken: string;
    readonly replacedClaimToken?: string;
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

    if (input.replacedClaimToken) {
      await cleanupReplacedClaimVariants({
        storagePort: deps.storagePort,
        instanceId: input.instanceId,
        assetId: String(asset.id),
        claimToken: input.replacedClaimToken,
      });
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
    const cleanupPersistedVariants = () =>
      Promise.allSettled(
        persistedVariantStorageKeys.map((storageKey) =>
          deps.storagePort.deleteObject({ instanceId: input.instanceId, storageKey })
        )
      );

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
          claimToken: input.claimToken,
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

      const variantsToPersist = await createMediaVariants({
        body: object.body,
        asset,
        instanceId: input.instanceId,
        claimToken: input.claimToken,
        createId: deps.createId,
      });

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
        await cleanupPersistedVariants();
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
        await cleanupPersistedVariants();
      }
      if (error instanceof MediaStorageUnavailableError || persistenceStarted) {
        throw error;
      }
      return markProcessingFailure({
        deps,
        claimToken: input.claimToken,
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
