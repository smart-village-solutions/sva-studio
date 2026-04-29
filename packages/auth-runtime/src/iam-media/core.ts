import { randomUUID } from 'node:crypto';

import { getWorkspaceContext } from '@sva/server-runtime';
import { asApiItem, asApiList, createApiError, parseRequestBody, readInstanceIdFromRequest, readPage, readPathSegment } from '../shared/request-helpers.js';
import { jsonResponse } from '../db.js';
import { withAuthenticatedUser, type AuthenticatedRequestContext } from '../middleware.js';
import { createUnavailableMediaStoragePort, MediaStorageUnavailableError, type MediaStoragePort } from './storage-port.js';
import { withMediaService } from './repository.js';
import type { MediaService } from './service.js';
import { z } from 'zod';

const uploadInitializationSchema = z.object({
  instanceId: z.string().trim().min(1).optional(),
  mediaType: z.literal('image').default('image'),
  mimeType: z.string().trim().min(1),
  byteSize: z.number().int().positive(),
  visibility: z.enum(['public', 'protected']).default('public'),
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
  readonly createId: () => string;
  readonly now: () => string;
};

export const createMediaHttpHandlers = (deps: MediaHttpHandlerDeps) => ({
  async listMedia(request: Request, ctx: AuthenticatedRequestContext): Promise<Response> {
    const instanceId = resolveScopedInstanceId(request, ctx.user.instanceId);
    if (instanceId instanceof Response) {
      return instanceId;
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

      const delivery = await deps.storagePort.resolveDelivery({
        instanceId,
        assetId,
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
  storagePort: createUnavailableMediaStoragePort(),
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

export const getMediaDeliveryHandler = async (request: Request): Promise<Response> =>
  withMediaRequest(request, mediaHttpHandlers.getMediaDelivery);
