import {
  authorizeContentPrimitiveForUser,
  validateCsrf,
  withAuthenticatedUser,
  type AuthenticatedRequestContext,
} from '@sva/auth-runtime/server';
import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';

import type {
  SvaMainserverPoiInput,
} from '../types.js';
import {
  errorJson,
  isResponse,
  json,
  matchRequestRoute,
  parseAddressList,
  parseCategories,
  parseContact,
  parseJsonObjectBody,
  parseTags,
  parseWebUrls,
  readBoolean,
  readString,
  type RouteMatch as SharedRouteMatch,
} from './content-route-helpers.js';
import { SvaMainserverError } from './errors.js';
import { parseMainserverListQuery } from './list-pagination.js';
import {
  createSvaMainserverPoi,
  deleteSvaMainserverPoi,
  getSvaMainserverPoi,
  listSvaMainserverPoi,
  updateSvaMainserverPoi,
} from './service.js';

const POI_CONTENT_TYPE = 'poi.point-of-interest';
const POI_COLLECTION_PATH = '/api/v1/mainserver/poi';
const logger = createSdkLogger({ component: 'sva-mainserver-poi-route', level: 'info' });

type ContentKind = 'poi';

type ContentActor = {
  readonly instanceId: string;
  readonly keycloakSubject: string;
  readonly activeOrganizationId?: string;
};

type RouteMatch = SharedRouteMatch<ContentKind>;

const matchRoute = (request: Request): RouteMatch | null => matchRequestRoute(request, POI_COLLECTION_PATH, 'poi');

const buildPoiInput = (input: {
  body: Record<string, unknown>;
  name: string;
  categories: SvaMainserverPoiInput['categories'] | undefined;
  addresses: SvaMainserverPoiInput['addresses'] | undefined;
  contact: ReturnType<typeof parseContact> extends Response | infer T | undefined ? T | undefined : never;
  webUrls: SvaMainserverPoiInput['webUrls'] | undefined;
  tags: readonly string[] | undefined;
}): SvaMainserverPoiInput => ({
  name: input.name,
  ...(readString(input.body.description) ? { description: readString(input.body.description) } : {}),
  ...(readString(input.body.mobileDescription) ? { mobileDescription: readString(input.body.mobileDescription) } : {}),
  ...(readString(input.body.externalId) ? { externalId: readString(input.body.externalId) } : {}),
  ...(readString(input.body.keywords) ? { keywords: readString(input.body.keywords) } : {}),
  ...(readBoolean(input.body.active) !== undefined ? { active: readBoolean(input.body.active) } : {}),
  ...(readString(input.body.categoryName) ? { categoryName: readString(input.body.categoryName) } : {}),
  ...(input.body.payload !== undefined ? { payload: input.body.payload } : {}),
  ...(input.categories ? { categories: input.categories } : {}),
  ...(input.addresses ? { addresses: input.addresses } : {}),
  ...(input.contact ? { contact: input.contact } : {}),
  ...(input.webUrls ? { webUrls: input.webUrls } : {}),
  ...(input.tags ? { tags: input.tags } : {}),
});

const parsePoiInput = async (request: Request): Promise<SvaMainserverPoiInput | Response> => {
  const body = await parseJsonObjectBody(request, 'POI-Daten müssen als Objekt gesendet werden.');
  if (isResponse(body)) {
    return body;
  }

  const name = readString(body.name);
  if (!name) {
    return errorJson(400, 'invalid_request', 'Der POI-Name ist erforderlich.');
  }
  const categories = parseCategories(body.categories);
  const addresses = parseAddressList(body.addresses);
  const contact = parseContact(body.contact);
  const webUrls = parseWebUrls(body.webUrls);
  const tags = parseTags(body.tags);
  if (categories instanceof Response) {
    return categories;
  }
  if (addresses instanceof Response) {
    return addresses;
  }
  if (contact instanceof Response) {
    return contact;
  }
  if (webUrls instanceof Response) {
    return webUrls;
  }
  if (tags instanceof Response) {
    return tags;
  }
  return buildPoiInput({ body, name, categories, addresses, contact, webUrls, tags });
};

const toMainserverErrorResponse = (error: unknown): Response => {
  if (error instanceof SvaMainserverError) {
    const status =
      error.statusCode ??
      ({
        missing_credentials: 400,
        organization_mainserver_credentials_missing: 409,
        invalid_config: 400,
        config_not_found: 400,
        integration_disabled: 400,
        unauthorized: 401,
        forbidden: 403,
        not_found: 404,
        database_unavailable: 503,
        identity_provider_unavailable: 503,
        network_error: 503,
        token_request_failed: 502,
        graphql_error: 502,
        invalid_response: 502,
      } satisfies Record<string, number>)[error.code] ??
      502;
    return errorJson(status, error.code, error.message);
  }

  return errorJson(500, 'internal_error', 'Mainserver-Anfrage ist fehlgeschlagen.');
};

const validateMutationRequest = (request: Request, requestId?: string): Response | null => {
  const csrfError = validateCsrf(request, requestId);
  return csrfError ? errorJson(403, 'csrf_validation_failed', 'Sicherheitsprüfung fehlgeschlagen.') : null;
};

const contentTypeFor = (_contentKind: ContentKind) => POI_CONTENT_TYPE;
const pluginActionFor = (
  contentKind: ContentKind,
  actionName: 'read' | 'create' | 'update' | 'delete'
) => `${contentKind}.${actionName}`;

const authorizeOrResponse = async (
  ctx: AuthenticatedRequestContext,
  contentKind: ContentKind,
  action: string,
  contentId?: string
): Promise<ContentActor | Response> => {
  const result = await authorizeContentPrimitiveForUser({
    ctx,
    action,
    resource: {
      contentType: contentTypeFor(contentKind),
      ...(contentId ? { contentId } : {}),
    },
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
    return errorJson(result.status, result.error, result.message);
  }
  return {
    instanceId: result.actor.instanceId,
    keycloakSubject: result.actor.keycloakSubject,
    activeOrganizationId: result.actor.organizationId ?? ctx.activeOrganizationId,
  };
};

const handleCollectionRead = async (
  request: Request,
  route: Extract<RouteMatch, { readonly kind: 'collection' }>,
  ctx: AuthenticatedRequestContext,
  logSuccess: (operation: string, contentId?: string) => void
) => {
  const actor = await authorizeOrResponse(ctx, route.contentKind, pluginActionFor(route.contentKind, 'read'));
  if (isResponse(actor)) {
    return actor;
  }

  const data = await listSvaMainserverPoi({ ...actor, ...parseMainserverListQuery(request) });
  logSuccess(`mainserver_${route.contentKind}_list`);
  return json(data);
};

const handleItemRead = async (
  route: Extract<RouteMatch, { readonly kind: 'item' }>,
  ctx: AuthenticatedRequestContext,
  logSuccess: (operation: string, contentId?: string) => void
) => {
  const actor = await authorizeOrResponse(ctx, route.contentKind, pluginActionFor(route.contentKind, 'read'), route.itemId);
  if (isResponse(actor)) {
    return actor;
  }

  const data = await getSvaMainserverPoi({ ...actor, poiId: route.itemId });
  logSuccess(`mainserver_${route.contentKind}_detail`, route.itemId);
  return json({ data });
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

  return authorizeOrResponse(ctx, contentKind, pluginActionFor(contentKind, actionName), contentId);
};

const createPoiContent = async (request: Request, actor: ContentActor) => {
  const parsed = await parsePoiInput(request);
  if (isResponse(parsed)) {
    return parsed;
  }

  return { data: await createSvaMainserverPoi({ ...actor, poi: parsed }) };
};

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

  const result = await createPoiContent(request, actor);
  if (isResponse(result)) {
    return result;
  }

  logSuccess(`mainserver_${route.contentKind}_create`, result.data.id);
  return json(result, 201);
};

const updatePoiContent = async (request: Request, actor: ContentActor, itemId: string) => {
  const parsed = await parsePoiInput(request);
  if (isResponse(parsed)) {
    return parsed;
  }

  return { data: await updateSvaMainserverPoi({ ...actor, poiId: itemId, poi: parsed }) };
};

const handleItemUpdate = async (
  request: Request,
  route: Extract<RouteMatch, { readonly kind: 'item' }>,
  ctx: AuthenticatedRequestContext,
  requestId: string | undefined,
  logSuccess: (operation: string, contentId?: string) => void
) => {
  const actor = await authorizeMutation(request, ctx, route.contentKind, 'update', requestId, route.itemId);
  if (isResponse(actor)) {
    return actor;
  }

  const result = await updatePoiContent(request, actor, route.itemId);
  if (isResponse(result)) {
    return result;
  }

  logSuccess(`mainserver_${route.contentKind}_update`, route.itemId);
  return json(result);
};

const handleItemDelete = async (
  request: Request,
  route: Extract<RouteMatch, { readonly kind: 'item' }>,
  ctx: AuthenticatedRequestContext,
  requestId: string | undefined,
  logSuccess: (operation: string, contentId?: string) => void
) => {
  const actor = await authorizeMutation(request, ctx, route.contentKind, 'delete', requestId, route.itemId);
  if (isResponse(actor)) {
    return actor;
  }

  const data = await deleteSvaMainserverPoi({ ...actor, poiId: route.itemId });
  logSuccess(`mainserver_${route.contentKind}_delete`, route.itemId);
  return json({ data });
};

const dispatchAuthenticated = async (request: Request, route: RouteMatch, ctx: AuthenticatedRequestContext) => {
  const workspaceContext = getWorkspaceContext();
  const logSuccess = (operation: string, contentId?: string) => {
    logger.info('Mainserver content route succeeded', {
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
      return await handleItemRead(route, ctx, logSuccess);
    }

    if (route.kind === 'collection' && request.method === 'POST') {
      return await handleCollectionCreate(request, route, ctx, workspaceContext.requestId, logSuccess);
    }

    if (route.kind === 'item' && request.method === 'PATCH') {
      return await handleItemUpdate(request, route, ctx, workspaceContext.requestId, logSuccess);
    }

    if (route.kind === 'item' && request.method === 'DELETE') {
      return await handleItemDelete(request, route, ctx, workspaceContext.requestId, logSuccess);
    }

    return errorJson(405, 'method_not_allowed', 'Methode wird für diesen Mainserver-Inhalt nicht unterstützt.');
  } catch (error) {
    logger.warn('Mainserver content route failed', {
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
    return toMainserverErrorResponse(error);
  }
};

export const dispatchSvaMainserverPoiRequest = async (request: Request): Promise<Response | null> => {
  const route = matchRoute(request);
  if (!route) {
    return null;
  }

  return withAuthenticatedUser(request, (ctx) => dispatchAuthenticated(request, route, ctx));
};
