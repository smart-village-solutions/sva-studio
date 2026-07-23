import type {
  SvaMainserverAccessibilityInformationInput,
  SvaMainserverCertificateInput,
  SvaMainserverMediaContentInput,
  SvaMainserverOpeningHourInput,
  SvaMainserverOperatingCompanyInput,
  SvaMainserverPriceInput,
} from '../types.js';
import { errorJson, isRecord, isTimeOfDay, readBoolean, readNumber, readString } from './content-route-core.js';
import { parseAddress, parseContact, parseWebUrl, parseWebUrls } from './content-route-parsers.shared.js';

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
    const timeFrom = readString(item.timeFrom);
    const timeTo = readString(item.timeTo);
    if ((timeFrom && !isTimeOfDay(timeFrom)) || (timeTo && !isTimeOfDay(timeTo))) {
      return errorJson(400, 'invalid_request', 'Öffnungszeiten müssen im Format HH:MM angegeben werden.');
    }
    openingHours.push({
      ...(readString(item.weekday) ? { weekday: readString(item.weekday) } : {}),
      ...(readString(item.dateFrom) ? { dateFrom: readString(item.dateFrom) } : {}),
      ...(readString(item.dateTo) ? { dateTo: readString(item.dateTo) } : {}),
      ...(timeFrom ? { timeFrom } : {}),
      ...(timeTo ? { timeTo } : {}),
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
  value: unknown,
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
