import { randomUUID } from 'node:crypto';

import { getWorkspaceContext } from '@sva/server-runtime';
import { canDeleteMediaAsset, type MediaAsset, type MediaProcessingStatus, type MediaReference, type MediaRole, type MediaUploadStatus, type MediaVisibility } from '@sva/media';
import { asApiItem, asApiList, createApiError, parseRequestBody, readInstanceIdFromRequest, readPage, readPathSegment } from '../shared/request-helpers.js';
import { jsonResponse } from '../db.js';
import { withAuthenticatedUser, type AuthenticatedRequestContext } from '../middleware.js';
import { emitAuthAuditEvent } from '../audit-events.js';
import { createUnavailableMediaStoragePort, MediaStorageUnavailableError, type MediaStoragePort } from './storage-port.js';
import { withMediaService } from './repository.js';
import type { MediaService } from './service.js';
import { createConfiguredMediaStoragePort } from './storage-s3.js';
import { authorizeMediaPrimitiveForUser, type MediaPrimitiveAuthorizationResult } from './server-authorization.js';
import { createMediaUploadProcessingService } from './processing.js';
import { z } from 'zod';

const uploadInitializationSchema = z.object({
  instanceId: z.string().trim().min(1).optional(),
  mediaType: z.literal('image').default('image'),
  mimeType: z.string().trim().min(1),
  byteSize: z.number().int().positive(),
  visibility: z.enum(['public', 'protected']).default('public'),
});

const metadataUpdateSchema = z.object({
  instanceId: z.string().trim().min(1).optional(),
  visibility: z.enum(['public', 'protected']).optional(),
  metadata: z
    .object({
      title: z.string().trim().min(1).max(512).optional(),
      description: z.string().trim().min(1).max(5000).optional(),
      altText: z.string().trim().min(1).max(512).optional(),
      copyright: z.string().trim().min(1).max(512).optional(),
      license: z.string().trim().min(1).max(512).optional(),
      focusPoint: z
        .object({
          x: z.number().min(0).max(1),
          y: z.number().min(0).max(1),
        })
        .optional(),
      crop: z
        .object({
          x: z.number().min(0),
          y: z.number().min(0),
          width: z.number().positive(),
          height: z.number().positive(),
        })
        .optional(),
    })
    .partial()
    .refine((value) => Object.keys(value).length > 0, 'metadata: Mindestens ein Metadatenfeld ist erforderlich.'),
});

const replaceReferencesSchema = z.object({
  instanceId: z.string().trim().min(1).optional(),
  targetType: z.string().trim().min(1),
  targetId: z.string().trim().min(1),
  references: z.array(
    z.object({
      id: z.string().trim().min(1).optional(),
      assetId: z.string().trim().min(1),
      role: z.string().trim().min(1),
      sortOrder: z.number().int().nonnegative().optional(),
    })
  ),
});

const resolveScopedInstanceId = (request: Request, userInstanceId?: string): string | Response => {
  const instanceId = readInstanceIdFromRequest(request, userInstanceId);
  if (!instanceId) {
    return createApiError(400, 'invalid_instance_id', 'Instanz-ID fehlt.');
  }
  if (userInstanceId && instanceId !== userInstanceId) {
    return createApiError(403, 'forbidden', 'Instanzkontext stimmt nicht mit der Sitzung überein.');
  }
  return instanceId;
};

const readAssetId = (request: Request): string | Response => {
  const assetId = readPathSegment(request, 4);
  return assetId ? assetId : createApiError(400, 'invalid_request', 'Asset-ID fehlt im Pfad.');
};

const readUploadSessionId = (request: Request): string | Response => {
  const uploadSessionId = readPathSegment(request, 5);
  return uploadSessionId ? uploadSessionId : createApiError(400, 'invalid_request', 'Upload-Session-ID fehlt im Pfad.');
};

const getRequestId = (): string | undefined => getWorkspaceContext().requestId;

type MediaHttpHandlerDeps = {
  readonly withMediaService: <T>(instanceId: string, work: (service: MediaService) => Promise<T>) => Promise<T>;
  readonly storagePort: MediaStoragePort;
  readonly authorizeAction: (input: {
    ctx: AuthenticatedRequestContext;
    action: string;
    resource?: {
      assetId?: string;
      targetType?: string;
      targetId?: string;
      visibility?: string;
    };
  }) => Promise<MediaPrimitiveAuthorizationResult>;
  readonly createId: () => string;
  readonly now: () => string;
  readonly emitAuditEvent: typeof emitAuthAuditEvent;
};

type MediaAuditResult = 'success' | 'failure' | 'denied';

const MEDIA_VISIBILITIES = new Set<MediaVisibility>(['public', 'protected']);
const MEDIA_UPLOAD_STATUSES = new Set<MediaUploadStatus>(['pending', 'validated', 'processed', 'failed', 'blocked']);
const MEDIA_PROCESSING_STATUSES = new Set<MediaProcessingStatus>(['pending', 'ready', 'failed']);
const MEDIA_ROLES = new Set<MediaRole>(['thumbnail', 'teaser_image', 'header_image', 'gallery_item', 'download', 'hero_image']);

const asMediaVisibility = (value: string): MediaVisibility => (MEDIA_VISIBILITIES.has(value as MediaVisibility) ? (value as MediaVisibility) : 'public');

const asMediaUploadStatus = (value: string): MediaUploadStatus =>
  MEDIA_UPLOAD_STATUSES.has(value as MediaUploadStatus) ? (value as MediaUploadStatus) : 'failed';

const asMediaProcessingStatus = (value: string): MediaProcessingStatus =>
  MEDIA_PROCESSING_STATUSES.has(value as MediaProcessingStatus) ? (value as MediaProcessingStatus) : 'failed';

const asMediaRole = (value: string): MediaRole => (MEDIA_ROLES.has(value as MediaRole) ? (value as MediaRole) : 'download');

const asMediaAsset = (asset: Awaited<ReturnType<MediaService['getAssetById']>>): MediaAsset | null => {
  if (!asset) {
    return null;
  }
  return {
    ...asset,
    mediaType: 'image',
    visibility: asMediaVisibility(asset.visibility),
    uploadStatus: asMediaUploadStatus(asset.uploadStatus),
    processingStatus: asMediaProcessingStatus(asset.processingStatus),
  };
};

const asMediaReferences = (references: readonly Awaited<ReturnType<MediaService['listReferencesByAssetId']>>[number][]): readonly MediaReference[] =>
  references.map((reference) => ({
    ...reference,
    role: asMediaRole(reference.role),
  }));

const emitMediaAuditEvent = async (input: {
  readonly deps: Pick<MediaHttpHandlerDeps, 'emitAuditEvent'>;
  readonly ctx: AuthenticatedRequestContext;
  readonly instanceId: string;
  readonly actionId: string;
  readonly result: MediaAuditResult;
  readonly reasonCode?: string;
  readonly resourceType?: string;
  readonly resourceId?: string;
}) => {
  await input.deps.emitAuditEvent({
    eventType:
      input.result === 'success'
        ? 'plugin_action_authorized'
        : input.result === 'denied'
          ? 'plugin_action_denied'
          : 'plugin_action_failed',
    actorUserId: input.ctx.user.id,
    actorEmail: input.ctx.user.email,
    actorDisplayName: input.ctx.user.displayName,
    scope: { kind: 'instance', instanceId: input.instanceId },
    workspaceId: input.instanceId,
    outcome: input.result,
    requestId: getWorkspaceContext().requestId,
    traceId: getWorkspaceContext().traceId,
    pluginAction: {
      actionId: input.actionId,
      actionNamespace: 'media',
      actionOwner: 'host',
      result: input.result,
      reasonCode: input.reasonCode,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
    },
  });
};

const mapAuthorizationFailure = (result: Exclude<MediaPrimitiveAuthorizationResult, { ok: true }>): Response => {
  const code: 'invalid_instance_id' | 'invalid_request' | 'database_unavailable' | 'forbidden' =
    result.error === 'missing_instance'
      ? 'invalid_instance_id'
      : result.error === 'invalid_action'
        ? 'invalid_request'
        : result.error;

  return createApiError(result.status, code, result.message, getRequestId());
};

export const createMediaHttpHandlers = (deps: MediaHttpHandlerDeps) => ({
  async listMedia(request: Request, ctx: AuthenticatedRequestContext): Promise<Response> {
    const instanceId = resolveScopedInstanceId(request, ctx.user.instanceId);
    if (instanceId instanceof Response) {
      return instanceId;
    }
    const authorization = await deps.authorizeAction({ ctx, action: 'media.read' });
    if (!authorization.ok) {
      await emitMediaAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'media.read',
        result: 'denied',
        reasonCode: authorization.error,
        resourceType: 'media_library',
      });
      return mapAuthorizationFailure(authorization);
    }

    const { page, pageSize } = readPage(request);
    const url = new URL(request.url);
    const search = url.searchParams.get('search')?.trim() || undefined;
    const visibility = url.searchParams.get('visibility')?.trim() || undefined;

    const [assets, total] = await deps.withMediaService(instanceId, async (service) => {
      const filter = {
        instanceId,
        search,
        visibility,
      };

      return Promise.all([
        service.listAssets({
          ...filter,
          limit: pageSize,
          offset: (page - 1) * pageSize,
        }),
        service.countAssets(filter),
      ]);
    });

    await emitMediaAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'media.read',
      result: 'success',
      resourceType: 'media_library',
    });

    return jsonResponse(200, asApiList(assets, { page, pageSize, total }, getRequestId()));
  },

  async getMedia(request: Request, ctx: AuthenticatedRequestContext): Promise<Response> {
    const instanceId = resolveScopedInstanceId(request, ctx.user.instanceId);
    if (instanceId instanceof Response) {
      return instanceId;
    }
    const assetId = readAssetId(request);
    if (assetId instanceof Response) {
      return assetId;
    }
    const authorization = await deps.authorizeAction({ ctx, action: 'media.read', resource: { assetId } });
    if (!authorization.ok) {
      await emitMediaAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'media.read',
        result: 'denied',
        reasonCode: authorization.error,
        resourceType: 'media_asset',
        resourceId: assetId,
      });
      return mapAuthorizationFailure(authorization);
    }

    const asset = await deps.withMediaService(instanceId, (service) => service.getAssetById(instanceId, assetId));
    if (!asset) {
      await emitMediaAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'media.read',
        result: 'failure',
        reasonCode: 'asset_not_found',
        resourceType: 'media_asset',
        resourceId: assetId,
      });
      return createApiError(404, 'not_found', 'Medienobjekt nicht gefunden.', getRequestId());
    }

    await emitMediaAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'media.read',
      result: 'success',
      resourceType: 'media_asset',
      resourceId: assetId,
    });

    return jsonResponse(200, asApiItem(asset, getRequestId()));
  },

  async getMediaUsage(request: Request, ctx: AuthenticatedRequestContext): Promise<Response> {
    const instanceId = resolveScopedInstanceId(request, ctx.user.instanceId);
    if (instanceId instanceof Response) {
      return instanceId;
    }
    const assetId = readAssetId(request);
    if (assetId instanceof Response) {
      return assetId;
    }
    const authorization = await deps.authorizeAction({ ctx, action: 'media.read', resource: { assetId } });
    if (!authorization.ok) {
      await emitMediaAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'media.readUsage',
        result: 'denied',
        reasonCode: authorization.error,
        resourceType: 'media_asset',
        resourceId: assetId,
      });
      return mapAuthorizationFailure(authorization);
    }

    const usage = await deps.withMediaService(instanceId, (service) => service.getUsageImpact(instanceId, assetId));
    await emitMediaAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'media.readUsage',
      result: 'success',
      reasonCode: usage.totalReferences > 0 ? 'active_references' : undefined,
      resourceType: 'media_asset',
      resourceId: assetId,
    });
    return jsonResponse(200, asApiItem(usage, getRequestId()));
  },

  async initializeUpload(request: Request, ctx: AuthenticatedRequestContext): Promise<Response> {
    const parsed = await parseRequestBody(request, uploadInitializationSchema);
    if (!parsed.ok) {
      return createApiError(400, 'invalid_request', parsed.message, getRequestId());
    }

    const instanceId = parsed.data.instanceId ?? ctx.user.instanceId;
    if (!instanceId) {
      return createApiError(400, 'invalid_instance_id', 'Instanz-ID fehlt.', getRequestId());
    }
    if (ctx.user.instanceId && instanceId !== ctx.user.instanceId) {
      return createApiError(403, 'forbidden', 'Instanzkontext stimmt nicht mit der Sitzung überein.', getRequestId());
    }
    const authorization = await deps.authorizeAction({ ctx, action: 'media.create' });
    if (!authorization.ok) {
      await emitMediaAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'media.uploadInitialize',
        result: 'denied',
        reasonCode: authorization.error,
        resourceType: 'media_asset',
      });
      return mapAuthorizationFailure(authorization);
    }

    const quotaCheck = await deps.withMediaService(instanceId, (service) =>
      service.wouldExceedStorageQuota(instanceId, parsed.data.byteSize)
    );

    if (quotaCheck.wouldExceed) {
      await emitMediaAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'media.uploadInitialize',
        result: 'failure',
        reasonCode: 'storage_quota_exceeded',
        resourceType: 'media_asset',
      });
      return createApiError(409, 'conflict', 'Speicherkontingent der Instanz würde überschritten.', getRequestId(), {
        reason: 'storage_quota_exceeded',
        maxBytes: quotaCheck.maxBytes,
      });
    }

    try {
      const assetId = deps.createId();
      const uploadSessionId = deps.createId();
      const upload = await deps.storagePort.prepareUpload({
        instanceId,
        assetId,
        uploadSessionId,
        mediaType: parsed.data.mediaType,
        mimeType: parsed.data.mimeType,
        byteSize: parsed.data.byteSize,
      });

      await deps.withMediaService(instanceId, async (service) => {
        await service.upsertAsset({
          id: assetId,
          instanceId,
          storageKey: upload.storageKey,
          mediaType: parsed.data.mediaType,
          mimeType: parsed.data.mimeType,
          byteSize: parsed.data.byteSize,
          visibility: parsed.data.visibility,
          uploadStatus: 'pending',
          processingStatus: 'pending',
          metadata: {},
          technical: {},
        });
        await service.upsertUploadSession({
          id: uploadSessionId,
          instanceId,
          assetId,
          storageKey: upload.storageKey,
          mimeType: parsed.data.mimeType,
          byteSize: parsed.data.byteSize,
          status: 'pending',
          expiresAt: upload.expiresAt,
        });
      });

      await emitMediaAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'media.uploadInitialize',
        result: 'success',
        resourceType: 'media_asset',
        resourceId: assetId,
      });

      return jsonResponse(
        201,
        asApiItem(
          {
            assetId,
            uploadSessionId,
            uploadUrl: upload.uploadUrl,
            method: upload.method,
            headers: upload.headers ?? {},
            expiresAt: upload.expiresAt,
            status: 'pending',
            initializedAt: deps.now(),
          },
          getRequestId()
        )
      );
    } catch (error) {
      if (error instanceof MediaStorageUnavailableError) {
        await emitMediaAuditEvent({
          deps,
          ctx,
          instanceId,
          actionId: 'media.uploadInitialize',
          result: 'failure',
          reasonCode: 'media_storage_unavailable',
          resourceType: 'media_asset',
        });
        return createApiError(503, 'internal_error', 'Medien-Storage ist momentan nicht verfügbar.', getRequestId());
      }
      throw error;
    }
  },

  async updateMedia(request: Request, ctx: AuthenticatedRequestContext): Promise<Response> {
    const parsed = await parseRequestBody(request, metadataUpdateSchema);
    if (!parsed.ok) {
      return createApiError(400, 'invalid_request', parsed.message, getRequestId());
    }

    const instanceId = parsed.data.instanceId ?? ctx.user.instanceId;
    if (!instanceId) {
      return createApiError(400, 'invalid_instance_id', 'Instanz-ID fehlt.', getRequestId());
    }
    if (ctx.user.instanceId && instanceId !== ctx.user.instanceId) {
      return createApiError(403, 'forbidden', 'Instanzkontext stimmt nicht mit der Sitzung überein.', getRequestId());
    }

    const assetId = readAssetId(request);
    if (assetId instanceof Response) {
      return assetId;
    }

    const authorization = await deps.authorizeAction({ ctx, action: 'media.update', resource: { assetId } });
    if (!authorization.ok) {
      await emitMediaAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'media.metadataUpdate',
        result: 'denied',
        reasonCode: authorization.error,
        resourceType: 'media_asset',
        resourceId: assetId,
      });
      return mapAuthorizationFailure(authorization);
    }

    const asset = await deps.withMediaService(instanceId, (service) => service.getAssetById(instanceId, assetId));
    if (!asset) {
      await emitMediaAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'media.metadataUpdate',
        result: 'failure',
        reasonCode: 'asset_not_found',
        resourceType: 'media_asset',
        resourceId: assetId,
      });
      return createApiError(404, 'not_found', 'Medienobjekt nicht gefunden.', getRequestId());
    }

    const usageImpact = await deps.withMediaService(instanceId, (service) => service.getUsageImpact(instanceId, assetId));

    const updatedAsset = {
      ...asset,
      visibility: parsed.data.visibility ?? asset.visibility,
      metadata: {
        ...asset.metadata,
        ...parsed.data.metadata,
      },
    };

    await deps.withMediaService(instanceId, async (service) => {
      await service.upsertAsset(updatedAsset);
    });

    await emitMediaAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'media.metadataUpdate',
      result: 'success',
      reasonCode:
        parsed.data.metadata.crop || parsed.data.metadata.focusPoint
          ? 'image_edit_applied'
          : usageImpact.totalReferences > 0
            ? 'referenced_asset_updated'
            : undefined,
      resourceType: 'media_asset',
      resourceId: assetId,
    });

    return jsonResponse(200, asApiItem({ ...updatedAsset, usageImpact }, getRequestId()));
  },

  async completeUpload(request: Request, ctx: AuthenticatedRequestContext): Promise<Response> {
    const instanceId = resolveScopedInstanceId(request, ctx.user.instanceId);
    if (instanceId instanceof Response) {
      return instanceId;
    }
    const uploadSessionId = readUploadSessionId(request);
    if (uploadSessionId instanceof Response) {
      return uploadSessionId;
    }

    const authorization = await deps.authorizeAction({ ctx, action: 'media.create' });
    if (!authorization.ok) {
      await emitMediaAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'media.uploadComplete',
        result: 'denied',
        reasonCode: authorization.error,
        resourceType: 'media_upload_session',
        resourceId: uploadSessionId,
      });
      return mapAuthorizationFailure(authorization);
    }

    try {
      const result = await deps.withMediaService(instanceId, async (service) =>
        createMediaUploadProcessingService({
          service,
          storagePort: deps.storagePort,
          createId: deps.createId,
        }).completeUpload({
          instanceId,
          uploadSessionId,
        })
      );

      if (!result.ok) {
        await emitMediaAuditEvent({
          deps,
          ctx,
          instanceId,
          actionId: 'media.uploadComplete',
          result: 'failure',
          reasonCode: result.errorCode,
          resourceType: 'media_upload_session',
          resourceId: uploadSessionId,
        });
        const errorCode =
          result.errorCode === 'upload_session_not_found' || result.errorCode === 'asset_not_found'
            ? 'not_found'
            : result.errorCode === 'upload_size_exceeded'
              ? 'conflict'
              : 'invalid_request';
        const message =
          result.errorCode === 'upload_size_exceeded'
            ? 'Das hochgeladene Medium überschreitet die erlaubte Größe.'
            : result.errorCode === 'invalid_media_content'
              ? 'Das hochgeladene Medium konnte nicht validiert werden.'
              : result.errorCode === 'upload_session_not_found'
                ? 'Upload-Session wurde nicht gefunden.'
                : 'Medienobjekt wurde nicht gefunden.';
        return createApiError(result.status, errorCode, message, getRequestId(), {
          reason: result.errorCode,
        });
      }

      await emitMediaAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'media.uploadComplete',
        result: 'success',
        reasonCode: 'variants_generated',
        resourceType: 'media_asset',
        resourceId: String(result.asset.id),
      });

      return jsonResponse(
        200,
        asApiItem(
          {
            assetId: result.asset.id,
            uploadSessionId: result.uploadSessionId,
            status: 'processed',
          },
          getRequestId()
        )
      );
    } catch (error) {
      if (error instanceof MediaStorageUnavailableError) {
        await emitMediaAuditEvent({
          deps,
          ctx,
          instanceId,
          actionId: 'media.uploadComplete',
          result: 'failure',
          reasonCode: 'media_storage_unavailable',
          resourceType: 'media_upload_session',
          resourceId: uploadSessionId,
        });
        return createApiError(503, 'internal_error', 'Medien-Storage ist momentan nicht verfügbar.', getRequestId());
      }
      throw error;
    }
  },

  async replaceReferences(request: Request, ctx: AuthenticatedRequestContext): Promise<Response> {
    const parsed = await parseRequestBody(request, replaceReferencesSchema);
    if (!parsed.ok) {
      return createApiError(400, 'invalid_request', parsed.message, getRequestId());
    }

    const instanceId = parsed.data.instanceId ?? ctx.user.instanceId;
    if (!instanceId) {
      return createApiError(400, 'invalid_instance_id', 'Instanz-ID fehlt.', getRequestId());
    }
    if (ctx.user.instanceId && instanceId !== ctx.user.instanceId) {
      return createApiError(403, 'forbidden', 'Instanzkontext stimmt nicht mit der Sitzung überein.', getRequestId());
    }

    const authorization = await deps.authorizeAction({
      ctx,
      action: 'media.reference.manage',
      resource: {
        targetType: parsed.data.targetType,
        targetId: parsed.data.targetId,
      },
    });
    if (!authorization.ok) {
      await emitMediaAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'media.referenceManage',
        result: 'denied',
        reasonCode: authorization.error,
        resourceType: parsed.data.targetType,
        resourceId: parsed.data.targetId,
      });
      return mapAuthorizationFailure(authorization);
    }

    const missingAssetIds: string[] = [];
    await deps.withMediaService(instanceId, async (service) => {
      for (const reference of parsed.data.references) {
        const asset = await service.getAssetById(instanceId, reference.assetId);
        if (!asset) {
          missingAssetIds.push(reference.assetId);
        }
      }
    });

    if (missingAssetIds.length > 0) {
      await emitMediaAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'media.referenceManage',
        result: 'failure',
        reasonCode: 'asset_not_found',
        resourceType: parsed.data.targetType,
        resourceId: parsed.data.targetId,
      });
      return createApiError(
        404,
        'not_found',
        'Mindestens ein referenziertes Medienobjekt wurde nicht gefunden.',
        getRequestId(),
        { missingAssetIds }
      );
    }

    const references = parsed.data.references.map((reference) => ({
      id: reference.id ?? deps.createId(),
      assetId: reference.assetId,
      targetType: parsed.data.targetType,
      targetId: parsed.data.targetId,
      role: reference.role,
      sortOrder: reference.sortOrder,
    }));

    await deps.withMediaService(instanceId, async (service) => {
      await service.replaceReferences({
        instanceId,
        targetType: parsed.data.targetType,
        targetId: parsed.data.targetId,
        references,
      });
    });

    await emitMediaAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'media.referenceManage',
      result: 'success',
      reasonCode: references.length > 0 ? 'references_replaced' : 'references_cleared',
      resourceType: parsed.data.targetType,
      resourceId: parsed.data.targetId,
    });

    return jsonResponse(
      200,
      asApiItem(
        {
          instanceId,
          targetType: parsed.data.targetType,
          targetId: parsed.data.targetId,
          references,
        },
        getRequestId()
      )
    );
  },

  async listReferences(request: Request, ctx: AuthenticatedRequestContext): Promise<Response> {
    const instanceId = resolveScopedInstanceId(request, ctx.user.instanceId);
    if (instanceId instanceof Response) {
      return instanceId;
    }
    const url = new URL(request.url);
    const targetType = url.searchParams.get('targetType')?.trim();
    const targetId = url.searchParams.get('targetId')?.trim();
    if (!targetType || !targetId) {
      return createApiError(400, 'invalid_request', 'Zieltyp und Ziel-ID sind erforderlich.', getRequestId());
    }

    const authorization = await deps.authorizeAction({
      ctx,
      action: 'media.reference.manage',
      resource: {
        targetType,
        targetId,
      },
    });
    if (!authorization.ok) {
      await emitMediaAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'media.referenceList',
        result: 'denied',
        reasonCode: authorization.error,
        resourceType: targetType,
        resourceId: targetId,
      });
      return mapAuthorizationFailure(authorization);
    }

    const references = await deps.withMediaService(instanceId, (service) => service.listReferencesByTarget(instanceId, targetType, targetId));
    await emitMediaAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'media.referenceList',
      result: 'success',
      reasonCode: references.length > 0 ? 'active_references' : undefined,
      resourceType: targetType,
      resourceId: targetId,
    });
    return jsonResponse(200, asApiItem(references, getRequestId()));
  },

  async getMediaDelivery(request: Request, ctx: AuthenticatedRequestContext): Promise<Response> {
    const instanceId = resolveScopedInstanceId(request, ctx.user.instanceId);
    if (instanceId instanceof Response) {
      return instanceId;
    }
    const assetId = readAssetId(request);
    if (assetId instanceof Response) {
      return assetId;
    }

    try {
      const asset = await deps.withMediaService(instanceId, (service) => service.getAssetById(instanceId, assetId));
      if (!asset) {
        await emitMediaAuditEvent({
          deps,
          ctx,
          instanceId,
          actionId: 'media.deliveryResolve',
          result: 'failure',
          reasonCode: 'asset_not_found',
          resourceType: 'media_asset',
          resourceId: assetId,
        });
        return createApiError(404, 'not_found', 'Medienobjekt nicht gefunden.', getRequestId());
      }
      const authorization = await deps.authorizeAction({
        ctx,
        action: asset.visibility === 'protected' ? 'media.deliver.protected' : 'media.read',
        resource: {
          assetId,
          visibility: asset.visibility,
        },
      });
      if (!authorization.ok) {
        await emitMediaAuditEvent({
          deps,
          ctx,
          instanceId,
          actionId: 'media.deliveryResolve',
          result: 'denied',
          reasonCode: authorization.error,
          resourceType: 'media_asset',
          resourceId: assetId,
        });
        return mapAuthorizationFailure(authorization);
      }

      const delivery = await deps.storagePort.resolveDelivery({
        instanceId,
        assetId,
        storageKey: asset.storageKey,
        visibility: asset.visibility,
      });

      await emitMediaAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'media.deliveryResolve',
        result: 'success',
        reasonCode: asset.visibility === 'protected' ? 'protected_delivery' : 'public_delivery',
        resourceType: 'media_asset',
        resourceId: assetId,
      });

      return jsonResponse(200, asApiItem(delivery, getRequestId()));
    } catch (error) {
      if (error instanceof MediaStorageUnavailableError) {
        await emitMediaAuditEvent({
          deps,
          ctx,
          instanceId,
          actionId: 'media.deliveryResolve',
          result: 'failure',
          reasonCode: 'media_storage_unavailable',
          resourceType: 'media_asset',
          resourceId: assetId,
        });
        return createApiError(503, 'internal_error', 'Medien-Storage ist momentan nicht verfügbar.', getRequestId());
      }
      throw error;
    }
  },

  async deleteMedia(request: Request, ctx: AuthenticatedRequestContext): Promise<Response> {
    const instanceId = resolveScopedInstanceId(request, ctx.user.instanceId);
    if (instanceId instanceof Response) {
      return instanceId;
    }
    const assetId = readAssetId(request);
    if (assetId instanceof Response) {
      return assetId;
    }

    const authorization = await deps.authorizeAction({ ctx, action: 'media.delete', resource: { assetId } });
    if (!authorization.ok) {
      await emitMediaAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'media.delete',
        result: 'denied',
        reasonCode: authorization.error,
        resourceType: 'media_asset',
        resourceId: assetId,
      });
      return mapAuthorizationFailure(authorization);
    }

    const asset = await deps.withMediaService(instanceId, (service) => service.getAssetById(instanceId, assetId));
    if (!asset) {
      await emitMediaAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'media.delete',
        result: 'failure',
        reasonCode: 'asset_not_found',
        resourceType: 'media_asset',
        resourceId: assetId,
      });
      return createApiError(404, 'not_found', 'Medienobjekt nicht gefunden.', getRequestId());
    }

    const references = await deps.withMediaService(instanceId, (service) => service.listReferencesByAssetId(instanceId, assetId));
    const deletionDecision = canDeleteMediaAsset({
      asset: asMediaAsset(asset)!,
      references: asMediaReferences(references),
    });
    if (!deletionDecision.allowed) {
      await emitMediaAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'media.delete',
        result: 'failure',
        reasonCode: deletionDecision.reason ?? 'delete_blocked',
        resourceType: 'media_asset',
        resourceId: assetId,
      });
      return createApiError(409, 'conflict', 'Das Medienobjekt kann derzeit nicht gelöscht werden.', getRequestId(), {
        reason: deletionDecision.reason,
        usage: {
          assetId,
          totalReferences: references.length,
        },
      });
    }

    await deps.withMediaService(instanceId, (service) => service.deleteAsset(instanceId, assetId));
    await emitMediaAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'media.delete',
      result: 'success',
      resourceType: 'media_asset',
      resourceId: assetId,
    });
    return jsonResponse(200, asApiItem({ assetId, deleted: true }, getRequestId()));
  },
});

const mediaHttpHandlers = createMediaHttpHandlers({
  withMediaService,
  storagePort: (() => {
    try {
      return createConfiguredMediaStoragePort();
    } catch {
      return createUnavailableMediaStoragePort();
    }
  })(),
  authorizeAction: authorizeMediaPrimitiveForUser,
  createId: () => randomUUID(),
  now: () => new Date().toISOString(),
  emitAuditEvent: emitAuthAuditEvent,
});

const withMediaRequest = async (
  request: Request,
  handler: (request: Request, ctx: AuthenticatedRequestContext) => Promise<Response>
): Promise<Response> => withAuthenticatedUser(request, async (ctx) => handler(request, ctx));

export const listMediaHandler = async (request: Request): Promise<Response> =>
  withMediaRequest(request, mediaHttpHandlers.listMedia);

export const getMediaHandler = async (request: Request): Promise<Response> =>
  withMediaRequest(request, mediaHttpHandlers.getMedia);

export const getMediaUsageHandler = async (request: Request): Promise<Response> =>
  withMediaRequest(request, mediaHttpHandlers.getMediaUsage);

export const initializeMediaUploadHandler = async (request: Request): Promise<Response> =>
  withMediaRequest(request, mediaHttpHandlers.initializeUpload);

export const updateMediaHandler = async (request: Request): Promise<Response> =>
  withMediaRequest(request, mediaHttpHandlers.updateMedia);

export const completeMediaUploadHandler = async (request: Request): Promise<Response> =>
  withMediaRequest(request, mediaHttpHandlers.completeUpload);

export const replaceMediaReferencesHandler = async (request: Request): Promise<Response> =>
  withMediaRequest(request, mediaHttpHandlers.replaceReferences);

export const listMediaReferencesHandler = async (request: Request): Promise<Response> =>
  withMediaRequest(request, mediaHttpHandlers.listReferences);

export const getMediaDeliveryHandler = async (request: Request): Promise<Response> =>
  withMediaRequest(request, mediaHttpHandlers.getMediaDelivery);

export const deleteMediaHandler = async (request: Request): Promise<Response> =>
  withMediaRequest(request, mediaHttpHandlers.deleteMedia);
