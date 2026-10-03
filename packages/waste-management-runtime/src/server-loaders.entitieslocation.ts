import type {
  WasteRegionRecord,
  WasteStreetRecord,
  WasteHouseNumberRecord,
  WasteCollectionLocationRecord,
} from '@sva/waste-management-contracts';
import type { WasteRepository } from './server-loaders.context.js';
import type { WasteLoaderContext } from './server-loaders.context.js';

export class WasteEntitiesLocationLoaders {
  constructor(private readonly context: WasteLoaderContext) {}

  get loadWasteFractionById() {
    return this.context.createLoader(
      'load_waste_fraction_by_id',
      (repository, fractionId: string) => repository.getWasteFractionById(fractionId)
    );
  }
  get saveWasteFraction() {
    return this.context.createLoader(
      'save_waste_fraction',
      (repository, input: Parameters<WasteRepository['upsertWasteFraction']>[0]) =>
        repository.upsertWasteFraction(input)
    );
  }
  get deleteWasteFraction() {
    return this.context.createLoader('delete_waste_fraction', (repository, fractionId: string) =>
      repository.deleteWasteFraction(fractionId)
    );
  }
  get loadWasteRegionById() {
    return this.context.createLoader('load_waste_region_by_id', (repository, regionId: string) =>
      repository.getWasteRegionById(regionId)
    );
  }
  get saveWasteRegion() {
    return this.context.createLoader(
      'save_waste_region',
      (repository, input: Omit<WasteRegionRecord, 'createdAt' | 'updatedAt'>) =>
        repository.upsertWasteRegion(input)
    );
  }
  get loadWasteCityById() {
    return this.context.createLoader('load_waste_city_by_id', (repository, cityId: string) =>
      repository.getWasteCityById(cityId)
    );
  }
  get saveWasteCity() {
    return this.context.createLoader(
      'save_waste_city',
      (repository, input: Parameters<WasteRepository['upsertWasteCity']>[0]) =>
        repository.upsertWasteCity(input)
    );
  }
  get patchWasteCity() {
    return this.context.createLoader(
      'patch_waste_city',
      (repository, cityId: string, input: Parameters<WasteRepository['updateWasteCity']>[1]) =>
        repository.updateWasteCity(cityId, input)
    );
  }
  get loadWasteStreetById() {
    return this.context.createLoader('load_waste_street_by_id', (repository, streetId: string) =>
      repository.getWasteStreetById(streetId)
    );
  }
  get saveWasteStreet() {
    return this.context.createLoader(
      'save_waste_street',
      (repository, input: Omit<WasteStreetRecord, 'createdAt' | 'updatedAt'>) =>
        repository.upsertWasteStreet(input)
    );
  }
  get loadWasteHouseNumberById() {
    return this.context.createLoader(
      'load_waste_house_number_by_id',
      (repository, houseNumberId: string) => repository.getWasteHouseNumberById(houseNumberId)
    );
  }
  get saveWasteHouseNumber() {
    return this.context.createLoader(
      'save_waste_house_number',
      (repository, input: Omit<WasteHouseNumberRecord, 'createdAt' | 'updatedAt'>) =>
        repository.upsertWasteHouseNumber(input)
    );
  }
  get loadWasteCollectionLocationById() {
    return this.context.createLoader(
      'load_waste_collection_location_by_id',
      (repository, locationId: string) => repository.getWasteCollectionLocationById(locationId)
    );
  }
  get loadWasteCollectionLocationPage() {
    return this.context.createLoader(
      'load_waste_collection_location_page',
      (repository, query: Parameters<WasteRepository['listWasteCollectionLocationPage']>[0]) =>
        repository.listWasteCollectionLocationPage(query)
    );
  }
  get loadWasteCollectionLocationIds() {
    return this.context.createLoader(
      'load_waste_collection_location_ids',
      (repository, filter: Parameters<WasteRepository['listWasteCollectionLocationIds']>[0]) =>
        repository.listWasteCollectionLocationIds(filter)
    );
  }
  get saveWasteCollectionLocation() {
    return this.context.createLoader(
      'save_waste_collection_location',
      (repository, input: Omit<WasteCollectionLocationRecord, 'createdAt' | 'updatedAt'>) =>
        repository.upsertWasteCollectionLocation(input)
    );
  }
  get deleteWasteCollectionLocation() {
    return this.context.createLoader(
      'delete_waste_collection_location',
      (repository, locationId: string) => repository.deleteWasteCollectionLocation(locationId)
    );
  }
}
