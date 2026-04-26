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
import type { IamContentPrimitiveAction } from '@sva/core';
import {
  createSvaMainserverNews,
  deleteSvaMainserverNews,
  getSvaMainserverNews,
  listSvaMainserverNews,
  updateSvaMainserverNews,
  SvaMainserverError,
} from '@sva/sva-mainserver/server';
import type { SvaMainserverNewsInput } from '@sva/sva-mainserver';
import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';

const NEWS_CONTENT_TYPE = 'news.article';
const NEWS_COLLECTION_PATH = '/api/v1/mainserver/news';
const NEWS_ITEM_PATH_PREFIX = `${NEWS_COLLECTION_PATH}/`;
const logger = createSdkLogger({ component: 'sva-mainserver-news-route', level: 'info' });

type RouteMatch =
  | { readonly kind: 'collection' }
  | { readonly kind: 'item'; readonly newsId: string };

const json = (body: unknown, status = 200): Response =>
  Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
    },
  });

const errorJson = (status: number, error: string, message: string): Response => json({ error, message }, status);

const matchRoute = (request: Request): RouteMatch | null => {
  const pathname = new URL(request.url).pathname;
  if (pathname === NEWS_COLLECTION_PATH) {
    return { kind: 'collection' };
  }
  if (pathname.startsWith(NEWS_ITEM_PATH_PREFIX)) {
    const newsId = decodeURIComponent(pathname.slice(NEWS_ITEM_PATH_PREFIX.length));
    if (newsId.length > 0 && newsId.includes('/') === false) {
      return { kind: 'item', newsId };
    }
  }
  return null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && Array.isArray(value) === false;

type ParsedNewsInput = {
  readonly news: SvaMainserverNewsInput;
  readonly rawBody: string;
};

type ParseOptions = {
  readonly allowPushNotification: boolean;
};

const toPayloadHash = (rawBody: string): string => createHash('sha256').update(rawBody).digest('hex');

const readonlyMutationFields = new Set([
  'id',
  'contentType',
  'status',
  'payload',
  'createdAt',
  'updatedAt',
  'visible',
  'dataProvider',
  'settings',
  'announcements',
  'likeCount',
  'likedByMe',
  'pushNotificationsSentAt',
]);

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

const isHttpsUrl = (value: string): boolean => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

const parseWebUrl = (value: unknown): SvaMainserverNewsInput['sourceUrl'] | undefined | Response => {
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

const parseCategories = (value: unknown): SvaMainserverNewsInput['categories'] | undefined | Response => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    return errorJson(400, 'invalid_request', 'Kategorien müssen als Liste gesendet werden.');
  }

  const parseCategory = (category: unknown): NonNullable<SvaMainserverNewsInput['categories']>[number] | Response => {
    if (!isRecord(category)) {
      return errorJson(400, 'invalid_request', 'Kategorien müssen Objekte sein.');
    }
    const name = readString(category.name);
    if (!name || name.length > 128) {
      return errorJson(400, 'invalid_request', 'Kategorien benötigen einen Namen mit maximal 128 Zeichen.');
    }
    const children = parseCategories(category.children);
    if (children instanceof Response) {
      return children;
    }
    return {
      name,
      ...(isRecord(category.payload) ? { payload: category.payload } : {}),
      ...(children ? { children } : {}),
    };
  };

  const categories = [];
  for (const item of value) {
    const category = parseCategory(item);
    if (category instanceof Response) {
      return category;
    }
    categories.push(category);
  }
  return categories;
};

const parseAddress = (value: unknown): SvaMainserverNewsInput['address'] | undefined | Response => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!isRecord(value)) {
    return errorJson(400, 'invalid_request', 'Adressdaten müssen als Objekt gesendet werden.');
  }

  let geoLocation: NonNullable<SvaMainserverNewsInput['address']>['geoLocation'] | undefined;
  if (value.geoLocation !== undefined && value.geoLocation !== null) {
    if (!isRecord(value.geoLocation)) {
      return errorJson(400, 'invalid_request', 'Geo-Koordinaten müssen als Objekt gesendet werden.');
    }
    const latitude = readNumber(value.geoLocation.latitude);
    const longitude = readNumber(value.geoLocation.longitude);
    if (
      latitude === undefined ||
      longitude === undefined ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return errorJson(400, 'invalid_request', 'Geo-Koordinaten sind ungültig.');
    }
    geoLocation = { latitude, longitude };
  }

  return {
    ...(readNumber(value.id) !== undefined ? { id: readNumber(value.id) } : {}),
    ...(readString(value.addition) ? { addition: readString(value.addition) } : {}),
    ...(readString(value.street) ? { street: readString(value.street) } : {}),
    ...(readString(value.zip) ? { zip: readString(value.zip) } : {}),
    ...(readString(value.city) ? { city: readString(value.city) } : {}),
    ...(readString(value.kind) ? { kind: readString(value.kind) } : {}),
    ...(geoLocation ? { geoLocation } : {}),
  };
};

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
    const mediaContents: Array<
      NonNullable<NonNullable<SvaMainserverNewsInput['contentBlocks']>[number]['mediaContents']>[number]
    > = [];
    if (block.mediaContents !== undefined && block.mediaContents !== null) {
      if (!Array.isArray(block.mediaContents)) {
        return errorJson(400, 'invalid_request', 'MediaContent muss als Liste gesendet werden.');
      }
      for (const media of block.mediaContents) {
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
    }
    blocks.push({
      ...(readString(block.title) ? { title: readString(block.title) } : {}),
      ...(readString(block.intro) ? { intro: readString(block.intro) } : {}),
      ...(readString(block.body) ? { body: readString(block.body) } : {}),
      ...(mediaContents.length > 0 ? { mediaContents } : {}),
    });
  }
  if (
    blocks.length === 0 ||
    blocks.some((block) => (block.body?.length ?? 0) > 50_000) ||
    blocks.some((block) => block.body && getVisibleTextLength(block.body) > 0) === false
  ) {
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
  const address = parseAddress(body.address);
  if (address instanceof Response) {
    return address;
  }
  const contentBlocks = parseContentBlocks(body.contentBlocks);
  if (contentBlocks instanceof Response) {
    return contentBlocks;
  }

  return {
    rawBody,
    news: {
      title,
      publishedAt,
      ...(readString(body.author) ? { author: readString(body.author) } : {}),
      ...(readString(body.keywords) ? { keywords: readString(body.keywords) } : {}),
      ...(readString(body.externalId) ? { externalId: readString(body.externalId) } : {}),
      ...(readBoolean(body.fullVersion) !== undefined ? { fullVersion: readBoolean(body.fullVersion) } : {}),
      ...(charactersToBeShown !== undefined ? { charactersToBeShown } : {}),
      ...(readString(body.newsType) ? { newsType: readString(body.newsType) } : {}),
      ...(publicationDate ? { publicationDate } : {}),
      ...(readBoolean(body.showPublishDate) !== undefined ? { showPublishDate: readBoolean(body.showPublishDate) } : {}),
      ...(readString(body.categoryName) ? { categoryName: readString(body.categoryName) } : {}),
      ...(categories ? { categories } : {}),
      ...(sourceUrl ? { sourceUrl } : {}),
      ...(address ? { address } : {}),
      ...(contentBlocks ? { contentBlocks } : {}),
      ...(readString(body.pointOfInterestId) ? { pointOfInterestId: readString(body.pointOfInterestId) } : {}),
      ...(options.allowPushNotification && readBoolean(body.pushNotification) !== undefined
        ? { pushNotification: readBoolean(body.pushNotification) }
        : {}),
    },
  };
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

  return errorJson(500, 'internal_error', 'Mainserver-News-Anfrage ist fehlgeschlagen.');
};

const authorize = async (
  ctx: AuthenticatedRequestContext,
  action: IamContentPrimitiveAction,
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
  action: IamContentPrimitiveAction,
  newsId?: string
): Promise<{ readonly instanceId: string; readonly keycloakSubject: string } | Response> => {
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
  };
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
    if (route.kind === 'collection' && request.method === 'GET') {
      const actor = await authorizeOrResponse(ctx, 'content.read');
      if (actor instanceof Response) {
        return actor;
      }
      const data = await listSvaMainserverNews(actor);
      logSuccess('mainserver_news_list');
      return json({ data });
    }

    if (route.kind === 'item' && request.method === 'GET') {
      const actor = await authorizeOrResponse(ctx, 'content.read', route.newsId);
      if (actor instanceof Response) {
        return actor;
      }
      const data = await getSvaMainserverNews({ ...actor, newsId: route.newsId });
      logSuccess('mainserver_news_detail', route.newsId);
      return json({ data });
    }

    if (route.kind === 'collection' && request.method === 'POST') {
      const csrfError = validateMutationRequest(request, workspaceContext.requestId);
      if (csrfError) {
        return csrfError;
      }
      const idempotencyKey = readIdempotencyKey(request);
      if (idempotencyKey instanceof Response) {
        return idempotencyKey;
      }
      const parsed = await parseNewsInput(request, { allowPushNotification: true });
      if (parsed instanceof Response) {
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
      const actor = await authorizeOrResponse(ctx, 'content.create');
      if (actor instanceof Response) {
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
        logSuccess('mainserver_news_create', data.id);
        const responseBody = { data };
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
    }

    if (route.kind === 'item' && request.method === 'PATCH') {
      const csrfError = validateMutationRequest(request, workspaceContext.requestId);
      if (csrfError) {
        return csrfError;
      }
      const parsed = await parseNewsInput(request, { allowPushNotification: false });
      if (parsed instanceof Response) {
        return parsed;
      }

      const metadataActor = await authorizeOrResponse(ctx, 'content.updateMetadata', route.newsId);
      if (metadataActor instanceof Response) {
        return metadataActor;
      }
      const payloadActor = await authorizeOrResponse(ctx, 'content.updatePayload', route.newsId);
      if (payloadActor instanceof Response) {
        return payloadActor;
      }

      const data = await updateSvaMainserverNews({ ...metadataActor, newsId: route.newsId, news: parsed.news });
      logSuccess('mainserver_news_update', route.newsId);
      return json({ data });
    }

    if (route.kind === 'item' && request.method === 'DELETE') {
      const csrfError = validateMutationRequest(request, workspaceContext.requestId);
      if (csrfError) {
        return csrfError;
      }
      const actor = await authorizeOrResponse(ctx, 'content.delete', route.newsId);
      if (actor instanceof Response) {
        return actor;
      }
      const data = await deleteSvaMainserverNews({ ...actor, newsId: route.newsId });
      logSuccess('mainserver_news_delete', route.newsId);
      return json({ data });
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
      content_id: route.kind === 'item' ? route.newsId : undefined,
      method: request.method,
      error_code: error instanceof SvaMainserverError ? error.code : 'internal_error',
    });
    return toMainserverErrorResponse(error);
  }
};

export const dispatchMainserverNewsRequest = async (request: Request): Promise<Response | null> => {
  const route = matchRoute(request);
  if (!route) {
    return null;
  }

  return withAuthenticatedUser(request, (ctx) => dispatchAuthenticated(request, route, ctx));
};
