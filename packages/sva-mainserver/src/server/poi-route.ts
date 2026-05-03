import {
  authorizeContentPrimitiveForUser,
  validateCsrf,
  withAuthenticatedUser,
  type AuthenticatedRequestContext,
} from '@sva/auth-runtime/server';
import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';

import type {
  SvaMainserverAddressInput,
  SvaMainserverCategoryInput,
  SvaMainserverContactInput,
  SvaMainserverPoiInput,
  SvaMainserverWebUrlInput,
} from '../types.js';
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

type RouteMatch =
  | { readonly kind: 'collection'; readonly contentKind: ContentKind }
  | { readonly kind: 'item'; readonly contentKind: ContentKind; readonly itemId: string };

const json = (body: unknown, status = 200): Response =>
  Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
    },
  });

const errorJson = (status: number, error: string, message: string): Response => json({ error, message }, status);

const decodePathSegment = (value: string): string | null => {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
};

const matchCollectionOrItem = (pathname: string, collectionPath: string, contentKind: ContentKind): RouteMatch | null => {
  if (pathname === collectionPath) {
    return { kind: 'collection', contentKind };
  }

  const prefix = `${collectionPath}/`;
  if (pathname.startsWith(prefix)) {
    const itemId = decodePathSegment(pathname.slice(prefix.length));
    if (itemId !== null && itemId.length > 0 && itemId.includes('/') === false) {
      return { kind: 'item', contentKind, itemId };
    }
  }

  return null;
};

const matchRoute = (request: Request): RouteMatch | null => {
  const pathname = new URL(request.url).pathname;
  return matchCollectionOrItem(pathname, POI_COLLECTION_PATH, 'poi');
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && Array.isArray(value) === false;

const readString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;

const readBoolean = (value: unknown): boolean | undefined => (typeof value === 'boolean' ? value : undefined);

const readNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const isHttpsUrl = (value: string): boolean => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

const parseWebUrl = (value: unknown): SvaMainserverWebUrlInput | Response | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!isRecord(value)) {
    return errorJson(400, 'invalid_request', 'URL-Angaben müssen als Objekt gesendet werden.');
  }
  const url = readString(value.url);
  if (!url || !isHttpsUrl(url)) {
    return errorJson(400, 'invalid_request', 'URL-Angaben müssen eine gültige HTTPS-URL enthalten.');
  }
  return {
    url,
    ...(readString(value.description) ? { description: readString(value.description) } : {}),
  };
};

const parseWebUrls = (value: unknown): readonly SvaMainserverWebUrlInput[] | Response | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    return errorJson(400, 'invalid_request', 'URLs müssen als Liste gesendet werden.');
  }
  const urls: SvaMainserverWebUrlInput[] = [];
  for (const item of value) {
    const parsed = parseWebUrl(item);
    if (parsed instanceof Response) {
      return parsed;
    }
    if (parsed) {
      urls.push(parsed);
    }
  }
  return urls;
};

const parseCategories = (value: unknown): readonly SvaMainserverCategoryInput[] | Response | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    return errorJson(400, 'invalid_request', 'Kategorien müssen als Liste gesendet werden.');
  }

  const parseCategory = (item: unknown): SvaMainserverCategoryInput | Response => {
    if (!isRecord(item)) {
      return errorJson(400, 'invalid_request', 'Kategorien müssen Objekte sein.');
    }
    const name = readString(item.name);
    if (!name || name.length > 128) {
      return errorJson(400, 'invalid_request', 'Kategorien benötigen einen Namen mit maximal 128 Zeichen.');
    }
    const children = parseCategories(item.children);
    if (children instanceof Response) {
      return children;
    }
    return {
      name,
      ...(isRecord(item.payload) ? { payload: item.payload } : {}),
      ...(children ? { children } : {}),
    };
  };

  const categories: SvaMainserverCategoryInput[] = [];
  for (const item of value) {
    const category = parseCategory(item);
    if (category instanceof Response) {
      return category;
    }
    categories.push(category);
  }
  return categories;
};

const parseAddress = (value: unknown): SvaMainserverAddressInput | Response | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!isRecord(value)) {
    return errorJson(400, 'invalid_request', 'Adressdaten müssen als Objekt gesendet werden.');
  }
  const latitude = isRecord(value.geoLocation) ? readNumber(value.geoLocation.latitude) : undefined;
  const longitude = isRecord(value.geoLocation) ? readNumber(value.geoLocation.longitude) : undefined;
  if (
    value.geoLocation !== undefined &&
    (latitude === undefined || longitude === undefined || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180)
  ) {
    return errorJson(400, 'invalid_request', 'Geo-Koordinaten sind ungültig.');
  }
  return {
    ...(readNumber(value.id) !== undefined ? { id: readNumber(value.id) } : {}),
    ...(readString(value.addition) ? { addition: readString(value.addition) } : {}),
    ...(readString(value.street) ? { street: readString(value.street) } : {}),
    ...(readString(value.zip) ? { zip: readString(value.zip) } : {}),
    ...(readString(value.city) ? { city: readString(value.city) } : {}),
    ...(readString(value.kind) ? { kind: readString(value.kind) } : {}),
    ...(latitude !== undefined && longitude !== undefined ? { geoLocation: { latitude, longitude } } : {}),
  };
};

const parseAddressList = (value: unknown): readonly SvaMainserverAddressInput[] | Response | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    return errorJson(400, 'invalid_request', 'Adressen müssen als Liste gesendet werden.');
  }
  const addresses: SvaMainserverAddressInput[] = [];
  for (const item of value) {
    const parsed = parseAddress(item);
    if (parsed instanceof Response) {
      return parsed;
    }
    if (parsed) {
      addresses.push(parsed);
    }
  }
  return addresses;
};

const parseContact = (value: unknown): SvaMainserverContactInput | Response | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!isRecord(value)) {
    return errorJson(400, 'invalid_request', 'Kontaktdaten müssen als Objekt gesendet werden.');
  }
  const webUrls = parseWebUrls(value.webUrls);
  if (webUrls instanceof Response) {
    return webUrls;
  }
  return {
    ...(readString(value.firstName) ? { firstName: readString(value.firstName) } : {}),
    ...(readString(value.lastName) ? { lastName: readString(value.lastName) } : {}),
    ...(readString(value.phone) ? { phone: readString(value.phone) } : {}),
    ...(readString(value.fax) ? { fax: readString(value.fax) } : {}),
    ...(readString(value.email) ? { email: readString(value.email) } : {}),
    ...(webUrls ? { webUrls } : {}),
  };
};

const parseTags = (value: unknown): readonly string[] | Response | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    return errorJson(400, 'invalid_request', 'Tags müssen als Liste gesendet werden.');
  }
  return value.map(readString).filter((tag): tag is string => Boolean(tag));
};

const buildPoiInput = (input: {
  body: Record<string, unknown>;
  categories: SvaMainserverPoiInput['categories'] | undefined;
  addresses: SvaMainserverPoiInput['addresses'] | undefined;
  contact: ReturnType<typeof parseContact> extends Response | infer T | undefined ? T | undefined : never;
  webUrls: SvaMainserverPoiInput['webUrls'] | undefined;
  tags: readonly string[] | undefined;
}): SvaMainserverPoiInput => ({
  name: readString(input.body.name) as string,
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
  const body = (await request.json().catch(() => null)) as unknown;
  if (!isRecord(body)) {
    return errorJson(400, 'invalid_request', 'POI-Daten müssen als Objekt gesendet werden.');
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
  return buildPoiInput({ body, categories, addresses, contact, webUrls, tags });
};

const toMainserverErrorResponse = (error: unknown): Response => {
  if (error instanceof SvaMainserverError) {
    const status =
      error.statusCode ??
      ({
        missing_credentials: 400,
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
): Promise<{ readonly instanceId: string; readonly keycloakSubject: string } | Response> => {
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
  };
};

const listContentForRoute = async (
  _route: Extract<RouteMatch, { kind: 'collection' }>,
  actor: { readonly instanceId: string; readonly keycloakSubject: string },
  request: Request
) => {
  const listQuery = parseMainserverListQuery(request);
  return listSvaMainserverPoi({ ...actor, ...listQuery });
};

const getContentForRoute = async (
  route: Extract<RouteMatch, { kind: 'item' }>,
  actor: { readonly instanceId: string; readonly keycloakSubject: string }
) =>
  getSvaMainserverPoi({ ...actor, poiId: route.itemId });

const createContentForRoute = async (
  _route: Extract<RouteMatch, { kind: 'collection' }>,
  actor: { readonly instanceId: string; readonly keycloakSubject: string },
  request: Request
) => {
  const parsed = await parsePoiInput(request);
  if (parsed instanceof Response) {
    return parsed;
  }
  const data = await createSvaMainserverPoi({ ...actor, poi: parsed });
  return json({ data }, 201);
};

const updateContentForRoute = async (
  _route: Extract<RouteMatch, { kind: 'item' }>,
  actor: { readonly instanceId: string; readonly keycloakSubject: string },
  request: Request
) => {
  const parsed = await parsePoiInput(request);
  if (parsed instanceof Response) {
    return parsed;
  }
  const data = await updateSvaMainserverPoi({ ...actor, poiId: _route.itemId, poi: parsed });
  return json({ data });
};

const deleteContentForRoute = async (
  route: Extract<RouteMatch, { kind: 'item' }>,
  actor: { readonly instanceId: string; readonly keycloakSubject: string }
) => {
  const data = await deleteSvaMainserverPoi({ ...actor, poiId: route.itemId });
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
      const actor = await authorizeOrResponse(ctx, route.contentKind, pluginActionFor(route.contentKind, 'read'));
      if (actor instanceof Response) {
        return actor;
      }
      const data = await listContentForRoute(route, actor, request);
      logSuccess(`mainserver_${route.contentKind}_list`);
      return json(data);
    }

    if (route.kind === 'item' && request.method === 'GET') {
      const actor = await authorizeOrResponse(ctx, route.contentKind, pluginActionFor(route.contentKind, 'read'), route.itemId);
      if (actor instanceof Response) {
        return actor;
      }
      const data = await getContentForRoute(route, actor);
      logSuccess(`mainserver_${route.contentKind}_detail`, route.itemId);
      return json({ data });
    }

    if (route.kind === 'collection' && request.method === 'POST') {
      const csrfError = validateMutationRequest(request, workspaceContext.requestId);
      if (csrfError) {
        return csrfError;
      }
      const actor = await authorizeOrResponse(ctx, route.contentKind, pluginActionFor(route.contentKind, 'create'));
      if (actor instanceof Response) {
        return actor;
      }
      const response = await createContentForRoute(route, actor, request);
      const responseBody = (await response.clone().json().catch(() => null)) as { data?: { id?: string } } | null;
      if (response.ok) {
        logSuccess(`mainserver_${route.contentKind}_create`, responseBody?.data?.id);
      }
      return response;
    }

    if (route.kind === 'item' && request.method === 'PATCH') {
      const csrfError = validateMutationRequest(request, workspaceContext.requestId);
      if (csrfError) {
        return csrfError;
      }
      const updateActor = await authorizeOrResponse(
        ctx,
        route.contentKind,
        pluginActionFor(route.contentKind, 'update'),
        route.itemId
      );
      if (updateActor instanceof Response) {
        return updateActor;
      }
      const response = await updateContentForRoute(route, updateActor, request);
      if (response.ok) {
        logSuccess(`mainserver_${route.contentKind}_update`, route.itemId);
      }
      return response;
    }

    if (route.kind === 'item' && request.method === 'DELETE') {
      const csrfError = validateMutationRequest(request, workspaceContext.requestId);
      if (csrfError) {
        return csrfError;
      }
      const actor = await authorizeOrResponse(ctx, route.contentKind, pluginActionFor(route.contentKind, 'delete'), route.itemId);
      if (actor instanceof Response) {
        return actor;
      }
      const response = await deleteContentForRoute(route, actor);
      logSuccess(`mainserver_${route.contentKind}_delete`, route.itemId);
      return response;
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
