import type {
  SvaMainserverAccessibilityInformationInput,
  SvaMainserverAddressInput,
  SvaMainserverCategoryInput,
  SvaMainserverContactInput,
  SvaMainserverLocationInput,
  SvaMainserverMediaContentInput,
  SvaMainserverOpeningHourInput,
  SvaMainserverOperatingCompanyInput,
  SvaMainserverPriceInput,
  SvaMainserverCertificateInput,
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

const readGeoLocation = (
  value: Record<string, unknown>,
  options?: ParseAddressOptions
): { readonly latitude?: number; readonly longitude?: number } | Response => {
  const { geoLocation } = value;

  if (geoLocation === undefined || geoLocation === null) {
    return {};
  }

  if (isRecord(geoLocation) === false) {
    return options?.requireGeoLocationObjectMessage
      ? errorJson(400, 'invalid_request', options.requireGeoLocationObjectMessage)
      : {};
  }

  const latitude = readNumber(geoLocation.latitude);
  const longitude = readNumber(geoLocation.longitude);
  const hasInvalidRange =
    latitude === undefined ||
    longitude === undefined ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180;

  if (hasInvalidRange) {
    return errorJson(400, 'invalid_request', 'Geo-Koordinaten sind ungültig.');
  }

  return { latitude, longitude };
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
  const geoLocation = readGeoLocation(value, options);
  if (geoLocation instanceof Response) {
    return geoLocation;
  }

  return {
    ...(readNumber(value.id) !== undefined ? { id: readNumber(value.id) } : {}),
    ...(readString(value.addition) ? { addition: readString(value.addition) } : {}),
    ...(readString(value.street) ? { street: readString(value.street) } : {}),
    ...(readString(value.zip) ? { zip: readString(value.zip) } : {}),
    ...(readString(value.city) ? { city: readString(value.city) } : {}),
    ...(readString(value.kind) ? { kind: readString(value.kind) } : {}),
    ...(geoLocation.latitude !== undefined && geoLocation.longitude !== undefined
      ? { geoLocation: { latitude: geoLocation.latitude, longitude: geoLocation.longitude } }
      : {}),
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

export const parseLocation = (value: unknown): SvaMainserverLocationInput | Response | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!isRecord(value)) {
    return errorJson(400, 'invalid_request', 'Ortsdaten müssen als Objekt gesendet werden.');
  }
  const geoLocation = readGeoLocation(value, {
    requireGeoLocationObjectMessage: 'Geo-Koordinaten müssen als Objekt gesendet werden.',
  });
  if (geoLocation instanceof Response) {
    return geoLocation;
  }

  return {
    ...(readString(value.name) ? { name: readString(value.name) } : {}),
    ...(readString(value.department) ? { department: readString(value.department) } : {}),
    ...(readString(value.district) ? { district: readString(value.district) } : {}),
    ...(readString(value.regionName) ? { regionName: readString(value.regionName) } : {}),
    ...(readString(value.state) ? { state: readString(value.state) } : {}),
    ...(geoLocation.latitude !== undefined && geoLocation.longitude !== undefined
      ? { geoLocation: { latitude: geoLocation.latitude, longitude: geoLocation.longitude } }
      : {}),
  };
};

export const parseOpeningHours = (value: unknown): readonly SvaMainserverOpeningHourInput[] | Response | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    return errorJson(400, 'invalid_request', 'Öffnungszeiten müssen als Liste gesendet werden.');
  }

  const openingHours: SvaMainserverOpeningHourInput[] = [];
  for (const item of value) {
    if (!isRecord(item)) {
      return errorJson(400, 'invalid_request', 'Öffnungszeiten-Einträge müssen Objekte sein.');
    }
    openingHours.push({
      ...(readString(item.weekday) ? { weekday: readString(item.weekday) } : {}),
      ...(readString(item.dateFrom) ? { dateFrom: readString(item.dateFrom) } : {}),
      ...(readString(item.dateTo) ? { dateTo: readString(item.dateTo) } : {}),
      ...(readString(item.timeFrom) ? { timeFrom: readString(item.timeFrom) } : {}),
      ...(readString(item.timeTo) ? { timeTo: readString(item.timeTo) } : {}),
      ...(readNumber(item.sortNumber) !== undefined ? { sortNumber: readNumber(item.sortNumber) } : {}),
      ...(readBoolean(item.open) !== undefined ? { open: readBoolean(item.open) } : {}),
      ...(readBoolean(item.useYear) !== undefined ? { useYear: readBoolean(item.useYear) } : {}),
      ...(readString(item.description) ? { description: readString(item.description) } : {}),
    });
  }

  return openingHours;
};

export const parsePrices = (value: unknown): readonly SvaMainserverPriceInput[] | Response | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    return errorJson(400, 'invalid_request', 'Preisangaben müssen als Liste gesendet werden.');
  }

  const prices: SvaMainserverPriceInput[] = [];
  for (const item of value) {
    if (!isRecord(item)) {
      return errorJson(400, 'invalid_request', 'Preis-Einträge müssen Objekte sein.');
    }
    prices.push({
      ...(readString(item.name) ? { name: readString(item.name) } : {}),
      ...(readNumber(item.amount) !== undefined ? { amount: readNumber(item.amount) } : {}),
      ...(readBoolean(item.groupPrice) !== undefined ? { groupPrice: readBoolean(item.groupPrice) } : {}),
      ...(readNumber(item.ageFrom) !== undefined ? { ageFrom: readNumber(item.ageFrom) } : {}),
      ...(readNumber(item.ageTo) !== undefined ? { ageTo: readNumber(item.ageTo) } : {}),
      ...(readNumber(item.minAdultCount) !== undefined ? { minAdultCount: readNumber(item.minAdultCount) } : {}),
      ...(readNumber(item.maxAdultCount) !== undefined ? { maxAdultCount: readNumber(item.maxAdultCount) } : {}),
      ...(readNumber(item.minChildrenCount) !== undefined ? { minChildrenCount: readNumber(item.minChildrenCount) } : {}),
      ...(readNumber(item.maxChildrenCount) !== undefined ? { maxChildrenCount: readNumber(item.maxChildrenCount) } : {}),
      ...(readString(item.description) ? { description: readString(item.description) } : {}),
      ...(readString(item.category) ? { category: readString(item.category) } : {}),
    });
  }

  return prices;
};

export const parseOperatingCompany = (value: unknown): SvaMainserverOperatingCompanyInput | Response | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!isRecord(value)) {
    return errorJson(400, 'invalid_request', 'Betreiberdaten müssen als Objekt gesendet werden.');
  }

  const address = parseAddress(value.address);
  if (address instanceof Response) {
    return address;
  }
  const contact = parseContact(value.contact);
  if (contact instanceof Response) {
    return contact;
  }

  return {
    ...(readString(value.name) ? { name: readString(value.name) } : {}),
    ...(address ? { address } : {}),
    ...(contact ? { contact } : {}),
  };
};

export const parseMediaContents = (value: unknown): readonly SvaMainserverMediaContentInput[] | Response | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    return errorJson(400, 'invalid_request', 'MediaContent muss als Liste gesendet werden.');
  }

  const mediaContents: SvaMainserverMediaContentInput[] = [];
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

export const parseCertificates = (value: unknown): readonly SvaMainserverCertificateInput[] | Response | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    return errorJson(400, 'invalid_request', 'Zertifikate müssen als Liste gesendet werden.');
  }

  const certificates: SvaMainserverCertificateInput[] = [];
  for (const item of value) {
    if (!isRecord(item)) {
      return errorJson(400, 'invalid_request', 'Zertifikats-Einträge müssen Objekte sein.');
    }
    const name = readString(item.name);
    if (!name) {
      return errorJson(400, 'invalid_request', 'Zertifikate benötigen einen Namen.');
    }
    certificates.push({ name });
  }

  return certificates;
};

export const parseAccessibilityInformation = (
  value: unknown
): SvaMainserverAccessibilityInformationInput | Response | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!isRecord(value)) {
    return errorJson(400, 'invalid_request', 'Barrierefreiheitsdaten müssen als Objekt gesendet werden.');
  }
  const urls = parseWebUrls(value.urls);
  if (urls instanceof Response) {
    return urls;
  }

  return {
    ...(readString(value.description) ? { description: readString(value.description) } : {}),
    ...(readString(value.types) ? { types: readString(value.types) } : {}),
    ...(urls ? { urls } : {}),
  };
};
