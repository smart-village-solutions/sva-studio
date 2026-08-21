import type { MediaVisibility } from '@sva/media';

import { createApiError } from '../shared/request-helpers.js';
import { jsonResponse } from '../db.js';
import type { AuthenticatedRequestContext } from '../middleware.js';
import {
  MediaStorageUnavailableError,
  type MediaStorageObjectSummary,
  type MediaStoragePort,
} from './storage-port.js';
import { mergeMediaListingPage } from './listing-merge.js';
import {
  decodeMediaListingCursor,
  encodeMediaListingCursor,
  type MediaListingCursor,
  type MediaListingFilters,
} from './listing-cursor.js';
import {
  getMediaRequestId as getRequestId,
  resolveScopedMediaInstanceId as resolveScopedInstanceId,
} from './request-context.js';
import {
  emitMediaAuditEvent,
  mapMediaAuthorizationFailure as mapAuthorizationFailure,
  resolveMediaStoragePort,
  withMediaStorageGuard,
  type MediaHttpHandlerDeps,
} from './http-support.js';
import {
  InvalidPersistedMediaVisibilityError,
  assertSupportedListAssetVisibility,
  isMediaVisibility,
} from './asset-record-support.js';

const isRegisteredListingAsset = (
  item: Awaited<ReturnType<typeof mergeMediaListingPage>>['items'][number]
): item is Awaited<ReturnType<typeof mergeMediaListingPage>>['items'][number] & {
  id: string;
  instanceId: string;
  storageKey: string;
  mimeType: string;
  visibility: MediaVisibility;
} => 'id' in item;

const enrichListItemWithPreviewUrl = async (input: {
  readonly storagePort: MediaStoragePort;
  readonly item: Awaited<ReturnType<typeof mergeMediaListingPage>>['items'][number];
}) => {
  if (
    !isRegisteredListingAsset(input.item) ||
    input.item.visibility !== 'public' ||
    !input.item.mimeType.startsWith('image/')
  ) {
    return input.item;
  }

  try {
    const delivery = await input.storagePort.resolveDelivery({
      instanceId: input.item.instanceId,
      assetId: input.item.id,
      storageKey: input.item.storageKey,
      visibility: input.item.visibility,
    });

    if (!delivery?.deliveryUrl || delivery.isPublicUrl !== true) {
      return input.item;
    }

    return {
      ...input.item,
      previewUrl: delivery.deliveryUrl,
    };
  } catch {
    return input.item;
  }
};

type MediaListRequest = Readonly<{
  search?: string;
  visibility?: MediaVisibility;
  limit: number;
  cursor?: MediaListingCursor;
  filters: MediaListingFilters;
}>;

const readOptionalListParam = (params: URLSearchParams, key: string): string | undefined => {
  const value = params.get(key)?.trim();
  return value ? value : undefined;
};

const parseListVisibility = (params: URLSearchParams): MediaVisibility | Response | undefined => {
  const visibility = readOptionalListParam(params, 'visibility');
  if (!visibility) return undefined;
  if (isMediaVisibility(visibility)) return visibility;
  return createApiError(400, 'invalid_request', 'Ungueltiger Sichtbarkeitsfilter.', getRequestId());
};

const parseListLimit = (params: URLSearchParams): number | Response => {
  const rawLimit = params.get('limit');
  const limit = rawLimit === null ? 25 : Number(rawLimit);
  if (Number.isInteger(limit) && limit >= 1 && limit <= 100) return limit;
  return createApiError(
    400,
    'invalid_request',
    'limit muss eine ganze Zahl zwischen 1 und 100 sein.',
    getRequestId()
  );
};

const parseListCursor = (
  params: URLSearchParams,
  filters: MediaListingFilters
): MediaListingCursor | Response | undefined => {
  const encodedCursor = readOptionalListParam(params, 'cursor');
  if (!encodedCursor) return undefined;
  return (
    decodeMediaListingCursor(encodedCursor, filters) ??
    createApiError(
      400,
      'invalid_request',
      'Der Mediencursor ist ungültig oder gehört zu anderen Filtern.',
      getRequestId()
    )
  );
};

const parseMediaListRequest = (request: Request): MediaListRequest | Response => {
  const url = new URL(request.url);
  if (url.searchParams.has('page') || url.searchParams.has('pageSize')) {
    return createApiError(
      400,
      'invalid_request',
      'Die Medienbibliothek verwendet cursor und limit statt page und pageSize.',
      getRequestId()
    );
  }
  const visibility = parseListVisibility(url.searchParams);
  if (visibility instanceof Response) return visibility;
  const limit = parseListLimit(url.searchParams);
  if (limit instanceof Response) return limit;
  const search = readOptionalListParam(url.searchParams, 'search');
  const filters: MediaListingFilters = { search, visibility };
  const cursor = parseListCursor(url.searchParams, filters);
  if (cursor instanceof Response) return cursor;
  return { search, visibility, limit, cursor, filters };
};

const loadMediaListingSources = async (input: {
  deps: MediaHttpHandlerDeps;
  instanceId: string;
  query: MediaListRequest;
}) => {
  const { search, visibility, cursor, limit } = input.query;
  const registeredAssets = await input.deps.withMediaService(input.instanceId, (service) =>
    service
      .listAssets({
        instanceId: input.instanceId,
        search,
        visibility,
        afterStorageKey: cursor?.afterStorageKey,
        order: 'storageKeyAsc',
        limit: limit + 1,
        offset: 0,
      })
      .then((assets) => assets.map(assertSupportedListAssetVisibility))
  );
  if (visibility) {
    return {
      registeredAssets,
      bucketObjects: [] as readonly MediaStorageObjectSummary[],
      bucketHasMore: false,
      lastScannedBucketKey: undefined,
    };
  }

  const storagePort = await resolveMediaStoragePort(input.deps, input.instanceId);
  const listing = await storagePort.listObjects({
    instanceId: input.instanceId,
    limit: (limit + 1) * 2,
    prefix: search,
    startAfter: cursor?.afterStorageKey,
  });
  return {
    registeredAssets,
    bucketObjects: listing.items,
    bucketHasMore: listing.nextCursor !== null,
    lastScannedBucketKey: listing.lastScannedStorageKey,
  };
};

const enrichMediaListing = async (
  deps: MediaHttpHandlerDeps,
  instanceId: string,
  items: Awaited<ReturnType<typeof mergeMediaListingPage>>['items']
) => {
  const requiresPreview = items.some(
    (item) =>
      isRegisteredListingAsset(item) &&
      item.visibility === 'public' &&
      item.mimeType.startsWith('image/')
  );
  if (!requiresPreview) return items;

  try {
    const storagePort = await resolveMediaStoragePort(deps, instanceId);
    return Promise.all(items.map((item) => enrichListItemWithPreviewUrl({ storagePort, item })));
  } catch (error) {
    if (error instanceof MediaStorageUnavailableError) return items;
    throw error;
  }
};

const listMediaWithStorage = async (input: {
  deps: MediaHttpHandlerDeps;
  ctx: AuthenticatedRequestContext;
  instanceId: string;
  query: MediaListRequest;
}): Promise<Response> => {
  try {
    const { registeredAssets, bucketObjects, bucketHasMore, lastScannedBucketKey } =
      await loadMediaListingSources(input);
    const merged = mergeMediaListingPage({
      instanceId: input.instanceId,
      limit: input.query.limit,
      registeredAssets,
      bucketObjects,
    });
    const items = await enrichMediaListing(input.deps, input.instanceId, merged.items);
    await emitMediaAuditEvent({
      deps: input.deps,
      ctx: input.ctx,
      instanceId: input.instanceId,
      actionId: 'media.read',
      result: 'success',
      resourceType: 'media_library',
    });

    const hasNextPage =
      merged.hasMoreItems || registeredAssets.length > input.query.limit || bucketHasMore;
    const cursorStorageKey =
      items[items.length - 1]?.storageKey ??
      (items.length === 0
        ? (bucketObjects[bucketObjects.length - 1]?.storageKey ?? lastScannedBucketKey)
        : undefined);
    const nextCursor =
      hasNextPage && cursorStorageKey
        ? encodeMediaListingCursor({ afterStorageKey: cursorStorageKey }, input.query.filters)
        : null;
    const requestId = getRequestId();
    return jsonResponse(200, {
      data: items,
      pagination: {
        limit: input.query.limit,
        nextCursor,
        hasNextPage: nextCursor !== null,
      },
      ...(requestId ? { requestId } : {}),
    });
  } catch (error) {
    if (!(error instanceof InvalidPersistedMediaVisibilityError)) throw error;
    await emitMediaAuditEvent({
      deps: input.deps,
      ctx: input.ctx,
      instanceId: input.instanceId,
      actionId: 'media.read',
      result: 'failure',
      reasonCode: 'invalid_persisted_media_visibility',
      resourceType: 'media_asset',
      resourceId: error.assetId,
    });
    return createApiError(
      500,
      'internal_error',
      'Persistierte Mediensichtbarkeit ist ungueltig.',
      getRequestId()
    );
  }
};

export const listMedia = async (
  deps: MediaHttpHandlerDeps,
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const instanceId = resolveScopedInstanceId(request, ctx.user.instanceId);
  if (instanceId instanceof Response) {
    return instanceId;
  }
  const authorization = await deps.authorizeAction({ ctx, instanceId, action: 'media.read' });
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

  const query = parseMediaListRequest(request);
  if (query instanceof Response) {
    return query;
  }
  return withMediaStorageGuard(() => listMediaWithStorage({ deps, ctx, instanceId, query }), {
    deps,
    ctx,
    instanceId,
    actionId: 'media.read',
    resourceType: 'media_library',
  });
};
