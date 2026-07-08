import {
  resolveActorAccountId,
  withAuthenticatedUser,
  withInstanceScopedDb,
} from '@sva/auth-runtime/server';
import { createSdkLogger } from '@sva/server-runtime';

import { refreshProjectedContentsForMainserverMutation } from './iam-content-list-projection.server.js';

type MainserverProjectionContentType =
  | 'news.article'
  | 'events.event-record'
  | 'poi.point-of-interest'
  | 'generic-items.generic-item'
  | 'surveys.survey';

type MainserverProjectionMutationOperation = 'create' | 'update' | 'delete';

const logger = createSdkLogger({
  component: 'mainserver-projection-refresh',
  level: 'info',
});

const mainserverCollectionSegments = new Set([
  'news',
  'events',
  'poi',
  'generic-items',
  'surveys',
]);

const shouldRefreshProjectionForRequest = (request: Request, response: Response): boolean =>
  response.ok &&
  request.method !== 'GET' &&
  request.method !== 'HEAD' &&
  request.method !== 'OPTIONS';

const parseMutationOperation = (
  request: Request
): MainserverProjectionMutationOperation | null =>
  request.method === 'POST'
    ? 'create'
    : request.method === 'PUT' || request.method === 'PATCH'
      ? 'update'
      : request.method === 'DELETE'
        ? 'delete'
        : null;

const parseEntityIdFromRequestPath = (request: Request): string | undefined => {
  const segments = new URL(request.url).pathname
    .split('/')
    .filter((segment) => segment.length > 0);
  const mainserverIndex = segments.findIndex((segment) => segment === 'mainserver');
  if (mainserverIndex < 0) {
    return undefined;
  }

  const collectionSegment = segments[mainserverIndex + 1];
  if (!collectionSegment || !mainserverCollectionSegments.has(collectionSegment)) {
    return undefined;
  }

  const entityIdSegment = segments[mainserverIndex + 2];
  return entityIdSegment && entityIdSegment.length > 0 ? entityIdSegment : undefined;
};

const parseEntityIdFromResponse = async (response: Response): Promise<string | undefined> => {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return undefined;
  }

  const payload = (await response.clone().json().catch(() => null)) as
    | { data?: { id?: unknown } }
    | null;
  return typeof payload?.data?.id === 'string' && payload.data.id.length > 0
    ? payload.data.id
    : undefined;
};

export const refreshProjectionAfterMainserverMutation = async (
  request: Request,
  response: Response,
  contentType: MainserverProjectionContentType
): Promise<void> => {
  if (!shouldRefreshProjectionForRequest(request, response)) {
    return;
  }

  const operation = parseMutationOperation(request);
  const entityIdFromPath = parseEntityIdFromRequestPath(request);
  const entityIdFromResponse = await parseEntityIdFromResponse(response);
  const entityId = entityIdFromResponse ?? entityIdFromPath;

  await withAuthenticatedUser(request, async (ctx) => {
    if (!ctx.user.instanceId) {
      return response;
    }

    let actorAccountId: string | undefined;
    try {
      actorAccountId = await withInstanceScopedDb(ctx.user.instanceId, async (client) =>
        resolveActorAccountId(client, {
          instanceId: ctx.user.instanceId!,
          keycloakSubject: ctx.user.id,
        })
      );
    } catch (error) {
      logger.warn('Skipped mainserver mutation projection refresh because actor account resolution failed', {
        instanceId: ctx.user.instanceId,
        keycloakSubject: ctx.user.id,
        contentType,
        method: request.method,
        error: error instanceof Error ? error.message : String(error),
      });
      return response;
    }

    if (!actorAccountId) {
      logger.warn('Skipped mainserver mutation projection refresh because actor account resolution returned no account', {
        instanceId: ctx.user.instanceId,
        keycloakSubject: ctx.user.id,
        contentType,
        method: request.method,
      });
      return response;
    }

    await refreshProjectedContentsForMainserverMutation({
      instanceId: ctx.user.instanceId,
      keycloakSubject: ctx.user.id,
      contentType,
      actorAccountId,
      ...(ctx.activeOrganizationId ? { organizationId: ctx.activeOrganizationId } : {}),
      ...(operation ? { operation } : {}),
      ...(entityId ? { entityId } : {}),
    });

    return response;
  });
};
