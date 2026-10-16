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

export const rowsForType = (
  type: WasteAddressEntityType,
  overview: ReturnType<typeof useWasteMasterDataViewModel>['overview']
): readonly AddressRow[] => {
  if (!overview) return [];
  const regions = new Map(overview.regions.map((item) => [item.id, item.name]));
  const cities = new Map(overview.cities.map((item) => [item.id, item]));
  const streets = new Map(overview.streets.map((item) => [item.id, item]));
  const cityLabel = (cityId: string): string => {
    const city = cities.get(cityId);
    return city ? [city.postalCode, city.name, city.regionId ? regions.get(city.regionId) : ''].filter(Boolean).join(' · ') : '';
  };
  if (type === 'region') return overview.regions.map((record) => ({
    id: record.id, type, name: record.name, parent: '', city: '', region: '',
    searchText: record.name, sortValue: record.name, record,
  }));
  if (type === 'city') return overview.cities.map((record) => ({
    id: record.id, type, name: record.name, parent: record.regionId ? regions.get(record.regionId) ?? '' : '',
    city: '', region: record.regionId ? regions.get(record.regionId) ?? '' : '',
    searchText: [record.name, record.postalCode, record.regionId ? regions.get(record.regionId) : ''].filter(Boolean).join(' '),
    sortValue: `${record.name}|${record.postalCode ?? ''}`, record,
  }));
  if (type === 'street') return overview.streets.map((record) => {
    const city = cities.get(record.cityId);
    const region = city?.regionId ? regions.get(city.regionId) ?? '' : '';
    return {
      id: record.id, type, name: record.name, parent: cityLabel(record.cityId), city: city?.name ?? '', region,
      searchText: [record.name, cityLabel(record.cityId)].filter(Boolean).join(' '),
      sortValue: `${record.name}|${city?.name ?? ''}`, record,
    };
  });
  return overview.houseNumbers.map((record) => {
    const street = streets.get(record.streetId);
    const city = street ? cities.get(street.cityId) : undefined;
    const region = city?.regionId ? regions.get(city.regionId) ?? '' : '';
    return {
      id: record.id, type, name: record.number, parent: street?.name ?? '', city: cityLabel(street?.cityId ?? ''), region,
      searchText: [record.number, street?.name, cityLabel(street?.cityId ?? '')].filter(Boolean).join(' '),
      sortValue: record.number, record,
    };
  });
};

export const recordParentId = (record: EntityRecord): string => {
  if ('regionId' in record) return record.regionId ?? '';
  if ('cityId' in record) return record.cityId;
  if ('streetId' in record) return record.streetId;
  return '';
};

