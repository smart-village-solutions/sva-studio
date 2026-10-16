import type { WasteAddressEntityType, WasteCityRecord, WasteHouseNumberRecord, WasteRegionRecord, WasteStreetRecord } from '@sva/waste-management-contracts';
import type { StudioDataTableSorting } from '@sva/studio-ui-react';
import type { useWasteMasterDataViewModel } from './use-waste-master-data-view-model.js';
import type { WasteManagementSearchParams } from './search-params.js';

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
export type AddressSortingState = Extract<StudioDataTableSorting, { mode: 'external' }>['state'];
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

export const addressRowContext = (row: AddressRow): string =>
  [row.name, row.parent, row.city].filter(Boolean).join(' · ');

export const filterAddressRows = (rows: readonly AddressRow[], search: WasteManagementSearchParams): readonly AddressRow[] => {
  const query = search.q.trim().toLocaleLowerCase('de-DE');
  return rows
    .filter((row) => !search.addressParentId || recordParentId(row.record) === search.addressParentId)
    .filter((row) => !query || row.searchText.toLocaleLowerCase('de-DE').includes(query))
    .sort((left, right) => left.sortValue.localeCompare(right.sortValue, 'de-DE', { numeric: search.addressEntityType === 'houseNumber', sensitivity: 'base' }) || left.id.localeCompare(right.id));
};

const addressSortValue = (row: AddressRow, columnId: string): string => columnId === 'postalCode'
  ? ('postalCode' in row.record ? row.record.postalCode ?? '' : '')
  : columnId === 'parent' ? [row.parent, row.city].filter(Boolean).join(' · ') : row.sortValue;

export const sortAddressRows = (
  rows: readonly AddressRow[], entityType: WasteAddressEntityType, sorting: AddressSortingState
): readonly AddressRow[] => {
  const sort = sorting[0];
  if (!sort) return rows;
  return [...rows].sort((left, right) => {
    const compared = addressSortValue(left, sort.id).localeCompare(addressSortValue(right, sort.id), 'de-DE', {
      numeric: entityType === 'houseNumber', sensitivity: 'base',
    }) || left.id.localeCompare(right.id);
    return sort.desc ? -compared : compared;
  });
};

export const pageAddressRows = (rows: readonly AddressRow[], requestedPage: number, pageSize: number) => {
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(requestedPage, pageCount);
  return { page, pageCount, pageItems: rows.slice((page - 1) * pageSize, page * pageSize) };
};

export const missingAddressParentType = (
  type: WasteAddressEntityType, cityCount: number, streetCount: number
): WasteAddressEntityType | null => {
  if ((type === 'street' || type === 'houseNumber') && cityCount === 0) return 'city';
  if (type === 'houseNumber' && streetCount === 0) return 'street';
  return null;
};
