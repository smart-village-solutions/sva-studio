import {
  authorizeContentPrimitiveForUser,
  validateCsrf,
  withAuthenticatedUser,
  type AuthenticatedRequestContext,
} from '@sva/auth-runtime/server';
import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';

import type { SvaMainserverGenericItemInput } from '../types.js';
import {
  errorJson,
  isResponse,
  json,
  matchRequestRoute,
  type RouteMatch as SharedRouteMatch,
} from './content-route-core.js';
import { withMainserverContextBinding } from './content-route-context.js';
import { SvaMainserverError } from './errors.js';
import { mergeFaqPayload, validateFaqWriteOrResponse } from './generic-items-route-faq.js';
import {
  mergeCockpitCardPayload,
  validateCockpitCardWriteOrResponse,
} from './generic-items-route-cockpit-cards.js';
import { parseGenericItemInput } from './generic-items-route-input.js';
import { listFaqItems } from './faq-listing.js';
import { listCockpitCardItems } from './cockpit-cards-listing.js';
import { parseMainserverListQuery } from './list-pagination.js';
import { toMainserverErrorResponse } from './mainserver-error-response.js';
import {
  authorizeMainserverCreateForPrincipal,
  authorizeMainserverExistingContent,
  finalizeMainserverMutation,
  recordCreatedMainserverDataProvider,
  runMainserverMutationWithFailureFinalization,
  resolveMainserverVisibilityAction,
  resolveMainserverMutationActor,
  toMainserverAdditionalActions,
  type MainserverMutationActor,
} from './mutation-principal.js';
import {
  createSvaMainserverGenericItem,
  deleteSvaMainserverGenericItem,
  getSvaMainserverGenericItem,
  listSvaMainserverGenericItems,
  updateSvaMainserverGenericItem,
} from './service.js';
import { dispatchSvaMainserverProjectsRequest } from './projects-route.js';

const GENERIC_ITEMS_CONTENT_TYPE = 'generic-items.generic-item';
const GENERIC_ITEMS_COLLECTION_PATH = '/api/v1/mainserver/generic-items';
const FAQ_CONTENT_TYPE = 'faq.faq';
const FAQ_COLLECTION_PATH = '/api/v1/mainserver/faqs';
const COCKPIT_CARDS_CONTENT_TYPE = 'cockpit-cards.cockpit-card';
const COCKPIT_CARDS_COLLECTION_PATH = '/api/v1/mainserver/cockpit-cards';
const logger = createSdkLogger({ component: 'sva-mainserver-generic-items-route', level: 'info' });

const withoutEditorialAuthor = (
  genericItem: SvaMainserverGenericItemInput
): SvaMainserverGenericItemInput => {
  const { author, ...genericItemWithoutAuthor } = genericItem;
  void author;
  return genericItemWithoutAuthor;
};

const preserveEditorialAuthor = (
  genericItem: SvaMainserverGenericItemInput,
  existing: { readonly author?: string } | null | undefined
): SvaMainserverGenericItemInput => ({
  ...withoutEditorialAuthor(genericItem),
  ...(existing?.author ? { author: existing.author } : {}),
});

type ContentKind = 'generic-items' | 'faq' | 'cockpit-cards';

type ContentActor = {
  readonly instanceId: string;
  readonly keycloakSubject: string;
  readonly activeOrganizationId?: string;
};

type RouteMatch = SharedRouteMatch<ContentKind>;

const matchRoute = (request: Request): RouteMatch | null =>
  matchRequestRoute(request, GENERIC_ITEMS_COLLECTION_PATH, 'generic-items') ??
  matchRequestRoute(request, FAQ_COLLECTION_PATH, 'faq') ??
  matchRequestRoute(request, COCKPIT_CARDS_COLLECTION_PATH, 'cockpit-cards');

const contentTypeFor = (contentKind: ContentKind) =>
  contentKind === 'faq'
    ? FAQ_CONTENT_TYPE
    : contentKind === 'cockpit-cards'
      ? COCKPIT_CARDS_CONTENT_TYPE
      : GENERIC_ITEMS_CONTENT_TYPE;

const pluginActionFor = (
  contentKind: ContentKind,
  actionName: 'read' | 'create' | 'update' | 'delete'
) => `${contentKind}.${actionName}`;

const validateMutationRequest = (request: Request, requestId?: string): Response | null => {
  const csrfError = validateCsrf(request, requestId);
  return csrfError
    ? errorJson(403, 'csrf_validation_failed', 'Sicherheitsprüfung fehlgeschlagen.')
    : null;
};

const authorizeOrResponse = async (
  ctx: AuthenticatedRequestContext,
  action: string,
  contentType: string,
  contentId?: string
): Promise<ContentActor | Response> => {
  const result = await authorizeContentPrimitiveForUser({
    ctx,
    action,
    resource: {
      contentType,
      ...(contentId ? { contentId } : {}),
    },
    credentialVisibleCompatibility: !action.endsWith('.read'),
  });

  if (!result.ok) {
    const workspaceContext = getWorkspaceContext();
    logger.warn('Mainserver generic items local authorization denied', {
      operation: 'mainserver_content_authorize',
      request_id: workspaceContext.requestId,
      trace_id: workspaceContext.traceId,
      actor_id: ctx.user.id,
      instance_id: ctx.user.instanceId,
      content_type: contentType,
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
    pluginActionFor(contentKind, actionName),
    contentTypeFor(contentKind),
    contentId
  );
  if (isResponse(authorizedActor)) {
    return authorizedActor;
  }
  return resolveMainserverMutationActor({ request, ctx, authorizedActor });
};

const parseGenericItemOrResponse = async (
  request: Request
): Promise<SvaMainserverGenericItemInput | Response> => {
  return parseGenericItemInput(request);
};

const handleListRequest = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  contentKind: ContentKind,
  logSuccess: (operation: string, contentId?: string) => void
) => {
  const actor = await authorizeOrResponse(
    ctx,
    pluginActionFor(contentKind, 'read'),
    contentTypeFor(contentKind)
  );
  if (isResponse(actor)) {
    return actor;
  }

  const includeInvisible = new URL(request.url).searchParams.get('includeInvisible') === 'true';
  const languageCode = new URL(request.url).searchParams.get('languageCode') ?? undefined;
  const input = {
    ...actor,
    ...parseMainserverListQuery(request),
    includeInvisible,
  };
  const startedAt = Date.now();
  const faqResult =
    contentKind === 'faq'
      ? await listFaqItems(input, listSvaMainserverGenericItems, languageCode)
      : null;
  const cockpitCardsResult =
    contentKind === 'cockpit-cards'
      ? await listCockpitCardItems(input, listSvaMainserverGenericItems)
      : null;
  const specializedResult = faqResult ?? cockpitCardsResult;
  const data = specializedResult
    ? { data: specializedResult.data, pagination: specializedResult.pagination }
    : await listSvaMainserverGenericItems(input);
  if (faqResult) {
    logger.info('FAQ list upstream pagination completed', {
      operation: 'mainserver_faq_list_upstream',
      upstream_page_count: faqResult.observability.upstreamPageCount,
      matching_item_count: faqResult.observability.matchingItemCount,
      duration_ms: Date.now() - startedAt,
    });
  }
  if (cockpitCardsResult)
    logger.info('Cockpit Cards list upstream pagination completed', {
      operation: 'mainserver_cockpit_cards_list_upstream',
      upstream_page_count: cockpitCardsResult.observability.upstreamPageCount,
      matching_item_count: cockpitCardsResult.observability.matchingItemCount,
      duration_ms: Date.now() - startedAt,
    });
  logSuccess(
    contentKind === 'faq'
      ? 'mainserver_faq_list'
      : contentKind === 'cockpit-cards'
        ? 'mainserver_cockpit_cards_list'
        : 'mainserver_generic-items_list'
  );
  return json(data);
};

const handleDetailRequest = async (
  ctx: AuthenticatedRequestContext,
  contentKind: ContentKind,
  itemId: string,
  logSuccess: (operation: string, contentId?: string) => void
) => {
  const actor = await authorizeOrResponse(
    ctx,
    pluginActionFor(contentKind, 'read'),
    contentTypeFor(contentKind),
    itemId
  );
  if (isResponse(actor)) {
    return actor;
  }

  const data = await getSvaMainserverGenericItem({ ...actor, genericItemId: itemId });
  if (contentKind === 'faq' && data.genericType !== 'FAQ') {
    return errorJson(404, 'not_found', 'FAQ wurde nicht gefunden.');
  }
  if (contentKind === 'cockpit-cards' && data.genericType !== 'COCKPIT_CARD')
    return errorJson(404, 'not_found', 'Cockpit Card wurde nicht gefunden.');
  logSuccess('mainserver_generic-items_detail', itemId);
  return json({ data });
};

const handleCreateRequest = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  contentKind: ContentKind,
  requestId: string | undefined,
  logSuccess: (operation: string, contentId?: string) => void
) => {
  const actor = await authorizeMutation(request, ctx, contentKind, 'create', requestId);
  if (isResponse(actor)) {
    return actor;
  }

  return runMainserverMutationWithFailureFinalization({
    actor,
    operation: async () => {
      const genericItem =
        contentKind === 'faq'
          ? await validateFaqWriteOrResponse(request)
          : contentKind === 'cockpit-cards'
            ? await validateCockpitCardWriteOrResponse(request)
            : await parseGenericItemOrResponse(request);
      if (isResponse(genericItem)) return genericItem;

      const principalAuthorization = await authorizeMainserverCreateForPrincipal({
        actor,
        action: pluginActionFor(contentKind, 'create'),
        contentType: contentTypeFor(contentKind),
      });
      if (isResponse(principalAuthorization)) return principalAuthorization;

      const data = await createSvaMainserverGenericItem({
        ...actor,
        genericItem:
          contentKind === 'faq'
            ? { ...withoutEditorialAuthor(genericItem), genericType: 'FAQ' }
            : contentKind === 'cockpit-cards'
              ? { ...withoutEditorialAuthor(genericItem), genericType: 'COCKPIT_CARD' }
              : withoutEditorialAuthor(genericItem),
      });
      const bindingOutcome = await recordCreatedMainserverDataProvider({
        actor,
        created: data,
        reread: async () => await getSvaMainserverGenericItem({ ...actor, genericItemId: data.id }),
        contentType: contentTypeFor(contentKind),
      });
      await finalizeMainserverMutation({
        actor,
        providerOutcome: 'succeeded',
        reconciliationStatus:
          bindingOutcome === 'conflict' || bindingOutcome === 'reconciliation_required'
            ? 'reconciliation_required'
            : 'complete',
        completedSteps: ['provider_write', 'binding_observation'],
        contentId: data.id,
        observedDataProviderId: data.dataProvider?.id,
      });
      logSuccess('mainserver_generic-items_create', data.id);
      return json(
        {
          data,
          ...(bindingOutcome === 'conflict' || bindingOutcome === 'reconciliation_required'
            ? { meta: { reconciliationStatus: 'reconciliation_required' } }
            : {}),
        },
        201
      );
    },
  });
};

const handleUpdateRequest = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  contentKind: ContentKind,
  requestId: string | undefined,
  itemId: string,
  logSuccess: (operation: string, contentId?: string) => void
) => {
  const actor = await authorizeMutation(request, ctx, contentKind, 'update', requestId, itemId);
  if (isResponse(actor)) {
    return actor;
  }

  return runMainserverMutationWithFailureFinalization({
    actor,
    contentId: itemId,
    operation: async () => {
      const existingItem = await getSvaMainserverGenericItem({ ...actor, genericItemId: itemId });
      if (contentKind === 'faq' && existingItem && existingItem.genericType !== 'FAQ') {
        return errorJson(404, 'not_found', 'FAQ wurde nicht gefunden.');
      }
      if (
        contentKind === 'cockpit-cards' &&
        existingItem &&
        existingItem.genericType !== 'COCKPIT_CARD'
      )
        return errorJson(404, 'not_found', 'Cockpit Card wurde nicht gefunden.');
      const genericItem =
        contentKind === 'faq'
          ? await validateFaqWriteOrResponse(request)
          : contentKind === 'cockpit-cards'
            ? await validateCockpitCardWriteOrResponse(request)
            : await parseGenericItemOrResponse(request);
      if (isResponse(genericItem)) return genericItem;
      if (contentKind === 'faq' && !existingItem)
        return errorJson(404, 'not_found', 'FAQ wurde nicht gefunden.');
      if (contentKind === 'cockpit-cards' && !existingItem)
        return errorJson(404, 'not_found', 'Cockpit Card wurde nicht gefunden.');
      const providerAuthorization = await authorizeMainserverExistingContent({
        actor,
        action: pluginActionFor(contentKind, 'update'),
        contentType: contentTypeFor(contentKind),
        contentId: itemId,
        item: existingItem,
        additionalActions: existingItem
          ? toMainserverAdditionalActions(
              resolveMainserverVisibilityAction(existingItem.visible, genericItem.visible)
            )
          : [],
      });
      if (isResponse(providerAuthorization)) return providerAuthorization;
      const data = await updateSvaMainserverGenericItem({
        ...actor,
        genericItemId: itemId,
        genericItem:
          contentKind === 'faq'
            ? {
                ...preserveEditorialAuthor(genericItem, existingItem),
                genericType: 'FAQ',
                payload: mergeFaqPayload(existingItem?.payload, genericItem.payload),
              }
            : contentKind === 'cockpit-cards'
              ? {
                  ...preserveEditorialAuthor(genericItem, existingItem),
                  genericType: 'COCKPIT_CARD',
                  payload: mergeCockpitCardPayload(existingItem?.payload, genericItem.payload),
                }
              : preserveEditorialAuthor(genericItem, existingItem),
      });
      await finalizeMainserverMutation({
        actor,
        providerOutcome: 'succeeded',
        reconciliationStatus: 'complete',
        completedSteps: ['provider_write'],
        contentId: itemId,
        observedDataProviderId: existingItem?.dataProvider?.id,
      });
      logSuccess('mainserver_generic-items_update', itemId);
      return json({ data });
    },
  });
};

const handleDeleteRequest = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  contentKind: ContentKind,
  requestId: string | undefined,
  itemId: string,
  logSuccess: (operation: string, contentId?: string) => void
) => {
  const actor = await authorizeMutation(request, ctx, contentKind, 'delete', requestId, itemId);
  if (isResponse(actor)) {
    return actor;
  }

  return runMainserverMutationWithFailureFinalization({
    actor,
    contentId: itemId,
    operation: async () => {
      const existingItem = await getSvaMainserverGenericItem({ ...actor, genericItemId: itemId });
      if (contentKind === 'faq' && existingItem?.genericType !== 'FAQ') {
        return errorJson(404, 'not_found', 'FAQ wurde nicht gefunden.');
      }
      if (contentKind === 'cockpit-cards' && existingItem?.genericType !== 'COCKPIT_CARD')
        return errorJson(404, 'not_found', 'Cockpit Card wurde nicht gefunden.');
      const providerAuthorization = await authorizeMainserverExistingContent({
        actor,
        action: pluginActionFor(contentKind, 'delete'),
        contentType: contentTypeFor(contentKind),
        contentId: itemId,
        item: existingItem,
      });
      if (isResponse(providerAuthorization)) return providerAuthorization;
      const data = await deleteSvaMainserverGenericItem({ ...actor, genericItemId: itemId });
      await finalizeMainserverMutation({
        actor,
        providerOutcome: 'succeeded',
        reconciliationStatus: 'complete',
        completedSteps: ['provider_write', 'tombstone'],
        contentId: itemId,
        observedDataProviderId: existingItem?.dataProvider?.id,
      });
      logSuccess('mainserver_generic-items_delete', itemId);
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
  const routeContentType = contentTypeFor(route.contentKind);
  const logSuccess = (operation: string, contentId?: string) => {
    logger.info('Mainserver generic items route succeeded', {
      operation,
      request_id: workspaceContext.requestId,
      trace_id: workspaceContext.traceId,
      actor_id: ctx.user.id,
      instance_id: ctx.user.instanceId,
      content_type: routeContentType,
      content_id: contentId,
      method: request.method,
    });
  };

  try {
    if (route.kind === 'collection' && request.method === 'GET') {
      return await handleListRequest(request, ctx, route.contentKind, logSuccess);
    }

    if (route.kind === 'item' && request.method === 'GET') {
      return withMainserverContextBinding(
        await handleDetailRequest(ctx, route.contentKind, route.itemId, logSuccess),
        ctx
      );
    }

    if (route.kind === 'collection' && request.method === 'POST') {
      return await handleCreateRequest(
        request,
        ctx,
        route.contentKind,
        workspaceContext.requestId,
        logSuccess
      );
    }

    if (route.kind === 'item' && request.method === 'PATCH') {
      return await handleUpdateRequest(
        request,
        ctx,
        route.contentKind,
        workspaceContext.requestId,
        route.itemId,
        logSuccess
      );
    }

    if (route.kind === 'item' && request.method === 'DELETE') {
      return await handleDeleteRequest(
        request,
        ctx,
        route.contentKind,
        workspaceContext.requestId,
        route.itemId,
        logSuccess
      );
    }

    return errorJson(
      405,
      'method_not_allowed',
      'Methode wird für diesen Mainserver-Inhalt nicht unterstützt.'
    );
  } catch (error) {
    logger.warn('Mainserver generic items route failed', {
      operation: 'mainserver_content_request',
      request_id: workspaceContext.requestId,
      trace_id: workspaceContext.traceId,
      actor_id: ctx.user.id,
      instance_id: ctx.user.instanceId,
      content_type: routeContentType,
      content_id: route.kind === 'item' ? route.itemId : undefined,
      method: request.method,
      error_code: error instanceof SvaMainserverError ? error.code : 'internal_error',
    });

    return toMainserverErrorResponse(error, 'Mainserver-Anfrage ist fehlgeschlagen.');
  }
};

export const dispatchSvaMainserverGenericItemsRequest = async (
  request: Request
): Promise<Response | null> => {
  const projectsResponse = await dispatchSvaMainserverProjectsRequest(request);
  if (projectsResponse) {
    return projectsResponse;
  }
  const route = matchRoute(request);
  if (!route) {
    return null;
  }

  return withAuthenticatedUser(request, (ctx) => dispatchAuthenticated(request, route, ctx));
};
