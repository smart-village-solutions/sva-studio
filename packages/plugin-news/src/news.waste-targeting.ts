import {
  requestMainserverJson,
  type WasteCityRecord,
  type WasteHouseNumberRecord,
  type WasteManagementMasterDataOverview,
  type WasteRegionRecord,
  type WasteStreetRecord,
} from '@sva/plugin-sdk';

import type { WasteLocationKey } from './news.types.js';

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

export const wasteLocationKeyId = (key: WasteLocationKey): string =>
  JSON.stringify([key.street.trim(), key.zip.trim(), key.city.trim()]);

export const resolveNewsWasteTargetOptions = (
  overview: Pick<
    WasteManagementMasterDataOverview,
    'regions' | 'cities' | 'streets' | 'houseNumbers' | 'collectionLocations'
  >
): readonly NewsWasteTargetOption[] => {
  const regions = byId<WasteRegionRecord>(overview.regions);
  const cities = byId<WasteCityRecord>(overview.cities);
  const streets = byId<WasteStreetRecord>(overview.streets);
  const houseNumbers = byId<WasteHouseNumberRecord>(overview.houseNumbers);

  const unique = new Map<string, NewsWasteTargetOption>();
  for (const location of overview.collectionLocations) {
    if (!location.active || !location.streetId) continue;
    const city = cities.get(location.cityId);
    const street = streets.get(location.streetId);
    const houseNumber = location.houseNumberId
      ? houseNumbers.get(location.houseNumberId)
      : undefined;
    const cityName = compact(city?.name);
    const postalCode = compact(city?.postalCode);
    const streetName = compact(street?.name);
    if (!cityName || !postalCode || !streetName) continue;

    const streetWithHouseNumber = [streetName, compact(houseNumber?.number)]
      .filter(Boolean)
      .join(' ');
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
      houseNumberId: location.houseNumberId,
      houseNumber: compact(houseNumber?.number),
      label: `${streetWithHouseNumber}, ${postalCode} ${cityName}`,
    });
  }
  return [...unique.values()].sort((left, right) => left.label.localeCompare(right.label, 'de'));
};

export const loadNewsWasteMasterData = async (): Promise<WasteManagementMasterDataOverview> => {
  const response = await requestMainserverJson<
    { readonly data: WasteManagementMasterDataOverview },
    Error
  >({
    url: '/api/v1/waste-management/master-data?scope=locations',
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
