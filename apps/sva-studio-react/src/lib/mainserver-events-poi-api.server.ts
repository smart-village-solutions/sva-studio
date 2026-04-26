import {
  authorizeContentPrimitiveForUser,
  validateCsrf,
  withAuthenticatedUser,
  type AuthenticatedRequestContext,
} from '@sva/auth-runtime/server';
import type { IamContentPrimitiveAction } from '@sva/core';
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

const EVENTS_CONTENT_TYPE = 'events.event-record';
const POI_CONTENT_TYPE = 'poi.point-of-interest';
const EVENTS_COLLECTION_PATH = '/api/v1/mainserver/events';
const POI_COLLECTION_PATH = '/api/v1/mainserver/poi';
const logger = createSdkLogger({ component: 'sva-mainserver-events-poi-route', level: 'info' });

type ContentKind = 'events' | 'poi';

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

const matchCollectionOrItem = (pathname: string, collectionPath: string, contentKind: ContentKind): RouteMatch | null => {
  if (pathname === collectionPath) {
    return { kind: 'collection', contentKind };
  }

  const prefix = `${collectionPath}/`;
  if (pathname.startsWith(prefix)) {
    const itemId = decodeURIComponent(pathname.slice(prefix.length));
    if (itemId.length > 0 && itemId.includes('/') === false) {
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
  const categories: SvaMainserverCategoryInput[] = [];
  for (const item of value) {
    if (!isRecord(item)) {
      return errorJson(400, 'invalid_request', 'Kategorien müssen Objekte sein.');
    }
    const name = readString(item.name);
    if (!name || name.length > 128) {
      return errorJson(400, 'invalid_request', 'Kategorien benötigen einen Namen mit maximal 128 Zeichen.');
    }
    categories.push({ name, ...(isRecord(item.payload) ? { payload: item.payload } : {}) });
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

const parseEventInput = async (request: Request): Promise<SvaMainserverEventInput | Response> => {
  const body = (await request.json().catch(() => null)) as unknown;
  if (!isRecord(body)) {
    return errorJson(400, 'invalid_request', 'Event-Daten müssen als Objekt gesendet werden.');
  }
  const title = readString(body.title);
  if (!title) {
    return errorJson(400, 'invalid_request', 'Der Event-Titel ist erforderlich.');
  }
  const dates = Array.isArray(body.dates)
    ? body.dates
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
  const categories = parseCategories(body.categories);
  const addresses = parseAddressList(body.addresses);
  const contact = parseContact(body.contact);
  const urls = parseWebUrls(body.urls);
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
  if (urls instanceof Response) {
    return urls;
  }
  if (tags instanceof Response) {
    return tags;
  }
  return {
    title,
    ...(readString(body.description) ? { description: readString(body.description) } : {}),
    ...(readString(body.externalId) ? { externalId: readString(body.externalId) } : {}),
    ...(readString(body.keywords) ? { keywords: readString(body.keywords) } : {}),
    ...(dates ? { dates } : {}),
    ...(readBoolean(body.repeat) !== undefined ? { repeat: readBoolean(body.repeat) } : {}),
    ...(readString(body.categoryName) ? { categoryName: readString(body.categoryName) } : {}),
    ...(categories ? { categories } : {}),
    ...(addresses ? { addresses } : {}),
    ...(contact ? { contacts: [contact] } : {}),
    ...(urls ? { urls } : {}),
    ...(tags ? { tags } : {}),
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
  return {
    name,
    ...(readString(body.description) ? { description: readString(body.description) } : {}),
    ...(readString(body.mobileDescription) ? { mobileDescription: readString(body.mobileDescription) } : {}),
    ...(readString(body.externalId) ? { externalId: readString(body.externalId) } : {}),
    ...(readString(body.keywords) ? { keywords: readString(body.keywords) } : {}),
    ...(readBoolean(body.active) !== undefined ? { active: readBoolean(body.active) } : {}),
    ...(readString(body.categoryName) ? { categoryName: readString(body.categoryName) } : {}),
    ...(body.payload !== undefined ? { payload: body.payload } : {}),
    ...(categories ? { categories } : {}),
    ...(addresses ? { addresses } : {}),
    ...(contact ? { contact } : {}),
    ...(webUrls ? { webUrls } : {}),
    ...(tags ? { tags } : {}),
  };
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

const authorizeOrResponse = async (
  ctx: AuthenticatedRequestContext,
  contentKind: ContentKind,
  action: IamContentPrimitiveAction,
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
      const actor = await authorizeOrResponse(ctx, route.contentKind, 'content.read');
      if (actor instanceof Response) {
        return actor;
      }
      const data = route.contentKind === 'events' ? await listSvaMainserverEvents(actor) : await listSvaMainserverPoi(actor);
      logSuccess(`mainserver_${route.contentKind}_list`);
      return json({ data });
    }

    if (route.kind === 'item' && request.method === 'GET') {
      const actor = await authorizeOrResponse(ctx, route.contentKind, 'content.read', route.itemId);
      if (actor instanceof Response) {
        return actor;
      }
      const data =
        route.contentKind === 'events'
          ? await getSvaMainserverEvent({ ...actor, eventId: route.itemId })
          : await getSvaMainserverPoi({ ...actor, poiId: route.itemId });
      logSuccess(`mainserver_${route.contentKind}_detail`, route.itemId);
      return json({ data });
    }

    if (route.kind === 'collection' && request.method === 'POST') {
      const csrfError = validateMutationRequest(request, workspaceContext.requestId);
      if (csrfError) {
        return csrfError;
      }
      const actor = await authorizeOrResponse(ctx, route.contentKind, 'content.create');
      if (actor instanceof Response) {
        return actor;
      }
      if (route.contentKind === 'events') {
        const parsed = await parseEventInput(request);
        if (parsed instanceof Response) {
          return parsed;
        }
        const data = await createSvaMainserverEvent({ ...actor, event: parsed });
        logSuccess('mainserver_events_create', data.id);
        return json({ data }, 201);
      }
      const parsed = await parsePoiInput(request);
      if (parsed instanceof Response) {
        return parsed;
      }
      const data = await createSvaMainserverPoi({ ...actor, poi: parsed });
      logSuccess('mainserver_poi_create', data.id);
      return json({ data }, 201);
    }

    if (route.kind === 'item' && request.method === 'PATCH') {
      const csrfError = validateMutationRequest(request, workspaceContext.requestId);
      if (csrfError) {
        return csrfError;
      }
      const metadataActor = await authorizeOrResponse(ctx, route.contentKind, 'content.updateMetadata', route.itemId);
      if (metadataActor instanceof Response) {
        return metadataActor;
      }
      const payloadActor = await authorizeOrResponse(ctx, route.contentKind, 'content.updatePayload', route.itemId);
      if (payloadActor instanceof Response) {
        return payloadActor;
      }
      if (route.contentKind === 'events') {
        const parsed = await parseEventInput(request);
        if (parsed instanceof Response) {
          return parsed;
        }
        const data = await updateSvaMainserverEvent({ ...metadataActor, eventId: route.itemId, event: parsed });
        logSuccess('mainserver_events_update', route.itemId);
        return json({ data });
      }
      const parsed = await parsePoiInput(request);
      if (parsed instanceof Response) {
        return parsed;
      }
      const data = await updateSvaMainserverPoi({ ...metadataActor, poiId: route.itemId, poi: parsed });
      logSuccess('mainserver_poi_update', route.itemId);
      return json({ data });
    }

    if (route.kind === 'item' && request.method === 'DELETE') {
      const csrfError = validateMutationRequest(request, workspaceContext.requestId);
      if (csrfError) {
        return csrfError;
      }
      const actor = await authorizeOrResponse(ctx, route.contentKind, 'content.delete', route.itemId);
      if (actor instanceof Response) {
        return actor;
      }
      const data =
        route.contentKind === 'events'
          ? await deleteSvaMainserverEvent({ ...actor, eventId: route.itemId })
          : await deleteSvaMainserverPoi({ ...actor, poiId: route.itemId });
      logSuccess(`mainserver_${route.contentKind}_delete`, route.itemId);
      return json({ data });
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
