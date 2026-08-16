import type { PoiContact } from './poi.content.types.js';
import type { PoiOperatingCompanyFormValue } from './poi.detail-form.js';

export type PoiOperatorFieldValues = Readonly<{
  name: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  fax: string;
  webUrl: string;
  webUrlDescription: string;
  locationName: string;
  street: string;
  zip: string;
  city: string;
  latitude: string;
  longitude: string;
}>;

export type PoiOperatorTextFieldPath =
  | 'content.operator.name'
  | 'content.operator.contact.email'
  | 'content.operator.contact.firstName'
  | 'content.operator.contact.lastName'
  | 'content.operator.contact.phone'
  | 'content.operator.contact.fax'
  | 'content.operator.address.addition'
  | 'content.operator.address.street'
  | 'content.operator.address.zip'
  | 'content.operator.address.city';

export type PoiOperatorWebUrlUpdate = Readonly<{ url?: string; description?: string }>;

const getPoiOperatorContactValues = (contact?: PoiContact) => ({
  email: contact?.email ?? '',
  firstName: contact?.firstName ?? '',
  lastName: contact?.lastName ?? '',
  phone: contact?.phone ?? '',
  fax: contact?.fax ?? '',
});

const getPoiOperatorWebUrlValues = (contact?: PoiContact) => {
  const webUrl = contact?.webUrls?.[0];
  return { webUrl: webUrl?.url ?? '', webUrlDescription: webUrl?.description ?? '' };
};

const getPoiOperatorAddressValues = (address?: PoiOperatingCompanyFormValue['address']) => ({
  locationName: address?.addition ?? '',
  street: address?.street ?? '',
  zip: address?.zip ?? '',
  city: address?.city ?? '',
});

const getPoiOperatorCoordinateValues = (address?: PoiOperatingCompanyFormValue['address']) => ({
  latitude: address?.geoLocation?.latitude ?? '',
  longitude: address?.geoLocation?.longitude ?? '',
});

export const getPoiOperatorFieldValues = (
  operator?: PoiOperatingCompanyFormValue
): PoiOperatorFieldValues => ({
  name: operator?.name ?? '',
  ...getPoiOperatorContactValues(operator?.contact),
  ...getPoiOperatorWebUrlValues(operator?.contact),
  ...getPoiOperatorAddressValues(operator?.address),
  ...getPoiOperatorCoordinateValues(operator?.address),
});

export const mergePoiOperatorWebUrl = (
  current: Readonly<{ url?: string; description?: string }> | undefined,
  update: PoiOperatorWebUrlUpdate
) => ({
  url: update.url ?? current?.url ?? '',
  description: update.description ?? current?.description ?? '',
});

export const createPoiOperatorGeocodingAddress = (
  values: Pick<PoiOperatorFieldValues, 'locationName' | 'street' | 'zip' | 'city'>
) => ({
  query: values.locationName.trim() || undefined,
  street: values.street.trim() || undefined,
  zip: values.zip.trim() || undefined,
  city: values.city.trim() || undefined,
  country: 'Deutschland',
});

export const hasPoiOperatorGeocodingInput = (
  values: Pick<PoiOperatorFieldValues, 'locationName' | 'street' | 'zip' | 'city'>
) => Object.values(values).some((value) => value.trim().length > 0);
