import type { PoiAddress, PoiPriceInformation } from './poi.content.types.js';
import type { PoiContentItem } from './poi.types.js';
import {
  createDefaultAccessibilityInformation,
  createDefaultAddress,
  createDefaultCertificate,
  createDefaultOpeningHour,
  createDefaultPrice,
  createDefaultWebUrl,
} from './poi.detail-form.defaults.js';
import {
  type PoiAddressFormValue,
  type PoiDetailFormValues,
  type PoiFormGeoLocationValue,
  type PoiLocationFormValue,
  type PoiPriceFormValue,
} from './poi.detail-form.types.js';
import { normalizeOpeningHourWeekday } from './poi.opening-hours.js';

const mapNumberToString = (value?: number) => (typeof value === 'number' && Number.isFinite(value) ? String(value) : '');

const mapGeoLocationToFormValue = (
  value?: { readonly latitude?: number; readonly longitude?: number } | null,
): PoiFormGeoLocationValue => ({
  latitude: mapNumberToString(value?.latitude),
  longitude: mapNumberToString(value?.longitude),
});

const mapAddressToFormValue = (address?: PoiAddress): PoiAddressFormValue => ({
  addition: address?.addition ?? '',
  street: address?.street ?? '',
  zip: address?.zip ?? '',
  city: address?.city ?? '',
  kind: address?.kind ?? '',
  geoLocation: mapGeoLocationToFormValue(address?.geoLocation),
});

const mapLocationToFormValue = (location?: PoiContentItem['location']): PoiLocationFormValue => ({
  name: location?.name ?? '',
  department: location?.department ?? '',
  district: location?.district ?? '',
  regionName: location?.regionName ?? '',
  state: location?.state ?? '',
  geoLocation: mapGeoLocationToFormValue(location?.geoLocation),
});

const mapContactToFormValue = (contact?: PoiContentItem['contact']) => ({
  firstName: contact?.firstName ?? '',
  lastName: contact?.lastName ?? '',
  phone: contact?.phone ?? '',
  fax: contact?.fax ?? '',
  email: contact?.email ?? '',
  webUrls: contact?.webUrls?.length ? contact.webUrls : [],
});

const mapPriceToFormValue = (price?: PoiPriceInformation): PoiPriceFormValue => ({
  name: price?.name ?? '',
  amount: mapNumberToString(price?.amount),
  groupPrice: price?.groupPrice ?? false,
  ageFrom: mapNumberToString(price?.ageFrom),
  ageTo: mapNumberToString(price?.ageTo),
  minAdultCount: mapNumberToString(price?.minAdultCount),
  maxAdultCount: mapNumberToString(price?.maxAdultCount),
  minChildrenCount: mapNumberToString(price?.minChildrenCount),
  maxChildrenCount: mapNumberToString(price?.maxChildrenCount),
  description: price?.description ?? '',
  category: price?.category ?? '',
});

const mapPoiContentToFormValues = (item: PoiContentItem): PoiDetailFormValues['content'] => ({
  description: item.description ?? '',
  mobileDescription: item.mobileDescription ?? '',
  addresses: item.addresses?.length ? item.addresses.map(mapAddressToFormValue) : [createDefaultAddress()],
  location: mapLocationToFormValue(item.location),
  contact: mapContactToFormValue(item.contact),
  openingHours: item.openingHours?.length
    ? item.openingHours.map((entry) => ({
        ...entry,
        weekday: normalizeOpeningHourWeekday(entry.weekday),
      }))
    : [createDefaultOpeningHour()],
  webUrls: item.webUrls?.length ? item.webUrls : [createDefaultWebUrl()],
  operator: {
    name: item.operatingCompany?.name ?? '',
    address: mapAddressToFormValue(item.operatingCompany?.address),
    contact: mapContactToFormValue(item.operatingCompany?.contact),
  },
  prices: item.priceInformations?.length ? item.priceInformations.map(mapPriceToFormValue) : [createDefaultPrice()],
  mediaContents: item.mediaContents?.length ? item.mediaContents : [],
  certificates: item.certificates?.length ? item.certificates : [createDefaultCertificate()],
  accessibilityInformation: {
    ...createDefaultAccessibilityInformation(),
    description: item.accessibilityInformation?.description ?? '',
    types: item.accessibilityInformation?.types ?? '',
    urls: item.accessibilityInformation?.urls?.length ? item.accessibilityInformation.urls : [],
  },
  tagsText: item.tags?.join(', ') ?? '',
  payloadText: JSON.stringify(item.payload ?? {}, null, 2),
});

export const mapPoiItemToDetailFormValues = (item: PoiContentItem): PoiDetailFormValues => ({
  name: item.name,
  basis: {
    categories: item.categories?.length ? item.categories.map((category) => category.name) : item.categoryName ? [item.categoryName] : [],
    active: item.active !== false,
  },
  content: mapPoiContentToFormValues(item),
  settings: {
    externalId: item.externalId ?? '',
    keywords: item.keywords ?? '',
  },
});

export const parsePoiPayloadText = (payloadText: string): Record<string, unknown> | null => {
  try {
    const parsed = JSON.parse(payloadText) as unknown;
    return parsed !== null && typeof parsed === 'object' && Array.isArray(parsed) === false
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};
