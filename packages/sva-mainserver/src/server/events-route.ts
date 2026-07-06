import {
  authorizeContentPrimitiveForUser,
  validateCsrf,
  withAuthenticatedUser,
  type AuthenticatedRequestContext,
} from '@sva/auth-runtime/server';
import { createMutationWorkflow, createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';

import type {
  SvaMainserverAccessibilityInformationInput,
  SvaMainserverAddressInput,
  SvaMainserverCategoryInput,
  SvaMainserverContactInput,
  SvaMainserverDateInput,
  SvaMainserverEventInput,
  SvaMainserverOperatingCompanyInput,
  SvaMainserverPriceInput,
  SvaMainserverWebUrlInput,
} from '../types.js';
import {
  errorJson,
  isRecord,
  isResponse,
  json,
  matchRequestRoute,
  parseJsonObjectBody,
  readBoolean,
  readString,
  type ParsedValue,
  type RouteMatch as SharedRouteMatch,
} from './content-route-core.js';
import {
  parseAccessibilityInformation,
  parseAddressList,
  parseCategories,
  parseContact,
  parseMediaContents,
  parseOperatingCompany,
  parsePrices,
  parseTags,
  parseWebUrls,
} from './content-route-parsers.js';
import { SvaMainserverError } from './errors.js';
import { parseMainserverListQuery } from './list-pagination.js';
import { toMainserverErrorResponse } from './mainserver-error-response.js';
import {
  changeSvaMainserverEventVisibility,
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
  readonly contacts: readonly SvaMainserverContactInput[] | undefined;
  readonly urls: readonly SvaMainserverWebUrlInput[] | undefined;
  readonly mediaContents: SvaMainserverEventInput['mediaContents'] | undefined;
  readonly tags: readonly string[] | undefined;
  readonly organizer: SvaMainserverOperatingCompanyInput | undefined;
  readonly priceInformations: readonly SvaMainserverPriceInput[] | undefined;
  readonly accessibilityInformation: SvaMainserverAccessibilityInformationInput | undefined;
}> => {
  const categories = parseCategories(body.categories);
  if (isResponse(categories)) {
    return categories;
  }

  const addresses = parseAddressList(body.addresses);
  if (isResponse(addresses)) {
    return addresses;
  }

  const contactsValue = body.contacts;
  const contactValue = body.contact;
  let contacts: readonly SvaMainserverContactInput[] | undefined;
  if (Array.isArray(contactsValue)) {
    const nextContacts: SvaMainserverContactInput[] = [];
    for (const item of contactsValue) {
      const parsedContact = parseContact(item);
      if (isResponse(parsedContact)) {
        return parsedContact;
      }
      if (parsedContact) {
        nextContacts.push(parsedContact);
      }
    }
    contacts = nextContacts;
  } else {
    const contact = parseContact(contactValue);
    if (isResponse(contact)) {
      return contact;
    }
    contacts = contact ? [contact] : undefined;
  }

  const urls = parseWebUrls(body.urls);
  if (isResponse(urls)) {
    return urls;
  }

  const mediaContents = parseMediaContents(body.mediaContents);
  if (isResponse(mediaContents)) {
    return mediaContents;
  }

  const tags = parseTags(body.tags);
  if (isResponse(tags)) {
    return tags;
  }

  const organizer = parseOperatingCompany(body.organizer);
  if (isResponse(organizer)) {
    return organizer;
  }

  const priceInformations = parsePrices(body.priceInformations);
  if (isResponse(priceInformations)) {
    return priceInformations;
  }

  const accessibilityInformation = parseAccessibilityInformation(body.accessibilityInformation);
  if (isResponse(accessibilityInformation)) {
    return accessibilityInformation;
  }

  return {
    categories,
    addresses,
    contacts,
    urls,
    mediaContents,
    tags,
    organizer,
    priceInformations,
    accessibilityInformation,
  };
};

const buildEventInput = (
  body: Record<string, unknown>,
  title: string,
  relations: {
    readonly categories: readonly SvaMainserverCategoryInput[] | undefined;
    readonly addresses: readonly SvaMainserverAddressInput[] | undefined;
    readonly contacts: readonly SvaMainserverContactInput[] | undefined;
    readonly urls: readonly SvaMainserverWebUrlInput[] | undefined;
    readonly mediaContents: SvaMainserverEventInput['mediaContents'] | undefined;
    readonly tags: readonly string[] | undefined;
    readonly organizer: SvaMainserverOperatingCompanyInput | undefined;
    readonly priceInformations: readonly SvaMainserverPriceInput[] | undefined;
    readonly accessibilityInformation: SvaMainserverAccessibilityInformationInput | undefined;
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
    ...(relations.contacts ? { contacts: relations.contacts } : {}),
    ...(relations.urls ? { urls: relations.urls } : {}),
    ...(relations.mediaContents ? { mediaContents: relations.mediaContents } : {}),
    ...(relations.organizer ? { organizer: relations.organizer } : {}),
    ...(relations.priceInformations ? { priceInformations: relations.priceInformations } : {}),
    ...(relations.accessibilityInformation ? { accessibilityInformation: relations.accessibilityInformation } : {}),
    ...(relations.tags ? { tags: relations.tags } : {}),
    ...(readString(body.recurring) ? { recurring: readString(body.recurring) } : {}),
    ...(readString(body.recurringType) ? { recurringType: readString(body.recurringType) } : {}),
    ...(readString(body.recurringInterval) ? { recurringInterval: readString(body.recurringInterval) } : {}),
    ...(Array.isArray(body.recurringWeekdays)
      ? { recurringWeekdays: body.recurringWeekdays.map(readString).filter((value): value is string => Boolean(value)) }
      : {}),
    ...(readString(body.pointOfInterestId) ? { pointOfInterestId: readString(body.pointOfInterestId) } : {}),
  };
};

const parseEventInput = async (
  request: Request
): Promise<Readonly<{ event: SvaMainserverEventInput; visible?: boolean }> | Response> => {
  const body = await parseJsonObjectBody(request, 'Event-Daten müssen als Objekt gesendet werden.');
  if (isResponse(body)) {
    return body;
  }

  const title = readString(body.title);
  if (!title) {
    return errorJson(400, 'invalid_request', 'Der Event-Titel ist erforderlich.');
  }

  const relations = parseEventRelations(body);
  if (isResponse(relations)) {
    return relations;
  }

  const visible = readBoolean(body.visible);
  if (body.visible !== undefined && visible === undefined) {
    return errorJson(400, 'invalid_request', 'Das Feld "visible" muss als Boolean gesendet werden.');
  }

  return {
    event: buildEventInput(body, title, relations),
    ...(visible !== undefined ? { visible } : {}),
  };
};

const validateMutationRequest = (request: Request, requestId?: string): Response | null => {
  const csrfError = validateCsrf(request, requestId);
  return csrfError ? errorJson(403, 'csrf_validation_failed', 'Sicherheitsprüfung fehlgeschlagen.') : null;
};

const toEventVisibilityPartialFailureResponse = (
  error: unknown,
  event: Record<string, unknown>,
  operation: 'erstellt' | 'aktualisiert'
): Response => {
  const status = error instanceof SvaMainserverError ? error.statusCode : 502;
  const message =
    operation === 'erstellt'
      ? 'Der Event wurde erstellt, aber die Sichtbarkeit konnte nicht aktualisiert werden. Erneutes Speichern kann zu Duplikaten führen.'
      : 'Der Event wurde aktualisiert, aber die Sichtbarkeit konnte nicht aktualisiert werden. Erneutes Speichern kann zu abweichender Sichtbarkeit führen.';

  return json(
    {
      error: 'invalid_response',
      message,
      partialSuccess: true,
      data: event,
    },
    status,
  );
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

const logMutationWorkflowFailure = (input: {
  readonly request: Request;
  readonly context: AuthenticatedRequestContext;
  readonly contentKind: ContentKind;
  readonly contentId?: string;
  readonly requestId?: string;
  readonly error: unknown;
}) => {
  logger.warn('Mainserver content route failed', {
    operation: 'mainserver_content_request',
    request_id: input.requestId,
    trace_id: getWorkspaceContext().traceId,
    actor_id: input.context.user.id,
    instance_id: input.context.user.instanceId,
    content_type: contentTypeFor(input.contentKind),
    content_id: input.contentId,
    method: input.request.method,
    error_code: input.error instanceof SvaMainserverError ? input.error.code : 'internal_error',
  });
};

const createContentMutationHandler = <TInput>(
  input: {
    readonly route: Extract<RouteMatch, { readonly kind: 'collection' | 'item' }>;
    readonly action: 'create' | 'update' | 'delete';
    readonly requestId?: string;
    readonly parse: (request: Request) => Promise<TInput | Response>;
    readonly execute: (actor: ContentActor, parsed: TInput) => Promise<Response>;
  }
) => {
  const workflow = createMutationWorkflow<
    AuthenticatedRequestContext,
    {
      readonly requestId?: string;
      readonly contentId?: string;
    },
    {
      readonly actor: ContentActor;
    },
    Record<never, never>,
    TInput,
    Response
  >({
    prepare: () => ({
      requestId: input.requestId,
      ...(input.route.kind === 'item' ? { contentId: input.route.itemId } : {}),
    }),
    authorize: async ({ context, contentId }) => {
      const actor = await authorizeOrResponse(
        context,
        input.route.contentKind,
        pluginActionFor(input.route.contentKind, input.action),
        contentId
      );
      return isResponse(actor) ? actor : { actor };
    },
    csrf: ({ request, requestId }) => validateMutationRequest(request, requestId) ?? undefined,
    parse: ({ request }) => input.parse(request),
    execute: async ({ actor, input: parsed }) => input.execute(actor, parsed),
    mapError: (error, state) => {
      logMutationWorkflowFailure({
        request: state.request,
        context: state.context,
        contentKind: input.route.contentKind,
        contentId: state.contentId,
        requestId: state.requestId,
        error,
      });
      return toMainserverErrorResponse(error, 'Mainserver-Anfrage ist fehlgeschlagen.');
    },
    respond: (response) => response,
  });

  return (request: Request, ctx: AuthenticatedRequestContext): Promise<Response> => workflow(request, ctx);
};

const handleCollectionCreate = async (
  request: Request,
  route: Extract<RouteMatch, { readonly kind: 'collection' }>,
  ctx: AuthenticatedRequestContext,
  requestId: string | undefined,
  logSuccess: (operation: string, contentId?: string) => void
) => {
  return createContentMutationHandler({
    route,
    action: 'create',
    requestId,
    parse: async (inputRequest) => await parseEventInput(inputRequest),
    execute: async (actor, parsed) => {
      const result = await createSvaMainserverEvent({ ...actor, event: parsed.event });
      if (parsed.visible === false) {
        try {
          await changeSvaMainserverEventVisibility({ ...actor, eventId: result.id, visible: false });
        } catch (error) {
          return toEventVisibilityPartialFailureResponse(error, { ...result, visible: false }, 'erstellt');
        }
      }
      logSuccess(`mainserver_${route.contentKind}_create`, result.id);
      return json({ data: parsed.visible === undefined ? result : { ...result, visible: parsed.visible } }, 201);
    },
  })(request, ctx);
};

const handleItemUpdate = async (
  request: Request,
  route: Extract<RouteMatch, { readonly kind: 'item' }>,
  ctx: AuthenticatedRequestContext,
  requestId: string | undefined,
  logSuccess: (operation: string, contentId?: string) => void
) => {
  return createContentMutationHandler({
    route,
    action: 'update',
    requestId,
    parse: async (inputRequest) => await parseEventInput(inputRequest),
    execute: async (actor, parsed) => {
      const result = await updateSvaMainserverEvent({ ...actor, eventId: route.itemId, event: parsed.event });
      if (parsed.visible !== undefined) {
        try {
          await changeSvaMainserverEventVisibility({ ...actor, eventId: route.itemId, visible: parsed.visible });
        } catch (error) {
          return toEventVisibilityPartialFailureResponse(
            error,
            { ...result, visible: parsed.visible },
            'aktualisiert'
          );
        }
      }
      logSuccess(`mainserver_${route.contentKind}_update`, route.itemId);
      return json({ data: parsed.visible === undefined ? result : { ...result, visible: parsed.visible } });
    },
  })(request, ctx);
};

const handleItemDelete = async (
  request: Request,
  route: Extract<RouteMatch, { readonly kind: 'item' }>,
  ctx: AuthenticatedRequestContext,
  requestId: string | undefined,
  logSuccess: (operation: string, contentId?: string) => void
) => {
  return createContentMutationHandler({
    route,
    action: 'delete',
    requestId,
    parse: async () => ({ itemId: route.itemId }),
    execute: async (actor) => {
      const data = await deleteSvaMainserverEvent({ ...actor, eventId: route.itemId });
      logSuccess(`mainserver_${route.contentKind}_delete`, route.itemId);
      return json({ data });
    },
  })(request, ctx);
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
