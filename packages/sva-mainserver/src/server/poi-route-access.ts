import {
  authorizeContentPrimitiveForUser,
  validateCsrf,
  type AuthenticatedRequestContext,
} from '@sva/auth-runtime/server';
import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';

import {
  errorJson,
  isResponse,
  json,
  type RouteMatch as SharedRouteMatch,
} from './content-route-core.js';
import { MAINSERVER_ACTING_PRINCIPAL_HEADER } from './content-route-context.js';
import { parseMainserverListQuery } from './list-pagination.js';
import { getSvaMainserverPoiDetail, listSvaMainserverPoi } from './service.js';
import {
  resolveMainserverMutationActor,
  resolveMainserverResourceAccess,
  resolveMainserverResourceActor,
  type MainserverMutationActor,
} from './mutation-principal.js';

export const POI_CONTENT_TYPE = 'poi.point-of-interest';
const logger = createSdkLogger({ component: 'sva-mainserver-poi-route', level: 'info' });

type ContentKind = 'poi';
type ContentActor = {
  readonly instanceId: string;
  readonly keycloakSubject: string;
  readonly activeOrganizationId?: string;
};
export type RouteMatch = SharedRouteMatch<ContentKind>;

const validateMutationRequest = (request: Request, requestId?: string): Response | null => {
  const csrfError = validateCsrf(request, requestId);
  return csrfError
    ? errorJson(403, 'csrf_validation_failed', 'Sicherheitsprüfung fehlgeschlagen.')
    : null;
};

export const contentTypeFor = (_contentKind: ContentKind) => POI_CONTENT_TYPE;
const pluginActionFor = (
  contentKind: ContentKind,
  actionName: 'read' | 'create' | 'update' | 'delete'
) => `${contentKind}.${actionName}`;

const authorizeOrResponse = async (
  ctx: AuthenticatedRequestContext,
  contentKind: ContentKind,
  action: string,
  contentId?: string,
  credentialVisibleRead = true
): Promise<ContentActor | Response> => {
  const result = await authorizeContentPrimitiveForUser({
    ctx,
    action,
    resource: {
      contentType: contentTypeFor(contentKind),
      ...(contentId ? { contentId } : {}),
    },
    credentialVisibleCompatibility:
      action !== 'poi.read' || (Boolean(contentId) && credentialVisibleRead),
  });
  if (!result.ok) {
    const workspaceContext = getWorkspaceContext();
    logger.warn('Mainserver content local authorization denied', {
      operation: 'mainserver_content_authorize',
      request_id: workspaceContext.requestId,
      trace_id: workspaceContext.traceId,
      actor_id: ctx.user.id,
      instance_id: ctx.user.instanceId,
      content_type: contentTypeFor(contentKind),
      content_id: contentId,
      action,
      error_code: result.error,
    });
    return errorJson(result.status, result.error, result.message, result.permissionDenial);
  }
  return {
    instanceId: result.actor.instanceId,
    keycloakSubject: result.actor.keycloakSubject,
    activeOrganizationId: result.actor.organizationId ?? ctx.activeOrganizationId,
  };
};

export const handleCollectionRead = async (
  request: Request,
  route: Extract<RouteMatch, { readonly kind: 'collection' }>,
  ctx: AuthenticatedRequestContext,
  logSuccess: (operation: string, contentId?: string) => void
) => {
  const actor = await authorizeOrResponse(
    ctx,
    route.contentKind,
    pluginActionFor(route.contentKind, 'read')
  );
  if (isResponse(actor)) {
    return actor;
  }

  const data = await listSvaMainserverPoi({ ...actor, ...parseMainserverListQuery(request) });
  logSuccess(`mainserver_${route.contentKind}_list`);
  return json(data);
};

export const handleItemRead = async (
  request: Request,
  route: Extract<RouteMatch, { readonly kind: 'item' }>,
  ctx: AuthenticatedRequestContext,
  logSuccess: (operation: string, contentId?: string) => void
) => {
  const actor = await authorizeOrResponse(
    ctx,
    route.contentKind,
    pluginActionFor(route.contentKind, 'read'),
    route.itemId,
    request.headers.has(MAINSERVER_ACTING_PRINCIPAL_HEADER)
  );
  if (isResponse(actor)) {
    return actor;
  }

  const resourceActor = await resolveMainserverResourceActor({
    request,
    ctx,
    authorizedActor: actor,
  });
  const detail = await getSvaMainserverPoiDetail({
    ...(resourceActor ?? actor),
    poiId: route.itemId,
  });
  const access = resourceActor
    ? await resolveMainserverResourceAccess({
        actor: resourceActor,
        actions: [
          `${route.contentKind}.read`,
          `${route.contentKind}.update`,
          `${route.contentKind}.delete`,
          'content.publish',
          'content.changeStatus',
        ],
        contentType: POI_CONTENT_TYPE,
        item: detail.data,
        forceExactScopeActions: [`${route.contentKind}.read`],
      })
    : {};
  if (
    (resourceActor && !access[`${route.contentKind}.read`]) ||
    (!resourceActor && request.headers.has(MAINSERVER_ACTING_PRINCIPAL_HEADER))
  ) {
    const exactRead = await authorizeOrResponse(
      ctx,
      route.contentKind,
      `${route.contentKind}.read`,
      route.itemId,
      false
    );
    if (isResponse(exactRead)) return exactRead;
  }
  for (const deviation of detail.deviations) {
    logger.warn('Mainserver detail response degraded', {
      operation: 'mainserver_poi_detail',
      instance_id: actor.instanceId,
      content_type: POI_CONTENT_TYPE,
      content_id: route.itemId,
      phase: deviation.phase,
      field_path: deviation.fieldPath,
      deviation_code: deviation.code,
      handling: deviation.handling,
    });
  }
  logSuccess(`mainserver_${route.contentKind}_detail`, route.itemId);
  return json({
    data: detail.data,
    meta: { deviations: detail.deviations, ...(resourceActor ? { access } : {}) },
  });
};

export const authorizeMutation = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  contentKind: ContentKind,
  actionName: 'create' | 'update' | 'delete',
  requestId?: string,
  contentId?: string
): Promise<Response | MainserverMutationActor> => {
  const csrfError = validateMutationRequest(request, requestId);
  if (csrfError) {
    return csrfError;
  }

  const authorizedActor = await authorizeOrResponse(
    ctx,
    contentKind,
    pluginActionFor(contentKind, actionName),
    contentId
  );
  if (isResponse(authorizedActor)) {
    return authorizedActor;
  }
  return resolveMainserverMutationActor({ request, ctx, authorizedActor });
};
