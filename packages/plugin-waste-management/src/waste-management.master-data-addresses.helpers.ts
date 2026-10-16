import type { WasteAddressEntityType, WasteCityRecord, WasteHouseNumberRecord, WasteRegionRecord, WasteStreetRecord } from '@sva/waste-management-contracts';
import type { useWasteMasterDataViewModel } from './use-waste-master-data-view-model.js';

export type EntityRecord = WasteRegionRecord | WasteCityRecord | WasteStreetRecord | WasteHouseNumberRecord;
export type AddressRow = Readonly<{
  id: string;
  type: WasteAddressEntityType;
  name: string;
  parent: string;
  city: string;
  region: string;
  searchText: string;
  sortValue: string;
  record: EntityRecord;
}>;
type Overview = NonNullable<ReturnType<typeof useWasteMasterDataViewModel>['overview']>;
type Lookups = Readonly<{
  overview: Overview;
  regions: ReadonlyMap<string, string>;
  cities: ReadonlyMap<string, WasteCityRecord>;
  streets: ReadonlyMap<string, WasteStreetRecord>;
}>;

const createLookups = (overview: Overview): Lookups => ({
  overview,
  regions: new Map(overview.regions.map((item) => [item.id, item.name])),
  cities: new Map(overview.cities.map((item) => [item.id, item])),
  streets: new Map(overview.streets.map((item) => [item.id, item])),
});

const cityLabel = ({ regions, cities }: Lookups, cityId: string): string => {
  const city = cities.get(cityId);
  const region = city?.regionId ? regions.get(city.regionId) : '';
  return city ? [city.postalCode, city.name, region].filter(Boolean).join(' · ') : '';
};

const regionRows = ({ overview }: Lookups): readonly AddressRow[] => overview.regions.map((record) => ({
  id: record.id, type: 'region', name: record.name, parent: '', city: '', region: '',
  searchText: record.name, sortValue: record.name, record,
}));

const cityRows = ({ overview, regions }: Lookups): readonly AddressRow[] => overview.cities.map((record) => {
  const region = record.regionId ? regions.get(record.regionId) ?? '' : '';
  return {
    id: record.id, type: 'city', name: record.name, parent: region, city: '', region,
    searchText: [record.name, record.postalCode, region].filter(Boolean).join(' '),
    sortValue: `${record.name}|${record.postalCode ?? ''}`, record,
  };
});

const streetRows = (lookups: Lookups): readonly AddressRow[] => lookups.overview.streets.map((record) => {
  const city = lookups.cities.get(record.cityId);
  const parent = cityLabel(lookups, record.cityId);
  const region = city?.regionId ? lookups.regions.get(city.regionId) ?? '' : '';
  return {
    id: record.id, type: 'street', name: record.name, parent, city: city?.name ?? '', region,
    searchText: [record.name, parent].filter(Boolean).join(' '),
    sortValue: `${record.name}|${city?.name ?? ''}`, record,
  };
});

const houseNumberRows = (lookups: Lookups): readonly AddressRow[] => lookups.overview.houseNumbers.map((record) => {
  const street = lookups.streets.get(record.streetId);
  const city = street ? lookups.cities.get(street.cityId) : undefined;
  const region = city?.regionId ? lookups.regions.get(city.regionId) ?? '' : '';
  const cityName = street ? cityLabel(lookups, street.cityId) : '';
  return {
    id: record.id, type: 'houseNumber', name: record.number, parent: street?.name ?? '', city: cityName, region,
    searchText: [record.number, street?.name, cityName].filter(Boolean).join(' '),
    sortValue: record.number, record,
  };
});

export const rowsForType = (
  type: WasteAddressEntityType,
  overview: ReturnType<typeof useWasteMasterDataViewModel>['overview']
): readonly AddressRow[] => {
  if (!overview) return [];
  const lookups = createLookups(overview);
  return ({ region: regionRows, city: cityRows, street: streetRows, houseNumber: houseNumberRows })[type](lookups);
};

export const recordParentId = (record: EntityRecord): string => {
  if ('regionId' in record) return record.regionId ?? '';
  if ('cityId' in record) return record.cityId;
  if ('streetId' in record) return record.streetId;
  return '';
};
