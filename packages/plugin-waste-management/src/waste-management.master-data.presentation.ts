import type {
  WasteCityRecord,
  WasteCollectionLocationRecord,
  WasteFractionRecord,
  WasteHouseNumberRecord,
  WasteRegionRecord,
  WasteStreetRecord,
  WasteTourRecord,
} from '@sva/core';
import { usePluginTranslation } from '@sva/plugin-sdk';

import type { WasteManagementMasterDataOverview } from './waste-management.api.js';
import type { WasteManagementSearchParams } from './search-params.js';

type PluginTranslation = ReturnType<typeof usePluginTranslation>;

const matchesSearch = (value: string, query: string) => value.toLocaleLowerCase().includes(query.toLocaleLowerCase());
const matchesStatusFilter = (status: WasteManagementSearchParams['status'], active: boolean | undefined): boolean =>
  status === 'all' || active === undefined ? true : status === 'active' ? active : !active;
const findRegionName = (regions: readonly WasteRegionRecord[], regionId?: string): string | undefined =>
  regionId ? regions.find((region) => region.id === regionId)?.name : undefined;
const findCityName = (cities: readonly WasteCityRecord[], cityId: string): string =>
  cities.find((city) => city.id === cityId)?.name ?? cityId;
const findStreetName = (streets: readonly WasteStreetRecord[], streetId?: string): string | undefined =>
  streetId ? streets.find((street) => street.id === streetId)?.name : undefined;
const findHouseNumberValue = (houseNumbers: readonly WasteHouseNumberRecord[], houseNumberId?: string): string | undefined =>
  houseNumberId ? houseNumbers.find((entry) => entry.id === houseNumberId)?.number : undefined;

export const wasteMasterDataPresentation = {
  filterFractions: (fractions: readonly WasteFractionRecord[], search: WasteManagementSearchParams): readonly WasteFractionRecord[] =>
    fractions.filter((fraction) => {
      if (!matchesStatusFilter(search.status, fraction.active)) {
        return false;
      }
      return !search.q
        ? true
        : [fraction.name, fraction.description, fraction.containerSize]
            .filter((value): value is string => typeof value === 'string' && value.length > 0)
            .some((value) => matchesSearch(value, search.q));
    }),
  filterRegions: (regions: readonly WasteRegionRecord[], search: WasteManagementSearchParams): readonly WasteRegionRecord[] =>
    regions.filter((region) =>
      search.regionId ? region.id === search.regionId : search.q ? matchesSearch(region.name, search.q) : true
    ),
  filterCities: (cities: readonly WasteCityRecord[], search: WasteManagementSearchParams): readonly WasteCityRecord[] =>
    cities.filter((city) => {
      if (search.cityId && city.id !== search.cityId) return false;
      if (search.regionId && city.regionId !== search.regionId) return false;
      return search.cityId || search.regionId ? true : search.q ? matchesSearch(city.name, search.q) : true;
    }),
  filterStreets: (streets: readonly WasteStreetRecord[], search: WasteManagementSearchParams): readonly WasteStreetRecord[] =>
    streets.filter((street) => (search.cityId ? street.cityId === search.cityId : search.q ? matchesSearch(street.name, search.q) : true)),
  filterHouseNumbers: (
    houseNumbers: readonly WasteHouseNumberRecord[],
    search: WasteManagementSearchParams
  ): readonly WasteHouseNumberRecord[] => houseNumbers.filter((houseNumber) => (search.q ? matchesSearch(houseNumber.number, search.q) : true)),
  filterCollectionLocations: (
    locations: readonly WasteCollectionLocationRecord[],
    search: WasteManagementSearchParams
  ): readonly WasteCollectionLocationRecord[] =>
    locations.filter((location) => {
      if (!matchesStatusFilter(search.status, location.active)) return false;
      if (search.regionId && location.regionId !== search.regionId) return false;
      return !(search.cityId && location.cityId !== search.cityId);
    }),
  formatCollectionLocationLabel: (
    pt: PluginTranslation,
    data: Pick<WasteManagementMasterDataOverview, 'regions' | 'cities' | 'streets' | 'houseNumbers'>,
    location: WasteCollectionLocationRecord
  ): string =>
    [
      findRegionName(data.regions, location.regionId),
      findCityName(data.cities, location.cityId),
      findStreetName(data.streets, location.streetId) ?? pt('masterData.collectionLocations.meta.allStreets'),
      findHouseNumberValue(data.houseNumbers, location.houseNumberId) ?? pt('masterData.collectionLocations.meta.allHouseNumbers'),
    ]
      .filter((value): value is string => Boolean(value))
      .join(' / '),
  mapSelectedLocations: (
    pt: PluginTranslation,
    overview: WasteManagementMasterDataOverview | null,
    locations: readonly WasteCollectionLocationRecord[]
  ): readonly { id: string; label: string }[] => {
    const fallback = overview ?? {
      fractions: [],
      regions: [],
      cities: [],
      streets: [],
      houseNumbers: [],
      collectionLocations: [],
      locationTourLinks: [],
    };
    return locations.map((location) => ({
      id: location.id,
      label: wasteMasterDataPresentation.formatCollectionLocationLabel(pt, fallback, location),
    }));
  },
  mapBulkTourId: (tours: readonly WasteTourRecord[]): string => (tours.length === 1 ? tours[0]?.id ?? '' : ''),
};
