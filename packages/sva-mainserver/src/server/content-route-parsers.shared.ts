import type {
  SvaMainserverAddressInput,
  SvaMainserverCategoryInput,
  SvaMainserverContactInput,
  SvaMainserverLocationInput,
  SvaMainserverWebUrlInput,
} from '../types.js';
import { errorJson, isRecord, readNumber, readString } from './content-route-core.js';

const isHttpsUrl = (value: string): boolean => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

type ParseAddressOptions = {
  readonly requireGeoLocationObjectMessage?: string;
};

const readGeoLocation = (
  value: Record<string, unknown>,
  options?: ParseAddressOptions,
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

  return { latitude, longitude };
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

  const categories: SvaMainserverCategoryInput[] = [];
  for (const item of value) {
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
    categories.push({
      name,
      ...(isRecord(item.payload) ? { payload: item.payload } : {}),
      ...(children ? { children } : {}),
    });
  }
  return categories;
};

export const parseAddress = (
  value: unknown,
  options?: ParseAddressOptions,
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
