import { createApiError } from '../shared/request-helpers.js';
import type { AuthenticatedRequestContext } from '../middleware.js';
import { emitMediaAuditEvent, type MediaHttpHandlerDeps } from './http-support.js';
import { getMediaRequestId as getRequestId } from './request-context.js';
import type { MediaService } from './service.js';

export const canAccessMediaAsset = (
  asset: NonNullable<Awaited<ReturnType<MediaService['getAssetById']>>>,
  actorSubject: string
): boolean =>
  asset.lifecycleStatus !== 'provisional' || asset.provisionalOwnerSubject === actorSubject;

export const isMediaAssetReady = (asset: {
  readonly uploadStatus: string;
  readonly processingStatus: string;
  readonly deletionPending?: boolean;
}): boolean =>
  asset.uploadStatus === 'processed' &&
  asset.processingStatus === 'ready' &&
  !asset.deletionPending;

export const toMediaAssetResponse = (
  asset: NonNullable<Awaited<ReturnType<MediaService['getAssetById']>>>
) => {
  const {
    editingDocument,
    editingSourceKey: _editingSourceKey,
    editingSourceAssetId: _editingSourceAssetId,
    ...publicAsset
  } = asset;
  const technical = Object.fromEntries(
    Object.entries(asset.technical ?? {}).filter(
      ([key]) => !key.startsWith('editing') && key !== 'uploadDraftFingerprint'
    )
  );
  return {
    ...publicAsset,
    ...(asset.technical ? { technical } : {}),
    ...(editingDocument ? { hasEditingDocument: true } : {}),
  };
};

export const rejectMediaMetadataChange = async (
  deps: MediaHttpHandlerDeps,
  ctx: AuthenticatedRequestContext,
  instanceId: string,
  asset: Parameters<typeof isMediaAssetReady>[0] & {
    id: string;
    visibility: string;
    technical?: Readonly<Record<string, unknown>>;
    editingDocument?: unknown;
    editingSourceKey?: string;
    editingSourceAssetId?: string;
  },
  visibility: string | undefined
): Promise<Response | null> => {
  if (!isMediaAssetReady(asset)) {
    return createApiError(
      409,
      'conflict',
      'Das Medium ist noch nicht zur Bearbeitung freigegeben.',
      getRequestId(),
      { reason: 'media_not_ready' }
    );
  }

  if (
    (asset.technical?.scanStatus === 'clean' ||
      asset.editingDocument ||
      asset.editingSourceKey ||
      asset.editingSourceAssetId) &&
    visibility !== undefined &&
    visibility !== asset.visibility
  ) {
    await emitMediaAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'media.metadataUpdate',
      result: 'denied',
      reasonCode: 'media_visibility_fixed',
      resourceType: 'media_asset',
      resourceId: asset.id,
    });
    return createApiError(
      409,
      'conflict',
      'Die Sichtbarkeit dieses Mediums bleibt nach dem Upload fest. Bitte laden Sie das Medium mit der gewünschten Sichtbarkeit erneut hoch.',
      getRequestId(),
      { reason: 'media_visibility_fixed' }
    );
  }

  return null;
};

export const persistMediaMetadataUpdate = async (
  deps: MediaHttpHandlerDeps,
  instanceId: string,
  asset: Parameters<MediaService['upsertAsset']>[0]
): Promise<Response | null> => {
  try {
    await deps.withMediaService(instanceId, (service) => service.upsertAsset(asset));
    return null;
  } catch (error) {
    if (error instanceof Error && error.message === 'media_visibility_fixed')
      return createApiError(
        409,
        'conflict',
        'Dieses Medium wird als Bearbeitungsgrundlage benötigt. Die Sichtbarkeit bleibt fest.',
        getRequestId(),
        { reason: 'media_visibility_fixed' }
      );
    throw error;
  }
};
