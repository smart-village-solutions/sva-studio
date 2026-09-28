import { requestMainserverJson } from '@sva/plugin-sdk';

import type { WasteLocationKey } from './news.types.js';

export type NewsWasteRegion = Readonly<{ id: string; name: string }>;
export type NewsWasteCity = Readonly<{
  id: string;
  name: string;
  postalCode?: string;
  regionId?: string;
}>;
export type NewsWasteStreet = Readonly<{ id: string; name: string; cityId: string }>;
export type NewsWasteHouseNumber = Readonly<{ id: string; number: string; streetId: string }>;
export type NewsWasteMasterDataOverview = Readonly<{
  regions: readonly NewsWasteRegion[];
  cities: readonly NewsWasteCity[];
  streets: readonly NewsWasteStreet[];
  houseNumbers: readonly NewsWasteHouseNumber[];
  collectionLocations: readonly Readonly<{
    active: boolean;
    cityId: string;
    streetId?: string;
    houseNumberId?: string;
    regionId?: string;
  }>[];
}>;

export type NewsWasteTargetOption = Readonly<{
  id: string;
  key: WasteLocationKey;
  regionId?: string;
  region: string;
  cityId: string;
  city: string;
  postalCode: string;
  streetId: string;
  street: string;
  houseNumberId?: string;
  houseNumber: string;
  label: string;
}>;

const byId = <T extends { readonly id: string }>(items: readonly T[]) =>
  new Map(items.map((item) => [item.id, item] as const));

const compact = (value: string | undefined): string => value?.trim() ?? '';

const formatWasteStreetKey = (street: string, houseNumber?: string): string => {
  const normalizedHouseNumber = houseNumber?.trim() ?? '';
  const isAllHouseNumbers =
    normalizedHouseNumber.localeCompare('Alle Hausnummern', 'de', { sensitivity: 'base' }) === 0;
  return [street.trim(), isAllHouseNumbers ? '' : normalizedHouseNumber].filter(Boolean).join(' ');
};

export const wasteLocationKeyId = (key: WasteLocationKey): string =>
  JSON.stringify([key.street.trim(), key.zip.trim(), key.city.trim()]);

export const resolveNewsWasteTargetOptions = (
  overview: NewsWasteMasterDataOverview
): readonly NewsWasteTargetOption[] => {
  const regions = byId(overview.regions);
  const cities = byId(overview.cities);
  const streets = byId(overview.streets);
  const houseNumbers = byId(overview.houseNumbers);

  const unique = new Map<string, NewsWasteTargetOption>();
  for (const location of overview.collectionLocations) {
    if (!location.active || !location.streetId) continue;
    const city = cities.get(location.cityId);
    const street = streets.get(location.streetId);
    const referencedHouseNumber = location.houseNumberId
      ? houseNumbers.get(location.houseNumberId)
      : undefined;
    const houseNumber =
      referencedHouseNumber?.streetId === location.streetId ? referencedHouseNumber : undefined;
    const cityName = compact(city?.name);
    const postalCode = compact(city?.postalCode);
    const streetName = compact(street?.name);
    if (!cityName || !postalCode || !streetName) continue;

    const streetWithHouseNumber = formatWasteStreetKey(streetName, houseNumber?.number);
    const key = { street: streetWithHouseNumber, zip: postalCode, city: cityName };
    const id = wasteLocationKeyId(key);
    if (unique.has(id)) continue;
    unique.set(id, {
      id,
      key,
      regionId: location.regionId ?? city?.regionId,
      region: compact(regions.get(location.regionId ?? city?.regionId ?? '')?.name),
      cityId: location.cityId,
      city: cityName,
      postalCode,
      streetId: location.streetId,
      street: streetName,
      houseNumberId: houseNumber?.id,
      houseNumber: compact(houseNumber?.number),
      label: `${streetWithHouseNumber}, ${postalCode} ${cityName}`,
    });
  }
  return [...unique.values()].sort((left, right) => left.label.localeCompare(right.label, 'de'));
};

export const loadNewsWasteMasterData = async (): Promise<NewsWasteMasterDataOverview> => {
  const response = await requestMainserverJson<
    { readonly data: NewsWasteMasterDataOverview },
    Error
  >({
    url: '/api/v1/waste-management/master-data?scope=targeting',
    errorFactory: (_code, message) => new Error(message),
  });
  return response.data;
};

export const findStaleWasteLocationKeys = (
  keys: readonly WasteLocationKey[],
  options: readonly NewsWasteTargetOption[]
): readonly WasteLocationKey[] => {
  const current = new Set(options.map((option) => option.id));
  return keys.filter((key) => !current.has(wasteLocationKeyId(key)));
};
