import { createHash } from 'node:crypto';
import {
  authorizeContentPrimitiveForUser,
  completeIdempotency,
  reserveIdempotency,
  resolveActorInfo,
  validateCsrf,
  withAuthenticatedUser,
  type AuthenticatedRequestContext,
} from '@sva/auth-runtime/server';
import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';

import type { SvaMainserverNewsInput } from '../types.js';
import {
  errorJson,
  isRecord,
  isResponse,
  json,
  parseAddress,
  parseCategories,
  parseWebUrl,
  readBoolean,
  readNumber,
  readString,
} from './content-route-helpers.js';
import { SvaMainserverError } from './errors.js';
import { parseMainserverListQuery } from './list-pagination.js';
import {
  changeSvaMainserverNewsVisibility,
  createSvaMainserverNews,
  deleteSvaMainserverNews,
  getSvaMainserverNews,
  listSvaMainserverCategories,
  listSvaMainserverNews,
  updateSvaMainserverNews,
} from './service.js';

const NEWS_CONTENT_TYPE = 'news.article';
const NEWS_COLLECTION_PATH = '/api/v1/mainserver/news';
const NEWS_ITEM_PATH_PREFIX = `${NEWS_COLLECTION_PATH}/`;
const CATEGORY_COLLECTION_PATH = '/api/v1/mainserver/categories';
const logger = createSdkLogger({ component: 'sva-mainserver-news-route', level: 'info' });

type RouteMatch =
  | { readonly kind: 'collection' }
  | { readonly kind: 'categories' }
  | { readonly kind: 'item'; readonly newsId: string }
  | { readonly kind: 'itemVisibility'; readonly newsId: string };

const matchRoute = (request: Request): RouteMatch | null => {
  const pathname = new URL(request.url).pathname;
  if (pathname === CATEGORY_COLLECTION_PATH) {
    return { kind: 'categories' };
  }
  if (pathname === NEWS_COLLECTION_PATH) {
    return { kind: 'collection' };
  }
  if (pathname.endsWith('/visibility') && pathname.startsWith(NEWS_ITEM_PATH_PREFIX)) {
    const newsId = decodeURIComponent(pathname.slice(NEWS_ITEM_PATH_PREFIX.length, -'/visibility'.length));
    if (newsId.length > 0 && newsId.includes('/') === false) {
      return { kind: 'itemVisibility', newsId };
    }
  }
  if (pathname.startsWith(NEWS_ITEM_PATH_PREFIX)) {
    const newsId = decodeURIComponent(pathname.slice(NEWS_ITEM_PATH_PREFIX.length));
    if (newsId.length > 0 && newsId.includes('/') === false) {
      return { kind: 'item', newsId };
    }
  }
  return null;
};

type ParsedNewsInput = {
  readonly news: SvaMainserverNewsInput;
  readonly rawBody: string;
  readonly visible?: boolean;
};

type ParseOptions = {
  readonly allowPushNotification: boolean;
};

type ParsedVisibilityInput = {
  readonly visible: boolean;
};

const normalizeVisibilityFilter = (value: string | null): 'all' | 'visible' | 'hidden' => {
  switch (value) {
    case 'visible':
    case 'hidden':
      return value;
    default:
      return 'all';
  }
};

const normalizeEditorialStatusFilter = (value: string | null): 'all' | 'draft' | 'scheduled' | 'published' => {
  switch (value) {
    case 'draft':
    case 'scheduled':
    case 'published':
      return value;
    default:
      return 'all';
  }
};

const toPayloadHash = (rawBody: string): string => createHash('sha256').update(rawBody).digest('hex');

const readonlyMutationFields = new Set([
  'id',
  'contentType',
  'status',
  'payload',
  'createdAt',
  'updatedAt',
  'dataProvider',
  'settings',
  'announcements',
  'likeCount',
  'likedByMe',
  'pushNotificationsSentAt',
]);

const isValidDate = (value: string): boolean => Number.isNaN(new Date(value).getTime()) === false;

const getVisibleTextLength = (value: string): number => {
  let inTag = false;
  let previousWasWhitespace = true;
  let visibleLength = 0;

  for (const character of value) {
    if (character === '<') {
      inTag = true;
      continue;
    }

    if (character === '>' && inTag) {
      inTag = false;
      previousWasWhitespace = true;
      continue;
    }

    if (inTag) {
      continue;
    }

    if (/\s/u.test(character)) {
      previousWasWhitespace = true;
      continue;
    }

    if (previousWasWhitespace && visibleLength > 0) {
      visibleLength += 1;
    }

    visibleLength += 1;
    previousWasWhitespace = false;
  }

  return visibleLength;
};

const parseContentBlockMediaContents = (
  value: unknown
): Array<NonNullable<NonNullable<SvaMainserverNewsInput['contentBlocks']>[number]['mediaContents']>[number]> | Response => {
  const mediaContents: Array<
    NonNullable<NonNullable<SvaMainserverNewsInput['contentBlocks']>[number]['mediaContents']>[number]
  > = [];

  if (value === undefined || value === null) {
    return mediaContents;
  }
  if (!Array.isArray(value)) {
    return errorJson(400, 'invalid_request', 'MediaContent muss als Liste gesendet werden.');
  }

  for (const media of value) {
    if (!isRecord(media)) {
      return errorJson(400, 'invalid_request', 'MediaContent-Einträge müssen Objekte sein.');
    }
    const sourceUrl = parseWebUrl(media.sourceUrl);
    if (sourceUrl instanceof Response) {
      return sourceUrl;
    }
    mediaContents.push({
      ...(readString(media.captionText) ? { captionText: readString(media.captionText) } : {}),
      ...(readString(media.copyright) ? { copyright: readString(media.copyright) } : {}),
      ...(readString(media.contentType) ? { contentType: readString(media.contentType) } : {}),
      ...(readNumber(media.height) !== undefined ? { height: readNumber(media.height) } : {}),
      ...(readNumber(media.width) !== undefined ? { width: readNumber(media.width) } : {}),
      ...(sourceUrl ? { sourceUrl } : {}),
    });
  }

  return mediaContents;
};

const hasValidContentBlocks = (blocks: readonly NonNullable<SvaMainserverNewsInput['contentBlocks']>[number][]) =>
  blocks.length > 0 &&
  blocks.some((block) => block.body && getVisibleTextLength(block.body) > 0) &&
  blocks.every((block) => (block.body?.length ?? 0) <= 50_000);

const buildNewsInput = (input: {
  body: Record<string, unknown>;
  title: string;
  publishedAt: string;
  publicationDate?: string;
  charactersToBeShown?: number;
  categories: SvaMainserverNewsInput['categories'] | undefined;
  sourceUrl: SvaMainserverNewsInput['sourceUrl'] | undefined;
  address: SvaMainserverNewsInput['address'] | undefined;
  contentBlocks: SvaMainserverNewsInput['contentBlocks'] | undefined;
  allowPushNotification: boolean;
}): SvaMainserverNewsInput => ({
  title: input.title,
  publishedAt: input.publishedAt,
  ...(readString(input.body.author) ? { author: readString(input.body.author) } : {}),
  ...(readString(input.body.keywords) ? { keywords: readString(input.body.keywords) } : {}),
  ...(readString(input.body.externalId) ? { externalId: readString(input.body.externalId) } : {}),
  ...(readBoolean(input.body.fullVersion) !== undefined ? { fullVersion: readBoolean(input.body.fullVersion) } : {}),
  ...(input.charactersToBeShown !== undefined ? { charactersToBeShown: input.charactersToBeShown } : {}),
  ...(readString(input.body.newsType) ? { newsType: readString(input.body.newsType) } : {}),
  ...(input.publicationDate ? { publicationDate: input.publicationDate } : {}),
  ...(readBoolean(input.body.showPublishDate) !== undefined ? { showPublishDate: readBoolean(input.body.showPublishDate) } : {}),
  ...(readString(input.body.categoryName) ? { categoryName: readString(input.body.categoryName) } : {}),
  ...(input.categories ? { categories: input.categories } : {}),
  ...(input.sourceUrl ? { sourceUrl: input.sourceUrl } : {}),
  ...(input.address ? { address: input.address } : {}),
  ...(input.contentBlocks ? { contentBlocks: input.contentBlocks } : {}),
  ...(readString(input.body.pointOfInterestId) ? { pointOfInterestId: readString(input.body.pointOfInterestId) } : {}),
  ...(input.allowPushNotification && readBoolean(input.body.pushNotification) !== undefined
    ? { pushNotification: readBoolean(input.body.pushNotification) }
    : {}),
});

const parseContentBlocks = (value: unknown): SvaMainserverNewsInput['contentBlocks'] | undefined | Response => {
  if (value === undefined || value === null) {
    return errorJson(400, 'invalid_request', 'Mindestens ein Inhaltsblock benötigt Inhalt und darf maximal 50.000 Zeichen haben.');
  }
  if (!Array.isArray(value)) {
    return errorJson(400, 'invalid_request', 'ContentBlocks müssen als Liste gesendet werden.');
  }

  const blocks: Array<NonNullable<SvaMainserverNewsInput['contentBlocks']>[number]> = [];
  for (const block of value) {
    if (!isRecord(block)) {
      return errorJson(400, 'invalid_request', 'ContentBlocks müssen Objekte sein.');
    }
    const mediaContents = parseContentBlockMediaContents(block.mediaContents);
    if (mediaContents instanceof Response) {
      return mediaContents;
    }
    blocks.push({
      ...(readString(block.title) ? { title: readString(block.title) } : {}),
      ...(readString(block.intro) ? { intro: readString(block.intro) } : {}),
      ...(readString(block.body) ? { body: readString(block.body) } : {}),
      ...(mediaContents.length > 0 ? { mediaContents } : {}),
    });
  }
  if (!hasValidContentBlocks(blocks)) {
    return errorJson(400, 'invalid_request', 'Mindestens ein Inhaltsblock benötigt Inhalt und darf maximal 50.000 Zeichen haben.');
  }
  return blocks;
};

const parseNewsInput = async (request: Request, options: ParseOptions): Promise<ParsedNewsInput | Response> => {
  const rawBody = await request.text();
  let body: unknown;
  try {
    body = JSON.parse(rawBody) as unknown;
  } catch {
    return errorJson(400, 'invalid_request', 'Request-Body muss gültiges JSON sein.');
  }

  if (!isRecord(body)) {
    return errorJson(400, 'invalid_request', 'News-Daten müssen als Objekt gesendet werden.');
  }

  const readonlyField = Object.keys(body).find((key) => readonlyMutationFields.has(key));
  if (readonlyField) {
    return errorJson(400, 'invalid_request', `Das Feld "${readonlyField}" darf nicht geschrieben werden.`);
  }

  if (!options.allowPushNotification && body.pushNotification !== undefined) {
    return errorJson(400, 'invalid_request', 'Push-Benachrichtigungen sind nur beim Erstellen erlaubt.');
  }

  const visible = readBoolean(body.visible);
  if ('visible' in body && visible === undefined) {
    return errorJson(400, 'invalid_request', 'Das Feld "visible" muss als Boolean gesendet werden.');
  }

  const title = readString(body.title);
  const publishedAt = readString(body.publishedAt);
  if (!title || !publishedAt || !isValidDate(publishedAt)) {
    return errorJson(400, 'invalid_request', 'Titel und Veröffentlichungsdatum sind erforderlich.');
  }

  const publicationDate = readString(body.publicationDate);
  if (publicationDate && !isValidDate(publicationDate)) {
    return errorJson(400, 'invalid_request', 'Das Publikationsdatum ist ungültig.');
  }

  const charactersToBeShown = readNumber(body.charactersToBeShown);
  if (
    body.charactersToBeShown !== undefined &&
    (charactersToBeShown === undefined || charactersToBeShown < 0 || Number.isInteger(charactersToBeShown) === false)
  ) {
    return errorJson(400, 'invalid_request', 'Die Zeichenbegrenzung muss eine nicht-negative Ganzzahl sein.');
  }

  const sourceUrl = parseWebUrl(body.sourceUrl);
  if (sourceUrl instanceof Response) {
    return sourceUrl;
  }
  const categories = parseCategories(body.categories);
  if (categories instanceof Response) {
    return categories;
  }
  const address = parseAddress(body.address, {
    requireGeoLocationObjectMessage: 'Geo-Koordinaten müssen als Objekt gesendet werden.',
  });
  if (address instanceof Response) {
    return address;
  }
  const contentBlocks = parseContentBlocks(body.contentBlocks);
  if (contentBlocks instanceof Response) {
    return contentBlocks;
  }

  return {
    rawBody,
    visible,
    news: buildNewsInput({
      body,
      title,
      publishedAt,
      publicationDate,
      charactersToBeShown,
      categories,
      sourceUrl,
      address,
      contentBlocks,
      allowPushNotification: options.allowPushNotification,
    }),
  };
};

const parseVisibilityInput = async (request: Request): Promise<ParsedVisibilityInput | Response> => {
  let body: unknown;
  try {
    body = (await request.json()) as unknown;
  } catch {
    return errorJson(400, 'invalid_request', 'Request-Body muss gültiges JSON sein.');
  }

  if (!isRecord(body)) {
    return errorJson(400, 'invalid_request', 'Sichtbarkeitsdaten müssen als Objekt gesendet werden.');
  }

  const visible = readBoolean(body.visible);
  if (visible === undefined) {
    return errorJson(400, 'invalid_request', 'Das Feld "visible" muss als Boolean gesendet werden.');
  }

  return { visible };
};

const validateMutationRequest = (request: Request, requestId?: string): Response | null => {
  const csrfError = validateCsrf(request, requestId);
  if (csrfError) {
    return errorJson(403, 'csrf_validation_failed', 'Sicherheitsprüfung fehlgeschlagen.');
  }
  return null;
};

const readIdempotencyKey = (request: Request): string | Response => {
  const key = request.headers.get('idempotency-key')?.trim();
  return key && key.length > 0
    ? key
    : errorJson(400, 'idempotency_key_required', 'Header Idempotency-Key ist erforderlich.');
};

const completeNewsCreateIdempotency = async (input: {
  readonly actorAccountId: string;
  readonly instanceId: string;
  readonly idempotencyKey: string;
  readonly responseBody: Record<string, unknown>;
  readonly responseStatus: number;
}) =>
  completeIdempotency({
    actorAccountId: input.actorAccountId,
    endpoint: 'POST:/api/v1/mainserver/news',
    idempotencyKey: input.idempotencyKey,
    instanceId: input.instanceId,
    responseBody: input.responseBody,
    responseStatus: input.responseStatus,
    status: input.responseStatus >= 400 ? 'FAILED' : 'COMPLETED',
  });

const readResponseBody = async (response: Response, fallback: Record<string, unknown>): Promise<Record<string, unknown>> => {
  const body = await response.clone().json().catch(() => fallback);
  return isRecord(body) ? body : fallback;
};

const handleCollectionRead = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  logSuccess: (operation: string, newsId?: string) => void
) => {
  const actor = await authorizeOrResponse(ctx, 'news.read');
  if (isResponse(actor)) {
    return actor;
  }

  const data = await listNewsForRequest(request, actor);
  logSuccess('mainserver_news_list');
  return json(data);
};

const handleCategoryCollectionRead = async (
  ctx: AuthenticatedRequestContext,
  logSuccess: (operation: string, newsId?: string) => void
) => {
  const actor = await authorizeOrResponse(ctx, 'news.read');
  if (isResponse(actor)) {
    return actor;
  }

  const data = await listSvaMainserverCategories(actor);
  logSuccess('mainserver_news_categories_list');
  return json({ data });
};

const handleItemRead = async (
  route: Extract<RouteMatch, { readonly kind: 'item' }>,
  ctx: AuthenticatedRequestContext,
  logSuccess: (operation: string, newsId?: string) => void
) => {
  const actor = await authorizeOrResponse(ctx, 'news.read', route.newsId);
  if (isResponse(actor)) {
    return actor;
  }

  const data = await getNewsForRoute(route, actor);
  logSuccess('mainserver_news_detail', route.newsId);
  return json({ data });
};

const handleCollectionCreate = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  requestId: string | undefined,
  logSuccess: (operation: string, newsId?: string) => void
) => {
  const csrfError = validateMutationRequest(request, requestId);
  if (csrfError) {
    return csrfError;
  }

  const idempotencyKey = readIdempotencyKey(request);
  if (isResponse(idempotencyKey)) {
    return idempotencyKey;
  }

  const parsed = await parseNewsInput(request, { allowPushNotification: true });
  if (isResponse(parsed)) {
    return parsed;
  }

  const actorInfo = await resolveActorInfo(request, ctx, { requireActorMembership: true });
  if ('error' in actorInfo) {
    return actorInfo.error;
  }

  const actorAccountId = actorInfo.actor.actorAccountId;
  if (!actorAccountId) {
    return errorJson(403, 'forbidden', 'Keine Berechtigung für diese Inhaltsoperation.');
  }

  const idempotency = await reserveIdempotency({
    actorAccountId,
    endpoint: 'POST:/api/v1/mainserver/news',
    idempotencyKey,
    instanceId: actorInfo.actor.instanceId,
    payloadHash: toPayloadHash(parsed.rawBody),
  });
  if (idempotency.status === 'replay') {
    return json(idempotency.responseBody, idempotency.responseStatus);
  }
  if (idempotency.status === 'conflict') {
    return errorJson(409, 'idempotency_key_reuse', idempotency.message);
  }

  const actor = await authorizeOrResponse(ctx, 'news.create');
  if (isResponse(actor)) {
    await completeNewsCreateIdempotency({
      actorAccountId,
      instanceId: actorInfo.actor.instanceId,
      idempotencyKey,
      responseBody: await readResponseBody(actor, {
        error: 'forbidden',
        message: 'Keine Berechtigung für diese Inhaltsoperation.',
      }),
      responseStatus: actor.status,
    });
    return actor;
  }

  try {
    const data = await createSvaMainserverNews({ ...actor, news: parsed.news });
    if (parsed.visible === false) {
      await changeSvaMainserverNewsVisibility({ ...actor, newsId: data.id, visible: false });
    }
    const responseData = parsed.visible === undefined ? data : { ...data, visible: parsed.visible };
    logSuccess('mainserver_news_create', data.id);
    const responseBody = { data: responseData };
    await completeNewsCreateIdempotency({
      actorAccountId,
      instanceId: actorInfo.actor.instanceId,
      idempotencyKey,
      responseBody,
      responseStatus: 201,
    });
    return json(responseBody, 201);
  } catch (error) {
    const response = toMainserverErrorResponse(error);
    await completeNewsCreateIdempotency({
      actorAccountId,
      instanceId: actorInfo.actor.instanceId,
      idempotencyKey,
      responseBody: await readResponseBody(response, {
        error: 'internal_error',
        message: 'Mainserver-News-Anfrage ist fehlgeschlagen.',
      }),
      responseStatus: response.status,
    });
    return response;
  }
};

const handleItemUpdate = async (
  request: Request,
  route: Extract<RouteMatch, { readonly kind: 'item' }>,
  ctx: AuthenticatedRequestContext,
  requestId: string | undefined,
  logSuccess: (operation: string, newsId?: string) => void
) => {
  const csrfError = validateMutationRequest(request, requestId);
  if (csrfError) {
    return csrfError;
  }

  const parsed = await parseNewsInput(request, { allowPushNotification: false });
  if (isResponse(parsed)) {
    return parsed;
  }

  const actor = await authorizeOrResponse(ctx, 'news.update', route.newsId);
  if (isResponse(actor)) {
    return actor;
  }

  const response = await updateNewsForRoute(route, actor, parsed.news, parsed.visible);
  logSuccess('mainserver_news_update', route.newsId);
  return response;
};

const handleItemDelete = async (
  request: Request,
  route: Extract<RouteMatch, { readonly kind: 'item' }>,
  ctx: AuthenticatedRequestContext,
  requestId: string | undefined,
  logSuccess: (operation: string, newsId?: string) => void
) => {
  const csrfError = validateMutationRequest(request, requestId);
  if (csrfError) {
    return csrfError;
  }

  const actor = await authorizeOrResponse(ctx, 'news.delete', route.newsId);
  if (isResponse(actor)) {
    return actor;
  }

  const response = await deleteNewsForRoute(route, actor);
  logSuccess('mainserver_news_delete', route.newsId);
  return response;
};

const handleVisibilityUpdate = async (
  request: Request,
  route: Extract<RouteMatch, { readonly kind: 'itemVisibility' }>,
  ctx: AuthenticatedRequestContext,
  requestId: string | undefined,
  logSuccess: (operation: string, newsId?: string) => void
) => {
  const csrfError = validateMutationRequest(request, requestId);
  if (csrfError) {
    return csrfError;
  }

  const parsed = await parseVisibilityInput(request);
  if (isResponse(parsed)) {
    return parsed;
  }

  const actor = await authorizeOrResponse(ctx, 'news.update', route.newsId);
  if (isResponse(actor)) {
    return actor;
  }

  const response = await changeNewsVisibilityForRoute(route, actor, parsed.visible);
  logSuccess('mainserver_news_visibility_update', route.newsId);
  return response;
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

  return errorJson(500, 'internal_error', 'Mainserver-News-Anfrage ist fehlgeschlagen.');
};

const authorize = async (
  ctx: AuthenticatedRequestContext,
  action: string,
  newsId?: string
): Promise<ReturnType<typeof authorizeContentPrimitiveForUser>> =>
  authorizeContentPrimitiveForUser({
    ctx,
    action,
    resource: {
      contentType: NEWS_CONTENT_TYPE,
      ...(newsId ? { contentId: newsId } : {}),
    },
  });

const authorizeOrResponse = async (
  ctx: AuthenticatedRequestContext,
  action: string,
  newsId?: string
): Promise<
  | {
      readonly instanceId: string;
      readonly keycloakSubject: string;
      readonly activeOrganizationId?: string;
    }
  | Response
> => {
  const result = await authorize(ctx, action, newsId);
  if (!result.ok) {
    const workspaceContext = getWorkspaceContext();
    logger.warn('Mainserver News local authorization denied', {
      operation: 'mainserver_news_authorize',
      request_id: workspaceContext.requestId,
      trace_id: workspaceContext.traceId,
      actor_id: ctx.user.id,
      instance_id: ctx.user.instanceId,
      content_type: NEWS_CONTENT_TYPE,
      content_id: newsId,
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

const listNewsForRequest = async (
  request: Request,
  actor: {
    readonly instanceId: string;
    readonly keycloakSubject: string;
    readonly activeOrganizationId?: string;
  }
) => {
  const searchParams = new URL(request.url).searchParams;
  const includeInvisible = searchParams.get('includeInvisible') === 'true';
  const visibilityFilter = normalizeVisibilityFilter(searchParams.get('visibilityFilter'));
  const editorialStatusFilter = normalizeEditorialStatusFilter(searchParams.get('editorialStatusFilter'));

  return listSvaMainserverNews({
    ...actor,
    ...parseMainserverListQuery(request),
    includeInvisible,
    visibilityFilter,
    editorialStatusFilter,
  });
};

const getNewsForRoute = async (
  route: Extract<RouteMatch, { kind: 'item' }>,
  actor: {
    readonly instanceId: string;
    readonly keycloakSubject: string;
    readonly activeOrganizationId?: string;
  }
) => getSvaMainserverNews({ ...actor, newsId: route.newsId });

const updateNewsForRoute = async (
  route: Extract<RouteMatch, { kind: 'item' }>,
  actor: {
    readonly instanceId: string;
    readonly keycloakSubject: string;
    readonly activeOrganizationId?: string;
  },
  news: SvaMainserverNewsInput,
  visible?: boolean
) => {
  const data = await updateSvaMainserverNews({ ...actor, newsId: route.newsId, news });
  if (visible !== undefined) {
    await changeSvaMainserverNewsVisibility({ ...actor, newsId: route.newsId, visible });
  }
  return json({ data: visible === undefined ? data : { ...data, visible } });
};

const changeNewsVisibilityForRoute = async (
  route: Extract<RouteMatch, { kind: 'itemVisibility' }>,
  actor: {
    readonly instanceId: string;
    readonly keycloakSubject: string;
    readonly activeOrganizationId?: string;
  },
  visible: boolean
) => {
  await changeSvaMainserverNewsVisibility({ ...actor, newsId: route.newsId, visible });
  return json({ data: { id: route.newsId, visible } });
};

const deleteNewsForRoute = async (
  route: Extract<RouteMatch, { kind: 'item' }>,
  actor: {
    readonly instanceId: string;
    readonly keycloakSubject: string;
    readonly activeOrganizationId?: string;
  }
) => {
  const data = await deleteSvaMainserverNews({ ...actor, newsId: route.newsId });
  return json({ data });
};

const dispatchAuthenticated = async (request: Request, route: RouteMatch, ctx: AuthenticatedRequestContext) => {
  const workspaceContext = getWorkspaceContext();
  const logSuccess = (operation: string, newsId?: string) => {
    logger.info('Mainserver News route succeeded', {
      operation,
      request_id: workspaceContext.requestId,
      trace_id: workspaceContext.traceId,
      actor_id: ctx.user.id,
      instance_id: ctx.user.instanceId,
      content_type: NEWS_CONTENT_TYPE,
      content_id: newsId,
      method: request.method,
    });
  };

  try {
    if (route.kind === 'categories' && request.method === 'GET') {
      return await handleCategoryCollectionRead(ctx, logSuccess);
    }

    if (route.kind === 'collection' && request.method === 'GET') {
      return await handleCollectionRead(request, ctx, logSuccess);
    }

    if (route.kind === 'item' && request.method === 'GET') {
      return await handleItemRead(route, ctx, logSuccess);
    }

    if (route.kind === 'collection' && request.method === 'POST') {
      return await handleCollectionCreate(request, ctx, workspaceContext.requestId, logSuccess);
    }

    if (route.kind === 'item' && request.method === 'PATCH') {
      return await handleItemUpdate(request, route, ctx, workspaceContext.requestId, logSuccess);
    }

    if (route.kind === 'itemVisibility' && request.method === 'PATCH') {
      return await handleVisibilityUpdate(request, route, ctx, workspaceContext.requestId, logSuccess);
    }

    if (route.kind === 'item' && request.method === 'DELETE') {
      return await handleItemDelete(request, route, ctx, workspaceContext.requestId, logSuccess);
    }

    return errorJson(405, 'method_not_allowed', 'Methode wird für Mainserver-News nicht unterstützt.');
  } catch (error) {
    logger.warn('Mainserver News route failed', {
      operation: 'mainserver_news_request',
      request_id: workspaceContext.requestId,
      trace_id: workspaceContext.traceId,
      actor_id: ctx.user.id,
      instance_id: ctx.user.instanceId,
      content_type: NEWS_CONTENT_TYPE,
      content_id: route.kind === 'item' || route.kind === 'itemVisibility' ? route.newsId : undefined,
      method: request.method,
      error_code: error instanceof SvaMainserverError ? error.code : 'internal_error',
    });
    return toMainserverErrorResponse(error);
  }
};

export const dispatchSvaMainserverNewsRequest = async (request: Request): Promise<Response | null> => {
  const route = matchRoute(request);
  if (!route) {
    return null;
  }

  return withAuthenticatedUser(request, (ctx) => dispatchAuthenticated(request, route, ctx));
};
