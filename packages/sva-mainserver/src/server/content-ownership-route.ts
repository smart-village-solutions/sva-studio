import {
  listMainserverOwnershipTargets,
  loadExternalContentReferenceByContentId,
  resolveActorInfo,
  resolveMainserverOwnershipSource,
  withAuthenticatedUser,
  type AuthenticatedRequestContext,
  type ResolvedMainserverOwnershipSource,
} from '@sva/auth-runtime/server';
import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';

import type { SvaMainserverProjectionContentType } from '../types.js';
import { errorJson, isResponse, json } from './content-route-core.js';
import {
  loadOwnershipItem,
  matchesOwnershipContentType,
  toOwnershipTransferContent,
  type ContentOwnershipRouteMatch,
  type SupportedContentOwnershipRouteMatch,
} from './content-ownership-route-contract.js';
import { handleContentOwnershipTransfer } from './content-ownership-transfer-route.js';
import { SvaMainserverError } from './errors.js';
import { toMainserverErrorResponse } from './mainserver-error-response.js';
import { isMainserverMutationCapabilityEnabled } from './mainserver-mutation-capabilities.js';
import {
  resolveMainserverMutationActor,
  resolveMainserverResourceAccess,
  type MainserverMutationActor,
} from './mutation-principal.js';
import { projectSourceReferenceInput } from './projects-route-transport.js';

const routePrefix = '/api/v1/mainserver/content-ownership/';
const logger = createSdkLogger({
  component: 'sva-mainserver-content-ownership-route',
  level: 'info',
});
const supportedContentTypes = new Set<SvaMainserverProjectionContentType>([
  'news.article',
  'events.event-record',
  'poi.point-of-interest',
  'generic-items.generic-item',
  'faq.faq',
  'cockpit-cards.cockpit-card',
  'projects.project',
  'surveys.survey',
]);

const isProjectionContentType = (value: string): value is SvaMainserverProjectionContentType =>
  supportedContentTypes.has(value as SvaMainserverProjectionContentType);

const matchRoute = (request: Request): ContentOwnershipRouteMatch | null => {
  const pathname = new URL(request.url).pathname;
  if (!pathname.startsWith(routePrefix)) return null;
  const segments = pathname.slice(routePrefix.length).split('/');
  if (segments.length !== 3) return null;
  const [encodedContentType, encodedContentId, operation] = segments;
  let contentType: string;
  let contentId: string;
  try {
    contentType = decodeURIComponent(encodedContentType ?? '');
    contentId = decodeURIComponent(encodedContentId ?? '');
  } catch {
    return null;
  }
  return isProjectionContentType(contentType) &&
    contentId.length > 0 &&
    (operation === 'authorization' || operation === 'targets' || operation === 'transfer')
    ? { contentType, contentId, operation }
    : null;
};

const resolveActor = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<MainserverMutationActor | Response> => {
  const resolution = await resolveActorInfo(request, ctx, { requireActorMembership: true });
  if ('error' in resolution) return resolution.error;
  return resolveMainserverMutationActor({
    request,
    ctx,
    authorizedActor: {
      instanceId: resolution.actor.instanceId,
      keycloakSubject: ctx.user.id,
      ...(ctx.activeOrganizationId ? { activeOrganizationId: ctx.activeOrganizationId } : {}),
    },
  });
};

const handleTargets = async (
  request: Request,
  route: ContentOwnershipRouteMatch,
  actor: MainserverMutationActor,
  source: ResolvedMainserverOwnershipSource
): Promise<Response> => {
  const url = new URL(request.url);
  const type = url.searchParams.get('type') ?? 'account';
  if (type !== 'account' && type !== 'organization') {
    return errorJson(400, 'invalid_request', 'Zielinhabertyp ist ungültig.');
  }
  const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const pageSize = Math.min(
    50,
    Math.max(1, Number.parseInt(url.searchParams.get('pageSize') ?? '10', 10) || 10)
  );
  const search = url.searchParams.get('q')?.trim() || undefined;
  const result = await listMainserverOwnershipTargets({
    instanceId: actor.instanceId,
    actorKeycloakSubject: actor.keycloakSubject,
    type,
    page,
    pageSize,
    ...(search ? { search } : {}),
    currentOwner: source.principal,
    currentDataProviderId: source.dataProviderId,
  });
  return json({
    data: result.items,
    pagination: { page: result.page, pageSize: result.pageSize, total: result.total },
    contentType: route.contentType,
    currentOwner: {
      principal: source.principal,
      displayName: source.dataProviderName ?? source.dataProviderId,
    },
  });
};

const handleAuthorizedTargets = async (
  request: Request,
  route: SupportedContentOwnershipRouteMatch,
  actor: MainserverMutationActor,
  content: ReturnType<typeof toOwnershipTransferContent>
): Promise<Response> => {
  const current = await loadOwnershipItem(actor, content);
  if (!matchesOwnershipContentType(route.contentType, current)) {
    return errorJson(404, 'not_found', 'Inhalt wurde nicht gefunden.');
  }
  const dataProviderId = current.dataProvider?.id?.trim();
  if (!dataProviderId)
    return errorJson(
      409,
      'content_transfer_source_changed',
      'Der aktuelle Inhaber ist nicht eindeutig.'
    );
  const source = await resolveMainserverOwnershipSource({
    instanceId: actor.instanceId,
    dataProviderId,
  });
  if (!source)
    return errorJson(
      409,
      'content_transfer_source_changed',
      'Die aktive Principal-Bindung ist nicht eindeutig.'
    );
  const access = await resolveMainserverResourceAccess({
    actor,
    actions: ['content.transferOwnership'],
    contentType: route.contentType,
    contentId: route.contentId,
    item: current,
  });
  return access['content.transferOwnership'] === true
    ? route.operation === 'authorization'
      ? json({
          data: { canTransfer: true },
          currentOwner: {
            principal: source.principal,
            displayName: source.dataProviderName ?? source.dataProviderId,
          },
        })
      : handleTargets(request, route, actor, source)
    : errorJson(403, 'content_transfer_permission_missing', 'Die Transferberechtigung fehlt.');
};

const dispatchAuthenticated = async (
  request: Request,
  route: ContentOwnershipRouteMatch,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  if (route.contentType === 'surveys.survey') {
    return errorJson(
      409,
      'content_transfer_type_unsupported',
      'Dieser Inhaltstyp unterstützt noch keinen Transfer.'
    );
  }
  if (!isMainserverMutationCapabilityEnabled('content.transferOwnership')) {
    return errorJson(
      409,
      'content_transfer_type_unsupported',
      'Der Mainserver-Vertrag für Inhaberübertragungen ist nicht bestätigt.'
    );
  }
  const supportedRoute: SupportedContentOwnershipRouteMatch = {
    ...route,
    contentType: route.contentType,
  };
  const actor = await resolveActor(request, ctx);
  if (isResponse(actor)) return actor;
  const providerContentId =
    supportedRoute.contentType === 'projects.project'
      ? ((
          await loadExternalContentReferenceByContentId({
            ...projectSourceReferenceInput(actor.instanceId),
            contentId: route.contentId,
          }).catch(() => undefined)
        )?.sourceEntityId ?? route.contentId)
      : supportedRoute.contentId;
  const content = toOwnershipTransferContent(supportedRoute.contentType, providerContentId);
  try {
    return supportedRoute.operation === 'transfer'
      ? handleContentOwnershipTransfer(request, supportedRoute, actor, content)
      : handleAuthorizedTargets(request, supportedRoute, actor, content);
  } catch (error) {
    const context = getWorkspaceContext();
    logger.warn('Mainserver content ownership route failed', {
      operation: 'mainserver_content_ownership',
      request_id: context.requestId,
      trace_id: context.traceId,
      instance_id: actor.instanceId,
      content_type: route.contentType,
      content_id: route.contentId,
      route_operation: route.operation,
      error_code: error instanceof SvaMainserverError ? error.code : 'internal_error',
      error_message: error instanceof Error ? error.message : String(error),
    });
    return toMainserverErrorResponse(error, 'Die Inhaberübertragung ist fehlgeschlagen.');
  }
};

export const dispatchSvaMainserverContentOwnershipRequest = async (
  request: Request
): Promise<Response | null> => {
  const route = matchRoute(request);
  if (!route) return null;
  const methodAllowed =
    ((route.operation === 'authorization' || route.operation === 'targets') &&
      request.method === 'GET') ||
    (route.operation === 'transfer' && request.method === 'POST');
  if (!methodAllowed)
    return errorJson(405, 'method_not_allowed', 'HTTP-Methode wird nicht unterstützt.');
  return withAuthenticatedUser(request, (ctx) => dispatchAuthenticated(request, route, ctx));
};
