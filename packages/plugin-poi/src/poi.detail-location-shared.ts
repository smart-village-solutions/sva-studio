import type { PoiDetailFormValues } from './poi.detail-form.js';

export const joinStreetParts = (street?: string, houseNumber?: string): string => {
  const parts = [street?.trim(), houseNumber?.trim()].filter((value): value is string => Boolean(value));
  return parts.join(' ');
};

export const getCurrentAddress = (address?: PoiDetailFormValues['content']['addresses'][number]) =>
  address ?? {
    addition: '',
    street: '',
    zip: '',
    city: '',
    kind: '',
    geoLocation: { latitude: '', longitude: '' },
  };

export const getCurrentLocation = (location?: PoiDetailFormValues['content']['location']) =>
  location ?? { geoLocation: { latitude: '', longitude: '' } };
