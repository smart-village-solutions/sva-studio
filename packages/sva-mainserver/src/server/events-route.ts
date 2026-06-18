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
  SvaMainserverDateInput,
  SvaMainserverEventInput,
  SvaMainserverWebUrlInput,
} from '../types.js';
import {
  errorJson,
  isRecord,
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
  type ParsedValue,
  type RouteMatch as SharedRouteMatch,
} from './content-route-helpers.js';
import { SvaMainserverError } from './errors.js';
import { parseMainserverListQuery } from './list-pagination.js';
import { toMainserverErrorResponse } from './mainserver-error-response.js';
import {
  createSvaMainserverEvent,
  deleteSvaMainserverEvent,
  getSvaMainserverEvent,
  listSvaMainserverEvents,
  updateSvaMainserverEvent,
} from './service.js';

const EVENTS_CONTENT_TYPE = 'events.event-record';
const EVENTS_COLLECTION_PATH = '/api/v1/mainserver/events';
const logger = createSdkLogger({ component: 'sva-mainserver-events-route', level: 'info' });

type ContentKind = 'events';

type RouteMatch = SharedRouteMatch<ContentKind>;

type ContentActor = {
  readonly instanceId: string;
  readonly keycloakSubject: string;
  readonly activeOrganizationId?: string;
};

const matchRoute = (request: Request): RouteMatch | null => matchRequestRoute(request, EVENTS_COLLECTION_PATH, 'events');

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

const validateMutationRequest = (request: Request, requestId?: string): Response | null => {
  const csrfError = validateCsrf(request, requestId);
  return csrfError ? errorJson(403, 'csrf_validation_failed', 'Sicherheitsprüfung fehlgeschlagen.') : null;
};

const contentTypeFor = (_contentKind: ContentKind) => EVENTS_CONTENT_TYPE;
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

  const listQuery = parseMainserverListQuery(request);
  const data = await listSvaMainserverEvents({ ...actor, ...listQuery });
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

  const data = await getSvaMainserverEvent({ ...actor, eventId: route.itemId });
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

  const result = await createEventsContent(request, actor);
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

  const result = await updateEventsContent(request, actor, route.itemId);
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

  const data = await deleteSvaMainserverEvent({ ...actor, eventId: route.itemId });
  logSuccess(`mainserver_${route.contentKind}_delete`, route.itemId);
  return json({ data });
};

const dispatchAuthenticated = async (request: Request, route: RouteMatch, ctx: AuthenticatedRequestContext) => {
  const workspaceContext = getWorkspaceContext();
  const logSuccess = (operation: string, contentId?: string) => {
    try {
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
    } catch {
      // Observability failures must not turn successful upstream operations into request failures.
    }
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
    return toMainserverErrorResponse(error, 'Mainserver-Anfrage ist fehlgeschlagen.');
  }
};

export const dispatchSvaMainserverEventsRequest = async (request: Request): Promise<Response | null> => {
  const route = matchRoute(request);
  if (!route) {
    return null;
  }

  return withAuthenticatedUser(request, (ctx) => dispatchAuthenticated(request, route, ctx));
};
