import { markProcessingFailure } from './upload-finalization.js';
import sharp from 'sharp';
import { fileTypeFromBuffer } from 'file-type';
import { MediaStorageUnavailableError, type MediaStoragePort } from './storage-port.js';
import type { MediaService } from './service.js';
import { cleanupReplacedClaimVariants, createMediaVariants } from './processing-variants.js';
import { MediaScanError, scanConfiguredMedia } from './clamav.js';
import {
  isMediaQuarantineKey,
  isPrivateMediaStorageKey,
  mediaProcessingPrefix,
} from './storage-key-paths.js';
import { getMediaEditingIntakeKeys, prepareMediaEditingData } from './processing-editing.js';

const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export type MediaUploadProcessingFailureCode =
  | 'upload_session_not_found'
  | 'asset_not_found'
  | 'invalid_media_content'
  | 'upload_size_exceeded'
  | 'storage_quota_exceeded'
  | 'upload_processing_superseded'
  | 'media_scan_infected';

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

export type MediaUploadProcessingResult =
  | Readonly<{
      ok: true;
      asset: NonNullable<Awaited<ReturnType<MediaService['getAssetById']>>>;
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
    const quarantined = isMediaQuarantineKey(uploadSession.storageKey);
    const privateIntake = isPrivateMediaStorageKey(uploadSession.storageKey);
    const privateOutput = privateIntake && asset.visibility === 'protected';

    if (input.replacedClaimToken) {
      await cleanupReplacedClaimVariants({
        storagePort: deps.storagePort,
        instanceId: input.instanceId,
        assetId: String(asset.id),
        claimToken: input.replacedClaimToken,
        privateOutput,
        privateSource: Boolean(asset.editingSourceKey),
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

      // The intake path fixes the scan contract at initialization. Legacy public
      // upload URLs remain writable and cannot receive an immutable scan proof.
      if (quarantined) await scanConfiguredMedia(object.body);

      const editing = await prepareMediaEditingData({
        asset,
        storage: deps.storagePort,
        scanRequired: quarantined,
      });
      const renderedFormat =
        detectedMimeType === 'image/jpeg'
          ? 'jpeg'
          : detectedMimeType === 'image/webp'
            ? 'webp'
            : 'png';
      const renderedBody = editing
        ? await sharp(object.body, { failOn: 'error' }).rotate().toFormat(renderedFormat).toBuffer()
        : object.body;

      const metadata = await sharp(renderedBody, { failOn: 'error' }).rotate().metadata();
      const technical = {
        ...(asset.technical ?? {}),
        ...(quarantined ? { scanStatus: 'clean' } : {}),
        width: metadata.width,
        height: metadata.height,
        contentType: detectedMimeType,
        etag: object.etag,
      };

      const variantsToPersist = await createMediaVariants({
        body: renderedBody,
        asset,
        instanceId: input.instanceId,
        claimToken: input.claimToken,
        createId: deps.createId,
        privateOutput,
      });

      let variantBytes = 0;
      persistenceStarted = true;
      let publishedOriginalKey = asset.storageKey;
      let editingSourceKey = asset.editingSourceKey;
      if (editing?.source) {
        editingSourceKey = `${mediaProcessingPrefix(input.instanceId, asset.id, input.claimToken, true)}source.${editing.source.extension}`;
        persistedVariantStorageKeys.push(editingSourceKey);
        await deps.storagePort.writeObject({
          instanceId: input.instanceId,
          storageKey: editingSourceKey,
          body: editing.source.body,
          contentType: editing.source.contentType,
        });
      }
      if (privateIntake) {
        publishedOriginalKey = `${mediaProcessingPrefix(input.instanceId, asset.id, input.claimToken, privateOutput)}original.${detectedFileType?.ext ?? 'bin'}`;
        await deps.storagePort.writeObject({
          instanceId: input.instanceId,
          storageKey: publishedOriginalKey,
          body: renderedBody,
          contentType: detectedMimeType,
        });
        persistedVariantStorageKeys.push(publishedOriginalKey);
      }
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
        storageKey: publishedOriginalKey,
        byteSize: renderedBody.byteLength,
        editingSourceKey,
        ...(editing ? { editingDocument: editing.document } : {}),
        mimeType: detectedMimeType,
        uploadStatus: 'processed',
        processingStatus: 'ready',
        technical: {
          ...technical,
          variantBytes,
          ...(editing
            ? {
                editingSourceBytes: editing.source?.body.byteLength ?? 0,
                editingDocumentBytes: editing.documentBytes,
              }
            : {}),
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
        totalBytes:
          renderedBody.byteLength +
          variantBytes +
          (editing?.source?.body.byteLength ?? 0) +
          (editing?.documentBytes ?? 0),
      });
      if (finalized === 'claim_superseded') {
        await cleanupPersistedVariants();
        return asErrorResult(409, 'upload_processing_superseded');
      }
      if (finalized === 'quota_exceeded') {
        await Promise.allSettled(
          [
            ...persistedVariantStorageKeys,
            String(uploadSession.storageKey),
            ...getMediaEditingIntakeKeys(asset),
          ].map((storageKey) =>
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
      if (error instanceof MediaScanError) {
        if (error.code === 'media_scan_infected')
          return markProcessingFailure({
            deps,
            claimToken: input.claimToken,
            asset,
            uploadSession,
            errorCode: error.code,
          });
        throw error;
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
