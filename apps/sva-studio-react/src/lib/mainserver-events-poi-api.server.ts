import {
  authorizeContentPrimitiveForUser,
  validateCsrf,
  withAuthenticatedUser,
  type AuthenticatedRequestContext,
} from '@sva/auth-runtime/server';
import {
  createSvaMainserverEvent,
  createSvaMainserverPoi,
  deleteSvaMainserverEvent,
  deleteSvaMainserverPoi,
  getSvaMainserverEvent,
  getSvaMainserverPoi,
  listSvaMainserverEvents,
  listSvaMainserverPoi,
  SvaMainserverError,
  updateSvaMainserverEvent,
  updateSvaMainserverPoi,
} from '@sva/sva-mainserver/server';
import type {
  SvaMainserverAddressInput,
  SvaMainserverCategoryInput,
  SvaMainserverContactInput,
  SvaMainserverDateInput,
  SvaMainserverEventInput,
  SvaMainserverPoiInput,
  SvaMainserverWebUrlInput,
} from '@sva/sva-mainserver';
import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';

import { parseMainserverListQuery } from './mainserver-list-pagination.js';

const EVENTS_CONTENT_TYPE = 'events.event-record';
const POI_CONTENT_TYPE = 'poi.point-of-interest';
const EVENTS_COLLECTION_PATH = '/api/v1/mainserver/events';
const POI_COLLECTION_PATH = '/api/v1/mainserver/poi';
const logger = createSdkLogger({ component: 'sva-mainserver-events-poi-route', level: 'info' });

type ContentKind = 'events' | 'poi';

type RouteMatch =
  | { readonly kind: 'collection'; readonly contentKind: ContentKind }
  | { readonly kind: 'item'; readonly contentKind: ContentKind; readonly itemId: string };

type ContentActor = {
  readonly instanceId: string;
  readonly keycloakSubject: string;
};

type ParsedValue<T> = T | Response;

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
  return (
    matchCollectionOrItem(pathname, EVENTS_COLLECTION_PATH, 'events') ??
    matchCollectionOrItem(pathname, POI_COLLECTION_PATH, 'poi')
  );
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

const isResponse = <T>(value: ParsedValue<T>): value is Response => value instanceof Response;

const parseJsonObjectBody = async (request: Request, message: string): Promise<Record<string, unknown> | Response> => {
  const body = (await request.json().catch(() => null)) as unknown;
  return isRecord(body) ? body : errorJson(400, 'invalid_request', message);
};

const parseEventDates = (value: unknown): readonly SvaMainserverDateInput[] | undefined =>
  Array.isArray(value)
    ? value
        .filter(isRecord)
        .map((date): SvaMainserverDateInput => ({
          ...(readString(date.weekday) ? { weekday: readString(date.weekday) } : {}),
          ...(readString(date.dateStart) ? { dateStart: readString(date.dateStart) } : {}),
          ...(readString(date.dateEnd) ? { dateEnd: readString(date.dateEnd) } : {}),
          ...(readString(date.timeStart) ? { timeStart: readString(date.timeStart) } : {}),
          ...(readString(date.timeEnd) ? { timeEnd: readString(date.timeEnd) } : {}),
          ...(readString(date.timeDescription) ? { timeDescription: readString(date.timeDescription) } : {}),
          ...(readBoolean(date.useOnlyTimeDescription) !== undefined
            ? { useOnlyTimeDescription: readBoolean(date.useOnlyTimeDescription) }
            : {}),
        }))
    : undefined;

const parseEventRelations = (
  body: Record<string, unknown>
): ParsedValue<{
  readonly categories: readonly SvaMainserverCategoryInput[] | undefined;
  readonly addresses: readonly SvaMainserverAddressInput[] | undefined;
  readonly contact: SvaMainserverContactInput | undefined;
  readonly urls: readonly SvaMainserverWebUrlInput[] | undefined;
  readonly tags: readonly string[] | undefined;
}> => {
  const categories = parseCategories(body.categories);
  if (isResponse(categories)) {
    return categories;
  }

  const addresses = parseAddressList(body.addresses);
  if (isResponse(addresses)) {
    return addresses;
  }

  const contact = parseContact(body.contact);
  if (isResponse(contact)) {
    return contact;
  }

  const urls = parseWebUrls(body.urls);
  if (isResponse(urls)) {
    return urls;
  }

  const tags = parseTags(body.tags);
  if (isResponse(tags)) {
    return tags;
  }

  return {
    categories,
    addresses,
    contact,
    urls,
    tags,
  };
};

const buildEventInput = (
  body: Record<string, unknown>,
  title: string,
  relations: {
    readonly categories: readonly SvaMainserverCategoryInput[] | undefined;
    readonly addresses: readonly SvaMainserverAddressInput[] | undefined;
    readonly contact: SvaMainserverContactInput | undefined;
    readonly urls: readonly SvaMainserverWebUrlInput[] | undefined;
    readonly tags: readonly string[] | undefined;
  }
): SvaMainserverEventInput => {
  const dates = parseEventDates(body.dates);

  return {
    title,
    ...(readString(body.description) ? { description: readString(body.description) } : {}),
    ...(readString(body.externalId) ? { externalId: readString(body.externalId) } : {}),
    ...(readString(body.keywords) ? { keywords: readString(body.keywords) } : {}),
    ...(dates ? { dates } : {}),
    ...(readBoolean(body.repeat) !== undefined ? { repeat: readBoolean(body.repeat) } : {}),
    ...(readString(body.categoryName) ? { categoryName: readString(body.categoryName) } : {}),
    ...(relations.categories ? { categories: relations.categories } : {}),
    ...(relations.addresses ? { addresses: relations.addresses } : {}),
    ...(relations.contact ? { contacts: [relations.contact] } : {}),
    ...(relations.urls ? { urls: relations.urls } : {}),
    ...(relations.tags ? { tags: relations.tags } : {}),
    ...(readString(body.recurring) ? { recurring: readString(body.recurring) } : {}),
    ...(readString(body.recurringType) ? { recurringType: readString(body.recurringType) } : {}),
    ...(readString(body.recurringInterval) ? { recurringInterval: readString(body.recurringInterval) } : {}),
    ...(Array.isArray(body.recurringWeekdays)
      ? { recurringWeekdays: body.recurringWeekdays.map(readString).filter((value): value is string => Boolean(value)) }
      : {}),
    ...(readString(body.pointOfInterestId) ? { pointOfInterestId: readString(body.pointOfInterestId) } : {}),
    ...(readBoolean(body.pushNotification) !== undefined ? { pushNotification: readBoolean(body.pushNotification) } : {}),
  };
};

const parseEventInput = async (request: Request): Promise<SvaMainserverEventInput | Response> => {
  const body = await parseJsonObjectBody(request, 'Event-Daten müssen als Objekt gesendet werden.');
  if (isResponse(body)) {
    return body;
  }

  const title = readString(body.title);
  if (!title) {
    return errorJson(400, 'invalid_request', 'Der Event-Titel ist erforderlich.');
  }

  const relations = parseEventRelations(body);
  return isResponse(relations) ? relations : buildEventInput(body, title, relations);
};

const parsePoiRelations = (
  body: Record<string, unknown>
): ParsedValue<{
  readonly categories: readonly SvaMainserverCategoryInput[] | undefined;
  readonly addresses: readonly SvaMainserverAddressInput[] | undefined;
  readonly contact: SvaMainserverContactInput | undefined;
  readonly webUrls: readonly SvaMainserverWebUrlInput[] | undefined;
  readonly tags: readonly string[] | undefined;
}> => {
  const categories = parseCategories(body.categories);
  if (isResponse(categories)) {
    return categories;
  }

  const addresses = parseAddressList(body.addresses);
  if (isResponse(addresses)) {
    return addresses;
  }

  const contact = parseContact(body.contact);
  if (isResponse(contact)) {
    return contact;
  }

  const webUrls = parseWebUrls(body.webUrls);
  if (isResponse(webUrls)) {
    return webUrls;
  }

  const tags = parseTags(body.tags);
  if (isResponse(tags)) {
    return tags;
  }

  return {
    categories,
    addresses,
    contact,
    webUrls,
    tags,
  };
};

const buildPoiInput = (
  body: Record<string, unknown>,
  name: string,
  relations: {
    readonly categories: readonly SvaMainserverCategoryInput[] | undefined;
    readonly addresses: readonly SvaMainserverAddressInput[] | undefined;
    readonly contact: SvaMainserverContactInput | undefined;
    readonly webUrls: readonly SvaMainserverWebUrlInput[] | undefined;
    readonly tags: readonly string[] | undefined;
  }
): SvaMainserverPoiInput => ({
  name,
  ...(readString(body.description) ? { description: readString(body.description) } : {}),
  ...(readString(body.mobileDescription) ? { mobileDescription: readString(body.mobileDescription) } : {}),
  ...(readString(body.externalId) ? { externalId: readString(body.externalId) } : {}),
  ...(readString(body.keywords) ? { keywords: readString(body.keywords) } : {}),
  ...(readBoolean(body.active) !== undefined ? { active: readBoolean(body.active) } : {}),
  ...(readString(body.categoryName) ? { categoryName: readString(body.categoryName) } : {}),
  ...(body.payload !== undefined ? { payload: body.payload } : {}),
  ...(relations.categories ? { categories: relations.categories } : {}),
  ...(relations.addresses ? { addresses: relations.addresses } : {}),
  ...(relations.contact ? { contact: relations.contact } : {}),
  ...(relations.webUrls ? { webUrls: relations.webUrls } : {}),
  ...(relations.tags ? { tags: relations.tags } : {}),
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

  const relations = parsePoiRelations(body);
  return isResponse(relations) ? relations : buildPoiInput(body, name, relations);
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

const contentTypeFor = (contentKind: ContentKind) => (contentKind === 'events' ? EVENTS_CONTENT_TYPE : POI_CONTENT_TYPE);
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

  const listQuery = parseMainserverListQuery(request);
  const data =
    route.contentKind === 'events'
      ? await listSvaMainserverEvents({ ...actor, ...listQuery })
      : await listSvaMainserverPoi({ ...actor, ...listQuery });
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

  const data =
    route.contentKind === 'events'
      ? await getSvaMainserverEvent({ ...actor, eventId: route.itemId })
      : await getSvaMainserverPoi({ ...actor, poiId: route.itemId });
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

const createEventsContent = async (request: Request, actor: ContentActor) => {
  const parsed = await parseEventInput(request);
  if (isResponse(parsed)) {
    return parsed;
  }

  const data = await createSvaMainserverEvent({ ...actor, event: parsed });
  return { data };
};

const createPoiContent = async (request: Request, actor: ContentActor) => {
  const parsed = await parsePoiInput(request);
  if (isResponse(parsed)) {
    return parsed;
  }

  const data = await createSvaMainserverPoi({ ...actor, poi: parsed });
  return { data };
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

  const result =
    route.contentKind === 'events'
      ? await createEventsContent(request, actor)
      : await createPoiContent(request, actor);
  if (isResponse(result)) {
    return result;
  }

  logSuccess(`mainserver_${route.contentKind}_create`, result.data.id);
  return json(result, 201);
};

const updateEventsContent = async (request: Request, actor: ContentActor, itemId: string) => {
  const parsed = await parseEventInput(request);
  if (isResponse(parsed)) {
    return parsed;
  }

  const data = await updateSvaMainserverEvent({ ...actor, eventId: itemId, event: parsed });
  return { data };
};

const updatePoiContent = async (request: Request, actor: ContentActor, itemId: string) => {
  const parsed = await parsePoiInput(request);
  if (isResponse(parsed)) {
    return parsed;
  }

  const data = await updateSvaMainserverPoi({ ...actor, poiId: itemId, poi: parsed });
  return { data };
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

  const result =
    route.contentKind === 'events'
      ? await updateEventsContent(request, actor, route.itemId)
      : await updatePoiContent(request, actor, route.itemId);
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

  const data =
    route.contentKind === 'events'
      ? await deleteSvaMainserverEvent({ ...actor, eventId: route.itemId })
      : await deleteSvaMainserverPoi({ ...actor, poiId: route.itemId });
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

export const dispatchMainserverEventsPoiRequest = async (request: Request): Promise<Response | null> => {
  const route = matchRoute(request);
  if (!route) {
    return null;
  }

  return withAuthenticatedUser(request, (ctx) => dispatchAuthenticated(request, route, ctx));
};
