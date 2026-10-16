import type { WasteCityRecord, WasteRegionRecord, WasteStreetRecord } from '@sva/waste-management-contracts';

const addDuplicateIds = <T extends Readonly<{ id: string }>>(
  values: readonly T[],
  labelFor: (item: T) => string
): ReadonlyMap<string, string> => {
  const labels = values.map((item) => [item.id, labelFor(item)] as const);
  const counts = new Map<string, number>();
  for (const [, label] of labels) counts.set(label, (counts.get(label) ?? 0) + 1);
  return new Map(labels.map(([id, label]) => [id, (counts.get(label) ?? 0) > 1 ? `${label} · ${id.slice(0, 8)}` : label]));
};

export const createRegionOptionLabels = (regions: readonly WasteRegionRecord[]) =>
  addDuplicateIds(regions, (region) => region.name);

export const createCityOptionLabels = (
  cities: readonly WasteCityRecord[],
  regions: readonly WasteRegionRecord[],
  noRegionLabel: string
) => {
  const regionName = new Map(regions.map((region) => [region.id, region.name]));
  return addDuplicateIds(cities, (city) =>
    [city.postalCode, city.name, city.regionId ? regionName.get(city.regionId) ?? noRegionLabel : noRegionLabel]
      .filter(Boolean)
      .join(' · ')
  );
};

export const createStreetOptionLabels = (
  streets: readonly WasteStreetRecord[],
  cities: readonly WasteCityRecord[],
  regions: readonly WasteRegionRecord[],
  noRegionLabel: string
) => {
  const cityName = createCityOptionLabels(cities, regions, noRegionLabel);
  const cityId = new Map(cities.map((city) => [city.id, cityName.get(city.id) ?? city.name]));
  return addDuplicateIds(streets, (street) => `${street.name} · ${cityId.get(street.cityId) ?? ''}`);
};
