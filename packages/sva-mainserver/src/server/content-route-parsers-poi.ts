import type {
  SvaMainserverAccessibilityInformationInput,
  SvaMainserverCertificateInput,
  SvaMainserverMediaContentInput,
  SvaMainserverOpeningHourInput,
  SvaMainserverOperatingCompanyInput,
  SvaMainserverPriceInput,
} from '../types.js';
import {
  errorJson,
  isRecord,
  isTimeOfDay,
  readBoolean,
  readNumber,
  readString,
} from './content-route-core.js';
import {
  parseAddress,
  parseContact,
  parseMediaUrl,
  parseWebUrls,
} from './content-route-parsers.shared.js';

// Omit only absent normalized fields; false, zero and empty relation lists remain values.
const omitUndefined = <T extends object>(value: T): T =>
  Object.fromEntries(Object.entries(value).filter(([, field]) => field !== undefined)) as T;

export const parseOpeningHours = (
  value: unknown
): readonly SvaMainserverOpeningHourInput[] | Response | undefined => {
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
      return errorJson(
        400,
        'invalid_request',
        'Öffnungszeiten müssen im Format HH:MM angegeben werden.'
      );
    }
    openingHours.push(
      omitUndefined({
        weekday: readString(item.weekday),
        dateFrom: readString(item.dateFrom),
        dateTo: readString(item.dateTo),
        timeFrom,
        timeTo,
        sortNumber: readNumber(item.sortNumber),
        open: readBoolean(item.open),
        useYear: readBoolean(item.useYear),
        description: readString(item.description),
      })
    );
  }
  return openingHours;
};

export const parsePrices = (
  value: unknown
): readonly SvaMainserverPriceInput[] | Response | undefined => {
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
    prices.push(
      omitUndefined({
        name: readString(item.name),
        amount: readNumber(item.amount),
        groupPrice: readBoolean(item.groupPrice),
        ageFrom: readNumber(item.ageFrom),
        ageTo: readNumber(item.ageTo),
        minAdultCount: readNumber(item.minAdultCount),
        maxAdultCount: readNumber(item.maxAdultCount),
        minChildrenCount: readNumber(item.minChildrenCount),
        maxChildrenCount: readNumber(item.maxChildrenCount),
        description: readString(item.description),
        category: readString(item.category),
      })
    );
  }
  return prices;
};

type ParseOperatingCompanyOptions = Readonly<{
  requireNameForDetails?: boolean;
}>;

export const parseOperatingCompany = (
  value: unknown,
  options: ParseOperatingCompanyOptions = {}
): SvaMainserverOperatingCompanyInput | Response | undefined => {
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

  const name = readString(value.name);
  const hasDetails =
    (address !== undefined && Object.keys(address).length > 0) ||
    (contact !== undefined && Object.keys(contact).length > 0);
  if (options.requireNameForDetails && !name && hasDetails) {
    return errorJson(
      400,
      'invalid_request',
      'Betreiberdaten mit Adresse oder Kontakt benötigen einen Namen.'
    );
  }
  if (options.requireNameForDetails && !name) {
    return undefined;
  }

  return omitUndefined({
    name,
    address,
    contact,
  });
};

export const parseMediaContents = (
  value: unknown
): readonly SvaMainserverMediaContentInput[] | Response | undefined => {
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
    const sourceUrl = parseMediaUrl(media.sourceUrl);
    if (sourceUrl instanceof Response) {
      return sourceUrl;
    }
    mediaContents.push(
      omitUndefined({
        captionText: readString(media.captionText),
        copyright: readString(media.copyright),
        contentType: readString(media.contentType),
        height: readNumber(media.height),
        width: readNumber(media.width),
        sourceUrl,
      })
    );
  }
  return mediaContents;
};

export const parseCertificates = (
  value: unknown
): readonly SvaMainserverCertificateInput[] | Response | undefined => {
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
    return errorJson(
      400,
      'invalid_request',
      'Barrierefreiheitsdaten müssen als Objekt gesendet werden.'
    );
  }
  const urls = parseWebUrls(value.urls);
  if (urls instanceof Response) {
    return urls;
  }

  return omitUndefined({
    description: readString(value.description),
    types: readString(value.types),
    urls,
  });
};
