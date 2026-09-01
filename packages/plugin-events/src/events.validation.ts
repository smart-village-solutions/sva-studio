import { isPersistableManualContentMediaUrl } from '@sva/studio-ui-react';

import type { EventFormInput } from './events.types.js';
import { isValidDateOnlyValue } from './events.date-only.js';

const isHttpsUrl = (value: string): boolean => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

const hasInvalidUrl = (value: string | undefined): boolean =>
  value !== undefined && value.trim().length > 0 && isHttpsUrl(value) === false;

export const hasInvalidGeoLocation = (value?: {
  readonly latitude?: number;
  readonly longitude?: number;
}): boolean => {
  const { latitude, longitude } = value ?? {};
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

export const hasInvalidFormGeoLocation = (value?: {
  readonly latitude?: string;
  readonly longitude?: string;
}): boolean => {
  const latitude = value?.latitude?.trim() ?? '';
  const longitude = value?.longitude?.trim() ?? '';
  if (latitude.length === 0 && longitude.length === 0) {
    return false;
  }

  return hasInvalidGeoLocation({
    latitude: latitude.length > 0 ? Number(latitude) : undefined,
    longitude: longitude.length > 0 ? Number(longitude) : undefined,
  });
};

export const validateEventForm = (input: EventFormInput): readonly string[] => {
  const errors: string[] = [];

  if (input.title.trim().length === 0) {
    errors.push('title');
  }

  if (input.organizer && (input.organizer.name?.trim().length ?? 0) === 0) {
    errors.push('organizerName');
  }

  if (
    (input.dates ?? []).some(
      (date) =>
        isValidDateOnlyValue(date.dateStart) === false ||
        isValidDateOnlyValue(date.dateEnd) === false
    )
  ) {
    errors.push('dates');
  }

  if (
    (input.urls ?? []).some((url) => url.url.trim().length > 0 && isHttpsUrl(url.url) === false)
  ) {
    errors.push('urls');
  }

  if (
    (input.contacts ?? []).some((contact) =>
      (contact.webUrls ?? []).some((url) => hasInvalidUrl(url.url))
    )
  ) {
    errors.push('urls');
  }

  if ((input.organizer?.contact?.webUrls ?? []).some((url) => hasInvalidUrl(url.url))) {
    errors.push('urls');
  }

  if ((input.accessibilityInformation?.urls ?? []).some((url) => hasInvalidUrl(url.url))) {
    errors.push('urls');
  }

  if (
    (input.mediaContents ?? []).some((media) => {
      const url = media.sourceUrl?.url?.trim() ?? '';
      return url.length > 0 && !isPersistableManualContentMediaUrl(url);
    })
  ) {
    errors.push('urls');
  }

  if (
    (input.categories ?? []).some(
      (category) => category.name.trim().length === 0 || category.name.length > 128
    )
  ) {
    errors.push('categories');
  }

  if (
    (input.priceInformations ?? []).some(
      (price) => price.amount !== undefined && Number.isFinite(price.amount) === false
    )
  ) {
    errors.push('priceInformations');
  }

  if (
    (input.addresses ?? []).some((address) => hasInvalidGeoLocation(address.geoLocation)) ||
    hasInvalidGeoLocation(input.organizer?.address?.geoLocation)
  ) {
    errors.push('geoLocation');
  }

  return errors;
};
