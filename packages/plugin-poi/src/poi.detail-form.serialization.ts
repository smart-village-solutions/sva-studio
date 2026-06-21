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

const compactString = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
};

const compactNumber = (value?: string | number | null) => {
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

const compactGeoLocation = (value?: PoiFormGeoLocationValue | null) => {
  const latitude = compactNumber(value?.latitude);
  const longitude = compactNumber(value?.longitude);
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
      ...(compactString(entry?.weekday) ? { weekday: compactString(entry?.weekday) } : {}),
      ...(compactString(entry?.dateFrom) ? { dateFrom: compactString(entry?.dateFrom) } : {}),
      ...(compactString(entry?.dateTo) ? { dateTo: compactString(entry?.dateTo) } : {}),
      ...(compactString(entry?.timeFrom) ? { timeFrom: compactString(entry?.timeFrom) } : {}),
      ...(compactString(entry?.timeTo) ? { timeTo: compactString(entry?.timeTo) } : {}),
      ...(compactNumber(entry?.sortNumber) !== undefined ? { sortNumber: compactNumber(entry?.sortNumber) } : {}),
      ...(entry?.open !== undefined ? { open: entry.open } : {}),
      ...(entry?.useYear !== undefined ? { useYear: entry.useYear } : {}),
      ...(compactString(entry?.description) ? { description: compactString(entry?.description) } : {}),
    }))
    .filter((entry) => Object.keys(entry).length > 0);

const serializePrices = (values: PoiDetailFormValues['content']['prices']) =>
  (values ?? [])
    .map((entry) => ({
      ...(compactString(entry?.name) ? { name: compactString(entry?.name) } : {}),
      ...(compactNumber(entry?.amount) !== undefined ? { amount: compactNumber(entry?.amount) } : {}),
      ...(entry?.groupPrice !== undefined ? { groupPrice: entry.groupPrice } : {}),
      ...(compactNumber(entry?.ageFrom) !== undefined ? { ageFrom: compactNumber(entry?.ageFrom) } : {}),
      ...(compactNumber(entry?.ageTo) !== undefined ? { ageTo: compactNumber(entry?.ageTo) } : {}),
      ...(compactNumber(entry?.minAdultCount) !== undefined ? { minAdultCount: compactNumber(entry?.minAdultCount) } : {}),
      ...(compactNumber(entry?.maxAdultCount) !== undefined ? { maxAdultCount: compactNumber(entry?.maxAdultCount) } : {}),
      ...(compactNumber(entry?.minChildrenCount) !== undefined
        ? { minChildrenCount: compactNumber(entry?.minChildrenCount) }
        : {}),
      ...(compactNumber(entry?.maxChildrenCount) !== undefined
        ? { maxChildrenCount: compactNumber(entry?.maxChildrenCount) }
        : {}),
      ...(compactString(entry?.description) ? { description: compactString(entry?.description) } : {}),
      ...(compactString(entry?.category) ? { category: compactString(entry?.category) } : {}),
    }))
    .filter((entry) => Object.keys(entry).length > 0);

const serializeMediaContents = (values: readonly PoiMediaContent[]) =>
  (values ?? [])
    .map((entry) => ({
      ...(compactString(entry?.captionText) ? { captionText: compactString(entry?.captionText) } : {}),
      ...(compactString(entry?.copyright) ? { copyright: compactString(entry?.copyright) } : {}),
      ...(compactNumber(entry?.height) !== undefined ? { height: compactNumber(entry?.height) } : {}),
      ...(compactNumber(entry?.width) !== undefined ? { width: compactNumber(entry?.width) } : {}),
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
  const accessibilityInformation = {
    ...(compactString(value.description) ? { description: compactString(value.description) } : {}),
    ...(compactString(value.types) ? { types: compactString(value.types) } : {}),
    ...(urls.length > 0 ? { urls } : {}),
  };
  return Object.keys(accessibilityInformation).length > 0 ? accessibilityInformation : undefined;
};

const serializeTags = (value: string) => {
  const tags = value
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
  return tags.length > 0 ? tags : undefined;
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
    ...(compactString(values.content.mobileDescription)
      ? { mobileDescription: compactString(values.content.mobileDescription) }
      : {}),
    active: values.basis.active,
    ...(compactString(values.basis.categoryName) ? { categoryName: compactString(values.basis.categoryName) } : {}),
    addresses: (values.content.addresses ?? [])
      .map((entry) => compactAddress(entry))
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
    ...(contact ? { contact } : {}),
    ...(compactLocation(values.content.location) ? { location: compactLocation(values.content.location) } : {}),
    openingHours: serializeOpeningHours(values.content.openingHours),
    webUrls: compactWebUrls(values.content.webUrls),
    ...(Object.keys(operator).length > 0 ? { operatingCompany: operator } : {}),
    priceInformations: serializePrices(values.content.prices),
    mediaContents: serializeMediaContents(values.content.mediaContents),
    certificates: serializeCertificates(values.content.certificates),
    ...(serializeAccessibilityInformation(values.content.accessibilityInformation)
      ? { accessibilityInformation: serializeAccessibilityInformation(values.content.accessibilityInformation) }
      : {}),
    ...(compactString(values.content.tagsText) ? { tags: serializeTags(values.content.tagsText) } : {}),
    ...(Object.keys(payload).length > 0 ? { payload } : {}),
  };
};
