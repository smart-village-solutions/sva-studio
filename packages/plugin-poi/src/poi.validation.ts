import type { PoiFormInput } from './poi.types.js';

const isHttpsUrl = (value: string): boolean => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

const hasInvalidGeoLocation = (value?: { readonly latitude?: number; readonly longitude?: number }) => {
  if (!value) {
    return false;
  }

  const { latitude, longitude } = value;
  if (latitude === undefined && longitude === undefined) {
    return false;
  }

  return (
    typeof latitude !== 'number' ||
    Number.isFinite(latitude) === false ||
    latitude < -90 ||
    latitude > 90 ||
    typeof longitude !== 'number' ||
    Number.isFinite(longitude) === false ||
    longitude < -180 ||
    longitude > 180
  );
};

export const validatePoiForm = (input: PoiFormInput): readonly string[] => {
  const errors: string[] = [];

  if (input.name.trim().length === 0) {
    errors.push('name');
  }

  if (input.categoryName && input.categoryName.length > 128) {
    errors.push('categoryName');
  }

  if ((input.webUrls ?? []).some((url) => url.url.trim().length > 0 && isHttpsUrl(url.url) === false)) {
    errors.push('webUrls');
  }

  if ((input.addresses ?? []).some((address) => hasInvalidGeoLocation(address.geoLocation))) {
    errors.push('addresses');
  }

  if (hasInvalidGeoLocation(input.location?.geoLocation)) {
    errors.push('location');
  }

  if ((input.contact?.webUrls ?? []).some((url) => url.url.trim().length > 0 && isHttpsUrl(url.url) === false)) {
    errors.push('contact.webUrls');
  }

  if (
    (input.operatingCompany?.contact?.webUrls ?? []).some(
      (url) => url.url.trim().length > 0 && isHttpsUrl(url.url) === false
    )
  ) {
    errors.push('operatingCompany.contact.webUrls');
  }

  if (
    (input.priceInformations ?? []).some(
      (price) => price.amount !== undefined && (typeof price.amount !== 'number' || Number.isFinite(price.amount) === false)
    )
  ) {
    errors.push('priceInformations');
  }

  return errors;
};
