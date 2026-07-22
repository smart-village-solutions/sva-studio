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
import { SvaMainserverError } from './errors.js';
import { parseGenericItemInput } from './generic-items-route-input.js';
import { listFaqItems } from './faq-listing.js';
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
const FAQ_CONTENT_TYPE = 'faq.faq';
const FAQ_COLLECTION_PATH = '/api/v1/mainserver/faqs';
const logger = createSdkLogger({ component: 'sva-mainserver-generic-items-route', level: 'info' });

type ContentKind = 'generic-items' | 'faq';

type ContentActor = {
  readonly instanceId: string;
  readonly keycloakSubject: string;
  readonly activeOrganizationId?: string;
};

type RouteMatch = SharedRouteMatch<ContentKind>;

const matchRoute = (request: Request): RouteMatch | null =>
  matchRequestRoute(request, GENERIC_ITEMS_COLLECTION_PATH, 'generic-items') ??
  matchRequestRoute(request, FAQ_COLLECTION_PATH, 'faq');

const contentTypeFor = (contentKind: ContentKind) =>
  contentKind === 'faq' ? FAQ_CONTENT_TYPE : GENERIC_ITEMS_CONTENT_TYPE;

const pluginActionFor = (contentKind: ContentKind, actionName: 'read' | 'create' | 'update' | 'delete') =>
  `${contentKind}.${actionName}`;

const validateMutationRequest = (request: Request, requestId?: string): Response | null => {
  const csrfError = validateCsrf(request, requestId);
  return csrfError ? errorJson(403, 'csrf_validation_failed', 'Sicherheitsprüfung fehlgeschlagen.') : null;
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
): Promise<Response | ContentActor> => {
  const csrfError = validateMutationRequest(request, requestId);
  if (csrfError) {
    return csrfError;
  }

  return authorizeOrResponse(ctx, pluginActionFor(contentKind, actionName), contentTypeFor(contentKind), contentId);
};

const parseGenericItemOrResponse = async (request: Request): Promise<SvaMainserverGenericItemInput | Response> => {
  return parseGenericItemInput(request);
};

const faqAnswerHtmlPattern = /<\/?[a-z][^>]*>/i;
const faqLanguageCodePattern = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;

const validateFaqItemOrResponse = (genericItem: SvaMainserverGenericItemInput): Response | null => {
  const contentBlocks = genericItem.contentBlocks ?? [];
  const answerBody = contentBlocks[0]?.body?.trim() ?? '';
  if (contentBlocks.length !== 1 || answerBody.length === 0) {
    return errorJson(400, 'invalid_request', 'Die FAQ-Antwort ist erforderlich.');
  }
  if (faqAnswerHtmlPattern.test(answerBody)) {
    return errorJson(400, 'invalid_request', 'HTML in der FAQ-Antwort ist nicht erlaubt.');
  }
  const payload = genericItem.payload;
  const payloadRecord = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : {};
  const languageCode = payloadRecord.languageCode;
  if (typeof languageCode !== 'string' || !faqLanguageCodePattern.test(languageCode.trim())) {
    return errorJson(400, 'invalid_request', 'Der FAQ-Sprachcode ist ungültig.');
  }
  const sortWeight = payloadRecord.sortWeight;
  if (typeof sortWeight !== 'number' || !Number.isInteger(sortWeight) || !Number.isFinite(sortWeight)) {
    return errorJson(400, 'invalid_request', 'Das FAQ-Sortiergewicht ist ungültig.');
  }
  if (
    (genericItem.categories?.length ?? 0) > 0 ||
    (genericItem.contacts?.length ?? 0) > 0 ||
    (genericItem.webUrls?.length ?? 0) > 0 ||
    (genericItem.addresses?.length ?? 0) > 0 ||
    (genericItem.openingHours?.length ?? 0) > 0 ||
    (genericItem.priceInformations?.length ?? 0) > 0 ||
    (genericItem.mediaContents?.length ?? 0) > 0 ||
    (genericItem.locations?.length ?? 0) > 0 ||
    (genericItem.dates?.length ?? 0) > 0 ||
    (genericItem.accessibilityInformations?.length ?? 0) > 0 ||
    typeof genericItem.teaser === 'string' ||
    typeof genericItem.author === 'string' ||
    typeof genericItem.keywords === 'string' ||
    typeof genericItem.externalId === 'string' ||
    typeof genericItem.categoryName === 'string' ||
    typeof genericItem.publishedAt === 'string'
  ) {
    return errorJson(400, 'invalid_request', 'FAQ unterstützt nur Frage, Antwort und kontrollierten Payload.');
  }
  return null;
};

const validateFaqWriteOrResponse = async (request: Request): Promise<SvaMainserverGenericItemInput | Response> => {
  const genericItem = await parseGenericItemOrResponse(request);
  return isResponse(genericItem) ? genericItem : validateFaqItemOrResponse(genericItem) ?? genericItem;
};

const handleListRequest = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  contentKind: ContentKind,
  logSuccess: (operation: string, contentId?: string) => void
) => {
  const actor = await authorizeOrResponse(ctx, pluginActionFor(contentKind, 'read'), contentTypeFor(contentKind));
  if (isResponse(actor)) {
    return actor;
  }

  const includeInvisible = new URL(request.url).searchParams.get('includeInvisible') === 'true';
  const input = {
    ...actor,
    ...parseMainserverListQuery(request),
    includeInvisible,
  };
  const startedAt = Date.now();
  const faqResult = contentKind === 'faq' ? await listFaqItems(input, listSvaMainserverGenericItems) : null;
  const data = faqResult
    ? { data: faqResult.data, pagination: faqResult.pagination }
    : await listSvaMainserverGenericItems(input);
  if (faqResult) {
    logger.info('FAQ list upstream pagination completed', {
      operation: 'mainserver_faq_list_upstream',
      upstream_page_count: faqResult.observability.upstreamPageCount,
      matching_item_count: faqResult.observability.matchingItemCount,
      duration_ms: Date.now() - startedAt,
    });
  }
  logSuccess('mainserver_generic-items_list');
  return json(data);
};

const handleDetailRequest = async (
  ctx: AuthenticatedRequestContext,
  contentKind: ContentKind,
  itemId: string,
  logSuccess: (operation: string, contentId?: string) => void
) => {
  const actor = await authorizeOrResponse(ctx, pluginActionFor(contentKind, 'read'), contentTypeFor(contentKind), itemId);
  if (isResponse(actor)) {
    return actor;
  }

  const data = await getSvaMainserverGenericItem({ ...actor, genericItemId: itemId });
  if (contentKind === 'faq' && data.genericType !== 'FAQ') {
    return errorJson(404, 'not_found', 'FAQ wurde nicht gefunden.');
  }
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

  const genericItem = contentKind === 'faq'
    ? await validateFaqWriteOrResponse(request)
    : await parseGenericItemOrResponse(request);
  if (isResponse(genericItem)) return genericItem;

  const data = await createSvaMainserverGenericItem({ ...actor, genericItem: contentKind === 'faq' ? { ...genericItem, genericType: 'FAQ' } : genericItem });
  logSuccess('mainserver_generic-items_create', data.id);
  return json({ data }, 201);
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

  const existingItem = contentKind === 'faq' ? await getSvaMainserverGenericItem({ ...actor, genericItemId: itemId }) : null;
  if (existingItem && existingItem.genericType !== 'FAQ') {
    return errorJson(404, 'not_found', 'FAQ wurde nicht gefunden.');
  }
  const genericItem = contentKind === 'faq'
    ? await validateFaqWriteOrResponse(request)
    : await parseGenericItemOrResponse(request);
  if (isResponse(genericItem)) return genericItem;

  const data = await updateSvaMainserverGenericItem({ ...actor, genericItemId: itemId, genericItem: contentKind === 'faq' ? { ...genericItem, genericType: 'FAQ' } : genericItem });
  logSuccess('mainserver_generic-items_update', itemId);
  return json({ data });
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

  const existingItem = contentKind === 'faq' ? await getSvaMainserverGenericItem({ ...actor, genericItemId: itemId }) : null;
  if (existingItem && existingItem.genericType !== 'FAQ') {
    return errorJson(404, 'not_found', 'FAQ wurde nicht gefunden.');
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
      return await handleListRequest(request, ctx, route.contentKind, logSuccess);
    }

    if (route.kind === 'item' && request.method === 'GET') {
      return await handleDetailRequest(ctx, route.contentKind, route.itemId, logSuccess);
    }

    if (route.kind === 'collection' && request.method === 'POST') {
      return await handleCreateRequest(request, ctx, route.contentKind, workspaceContext.requestId, logSuccess);
    }

    if (route.kind === 'item' && request.method === 'PATCH') {
      return await handleUpdateRequest(request, ctx, route.contentKind, workspaceContext.requestId, route.itemId, logSuccess);
    }

    if (route.kind === 'item' && request.method === 'DELETE') {
      return await handleDeleteRequest(request, ctx, route.contentKind, workspaceContext.requestId, route.itemId, logSuccess);
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
