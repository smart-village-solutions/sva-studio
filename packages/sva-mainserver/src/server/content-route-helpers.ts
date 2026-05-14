import type {
  SvaMainserverAddressInput,
  SvaMainserverCategoryInput,
  SvaMainserverContactInput,
  SvaMainserverWebUrlInput,
} from '../types.js';

export type ParsedValue<T> = T | Response;

export type RouteMatch<ContentKind extends string> =
  | { readonly kind: 'collection'; readonly contentKind: ContentKind }
  | { readonly kind: 'item'; readonly contentKind: ContentKind; readonly itemId: string };

export const json = (body: unknown, status = 200): Response =>
  Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
    },
  });

export const errorJson = (status: number, error: string, message: string): Response =>
  json({ error, message }, status);

const decodePathSegment = (value: string): string | null => {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
};

export const matchRequestRoute = <ContentKind extends string>(
  request: Request,
  collectionPath: string,
  contentKind: ContentKind
): RouteMatch<ContentKind> | null => {
  const pathname = new URL(request.url).pathname;
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

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && Array.isArray(value) === false;

export const isResponse = <T>(value: ParsedValue<T>): value is Response => value instanceof Response;

export const readString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;

export const readBoolean = (value: unknown): boolean | undefined => (typeof value === 'boolean' ? value : undefined);

export const readNumber = (value: unknown): number | undefined => {
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

export const parseJsonObjectBody = async (
  request: Request,
  message: string
): Promise<Record<string, unknown> | Response> => {
  const body = (await request.json().catch(() => null)) as unknown;
  return isRecord(body) ? body : errorJson(400, 'invalid_request', message);
};

export const parseWebUrl = (value: unknown): SvaMainserverWebUrlInput | Response | undefined => {
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

export const parseWebUrls = (value: unknown): readonly SvaMainserverWebUrlInput[] | Response | undefined => {
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

export const parseCategories = (value: unknown): readonly SvaMainserverCategoryInput[] | Response | undefined => {
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

type ParseAddressOptions = {
  readonly requireGeoLocationObjectMessage?: string;
};

export const parseAddress = (
  value: unknown,
  options?: ParseAddressOptions
): SvaMainserverAddressInput | Response | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!isRecord(value)) {
    return errorJson(400, 'invalid_request', 'Adressdaten müssen als Objekt gesendet werden.');
  }
  if (
    value.geoLocation !== undefined &&
    value.geoLocation !== null &&
    isRecord(value.geoLocation) === false &&
    options?.requireGeoLocationObjectMessage
  ) {
    return errorJson(400, 'invalid_request', options.requireGeoLocationObjectMessage);
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

export const parseAddressList = (value: unknown): readonly SvaMainserverAddressInput[] | Response | undefined => {
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

export const parseContact = (value: unknown): SvaMainserverContactInput | Response | undefined => {
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

export const parseTags = (value: unknown): readonly string[] | Response | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    return errorJson(400, 'invalid_request', 'Tags müssen als Liste gesendet werden.');
  }
  return value.map(readString).filter((tag): tag is string => Boolean(tag));
};
