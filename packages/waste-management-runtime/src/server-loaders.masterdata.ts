import type { WasteManagementMasterDataOverview } from '@sva/waste-management-contracts';
import type { WasteLoaderContext } from './server-loaders.context.js';

export class WasteMasterDataLoaders {
  constructor(private readonly context: WasteLoaderContext) {}

  loadMasterDataOverview = (instanceId: string): Promise<WasteManagementMasterDataOverview> =>
    this.context.withWasteRepository(instanceId, 'load_master_data_overview', async (repository) =>
      this.context.measureWasteStep(
        'load_master_data_overview',
        'query_overview',
        { instance_id: instanceId },
        async () => {
          const fractions = await this.context.measureWasteRepositoryStep(
            instanceId,
            'load_master_data_overview',
            'list_waste_fractions',
            () => repository.listWasteFractions()
          );
          const regions = await this.context.measureWasteRepositoryStep(
            instanceId,
            'load_master_data_overview',
            'list_waste_regions',
            () => repository.listWasteRegions()
          );
          const cities = await this.context.measureWasteRepositoryStep(
            instanceId,
            'load_master_data_overview',
            'list_waste_cities',
            () => repository.listWasteCities()
          );
          const streets = await this.context.measureWasteRepositoryStep(
            instanceId,
            'load_master_data_overview',
            'list_waste_streets',
            () => repository.listWasteStreets()
          );
          const houseNumbers = await this.context.measureWasteRepositoryStep(
            instanceId,
            'load_master_data_overview',
            'list_waste_house_numbers',
            () => repository.listWasteHouseNumbers()
          );
          const collectionLocations = await this.context.measureWasteRepositoryStep(
            instanceId,
            'load_master_data_overview',
            'list_waste_collection_locations',
            () => repository.listWasteCollectionLocations()
          );
          const locationTourLinks = await this.context.measureWasteRepositoryStep(
            instanceId,
            'load_master_data_overview',
            'list_waste_location_tour_links',
            () => repository.listWasteLocationTourLinks()
          );
          return {
            fractions,
            regions,
            cities,
            streets,
            houseNumbers,
            collectionLocations,
            locationTourLinks,
          };
        }
      )
    );

  loadMasterDataFractionsOverview = (
    instanceId: string
  ): Promise<WasteManagementMasterDataOverview> =>
    this.context.withWasteRepository(
      instanceId,
      'load_master_data_fractions_overview',
      async (repository) =>
        this.context.measureWasteStep(
          'load_master_data_fractions_overview',
          'query_overview',
          { instance_id: instanceId },
          async () => ({
            fractions: await this.context.measureWasteRepositoryStep(
              instanceId,
              'load_master_data_fractions_overview',
              'list_waste_fractions',
              () => repository.listWasteFractions()
            ),
            regions: [],
            cities: [],
            streets: [],
            houseNumbers: [],
            collectionLocations: [],
            locationTourLinks: [],
          })
        )
    );

  loadMasterDataLocationHierarchyOverview = (
    instanceId: string,
    operation: 'load_master_data_locations_overview' | 'load_master_data_targeting_overview',
    includeLocationTourLinks: boolean
  ): Promise<WasteManagementMasterDataOverview> =>
    this.context.withWasteRepository(instanceId, operation, async (repository) =>
      this.context.measureWasteStep(
        operation,
        'query_overview',
        { instance_id: instanceId },
        async () => {
          const [regions, cities, streets, houseNumbers, collectionLocations, locationTourLinks] =
            await Promise.all([
              this.context.measureWasteRepositoryStep(
                instanceId,
                operation,
                'list_waste_regions',
                () => repository.listWasteRegions()
              ),
              this.context.measureWasteRepositoryStep(
                instanceId,
                operation,
                'list_waste_cities',
                () => repository.listWasteCities()
              ),
              this.context.measureWasteRepositoryStep(
                instanceId,
                operation,
                'list_waste_streets',
                () => repository.listWasteStreets()
              ),
              this.context.measureWasteRepositoryStep(
                instanceId,
                operation,
                'list_waste_house_numbers',
                () => repository.listWasteHouseNumbers()
              ),
              this.context.measureWasteRepositoryStep(
                instanceId,
                operation,
                'list_waste_collection_locations',
                () => repository.listWasteCollectionLocations()
              ),
              includeLocationTourLinks
                ? this.context.measureWasteRepositoryStep(
                    instanceId,
                    operation,
                    'list_waste_location_tour_links',
                    () => repository.listWasteLocationTourLinks()
                  )
                : Promise.resolve([]),
            ]);

          return {
            fractions: [],
            regions,
            cities,
            streets,
            houseNumbers,
            collectionLocations,
            locationTourLinks,
          };
        }
      )
    );

  loadMasterDataLocationsOverview = (
    instanceId: string
  ): Promise<WasteManagementMasterDataOverview> =>
    this.loadMasterDataLocationHierarchyOverview(
      instanceId,
      'load_master_data_locations_overview',
      true
    );

  loadMasterDataTargetingOverview = (
    instanceId: string
  ): Promise<WasteManagementMasterDataOverview> =>
    this.loadMasterDataLocationHierarchyOverview(
      instanceId,
      'load_master_data_targeting_overview',
      false
    );
}
