import type {
  PoiAccessibilityInformation,
  PoiAddress,
  PoiContact,
  PoiLocation,
  PoiMediaContent,
  PoiOpeningHour,
  PoiOperatingCompany,
  PoiPriceInformation,
  PoiWebUrl,
} from './poi.content.types.js';
import type { PoiFormInput } from './poi.types.js';
import type {
  PoiAddressFormValue,
  PoiDetailFormValues,
  PoiFormGeoLocationValue,
  PoiLocationFormValue,
} from './poi.detail-form.types.js';
import { normalizeMediaContentType } from './poi.detail-media-content-type.js';
import {
  hasSubstantiveFields,
  serializeCertificates,
  serializePayload,
  serializeTags,
} from './poi.detail-form.serialization.metadata.js';
import { normalizeOpeningHourWeekday } from './poi.opening-hours.js';

type MutablePartial<T> = {
  -readonly [Key in keyof T]?: T[Key];
};

const withoutUndefined = <T extends Record<string, unknown>>(value: T): MutablePartial<T> =>
  Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  ) as MutablePartial<T>;

const compactString = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
};

const compactCategoryNames = (values: readonly string[]) =>
  Array.from(new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)));

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

const compactWebUrl = (entry?: PoiWebUrl | null): PoiWebUrl | undefined => {
  const url = compactString(entry?.url);
  if (!url) {
    return undefined;
  }
  const description = compactString(entry?.description);
  return description ? { url, description } : { url };
};

const compactWebUrls = (value?: readonly PoiWebUrl[] | null) =>
  (value ?? []).map(compactWebUrl).filter((entry): entry is PoiWebUrl => entry !== undefined);

const compactAddress = (value?: PoiAddressFormValue | null) => {
  const address: MutablePartial<PoiAddress> = withoutUndefined({
    addition: compactString(value?.addition),
    street: compactString(value?.street),
    zip: compactString(value?.zip),
    city: compactString(value?.city),
    kind: compactString(value?.kind),
    geoLocation: compactGeoLocation(value?.geoLocation),
  });
  return Object.keys(address).length > 0 ? address : undefined;
};

const compactContact = (value?: PoiContact | null) => {
  const webUrls = compactWebUrls(value?.webUrls);
  const contact: MutablePartial<PoiContact> = withoutUndefined({
    firstName: compactString(value?.firstName),
    lastName: compactString(value?.lastName),
    phone: compactString(value?.phone),
    fax: compactString(value?.fax),
    email: compactString(value?.email),
    webUrls: webUrls.length > 0 ? webUrls : undefined,
  });
  return Object.keys(contact).length > 0 ? contact : undefined;
};

const compactLocation = (value?: PoiLocationFormValue | null) => {
  const location: MutablePartial<PoiLocation> = withoutUndefined({
    name: compactString(value?.name),
    department: compactString(value?.department),
    district: compactString(value?.district),
    regionName: compactString(value?.regionName),
    state: compactString(value?.state),
    geoLocation: compactGeoLocation(value?.geoLocation),
  });
  return Object.keys(location).length > 0 ? location : undefined;
};

const serializeOpeningHour = (
  entry: PoiDetailFormValues['content']['openingHours'][number]
): PoiOpeningHour | undefined => {
  const weekday = compactString(entry?.weekday);
  const result: MutablePartial<PoiOpeningHour> = withoutUndefined({
    weekday: weekday ? normalizeOpeningHourWeekday(weekday) : undefined,
    dateFrom: compactString(entry?.dateFrom),
    dateTo: compactString(entry?.dateTo),
    timeFrom: compactString(entry?.timeFrom),
    timeTo: compactString(entry?.timeTo),
    sortNumber: compactFiniteNumber(entry?.sortNumber),
    open: entry?.open,
    useYear: entry?.useYear,
    description: compactString(entry?.description),
  });
  return Object.keys(result).length > 0 && hasSubstantiveFields(result, 'open')
    ? result
    : undefined;
};

const serializeOpeningHours = (values: PoiDetailFormValues['content']['openingHours']) =>
  (values ?? [])
    .map(serializeOpeningHour)
    .filter((entry): entry is PoiOpeningHour => entry !== undefined);

const serializePrice = (
  entry: PoiDetailFormValues['content']['prices'][number]
): PoiPriceInformation | undefined => {
  const result: MutablePartial<PoiPriceInformation> = withoutUndefined({
    name: compactString(entry?.name),
    amount: compactValidatedNumber(entry?.amount),
    groupPrice: entry?.groupPrice,
    ageFrom: compactFiniteNumber(entry?.ageFrom),
    ageTo: compactFiniteNumber(entry?.ageTo),
    minAdultCount: compactFiniteNumber(entry?.minAdultCount),
    maxAdultCount: compactFiniteNumber(entry?.maxAdultCount),
    minChildrenCount: compactFiniteNumber(entry?.minChildrenCount),
    maxChildrenCount: compactFiniteNumber(entry?.maxChildrenCount),
    description: compactString(entry?.description),
    category: compactString(entry?.category),
  });
  return Object.keys(result).length > 0 && hasSubstantiveFields(result, 'groupPrice')
    ? result
    : undefined;
};

const serializePrices = (values: PoiDetailFormValues['content']['prices']) =>
  (values ?? [])
    .map(serializePrice)
    .filter((entry): entry is PoiPriceInformation => entry !== undefined);

const serializeMediaContent = (entry: PoiMediaContent): PoiMediaContent | undefined => {
  const result: MutablePartial<PoiMediaContent> = withoutUndefined({
    captionText: compactString(entry?.captionText),
    copyright: compactString(entry?.copyright),
    height: compactFiniteNumber(entry?.height),
    width: compactFiniteNumber(entry?.width),
    contentType: normalizeMediaContentType(entry?.contentType),
    sourceUrl: compactWebUrl(entry?.sourceUrl),
  });
  return Object.keys(result).length > 0 ? result : undefined;
};

const serializeMediaContents = (values: readonly PoiMediaContent[]) =>
  (values ?? [])
    .map(serializeMediaContent)
    .filter((entry): entry is PoiMediaContent => entry !== undefined);

const serializeAccessibilityInformation = (value: PoiAccessibilityInformation) => {
  const urls = compactWebUrls(value.urls);
  return withoutUndefined({
    description: compactString(value.description),
    types: compactString(value.types),
    urls: urls.length > 0 ? urls : undefined,
  });
};

const serializeCategories = (values: readonly string[]): Partial<PoiFormInput> => {
  const categoryNames = compactCategoryNames(values);
  return categoryNames.length > 0
    ? {
        categoryName: categoryNames[0],
        categories: categoryNames.map((name) => ({ name })),
      }
    : {};
};

const serializeOperator = (
  value: PoiDetailFormValues['content']['operator']
): PoiOperatingCompany | undefined => {
  const operator: MutablePartial<PoiOperatingCompany> = withoutUndefined({
    name: compactString(value.name),
    address: compactAddress(value.address),
    contact: compactContact(value.contact),
  });
  return Object.keys(operator).length > 0 ? operator : undefined;
};

export const mapPoiDetailFormValuesToInput = (
  values: PoiDetailFormValues,
  payload: unknown
): PoiFormInput => {
  const categories = serializeCategories(values.basis.categories);
  const contact = compactContact(values.content.contact);
  const location = compactLocation(values.content.location);
  const operator = serializeOperator(values.content.operator);

  return {
    name: values.name.trim(),
    ...(compactString(values.content.description)
      ? { description: compactString(values.content.description) }
      : {}),
    mobileDescription: compactString(values.content.mobileDescription) ?? '',
    active: values.basis.active,
    externalId: values.settings.externalId?.trim() ?? '',
    keywords: values.settings.keywords?.trim() ?? '',
    ...categories,
    addresses: (values.content.addresses ?? [])
      .map((entry) => compactAddress(entry))
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
    ...(contact ? { contact } : {}),
    ...(location ? { location } : {}),
    openingHours: serializeOpeningHours(values.content.openingHours),
    webUrls: compactWebUrls(values.content.webUrls),
    ...(operator ? { operatingCompany: operator } : {}),
    priceInformations: serializePrices(values.content.prices),
    mediaContents: serializeMediaContents(values.content.mediaContents),
    certificates: serializeCertificates(values.content.certificates),
    accessibilityInformation: serializeAccessibilityInformation(
      values.content.accessibilityInformation
    ),
    tags: serializeTags(values.content.tagsText),
    ...serializePayload(payload),
  };
};
