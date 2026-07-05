import {
  authorizeContentPrimitiveForUser,
  validateCsrf,
  withAuthenticatedUser,
  type AuthenticatedRequestContext,
} from '@sva/auth-runtime/server';
import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';

import type {
  SvaMainserverAccessibilityInformationInput,
  SvaMainserverAddressInput,
  SvaMainserverCategoryInput,
  SvaMainserverContactInput,
  SvaMainserverContentBlockInput,
  SvaMainserverDateInput,
  SvaMainserverGenericItemInput,
  SvaMainserverLocationInput,
  SvaMainserverMediaContentInput,
  SvaMainserverOpeningHourInput,
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
  readNumber,
  readString,
  type RouteMatch as SharedRouteMatch,
} from './content-route-core.js';
import {
  parseAccessibilityInformation,
  parseAddressList,
  parseCategories,
  parseContact,
  parseMediaContents,
  parseOpeningHours,
  parsePrices,
  parseWebUrls,
} from './content-route-parsers.js';
import { SvaMainserverError } from './errors.js';
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
const logger = createSdkLogger({ component: 'sva-mainserver-generic-items-route', level: 'info' });

type ContentKind = 'generic-items';

type ContentActor = {
  readonly instanceId: string;
  readonly keycloakSubject: string;
  readonly activeOrganizationId?: string;
};

type RouteMatch = SharedRouteMatch<ContentKind>;

const matchRoute = (request: Request): RouteMatch | null =>
  matchRequestRoute(request, GENERIC_ITEMS_COLLECTION_PATH, 'generic-items');

const parseDates = (value: unknown): readonly SvaMainserverDateInput[] | undefined =>
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
        .filter((date) => Object.keys(date).length > 0)
    : undefined;

const parseContentBlockMediaContents = (
  value: unknown
): Array<NonNullable<NonNullable<SvaMainserverContentBlockInput['mediaContents']>[number]>> | Response => {
  if (value === undefined || value === null) {
    return [];
  }

  const parsed = parseMediaContents(value);
  return parsed instanceof Response ? parsed : [...(parsed ?? [])];
};

const parseContentBlocks = (value: unknown): readonly SvaMainserverContentBlockInput[] | undefined | Response => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    return errorJson(400, 'invalid_request', 'ContentBlocks müssen als Liste gesendet werden.');
  }

  const blocks: SvaMainserverContentBlockInput[] = [];
  for (const block of value) {
    if (!isRecord(block)) {
      return errorJson(400, 'invalid_request', 'ContentBlocks müssen Objekte sein.');
    }

    const mediaContents = parseContentBlockMediaContents(block.mediaContents);
    if (mediaContents instanceof Response) {
      return mediaContents;
    }

    const parsedBlock: SvaMainserverContentBlockInput = {
      ...(readString(block.title) ? { title: readString(block.title) } : {}),
      ...(readString(block.intro) ? { intro: readString(block.intro) } : {}),
      ...(readString(block.body) ? { body: readString(block.body) } : {}),
      ...(mediaContents.length > 0 ? { mediaContents } : {}),
    };

    if (Object.keys(parsedBlock).length > 0) {
      blocks.push(parsedBlock);
    }
  }

  return blocks;
};

const parseContactList = (value: unknown): readonly SvaMainserverContactInput[] | undefined | Response => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    return errorJson(400, 'invalid_request', 'Kontakte müssen als Liste gesendet werden.');
  }

  const contacts: SvaMainserverContactInput[] = [];
  for (const item of value) {
    const parsed = parseContact(item);
    if (parsed instanceof Response) {
      return parsed;
    }
    if (parsed) {
      contacts.push(parsed);
    }
  }

  return contacts;
};

const parseAccessibilityInformations = (
  value: unknown
): readonly SvaMainserverAccessibilityInformationInput[] | undefined | Response => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    return errorJson(400, 'invalid_request', 'Barrierefreiheitsinformationen müssen als Liste gesendet werden.');
  }

  const items: SvaMainserverAccessibilityInformationInput[] = [];
  for (const item of value) {
    const parsed = parseAccessibilityInformation(item);
    if (parsed instanceof Response) {
      return parsed;
    }
    if (parsed) {
      items.push(parsed);
    }
  }

  return items;
};

const parseLocations = (value: unknown): readonly SvaMainserverLocationInput[] | undefined | Response => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    return errorJson(400, 'invalid_request', 'Orte müssen als Liste gesendet werden.');
  }

  const locations: SvaMainserverLocationInput[] = [];
  for (const item of value) {
    if (!isRecord(item)) {
      return errorJson(400, 'invalid_request', 'Orte müssen Objekte sein.');
    }

    const location = {
      ...(readString(item.name) ? { name: readString(item.name) } : {}),
      ...(readString(item.department) ? { department: readString(item.department) } : {}),
      ...(readString(item.district) ? { district: readString(item.district) } : {}),
      ...(readString(item.regionName) ? { regionName: readString(item.regionName) } : {}),
      ...(readString(item.state) ? { state: readString(item.state) } : {}),
      ...(isRecord(item.geoLocation)
        ? {
            geoLocation: {
              ...(readNumber(item.geoLocation.latitude) !== undefined
                ? { latitude: readNumber(item.geoLocation.latitude) }
                : {}),
              ...(readNumber(item.geoLocation.longitude) !== undefined
                ? { longitude: readNumber(item.geoLocation.longitude) }
                : {}),
            },
          }
        : {}),
    };

    if (Object.keys(location).length > 0) {
      locations.push(location);
    }
  }

  return locations;
};

const buildGenericItemInput = (input: {
  body: Record<string, unknown>;
  title: string;
  genericType: string;
  categories: readonly SvaMainserverCategoryInput[] | undefined;
  contacts: readonly SvaMainserverContactInput[] | undefined;
  webUrls: readonly SvaMainserverWebUrlInput[] | undefined;
  addresses: readonly SvaMainserverAddressInput[] | undefined;
  contentBlocks: readonly SvaMainserverContentBlockInput[] | undefined;
  openingHours: readonly SvaMainserverOpeningHourInput[] | undefined;
  priceInformations: readonly SvaMainserverPriceInput[] | undefined;
  mediaContents: readonly SvaMainserverMediaContentInput[] | undefined;
  locations: readonly SvaMainserverLocationInput[] | undefined;
  dates: readonly SvaMainserverDateInput[] | undefined;
  accessibilityInformations: readonly SvaMainserverAccessibilityInformationInput[] | undefined;
}): SvaMainserverGenericItemInput => ({
  title: input.title,
  genericType: input.genericType,
  ...(readString(input.body.teaser) ? { teaser: readString(input.body.teaser) } : {}),
  ...(readBoolean(input.body.visible) !== undefined ? { visible: readBoolean(input.body.visible) } : {}),
  ...(readString(input.body.author) ? { author: readString(input.body.author) } : {}),
  ...(readString(input.body.keywords) ? { keywords: readString(input.body.keywords) } : {}),
  ...(readString(input.body.externalId) ? { externalId: readString(input.body.externalId) } : {}),
  ...(readString(input.body.publicationDate) ? { publicationDate: readString(input.body.publicationDate) } : {}),
  ...(readString(input.body.publishedAt) ? { publishedAt: readString(input.body.publishedAt) } : {}),
  ...(readString(input.body.categoryName) ? { categoryName: readString(input.body.categoryName) } : {}),
  ...(input.body.payload !== undefined ? { payload: input.body.payload } : {}),
  ...(input.categories ? { categories: input.categories } : {}),
  ...(input.contacts ? { contacts: input.contacts } : {}),
  ...(input.webUrls ? { webUrls: input.webUrls } : {}),
  ...(input.addresses ? { addresses: input.addresses } : {}),
  ...(input.contentBlocks ? { contentBlocks: input.contentBlocks } : {}),
  ...(input.openingHours ? { openingHours: input.openingHours } : {}),
  ...(input.priceInformations ? { priceInformations: input.priceInformations } : {}),
  ...(input.mediaContents ? { mediaContents: input.mediaContents } : {}),
  ...(input.locations ? { locations: input.locations } : {}),
  ...(input.dates ? { dates: input.dates } : {}),
  ...(input.accessibilityInformations ? { accessibilityInformations: input.accessibilityInformations } : {}),
});

const parseGenericItemInput = async (request: Request): Promise<SvaMainserverGenericItemInput | Response> => {
  const body = await parseJsonObjectBody(request, 'Generic-Item-Daten müssen als Objekt gesendet werden.');
  if (isResponse(body)) {
    return body;
  }

  const title = readString(body.title);
  if (!title) {
    return errorJson(400, 'invalid_request', 'Der Titel ist erforderlich.');
  }

  const genericType = readString(body.genericType);
  if (!genericType) {
    return errorJson(400, 'invalid_request', 'Der Generic-Type ist erforderlich.');
  }

  const categories = parseCategories(body.categories);
  const contacts = parseContactList(body.contacts);
  const webUrls = parseWebUrls(body.webUrls);
  const addresses = parseAddressList(body.addresses);
  const contentBlocks = parseContentBlocks(body.contentBlocks);
  const openingHours = parseOpeningHours(body.openingHours);
  const priceInformations = parsePrices(body.priceInformations);
  const mediaContents = parseMediaContents(body.mediaContents);
  const locations = parseLocations(body.locations);
  const dates = parseDates(body.dates);
  const accessibilityInformations = parseAccessibilityInformations(body.accessibilityInformations);

  if (isResponse(categories)) {
    return categories;
  }
  if (isResponse(contacts)) {
    return contacts;
  }
  if (isResponse(webUrls)) {
    return webUrls;
  }
  if (isResponse(addresses)) {
    return addresses;
  }
  if (isResponse(contentBlocks)) {
    return contentBlocks;
  }
  if (isResponse(openingHours)) {
    return openingHours;
  }
  if (isResponse(priceInformations)) {
    return priceInformations;
  }
  if (isResponse(mediaContents)) {
    return mediaContents;
  }
  if (isResponse(locations)) {
    return locations;
  }
  if (isResponse(accessibilityInformations)) {
    return accessibilityInformations;
  }

  return buildGenericItemInput({
    body,
    title,
    genericType,
    categories,
    contacts,
    webUrls,
    addresses,
    contentBlocks,
    openingHours,
    priceInformations,
    mediaContents,
    locations,
    dates,
    accessibilityInformations,
  });
};

const validateMutationRequest = (request: Request, requestId?: string): Response | null => {
  const csrfError = validateCsrf(request, requestId);
  return csrfError ? errorJson(403, 'csrf_validation_failed', 'Sicherheitsprüfung fehlgeschlagen.') : null;
};

const pluginActionFor = (actionName: 'read' | 'create' | 'update' | 'delete') => `generic-items.${actionName}`;

const authorizeOrResponse = async (
  ctx: AuthenticatedRequestContext,
  action: string,
  contentId?: string
): Promise<ContentActor | Response> => {
  const result = await authorizeContentPrimitiveForUser({
    ctx,
    action,
    resource: {
      contentType: GENERIC_ITEMS_CONTENT_TYPE,
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
      content_type: GENERIC_ITEMS_CONTENT_TYPE,
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
  actionName: 'create' | 'update' | 'delete',
  requestId?: string,
  contentId?: string
): Promise<Response | ContentActor> => {
  const csrfError = validateMutationRequest(request, requestId);
  if (csrfError) {
    return csrfError;
  }

  return authorizeOrResponse(ctx, pluginActionFor(actionName), contentId);
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
      const actor = await authorizeOrResponse(ctx, pluginActionFor('read'));
      if (isResponse(actor)) {
        return actor;
      }

      const data = await listSvaMainserverGenericItems({ ...actor, ...parseMainserverListQuery(request) });
      logSuccess('mainserver_generic-items_list');
      return json(data);
    }

    if (route.kind === 'item' && request.method === 'GET') {
      const actor = await authorizeOrResponse(ctx, pluginActionFor('read'), route.itemId);
      if (isResponse(actor)) {
        return actor;
      }

      const data = await getSvaMainserverGenericItem({ ...actor, genericItemId: route.itemId });
      logSuccess('mainserver_generic-items_detail', route.itemId);
      return json({ data });
    }

    if (route.kind === 'collection' && request.method === 'POST') {
      const actor = await authorizeMutation(request, ctx, 'create', workspaceContext.requestId);
      if (isResponse(actor)) {
        return actor;
      }

      const genericItem = await parseGenericItemInput(request);
      if (isResponse(genericItem)) {
        return genericItem;
      }

      const data = await createSvaMainserverGenericItem({ ...actor, genericItem });
      logSuccess('mainserver_generic-items_create', data.id);
      return json({ data }, 201);
    }

    if (route.kind === 'item' && request.method === 'PATCH') {
      const actor = await authorizeMutation(request, ctx, 'update', workspaceContext.requestId, route.itemId);
      if (isResponse(actor)) {
        return actor;
      }

      const genericItem = await parseGenericItemInput(request);
      if (isResponse(genericItem)) {
        return genericItem;
      }

      const data = await updateSvaMainserverGenericItem({ ...actor, genericItemId: route.itemId, genericItem });
      logSuccess('mainserver_generic-items_update', route.itemId);
      return json({ data });
    }

    if (route.kind === 'item' && request.method === 'DELETE') {
      const actor = await authorizeMutation(request, ctx, 'delete', workspaceContext.requestId, route.itemId);
      if (isResponse(actor)) {
        return actor;
      }

      const data = await deleteSvaMainserverGenericItem({ ...actor, genericItemId: route.itemId });
      logSuccess('mainserver_generic-items_delete', route.itemId);
      return json({ data });
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
