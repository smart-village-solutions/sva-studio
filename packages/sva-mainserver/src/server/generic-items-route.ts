import {
  authorizeContentPrimitiveForUser,
  validateCsrf,
  withAuthenticatedUser,
  type AuthenticatedRequestContext,
} from '@sva/auth-runtime/server';
import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';

import type {
  SvaMainserverGenericItemInput,
} from '../types.js';
import {
  errorJson,
  isResponse,
  json,
  matchRequestRoute,
  type RouteMatch as SharedRouteMatch,
} from './content-route-core.js';
import { SvaMainserverError } from './errors.js';
import { parseGenericItemInput } from './generic-items-route-input.js';
import { parseMainserverListQuery } from './list-pagination.js';
import { toMainserverErrorResponse } from './mainserver-error-response.js';
import {
  createSvaMainserverGenericItem,
  deleteSvaMainserverGenericItem,
  getSvaMainserverGenericItem,
  listSvaMainserverGenericItems,
  updateSvaMainserverGenericItem,
} from './service.js';

const GENERIC_ITEMS_CONTENT_TYPE = 'generic-items.generic-item';
const GENERIC_ITEMS_COLLECTION_PATH = '/api/v1/mainserver/generic-items';
const logger = createSdkLogger({ component: 'sva-mainserver-generic-items-route', level: 'info' });

type ContentKind = 'generic-items';

type ContentActor = {
  readonly instanceId: string;
  readonly keycloakSubject: string;
  readonly activeOrganizationId?: string;
};

type RouteMatch = SharedRouteMatch<ContentKind>;

const matchRoute = (request: Request): RouteMatch | null =>
  matchRequestRoute(request, GENERIC_ITEMS_COLLECTION_PATH, 'generic-items');

const validateMutationRequest = (request: Request, requestId?: string): Response | null => {
  const csrfError = validateCsrf(request, requestId);
  return csrfError ? errorJson(403, 'csrf_validation_failed', 'Sicherheitsprüfung fehlgeschlagen.') : null;
};

const pluginActionFor = (actionName: 'read' | 'create' | 'update' | 'delete') => `generic-items.${actionName}`;

const authorizeOrResponse = async (
  ctx: AuthenticatedRequestContext,
  action: string,
  contentId?: string
): Promise<ContentActor | Response> => {
  const result = await authorizeContentPrimitiveForUser({
    ctx,
    action,
    resource: {
      contentType: GENERIC_ITEMS_CONTENT_TYPE,
      ...(contentId ? { contentId } : {}),
    },
  });

  if (!result.ok) {
    const workspaceContext = getWorkspaceContext();
    logger.warn('Mainserver generic items local authorization denied', {
      operation: 'mainserver_content_authorize',
      request_id: workspaceContext.requestId,
      trace_id: workspaceContext.traceId,
      actor_id: ctx.user.id,
      instance_id: ctx.user.instanceId,
      content_type: GENERIC_ITEMS_CONTENT_TYPE,
      content_id: contentId,
      action,
      error_code: result.error,
    });

    return errorJson(result.status, result.error, result.message);
  }

  return {
    instanceId: result.actor.instanceId,
    keycloakSubject: result.actor.keycloakSubject,
    activeOrganizationId: result.actor.organizationId ?? ctx.activeOrganizationId,
  };
};

const authorizeMutation = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  actionName: 'create' | 'update' | 'delete',
  requestId?: string,
  contentId?: string
): Promise<Response | ContentActor> => {
  const csrfError = validateMutationRequest(request, requestId);
  if (csrfError) {
    return csrfError;
  }

  return authorizeOrResponse(ctx, pluginActionFor(actionName), contentId);
};

const parseGenericItemOrResponse = async (request: Request): Promise<SvaMainserverGenericItemInput | Response> => {
  return parseGenericItemInput(request);
};

const handleListRequest = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  logSuccess: (operation: string, contentId?: string) => void
) => {
  const actor = await authorizeOrResponse(ctx, pluginActionFor('read'));
  if (isResponse(actor)) {
    return actor;
  }

  const includeInvisible = new URL(request.url).searchParams.get('includeInvisible') === 'true';
  const data = await listSvaMainserverGenericItems({
    ...actor,
    ...parseMainserverListQuery(request),
    includeInvisible,
  });
  logSuccess('mainserver_generic-items_list');
  return json(data);
};

const handleDetailRequest = async (
  ctx: AuthenticatedRequestContext,
  itemId: string,
  logSuccess: (operation: string, contentId?: string) => void
) => {
  const actor = await authorizeOrResponse(ctx, pluginActionFor('read'), itemId);
  if (isResponse(actor)) {
    return actor;
  }

  const data = await getSvaMainserverGenericItem({ ...actor, genericItemId: itemId });
  logSuccess('mainserver_generic-items_detail', itemId);
  return json({ data });
};

const handleCreateRequest = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  requestId: string | undefined,
  logSuccess: (operation: string, contentId?: string) => void
) => {
  const actor = await authorizeMutation(request, ctx, 'create', requestId);
  if (isResponse(actor)) {
    return actor;
  }

  const genericItem = await parseGenericItemOrResponse(request);
  if (isResponse(genericItem)) {
    return genericItem;
  }

  const data = await createSvaMainserverGenericItem({ ...actor, genericItem });
  logSuccess('mainserver_generic-items_create', data.id);
  return json({ data }, 201);
};

const handleUpdateRequest = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  requestId: string | undefined,
  itemId: string,
  logSuccess: (operation: string, contentId?: string) => void
) => {
  const actor = await authorizeMutation(request, ctx, 'update', requestId, itemId);
  if (isResponse(actor)) {
    return actor;
  }

  const genericItem = await parseGenericItemOrResponse(request);
  if (isResponse(genericItem)) {
    return genericItem;
  }

  const data = await updateSvaMainserverGenericItem({ ...actor, genericItemId: itemId, genericItem });
  logSuccess('mainserver_generic-items_update', itemId);
  return json({ data });
};

const handleDeleteRequest = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  requestId: string | undefined,
  itemId: string,
  logSuccess: (operation: string, contentId?: string) => void
) => {
  const actor = await authorizeMutation(request, ctx, 'delete', requestId, itemId);
  if (isResponse(actor)) {
    return actor;
  }

  const data = await deleteSvaMainserverGenericItem({ ...actor, genericItemId: itemId });
  logSuccess('mainserver_generic-items_delete', itemId);
  return json({ data });
};

const dispatchAuthenticated = async (request: Request, route: RouteMatch, ctx: AuthenticatedRequestContext) => {
  const workspaceContext = getWorkspaceContext();
  const logSuccess = (operation: string, contentId?: string) => {
    logger.info('Mainserver generic items route succeeded', {
      operation,
      request_id: workspaceContext.requestId,
      trace_id: workspaceContext.traceId,
      actor_id: ctx.user.id,
      instance_id: ctx.user.instanceId,
      content_type: GENERIC_ITEMS_CONTENT_TYPE,
      content_id: contentId,
      method: request.method,
    });
  };

  try {
    if (route.kind === 'collection' && request.method === 'GET') {
      return await handleListRequest(request, ctx, logSuccess);
    }

    if (route.kind === 'item' && request.method === 'GET') {
      return await handleDetailRequest(ctx, route.itemId, logSuccess);
    }

    if (route.kind === 'collection' && request.method === 'POST') {
      return await handleCreateRequest(request, ctx, workspaceContext.requestId, logSuccess);
    }

    if (route.kind === 'item' && request.method === 'PATCH') {
      return await handleUpdateRequest(request, ctx, workspaceContext.requestId, route.itemId, logSuccess);
    }

    if (route.kind === 'item' && request.method === 'DELETE') {
      return await handleDeleteRequest(request, ctx, workspaceContext.requestId, route.itemId, logSuccess);
    }

    return errorJson(405, 'method_not_allowed', 'Methode wird für diesen Mainserver-Inhalt nicht unterstützt.');
  } catch (error) {
    logger.warn('Mainserver generic items route failed', {
      operation: 'mainserver_content_request',
      request_id: workspaceContext.requestId,
      trace_id: workspaceContext.traceId,
      actor_id: ctx.user.id,
      instance_id: ctx.user.instanceId,
      content_type: GENERIC_ITEMS_CONTENT_TYPE,
      content_id: route.kind === 'item' ? route.itemId : undefined,
      method: request.method,
      error_code: error instanceof SvaMainserverError ? error.code : 'internal_error',
    });

    return toMainserverErrorResponse(error, 'Mainserver-Anfrage ist fehlgeschlagen.');
  }
};

export const dispatchSvaMainserverGenericItemsRequest = async (request: Request): Promise<Response | null> => {
  const route = matchRoute(request);
  if (!route) {
    return null;
  }

  return withAuthenticatedUser(request, (ctx) => dispatchAuthenticated(request, route, ctx));
};
