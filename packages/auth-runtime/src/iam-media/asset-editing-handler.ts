import { parseMediaEditingDocument, type MediaEditingDocument } from '@sva/media';

import { jsonResponse } from '../db.js';
import type { AuthenticatedRequestContext } from '../middleware.js';
import { asApiItem, createApiError } from '../shared/request-helpers.js';
import { canAccessMediaAsset, isMediaAssetReady } from './asset-support.js';
import { isMediaVisibility } from './asset-record-support.js';
import {
  emitMediaAuditEvent,
  mapMediaAuthorizationFailure,
  resolveMediaStoragePort,
  withMediaStorageGuard,
  type MediaHttpHandlerDeps,
} from './http-support.js';
import {
  getMediaRequestId,
  readMediaAssetId,
  resolveScopedMediaInstanceId,
} from './request-context.js';
import type { MediaService } from './service.js';

type Asset = NonNullable<Awaited<ReturnType<MediaService['getAssetById']>>>;

const authorizeEditingAsset = async (
  deps: MediaHttpHandlerDeps,
  ctx: AuthenticatedRequestContext,
  instanceId: string,
  assetId: string,
  visibility?: string
): Promise<Response | null> => {
  const action = visibility === 'protected' ? 'media.deliver.protected' : 'media.read';
  const authorization = await deps.authorizeAction({
    ctx,
    instanceId,
    action,
    resource: { assetId },
  });
  if (!authorization.ok) {
    await emitMediaAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'media.editorRead',
      result: 'denied',
      reasonCode: authorization.error,
      resourceType: 'media_asset',
      resourceId: assetId,
    });
    return mapMediaAuthorizationFailure(authorization);
  }
  return null;
};

export const readAuthorizedMediaEditingAsset = async (
  deps: MediaHttpHandlerDeps,
  ctx: AuthenticatedRequestContext,
  instanceId: string,
  assetId: string
): Promise<Asset | Response> => {
  const denied = await authorizeEditingAsset(deps, ctx, instanceId, assetId);
  if (denied) return denied;
  const asset = await deps.withMediaService(instanceId, (service) =>
    service.getAssetById(instanceId, assetId)
  );
  if (!asset || !canAccessMediaAsset(asset, ctx.user.id)) {
    return createApiError(404, 'not_found', 'Medienobjekt nicht gefunden.', getMediaRequestId());
  }
  if (!isMediaVisibility(asset.visibility)) {
    return createApiError(
      500,
      'internal_error',
      'Ungültige Mediensichtbarkeit.',
      getMediaRequestId()
    );
  }
  if (asset.visibility === 'protected') {
    const protectedDenied = await authorizeEditingAsset(
      deps,
      ctx,
      instanceId,
      assetId,
      asset.visibility
    );
    if (protectedDenied) return protectedDenied;
  }
  if (!isMediaAssetReady(asset)) {
    return createApiError(
      409,
      'conflict',
      'Das Medium ist noch nicht zur Bearbeitung freigegeben.',
      getMediaRequestId(),
      { reason: 'media_not_ready' }
    );
  }
  return asset;
};

export const getMediaEditing = async (
  deps: MediaHttpHandlerDeps,
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const instanceId = resolveScopedMediaInstanceId(request, ctx.user.instanceId);
  if (instanceId instanceof Response) return instanceId;
  const assetId = readMediaAssetId(request);
  if (assetId instanceof Response) return assetId;
  return withMediaStorageGuard(
    async () => {
      const asset = await readAuthorizedMediaEditingAsset(deps, ctx, instanceId, assetId);
      if (asset instanceof Response) return asset;
      const source = asset.editingSourceAssetId
        ? await readAuthorizedMediaEditingAsset(deps, ctx, instanceId, asset.editingSourceAssetId)
        : asset;
      if (source instanceof Response) return source;
      let document: MediaEditingDocument | undefined;
      try {
        document = asset.editingDocument
          ? parseMediaEditingDocument(asset.editingDocument)
          : undefined;
      } catch {
        return createApiError(
          409,
          'conflict',
          'Der Bearbeitungszustand kann nicht geladen werden.',
          getMediaRequestId(),
          { reason: 'media_editor_document_incompatible' }
        );
      }
      const storage = await resolveMediaStoragePort(deps, instanceId);
      const delivery = await storage.resolveDelivery({
        instanceId,
        assetId: source.id,
        storageKey: source.editingSourceKey ?? source.storageKey,
        // Original editing resources are always signed, including a public asset's private local source.
        visibility: 'protected',
      });
      await emitMediaAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'media.editorRead',
        result: 'success',
        resourceType: 'media_asset',
        resourceId: assetId,
      });
      const response = jsonResponse(
        200,
        asApiItem(
          {
            assetId,
            sourceAssetId: source.id,
            sourceUrl: delivery.deliveryUrl,
            sourceExpiresAt: delivery.expiresAt,
            document,
          },
          getMediaRequestId()
        )
      );
      response.headers.set('Cache-Control', 'private, no-store');
      response.headers.set('Referrer-Policy', 'no-referrer');
      return response;
    },
    {
      deps,
      ctx,
      instanceId,
      actionId: 'media.editorRead',
      resourceType: 'media_asset',
      resourceId: assetId,
    }
  );
};
