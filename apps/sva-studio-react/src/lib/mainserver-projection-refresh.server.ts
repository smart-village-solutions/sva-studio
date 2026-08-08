import { loadMainserverMutationJournal } from '@sva/auth-runtime/server';
import { readMainserverMutationFollowUpContext } from '@sva/sva-mainserver/server';
import { createSdkLogger } from '@sva/server-runtime';

import { refreshProjectedContentsForMainserverMutation } from './iam-content-list-projection.server.js';

type MainserverProjectionContentType =
  | 'news.article'
  | 'events.event-record'
  | 'poi.point-of-interest'
  | 'generic-items.generic-item'
  | 'faq.faq'
  | 'cockpit-cards.cockpit-card'
  | 'projects.project'
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
  'faqs',
  'cockpit-cards',
  'projects',
  'surveys',
]);

const shouldRefreshProjectionForRequest = (request: Request, response: Response): boolean =>
  response.ok &&
  request.method !== 'GET' &&
  request.method !== 'HEAD' &&
  request.method !== 'OPTIONS';

const parseMutationOperation = (request: Request): MainserverProjectionMutationOperation | null =>
  request.method === 'POST'
    ? 'create'
    : request.method === 'PUT' || request.method === 'PATCH'
      ? 'update'
      : request.method === 'DELETE'
        ? 'delete'
        : null;

const parseEntityIdFromRequestPath = (request: Request): string | undefined => {
  const segments = new URL(request.url).pathname.split('/').filter((segment) => segment.length > 0);
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
  const providerEntityId = response.headers.get('x-sva-mainserver-entity-id')?.trim();
  if (providerEntityId) return providerEntityId;
  const location = response.headers.get('location');
  if (location) {
    const locationSegments = new URL(location, 'https://studio.invalid').pathname
      .split('/')
      .filter(Boolean);
    const locationId = locationSegments.at(-1);
    if (locationId) return decodeURIComponent(locationId);
  }
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return undefined;
  }

  const payload = (await response
    .clone()
    .json()
    .catch(() => null)) as { data?: { id?: unknown }; id?: unknown } | null;
  const id = payload?.data?.id ?? payload?.id;
  return typeof id === 'string' && id.length > 0 ? id : undefined;
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
  const providerEntityId = response.headers.get('x-sva-mainserver-entity-id')?.trim();
  const entityId = providerEntityId || entityIdFromPath || entityIdFromResponse;
  if ((operation === 'create' || operation === 'update') && !entityId) {
    logger.warn('Mainserver mutation succeeded without a resolvable entity identity', {
      contentType,
      method: request.method,
      requestPath: new URL(request.url).pathname,
    });
    return;
  }

  const followUpContext = readMainserverMutationFollowUpContext(request);
  if (!followUpContext) {
    logger.warn(
      'Skipped Mainserver mutation projection refresh without a bound principal context',
      {
        contentType,
        method: request.method,
        entityId: entityId ?? null,
      }
    );
    return;
  }

  try {
    const journal = await loadMainserverMutationJournal({
      instanceId: followUpContext.instanceId,
      operationExternalId: followUpContext.operationExternalId,
    });
    await refreshProjectedContentsForMainserverMutation({
      instanceId: followUpContext.instanceId,
      keycloakSubject: followUpContext.keycloakSubject,
      contentType,
      actorAccountId: followUpContext.actorAccountId,
      actorDisplayName: followUpContext.actorDisplayName,
      mutationRef: followUpContext.operationExternalId,
      actingPrincipalType: followUpContext.actingPrincipalType,
      credentialFingerprint: followUpContext.credentialFingerprint,
      authorizationMode: journal?.authorizationMode ?? 'credential_visible_compatibility',
      ...(followUpContext.activeOrganizationId
        ? { organizationId: followUpContext.activeOrganizationId }
        : {}),
      ...(operation ? { operation } : {}),
      ...(entityId ? { entityId } : {}),
    });
  } catch (error) {
    logger.warn('Mainserver mutation projection refresh failed after a successful provider write', {
      instanceId: followUpContext.instanceId,
      contentType,
      method: request.method,
      entityId: entityId ?? null,
      operationExternalId: followUpContext.operationExternalId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
