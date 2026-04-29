import { randomUUID } from 'node:crypto';

import { getWorkspaceContext } from '@sva/server-runtime';
import { asApiItem, asApiList, createApiError, parseRequestBody, readInstanceIdFromRequest, readPage, readPathSegment } from '../shared/request-helpers.js';
import { jsonResponse } from '../db.js';
import { withAuthenticatedUser, type AuthenticatedRequestContext } from '../middleware.js';
import { createUnavailableMediaStoragePort, MediaStorageUnavailableError, type MediaStoragePort } from './storage-port.js';
import { withMediaService } from './repository.js';
import type { MediaService } from './service.js';
import { createConfiguredMediaStoragePort } from './storage-s3.js';
import { authorizeMediaPrimitiveForUser, type MediaPrimitiveAuthorizationResult } from './server-authorization.js';
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
};

const mapAuthorizationFailure = (result: Exclude<MediaPrimitiveAuthorizationResult, { ok: true }>): Response => {
  const code =
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
      return mapAuthorizationFailure(authorization);
    }

    const { page, pageSize } = readPage(request);
    const url = new URL(request.url);
    const search = url.searchParams.get('search')?.trim() || undefined;
    const visibility = url.searchParams.get('visibility')?.trim() || undefined;

    const assets = await deps.withMediaService(instanceId, (service) =>
      service.listAssets({
        instanceId,
        search,
        visibility,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      })
    );

    return jsonResponse(200, asApiList(assets, { page, pageSize, total: assets.length }, getRequestId()));
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
      return mapAuthorizationFailure(authorization);
    }

    const asset = await deps.withMediaService(instanceId, (service) => service.getAssetById(instanceId, assetId));
    if (!asset) {
      return createApiError(404, 'not_found', 'Medienobjekt nicht gefunden.', getRequestId());
    }

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
      return mapAuthorizationFailure(authorization);
    }

    const usage = await deps.withMediaService(instanceId, (service) => service.getUsageImpact(instanceId, assetId));
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
      return mapAuthorizationFailure(authorization);
    }

    const quotaCheck = await deps.withMediaService(instanceId, (service) =>
      service.wouldExceedStorageQuota(instanceId, parsed.data.byteSize)
    );

    if (quotaCheck.wouldExceed) {
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
      return mapAuthorizationFailure(authorization);
    }

    const asset = await deps.withMediaService(instanceId, (service) => service.getAssetById(instanceId, assetId));
    if (!asset) {
      return createApiError(404, 'not_found', 'Medienobjekt nicht gefunden.', getRequestId());
    }

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

    return jsonResponse(200, asApiItem(updatedAsset, getRequestId()));
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
        return mapAuthorizationFailure(authorization);
      }

      const delivery = await deps.storagePort.resolveDelivery({
        instanceId,
        assetId,
        storageKey: asset.storageKey,
        visibility: asset.visibility,
      });

      return jsonResponse(200, asApiItem(delivery, getRequestId()));
    } catch (error) {
      if (error instanceof MediaStorageUnavailableError) {
        return createApiError(503, 'internal_error', 'Medien-Storage ist momentan nicht verfügbar.', getRequestId());
      }
      throw error;
    }
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

export const replaceMediaReferencesHandler = async (request: Request): Promise<Response> =>
  withMediaRequest(request, mediaHttpHandlers.replaceReferences);

export const getMediaDeliveryHandler = async (request: Request): Promise<Response> =>
  withMediaRequest(request, mediaHttpHandlers.getMediaDelivery);
