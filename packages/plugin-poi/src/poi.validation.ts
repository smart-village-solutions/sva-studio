import type { PoiFormInput } from './poi.types.js';

const isHttpsUrl = (value: string): boolean => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

const hasInvalidHttpsUrl = (
  values?: readonly Readonly<{
    url: string;
  }>[]
) => (values ?? []).some((entry) => entry.url.trim().length > 0 && isHttpsUrl(entry.url) === false);

const defined = <T>(value: T | undefined | null): value is T => value !== undefined && value !== null;

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
  const pushIf = (condition: boolean, error: string) => {
    if (condition) {
      errors.push(error);
    }
  };

  pushIf(input.name.trim().length === 0, 'name');
  pushIf(Boolean(input.categoryName && input.categoryName.length > 128), 'categoryName');
  pushIf(hasInvalidHttpsUrl(input.webUrls), 'webUrls');
  pushIf((input.addresses ?? []).some((address) => hasInvalidGeoLocation(address.geoLocation)), 'addresses');
  pushIf(hasInvalidGeoLocation(input.location?.geoLocation), 'location');
  pushIf(hasInvalidHttpsUrl(input.contact?.webUrls), 'contact.webUrls');
  pushIf(hasInvalidGeoLocation(input.operatingCompany?.address?.geoLocation), 'operatingCompany.address');
  pushIf(hasInvalidHttpsUrl(input.operatingCompany?.contact?.webUrls), 'operatingCompany.contact.webUrls');
  pushIf(
    (input.priceInformations ?? []).some(
      (price) => price.amount !== undefined && (typeof price.amount !== 'number' || Number.isFinite(price.amount) === false),
    ),
    'priceInformations',
  );
  pushIf(
    hasInvalidHttpsUrl((input.mediaContents ?? []).map((entry) => entry.sourceUrl).filter(defined)),
    'mediaContents',
  );

  return errors;
};
