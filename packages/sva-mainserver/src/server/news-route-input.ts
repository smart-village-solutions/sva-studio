import {
  authorizeContentPrimitiveForUser,
  type AuthenticatedRequestContext,
} from '@sva/auth-runtime/server';
import type { SvaMainserverNewsInput, SvaMainserverNewsPayload } from '../types.js';
import {
  errorJson,
  isRecord,
  isResponse,
  readBoolean,
  readNumber,
  readString,
} from './content-route-core.js';
import { parseAddress, parseCategories, parseWebUrl } from './content-route-parsers.js';
import { parseContentBlocks } from './news-route-blocks.js';
import { parseNewsPayload } from './news-route-payload.js';

export type ParsedNewsInput = {
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

const readonlyMutationFields = new Set([
  'id',
  'contentType',
  'status',
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
  payload: SvaMainserverNewsPayload | undefined;
  allowPushNotification: boolean;
}): SvaMainserverNewsInput => ({
  title: input.title,
  publishedAt: input.publishedAt,
  ...(readString(input.body.author) ? { author: readString(input.body.author) } : {}),
  ...(readString(input.body.keywords) ? { keywords: readString(input.body.keywords) } : {}),
  ...(readString(input.body.externalId) ? { externalId: readString(input.body.externalId) } : {}),
  ...(readBoolean(input.body.fullVersion) !== undefined
    ? { fullVersion: readBoolean(input.body.fullVersion) }
    : {}),
  ...(input.charactersToBeShown !== undefined
    ? { charactersToBeShown: input.charactersToBeShown }
    : {}),
  ...(readString(input.body.newsType) ? { newsType: readString(input.body.newsType) } : {}),
  ...(input.publicationDate ? { publicationDate: input.publicationDate } : {}),
  ...(readBoolean(input.body.showPublishDate) !== undefined
    ? { showPublishDate: readBoolean(input.body.showPublishDate) }
    : {}),
  ...(readString(input.body.categoryName)
    ? { categoryName: readString(input.body.categoryName) }
    : {}),
  ...(input.categories ? { categories: input.categories } : {}),
  ...(input.sourceUrl ? { sourceUrl: input.sourceUrl } : {}),
  ...(input.address ? { address: input.address } : {}),
  ...(input.contentBlocks ? { contentBlocks: input.contentBlocks } : {}),
  ...(readString(input.body.pointOfInterestId)
    ? { pointOfInterestId: readString(input.body.pointOfInterestId) }
    : {}),
  ...(input.allowPushNotification && readBoolean(input.body.pushNotification) !== undefined
    ? { pushNotification: readBoolean(input.body.pushNotification) }
    : {}),
  ...(input.payload ? { payload: input.payload } : {}),
});

const parseNewsPublicationFields = (
  body: Record<string, unknown>,
  visible: boolean | undefined
):
  | Response
  | {
      title: string;
      publishedAt: string;
      publicationDate?: string;
      charactersToBeShown?: number;
    } => {
  const title = readString(body.title);
  const publishedAt = readString(body.publishedAt);
  if (!title || !publishedAt || !isValidDate(publishedAt)) {
    return errorJson(400, 'invalid_request', 'Titel und Veröffentlichungsdatum sind erforderlich.');
  }

  const publicationDate = readString(body.publicationDate);
  if (publicationDate && !isValidDate(publicationDate)) {
    return errorJson(400, 'invalid_request', 'Das Publikationsdatum ist ungültig.');
  }

  if (
    readBoolean(body.pushNotification) === true &&
    (visible !== true || new Date(publishedAt).getTime() > Date.now())
  ) {
    return errorJson(
      400,
      'invalid_request',
      'Push-Benachrichtigungen dürfen nur für sofort veröffentlichte Nachrichten gesendet werden.'
    );
  }

  const charactersToBeShown = readNumber(body.charactersToBeShown);
  if (
    body.charactersToBeShown !== undefined &&
    (charactersToBeShown === undefined ||
      charactersToBeShown < 0 ||
      Number.isInteger(charactersToBeShown) === false)
  ) {
    return errorJson(
      400,
      'invalid_request',
      'Die Zeichenbegrenzung muss eine nicht-negative Ganzzahl sein.'
    );
  }

  return { title, publishedAt, publicationDate, charactersToBeShown };
};

const parseNewsInput = async (
  request: Request,
  options: ParseOptions
): Promise<ParsedNewsInput | Response> => {
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
    return errorJson(
      400,
      'invalid_request',
      `Das Feld "${readonlyField}" darf nicht geschrieben werden.`
    );
  }

  if (!options.allowPushNotification && body.pushNotification !== undefined) {
    return errorJson(
      400,
      'invalid_request',
      'Push-Benachrichtigungen sind nur beim Erstellen erlaubt.'
    );
  }

  const visible = readBoolean(body.visible);
  if ('visible' in body && visible === undefined) {
    return errorJson(
      400,
      'invalid_request',
      'Das Feld "visible" muss als Boolean gesendet werden.'
    );
  }

  const payload = parseNewsPayload(body.payload);
  if (payload instanceof Response) return payload;

  const publicationFields = parseNewsPublicationFields(body, visible);
  if (isResponse(publicationFields)) return publicationFields;
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
      ...publicationFields,
      categories,
      sourceUrl,
      address,
      contentBlocks,
      payload,
      allowPushNotification: options.allowPushNotification,
    }),
  };
};

export const parseAuthorizedNewsInput = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  options: ParseOptions
): Promise<ParsedNewsInput | Response> => {
  const parsed = await parseNewsInput(request, options);
  if (isResponse(parsed) || parsed.news.payload === undefined) return parsed;

  const authorization = await authorizeContentPrimitiveForUser({
    ctx,
    action: 'waste-management.read',
  });
  if (authorization.ok) return parsed;

  return errorJson(
    authorization.status,
    authorization.error,
    authorization.message,
    authorization.permissionDenial
  );
};

export const parseVisibilityInput = async (
  request: Request
): Promise<ParsedVisibilityInput | Response> => {
  let body: unknown;
  try {
    body = (await request.json()) as unknown;
  } catch {
    return errorJson(400, 'invalid_request', 'Request-Body muss gültiges JSON sein.');
  }

  if (!isRecord(body)) {
    return errorJson(
      400,
      'invalid_request',
      'Sichtbarkeitsdaten müssen als Objekt gesendet werden.'
    );
  }

  const visible = readBoolean(body.visible);
  if (visible === undefined) {
    return errorJson(
      400,
      'invalid_request',
      'Das Feld "visible" muss als Boolean gesendet werden.'
    );
  }

  return { visible };
};
