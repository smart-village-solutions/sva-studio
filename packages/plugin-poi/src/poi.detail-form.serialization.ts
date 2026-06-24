import type {
  PoiAccessibilityInformation,
  PoiCertificate,
  PoiContact,
  PoiMediaContent,
  PoiWebUrl,
} from './poi.content.types.js';
import type { PoiFormInput } from './poi.types.js';
import type {
  PoiAddressFormValue,
  PoiDetailFormValues,
  PoiFormGeoLocationValue,
  PoiLocationFormValue,
} from './poi.detail-form.types.js';
import { normalizeOpeningHourWeekday } from './poi.opening-hours.js';

const compactString = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
};

const compactCategoryNames = (values: readonly string[]) =>
  Array.from(new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)));

const hasSubstantiveFields = <T extends Record<string, unknown>, K extends keyof T>(
  entry: T,
  ignoredKey: K,
): boolean => {
  const { [ignoredKey]: _ignored, ...rest } = entry;
  return Object.keys(rest).length > 0;
};

const compactFiniteNumber = (value?: string | number | null) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const compactValidatedNumber = (value?: string | number | null) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : Number.NaN;
  }
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const compactGeoLocation = (value?: PoiFormGeoLocationValue | null) => {
  const latitude = compactValidatedNumber(value?.latitude);
  const longitude = compactValidatedNumber(value?.longitude);
  return latitude !== undefined || longitude !== undefined ? { latitude, longitude } : undefined;
};

const compactWebUrls = (value?: readonly PoiWebUrl[] | null) =>
  (value ?? [])
    .map((entry) => ({
      ...(compactString(entry?.url) ? { url: compactString(entry?.url) as string } : {}),
      ...(compactString(entry?.description) ? { description: compactString(entry?.description) } : {}),
    }))
    .filter((entry): entry is PoiWebUrl => Boolean(entry.url));

const compactAddress = (value?: PoiAddressFormValue | null) => {
  const geoLocation = compactGeoLocation(value?.geoLocation);
  const address = {
    ...(compactString(value?.addition) ? { addition: compactString(value?.addition) } : {}),
    ...(compactString(value?.street) ? { street: compactString(value?.street) } : {}),
    ...(compactString(value?.zip) ? { zip: compactString(value?.zip) } : {}),
    ...(compactString(value?.city) ? { city: compactString(value?.city) } : {}),
    ...(compactString(value?.kind) ? { kind: compactString(value?.kind) } : {}),
    ...(geoLocation ? { geoLocation } : {}),
  };
  return Object.keys(address).length > 0 ? address : undefined;
};

const compactContact = (value?: PoiContact | null) => {
  const webUrls = compactWebUrls(value?.webUrls);
  const contact = {
    ...(compactString(value?.firstName) ? { firstName: compactString(value?.firstName) } : {}),
    ...(compactString(value?.lastName) ? { lastName: compactString(value?.lastName) } : {}),
    ...(compactString(value?.phone) ? { phone: compactString(value?.phone) } : {}),
    ...(compactString(value?.fax) ? { fax: compactString(value?.fax) } : {}),
    ...(compactString(value?.email) ? { email: compactString(value?.email) } : {}),
    ...(webUrls.length > 0 ? { webUrls } : {}),
  };
  return Object.keys(contact).length > 0 ? contact : undefined;
};

const compactLocation = (value?: PoiLocationFormValue | null) => {
  const geoLocation = compactGeoLocation(value?.geoLocation);
  const location = {
    ...(compactString(value?.name) ? { name: compactString(value?.name) } : {}),
    ...(compactString(value?.department) ? { department: compactString(value?.department) } : {}),
    ...(compactString(value?.district) ? { district: compactString(value?.district) } : {}),
    ...(compactString(value?.regionName) ? { regionName: compactString(value?.regionName) } : {}),
    ...(compactString(value?.state) ? { state: compactString(value?.state) } : {}),
    ...(geoLocation ? { geoLocation } : {}),
  };
  return Object.keys(location).length > 0 ? location : undefined;
};

const serializeOpeningHours = (values: PoiDetailFormValues['content']['openingHours']) =>
  (values ?? [])
    .map((entry) => ({
      ...(compactString(entry?.weekday) ? { weekday: normalizeOpeningHourWeekday(compactString(entry?.weekday)) } : {}),
      ...(compactString(entry?.dateFrom) ? { dateFrom: compactString(entry?.dateFrom) } : {}),
      ...(compactString(entry?.dateTo) ? { dateTo: compactString(entry?.dateTo) } : {}),
      ...(compactString(entry?.timeFrom) ? { timeFrom: compactString(entry?.timeFrom) } : {}),
      ...(compactString(entry?.timeTo) ? { timeTo: compactString(entry?.timeTo) } : {}),
      ...(compactFiniteNumber(entry?.sortNumber) !== undefined
        ? { sortNumber: compactFiniteNumber(entry?.sortNumber) }
        : {}),
      ...(entry?.open !== undefined ? { open: entry.open } : {}),
      ...(entry?.useYear !== undefined ? { useYear: entry.useYear } : {}),
      ...(compactString(entry?.description) ? { description: compactString(entry?.description) } : {}),
    }))
    .filter((entry) => {
      const keys = Object.keys(entry);
      if (keys.length === 0) {
        return false;
      }

      return hasSubstantiveFields(entry, 'open');
    });

const serializePrices = (values: PoiDetailFormValues['content']['prices']) =>
  (values ?? [])
    .map((entry) => ({
      ...(compactString(entry?.name) ? { name: compactString(entry?.name) } : {}),
      ...(compactValidatedNumber(entry?.amount) !== undefined
        ? { amount: compactValidatedNumber(entry?.amount) }
        : {}),
      ...(entry?.groupPrice !== undefined ? { groupPrice: entry.groupPrice } : {}),
      ...(compactFiniteNumber(entry?.ageFrom) !== undefined
        ? { ageFrom: compactFiniteNumber(entry?.ageFrom) }
        : {}),
      ...(compactFiniteNumber(entry?.ageTo) !== undefined ? { ageTo: compactFiniteNumber(entry?.ageTo) } : {}),
      ...(compactFiniteNumber(entry?.minAdultCount) !== undefined
        ? { minAdultCount: compactFiniteNumber(entry?.minAdultCount) }
        : {}),
      ...(compactFiniteNumber(entry?.maxAdultCount) !== undefined
        ? { maxAdultCount: compactFiniteNumber(entry?.maxAdultCount) }
        : {}),
      ...(compactFiniteNumber(entry?.minChildrenCount) !== undefined
        ? { minChildrenCount: compactFiniteNumber(entry?.minChildrenCount) }
        : {}),
      ...(compactFiniteNumber(entry?.maxChildrenCount) !== undefined
        ? { maxChildrenCount: compactFiniteNumber(entry?.maxChildrenCount) }
        : {}),
      ...(compactString(entry?.description) ? { description: compactString(entry?.description) } : {}),
      ...(compactString(entry?.category) ? { category: compactString(entry?.category) } : {}),
    }))
    .filter((entry) => {
      const keys = Object.keys(entry);
      if (keys.length === 0) {
        return false;
      }

      return hasSubstantiveFields(entry, 'groupPrice');
    });

const serializeMediaContents = (values: readonly PoiMediaContent[]) =>
  (values ?? [])
    .map((entry) => ({
      ...(compactString(entry?.captionText) ? { captionText: compactString(entry?.captionText) } : {}),
      ...(compactString(entry?.copyright) ? { copyright: compactString(entry?.copyright) } : {}),
      ...(compactFiniteNumber(entry?.height) !== undefined ? { height: compactFiniteNumber(entry?.height) } : {}),
      ...(compactFiniteNumber(entry?.width) !== undefined ? { width: compactFiniteNumber(entry?.width) } : {}),
      ...(compactString(entry?.contentType) ? { contentType: compactString(entry?.contentType) } : {}),
      ...(entry?.sourceUrl && compactWebUrls([entry.sourceUrl]).length > 0
        ? { sourceUrl: compactWebUrls([entry.sourceUrl])[0] }
        : {}),
    }))
    .filter((entry) => Object.keys(entry).length > 0);

const serializeCertificates = (values: readonly PoiCertificate[]) =>
  (values ?? [])
    .map((entry) => ({ ...(compactString(entry?.name) ? { name: compactString(entry?.name) as string } : {}) }))
    .filter((entry): entry is PoiCertificate => Boolean(entry.name));

const serializeAccessibilityInformation = (value: PoiAccessibilityInformation) => {
  const urls = compactWebUrls(value.urls);
  return {
    ...(compactString(value.description) ? { description: compactString(value.description) } : {}),
    ...(compactString(value.types) ? { types: compactString(value.types) } : {}),
    ...(urls.length > 0 ? { urls } : {}),
  };
};

const serializeTags = (value: string) => {
  const tags = value
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
  return tags;
};

export const mapPoiDetailFormValuesToInput = (
  values: PoiDetailFormValues,
  payload: Record<string, unknown>,
): PoiFormInput => {
  const contact = compactContact(values.content.contact);
  const operatorAddress = compactAddress(values.content.operator.address);
  const operatorContact = compactContact(values.content.operator.contact);
  const operator = {
    ...(compactString(values.content.operator.name) ? { name: compactString(values.content.operator.name) } : {}),
    ...(operatorAddress ? { address: operatorAddress } : {}),
    ...(operatorContact ? { contact: operatorContact } : {}),
  };

  return {
    name: values.name.trim(),
    ...(compactString(values.content.description) ? { description: compactString(values.content.description) } : {}),
    mobileDescription: compactString(values.content.mobileDescription) ?? '',
    active: values.basis.active,
    ...(compactCategoryNames(values.basis.categories).length > 0
      ? {
          categoryName: compactCategoryNames(values.basis.categories)[0],
          categories: compactCategoryNames(values.basis.categories).map((name) => ({ name })),
        }
      : {}),
    addresses: (values.content.addresses ?? [])
      .map((entry) => compactAddress(entry))
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
    ...(contact ? { contact } : {}),
    ...(compactLocation(values.content.location) ? { location: compactLocation(values.content.location) } : {}),
    openingHours: serializeOpeningHours(values.content.openingHours),
    webUrls: compactWebUrls(values.content.webUrls),
    operatingCompany: operator,
    priceInformations: serializePrices(values.content.prices),
    mediaContents: serializeMediaContents(values.content.mediaContents),
    certificates: serializeCertificates(values.content.certificates),
    accessibilityInformation: serializeAccessibilityInformation(values.content.accessibilityInformation),
    tags: serializeTags(values.content.tagsText),
    ...(Object.keys(payload).length > 0 ? { payload } : {}),
  };
};
