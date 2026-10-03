import { withAuthenticatedUser, type AuthenticatedRequestContext } from '@sva/auth-runtime/server';
import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';

import { errorJson, isResponse, json, matchRequestRoute } from './content-route-core.js';
import { withMainserverContextBinding } from './content-route-context.js';
import { isUnexpectedMainserverError, SvaMainserverError } from './errors.js';
import {
  deleteSvaMainserverPoi,
  getSvaMainserverPoiDetail,
  updateSvaMainserverPoi,
} from './service.js';
import { toMainserverErrorResponse } from './mainserver-error-response.js';
import {
  authorizeMutation,
  contentTypeFor,
  handleCollectionRead,
  handleItemRead,
  POI_CONTENT_TYPE,
  type RouteMatch,
} from './poi-route-access.js';
import { createPoiContent, parsePoiInput } from './poi-route-input.js';
import {
  authorizeMainserverExistingContent,
  finalizeMainserverMutation,
  runMainserverMutationWithFailureFinalization,
  resolveMainserverVisibilityAction,
  toMainserverAdditionalActions,
} from './mutation-principal.js';

const POI_COLLECTION_PATH = '/api/v1/mainserver/poi';
const logger = createSdkLogger({ component: 'sva-mainserver-poi-route', level: 'info' });

const matchRoute = (request: Request): RouteMatch | null =>
  matchRequestRoute(request, POI_COLLECTION_PATH, 'poi');

const handleCollectionCreate = async (
  request: Request,
  route: Extract<RouteMatch, { readonly kind: 'collection' }>,
  ctx: AuthenticatedRequestContext,
  requestId: string | undefined,
  logSuccess: (operation: string, contentId?: string) => void
) => {
  const actor = await authorizeMutation(request, ctx, route.contentKind, 'create', requestId);
  if (isResponse(actor)) {
    return actor;
  }

  return runMainserverMutationWithFailureFinalization({
    actor,
    operation: async () => {
      const result = await createPoiContent(request, actor);
      if (isResponse(result)) {
        return result;
      }

      logSuccess(`mainserver_${route.contentKind}_create`, result.data.id);
      return json(result, 201);
    },
  });
};

const handleItemUpdate = async (
  request: Request,
  route: Extract<RouteMatch, { readonly kind: 'item' }>,
  ctx: AuthenticatedRequestContext,
  requestId: string | undefined,
  logSuccess: (operation: string, contentId?: string) => void
) => {
  const actor = await authorizeMutation(
    request,
    ctx,
    route.contentKind,
    'update',
    requestId,
    route.itemId
  );
  if (isResponse(actor)) {
    return actor;
  }

  return runMainserverMutationWithFailureFinalization({
    actor,
    contentId: route.itemId,
    operation: async () => {
      const parsed = await parsePoiInput(request);
      if (isResponse(parsed)) {
        return parsed;
      }

      const existing = await getSvaMainserverPoiDetail({ ...actor, poiId: route.itemId });
      const providerAuthorization = await authorizeMainserverExistingContent({
        actor,
        action: 'poi.update',
        contentType: POI_CONTENT_TYPE,
        contentId: route.itemId,
        item: existing?.data,
        additionalActions: existing?.data
          ? toMainserverAdditionalActions(
              resolveMainserverVisibilityAction(existing.data.visible, parsed.active)
            )
          : [],
      });
      if (isResponse(providerAuthorization)) return providerAuthorization;
      const result = {
        data: await updateSvaMainserverPoi({ ...actor, poiId: route.itemId, poi: parsed }),
      };
      await finalizeMainserverMutation({
        actor,
        providerOutcome: 'succeeded',
        reconciliationStatus: 'complete',
        completedSteps: ['provider_write'],
        contentId: route.itemId,
        observedDataProviderId: existing?.data?.dataProvider?.id,
      });

      logSuccess(`mainserver_${route.contentKind}_update`, route.itemId);
      return json(result);
    },
  });
};

const handleItemDelete = async (
  request: Request,
  route: Extract<RouteMatch, { readonly kind: 'item' }>,
  ctx: AuthenticatedRequestContext,
  requestId: string | undefined,
  logSuccess: (operation: string, contentId?: string) => void
) => {
  const actor = await authorizeMutation(
    request,
    ctx,
    route.contentKind,
    'delete',
    requestId,
    route.itemId
  );
  if (isResponse(actor)) {
    return actor;
  }

  return runMainserverMutationWithFailureFinalization({
    actor,
    contentId: route.itemId,
    operation: async () => {
      const existing = await getSvaMainserverPoiDetail({ ...actor, poiId: route.itemId });
      const providerAuthorization = await authorizeMainserverExistingContent({
        actor,
        action: 'poi.delete',
        contentType: POI_CONTENT_TYPE,
        contentId: route.itemId,
        item: existing?.data,
      });
      if (isResponse(providerAuthorization)) return providerAuthorization;
      const data = await deleteSvaMainserverPoi({ ...actor, poiId: route.itemId });
      await finalizeMainserverMutation({
        actor,
        providerOutcome: 'succeeded',
        reconciliationStatus: 'complete',
        completedSteps: ['provider_write', 'tombstone'],
        contentId: route.itemId,
        observedDataProviderId: existing?.data?.dataProvider?.id,
      });
      logSuccess(`mainserver_${route.contentKind}_delete`, route.itemId);
      return json({ data });
    },
  });
};

const dispatchAuthenticated = async (
  request: Request,
  route: RouteMatch,
  ctx: AuthenticatedRequestContext
) => {
  const workspaceContext = getWorkspaceContext();
  const logSuccess = (operation: string, contentId?: string) => {
    const logSuccessEvent = request.method === 'GET' ? logger.debug : logger.info;
    logSuccessEvent('Mainserver content route succeeded', {
      operation,
      request_id: workspaceContext.requestId,
      trace_id: workspaceContext.traceId,
      actor_id: ctx.user.id,
      instance_id: ctx.user.instanceId,
      content_type: contentTypeFor(route.contentKind),
      content_id: contentId,
      method: request.method,
    });
  };

  try {
    if (route.kind === 'collection' && request.method === 'GET') {
      return await handleCollectionRead(request, route, ctx, logSuccess);
    }

    if (route.kind === 'item' && request.method === 'GET') {
      return withMainserverContextBinding(
        await handleItemRead(request, route, ctx, logSuccess),
        ctx
      );
    }

    if (route.kind === 'collection' && request.method === 'POST') {
      return await handleCollectionCreate(
        request,
        route,
        ctx,
        workspaceContext.requestId,
        logSuccess
      );
    }

    if (route.kind === 'item' && request.method === 'PATCH') {
      return await handleItemUpdate(request, route, ctx, workspaceContext.requestId, logSuccess);
    }

    if (route.kind === 'item' && request.method === 'DELETE') {
      return await handleItemDelete(request, route, ctx, workspaceContext.requestId, logSuccess);
    }

    return errorJson(
      405,
      'method_not_allowed',
      'Methode wird für diesen Mainserver-Inhalt nicht unterstützt.'
    );
  } catch (error) {
    const logFailure = isUnexpectedMainserverError(error) ? logger.error : logger.warn;
    logFailure('Mainserver content route failed', {
      operation: 'mainserver_content_request',
      request_id: workspaceContext.requestId,
      trace_id: workspaceContext.traceId,
      actor_id: ctx.user.id,
      instance_id: ctx.user.instanceId,
      content_type: contentTypeFor(route.contentKind),
      content_id: route.kind === 'item' ? route.itemId : undefined,
      method: request.method,
      error_code: error instanceof SvaMainserverError ? error.code : 'internal_error',
    });
    return toMainserverErrorResponse(error, 'Mainserver-Anfrage ist fehlgeschlagen.');
  }
};

export const dispatchSvaMainserverPoiRequest = async (
  request: Request
): Promise<Response | null> => {
  const route = matchRoute(request);
  if (!route) {
    return null;
  }

  return withAuthenticatedUser(request, (ctx) => dispatchAuthenticated(request, route, ctx));
};
