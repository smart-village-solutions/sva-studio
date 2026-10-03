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

  loadWasteFractionById = this.context.createLoader(
    'load_waste_fraction_by_id',
    (repository, fractionId: string) => repository.getWasteFractionById(fractionId)
  );
  saveWasteFraction = this.context.createLoader(
    'save_waste_fraction',
    (repository, input: Parameters<WasteRepository['upsertWasteFraction']>[0]) =>
      repository.upsertWasteFraction(input)
  );
  deleteWasteFraction = this.context.createLoader(
    'delete_waste_fraction',
    (repository, fractionId: string) => repository.deleteWasteFraction(fractionId)
  );
  loadWasteRegionById = this.context.createLoader(
    'load_waste_region_by_id',
    (repository, regionId: string) => repository.getWasteRegionById(regionId)
  );
  saveWasteRegion = this.context.createLoader(
    'save_waste_region',
    (repository, input: Omit<WasteRegionRecord, 'createdAt' | 'updatedAt'>) =>
      repository.upsertWasteRegion(input)
  );
  loadWasteCityById = this.context.createLoader(
    'load_waste_city_by_id',
    (repository, cityId: string) => repository.getWasteCityById(cityId)
  );
  saveWasteCity = this.context.createLoader(
    'save_waste_city',
    (repository, input: Parameters<WasteRepository['upsertWasteCity']>[0]) =>
      repository.upsertWasteCity(input)
  );
  patchWasteCity = this.context.createLoader(
    'patch_waste_city',
    (repository, cityId: string, input: Parameters<WasteRepository['updateWasteCity']>[1]) =>
      repository.updateWasteCity(cityId, input)
  );
  loadWasteStreetById = this.context.createLoader(
    'load_waste_street_by_id',
    (repository, streetId: string) => repository.getWasteStreetById(streetId)
  );
  saveWasteStreet = this.context.createLoader(
    'save_waste_street',
    (repository, input: Omit<WasteStreetRecord, 'createdAt' | 'updatedAt'>) =>
      repository.upsertWasteStreet(input)
  );
  loadWasteHouseNumberById = this.context.createLoader(
    'load_waste_house_number_by_id',
    (repository, houseNumberId: string) => repository.getWasteHouseNumberById(houseNumberId)
  );
  saveWasteHouseNumber = this.context.createLoader(
    'save_waste_house_number',
    (repository, input: Omit<WasteHouseNumberRecord, 'createdAt' | 'updatedAt'>) =>
      repository.upsertWasteHouseNumber(input)
  );
  loadWasteCollectionLocationById = this.context.createLoader(
    'load_waste_collection_location_by_id',
    (repository, locationId: string) => repository.getWasteCollectionLocationById(locationId)
  );
  loadWasteCollectionLocationPage = this.context.createLoader(
    'load_waste_collection_location_page',
    (repository, query: Parameters<WasteRepository['listWasteCollectionLocationPage']>[0]) =>
      repository.listWasteCollectionLocationPage(query)
  );
  loadWasteCollectionLocationIds = this.context.createLoader(
    'load_waste_collection_location_ids',
    (repository, filter: Parameters<WasteRepository['listWasteCollectionLocationIds']>[0]) =>
      repository.listWasteCollectionLocationIds(filter)
  );
  saveWasteCollectionLocation = this.context.createLoader(
    'save_waste_collection_location',
    (repository, input: Omit<WasteCollectionLocationRecord, 'createdAt' | 'updatedAt'>) =>
      repository.upsertWasteCollectionLocation(input)
  );
  deleteWasteCollectionLocation = this.context.createLoader(
    'delete_waste_collection_location',
    (repository, locationId: string) => repository.deleteWasteCollectionLocation(locationId)
  );
}
