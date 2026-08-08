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
  isTimeOfDay,
  json,
  matchRequestRoute,
  parseJsonObjectBody,
  readBoolean,
  readString,
  type ParsedValue,
  type RouteMatch as SharedRouteMatch,
} from './content-route-core.js';
import { withMainserverContextBinding } from './content-route-context.js';
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
  changeSvaMainserverEventVisibility,
  createSvaMainserverEvent,
  deleteSvaMainserverEvent,
  getSvaMainserverEventDetail,
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

const matchRoute = (request: Request): RouteMatch | null =>
  matchRequestRoute(request, EVENTS_COLLECTION_PATH, 'events');

const parseEventDates = (
  value: unknown
): readonly SvaMainserverDateInput[] | Response | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const dates: SvaMainserverDateInput[] = [];
  for (const item of value) {
    if (!isRecord(item)) {
      continue;
    }
    const timeStart = readString(item.timeStart);
    const timeEnd = readString(item.timeEnd);
    if ((timeStart && !isTimeOfDay(timeStart)) || (timeEnd && !isTimeOfDay(timeEnd))) {
      return errorJson(
        400,
        'invalid_request',
        'Termine müssen Uhrzeiten im Format HH:MM enthalten.'
      );
    }
    dates.push({
      ...(readString(item.weekday) ? { weekday: readString(item.weekday) } : {}),
      ...(readString(item.dateStart) ? { dateStart: readString(item.dateStart) } : {}),
      ...(readString(item.dateEnd) ? { dateEnd: readString(item.dateEnd) } : {}),
      ...(timeStart ? { timeStart } : {}),
      ...(timeEnd ? { timeEnd } : {}),
      ...(readString(item.timeDescription)
        ? { timeDescription: readString(item.timeDescription) }
        : {}),
      ...(readBoolean(item.useOnlyTimeDescription) !== undefined
        ? { useOnlyTimeDescription: readBoolean(item.useOnlyTimeDescription) }
        : {}),
    });
  }
  return dates;
};

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
  dates: readonly SvaMainserverDateInput[] | undefined,
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
    ...(relations.accessibilityInformation
      ? { accessibilityInformation: relations.accessibilityInformation }
      : {}),
    ...(relations.tags ? { tags: relations.tags } : {}),
    ...(readString(body.recurring) ? { recurring: readString(body.recurring) } : {}),
    ...(readString(body.recurringType) ? { recurringType: readString(body.recurringType) } : {}),
    ...(readString(body.recurringInterval)
      ? { recurringInterval: readString(body.recurringInterval) }
      : {}),
    ...(Array.isArray(body.recurringWeekdays)
      ? {
          recurringWeekdays: body.recurringWeekdays
            .map(readString)
            .filter((value): value is string => Boolean(value)),
        }
      : {}),
    ...(readString(body.pointOfInterestId)
      ? { pointOfInterestId: readString(body.pointOfInterestId) }
      : {}),
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

  const dates = parseEventDates(body.dates);
  if (isResponse(dates)) {
    return dates;
  }

  const visible = readBoolean(body.visible);
  if (body.visible !== undefined && visible === undefined) {
    return errorJson(
      400,
      'invalid_request',
      'Das Feld "visible" muss als Boolean gesendet werden.'
    );
  }

  return {
    event: buildEventInput(body, title, dates, relations),
    ...(visible !== undefined ? { visible } : {}),
  };
};

const validateMutationRequest = (request: Request, requestId?: string): Response | null => {
  const csrfError = validateCsrf(request, requestId);
  return csrfError
    ? errorJson(403, 'csrf_validation_failed', 'Sicherheitsprüfung fehlgeschlagen.')
    : null;
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
    status
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
    credentialVisibleCompatibility: action !== 'events.read',
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

const authorizeMutationOrResponse = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  contentKind: ContentKind,
  action: string,
  contentId?: string
): Promise<MainserverMutationActor | Response> => {
  const authorizedActor = await authorizeOrResponse(ctx, contentKind, action, contentId);
  if (isResponse(authorizedActor)) {
    return authorizedActor;
  }
  return resolveMainserverMutationActor({ request, ctx, authorizedActor });
};

const handleCollectionRead = async (
  request: Request,
  route: Extract<RouteMatch, { readonly kind: 'collection' }>,
  ctx: AuthenticatedRequestContext,
  logSuccess: (operation: string, contentId?: string) => void
) => {
  const actor = await authorizeOrResponse(
    ctx,
    route.contentKind,
    pluginActionFor(route.contentKind, 'read')
  );
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
  const actor = await authorizeOrResponse(
    ctx,
    route.contentKind,
    pluginActionFor(route.contentKind, 'read'),
    route.itemId
  );
  if (isResponse(actor)) {
    return actor;
  }

  const detail = await getSvaMainserverEventDetail({ ...actor, eventId: route.itemId });
  for (const deviation of detail.deviations) {
    logger.warn('Mainserver detail response degraded', {
      operation: 'mainserver_event_detail',
      instance_id: actor.instanceId,
      content_type: EVENTS_CONTENT_TYPE,
      content_id: route.itemId,
      phase: deviation.phase,
      field_path: deviation.fieldPath,
      deviation_code: deviation.code,
      handling: deviation.handling,
    });
  }
  logSuccess(`mainserver_${route.contentKind}_detail`, route.itemId);
  return json({ data: detail.data, meta: { deviations: detail.deviations } });
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

const createContentMutationHandler = <TInput>(input: {
  readonly route: Extract<RouteMatch, { readonly kind: 'collection' | 'item' }>;
  readonly action: 'create' | 'update' | 'delete';
  readonly requestId?: string;
  readonly parse: (request: Request) => Promise<TInput | Response>;
  readonly execute: (actor: MainserverMutationActor, parsed: TInput) => Promise<Response>;
}) => {
  const workflow = createMutationWorkflow<
    AuthenticatedRequestContext,
    {
      readonly requestId?: string;
      readonly contentId?: string;
    },
    {
      readonly actor: MainserverMutationActor;
    },
    Record<never, never>,
    TInput,
    Response
  >({
    prepare: () => ({
      requestId: input.requestId,
      ...(input.route.kind === 'item' ? { contentId: input.route.itemId } : {}),
    }),
    authorize: async ({ request, context, contentId }) => {
      const actor = await authorizeMutationOrResponse(
        request,
        context,
        input.route.contentKind,
        pluginActionFor(input.route.contentKind, input.action),
        contentId
      );
      return isResponse(actor) ? actor : { actor };
    },
    csrf: ({ request, requestId }) => validateMutationRequest(request, requestId) ?? undefined,
    parse: ({ request }) => input.parse(request),
    execute: async ({ actor, input: parsed, contentId }) =>
      runMainserverMutationWithFailureFinalization({
        actor,
        contentId,
        operation: async () => await input.execute(actor, parsed),
      }),
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

  return (request: Request, ctx: AuthenticatedRequestContext): Promise<Response> =>
    workflow(request, ctx);
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
      const principalAuthorization = await authorizeMainserverCreateForPrincipal({
        actor,
        action: pluginActionFor(route.contentKind, 'create'),
        contentType: EVENTS_CONTENT_TYPE,
      });
      if (isResponse(principalAuthorization)) return principalAuthorization;
      const result = await createSvaMainserverEvent({ ...actor, event: parsed.event });
      const bindingOutcome = await recordCreatedMainserverDataProvider({
        actor,
        created: result,
        reread: async () =>
          (await getSvaMainserverEventDetail({ ...actor, eventId: result.id })).data,
        contentType: EVENTS_CONTENT_TYPE,
      });
      if (parsed.visible === false) {
        try {
          await changeSvaMainserverEventVisibility({
            ...actor,
            eventId: result.id,
            visible: false,
          });
        } catch (error) {
          await finalizeMainserverMutation({
            actor,
            providerOutcome: 'succeeded',
            reconciliationStatus: 'reconciliation_required',
            completedSteps: ['provider_write'],
            contentId: result.id,
            observedDataProviderId: result.dataProvider?.id,
            lastErrorCode: error instanceof SvaMainserverError ? error.code : 'visibility_failed',
          });
          return toEventVisibilityPartialFailureResponse(
            error,
            { ...result, visible: false },
            'erstellt'
          );
        }
      }
      await finalizeMainserverMutation({
        actor,
        providerOutcome: 'succeeded',
        reconciliationStatus:
          bindingOutcome === 'conflict' || bindingOutcome === 'reconciliation_required'
            ? 'reconciliation_required'
            : 'complete',
        completedSteps: ['provider_write', 'binding_observation'],
        contentId: result.id,
        observedDataProviderId: result.dataProvider?.id,
      });
      logSuccess(`mainserver_${route.contentKind}_create`, result.id);
      return json(
        {
          data: parsed.visible === undefined ? result : { ...result, visible: parsed.visible },
          ...(bindingOutcome === 'conflict' || bindingOutcome === 'reconciliation_required'
            ? { meta: { reconciliationStatus: 'reconciliation_required' } }
            : {}),
        },
        201
      );
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
      const existing = await getSvaMainserverEventDetail({ ...actor, eventId: route.itemId });
      const providerAuthorization = await authorizeMainserverExistingContent({
        actor,
        action: pluginActionFor(route.contentKind, 'update'),
        contentType: EVENTS_CONTENT_TYPE,
        contentId: route.itemId,
        item: existing.data,
        additionalActions: toMainserverAdditionalActions(
          resolveMainserverVisibilityAction(existing.data.visible, parsed.visible)
        ),
      });
      if (isResponse(providerAuthorization)) return providerAuthorization;
      const result = await updateSvaMainserverEvent({
        ...actor,
        eventId: route.itemId,
        event: parsed.event,
      });
      if (parsed.visible !== undefined) {
        try {
          await changeSvaMainserverEventVisibility({
            ...actor,
            eventId: route.itemId,
            visible: parsed.visible,
          });
        } catch (error) {
          await finalizeMainserverMutation({
            actor,
            providerOutcome: 'succeeded',
            reconciliationStatus: 'reconciliation_required',
            completedSteps: ['provider_write'],
            contentId: route.itemId,
            observedDataProviderId: existing.data?.dataProvider?.id,
            lastErrorCode: error instanceof SvaMainserverError ? error.code : 'visibility_failed',
          });
          return toEventVisibilityPartialFailureResponse(
            error,
            { ...result, visible: parsed.visible },
            'aktualisiert'
          );
        }
      }
      await finalizeMainserverMutation({
        actor,
        providerOutcome: 'succeeded',
        reconciliationStatus: 'complete',
        completedSteps: ['provider_write'],
        contentId: route.itemId,
        observedDataProviderId: existing.data?.dataProvider?.id,
      });
      logSuccess(`mainserver_${route.contentKind}_update`, route.itemId);
      return json({
        data: parsed.visible === undefined ? result : { ...result, visible: parsed.visible },
      });
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
      const existing = await getSvaMainserverEventDetail({ ...actor, eventId: route.itemId });
      const providerAuthorization = await authorizeMainserverExistingContent({
        actor,
        action: pluginActionFor(route.contentKind, 'delete'),
        contentType: EVENTS_CONTENT_TYPE,
        contentId: route.itemId,
        item: existing.data,
      });
      if (isResponse(providerAuthorization)) return providerAuthorization;
      const data = await deleteSvaMainserverEvent({ ...actor, eventId: route.itemId });
      await finalizeMainserverMutation({
        actor,
        providerOutcome: 'succeeded',
        reconciliationStatus: 'complete',
        completedSteps: ['provider_write', 'tombstone'],
        contentId: route.itemId,
        observedDataProviderId: existing.data?.dataProvider?.id,
      });
      logSuccess(`mainserver_${route.contentKind}_delete`, route.itemId);
      return json({ data });
    },
  })(request, ctx);
};

const dispatchAuthenticated = async (
  request: Request,
  route: RouteMatch,
  ctx: AuthenticatedRequestContext
) => {
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
      return withMainserverContextBinding(await handleItemRead(route, ctx, logSuccess), ctx);
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

export const dispatchSvaMainserverEventsRequest = async (
  request: Request
): Promise<Response | null> => {
  const route = matchRoute(request);
  if (!route) {
    return null;
  }

  return withAuthenticatedUser(request, (ctx) => dispatchAuthenticated(request, route, ctx));
};
