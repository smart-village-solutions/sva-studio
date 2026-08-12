import type { WasteManagementMasterDataOverview } from '@sva/plugin-sdk';

import type { WasteManagementHandlerDeps } from './types.js';
import { requireDeps } from './utils.js';

export type MasterDataScope = 'fractions' | 'locations' | 'targeting' | 'all';

export const resolveMasterDataScope = (request: Request): MasterDataScope => {
  const scope = new URL(request.url).searchParams.get('scope')?.trim();
  if (scope === 'fractions' || scope === 'locations' || scope === 'targeting') {
    return scope;
  }
  return 'all';
};

export const resolveMasterDataOverview = (
  scope: MasterDataScope,
  deps: WasteManagementHandlerDeps,
  instanceId: string
): Promise<WasteManagementMasterDataOverview> => {
  if (scope === 'fractions') {
    return requireDeps(
      deps.loadMasterDataFractionsOverview,
      'loadMasterDataFractionsOverview'
    )(instanceId);
  }
  if (scope === 'locations') {
    return requireDeps(
      deps.loadMasterDataLocationsOverview,
      'loadMasterDataLocationsOverview'
    )(instanceId);
  }
  if (scope === 'targeting') {
    return requireDeps(
      deps.loadMasterDataTargetingOverview,
      'loadMasterDataTargetingOverview'
    )(instanceId);
  }
  return requireDeps(deps.loadMasterDataOverview, 'loadMasterDataOverview')(instanceId);
};

export const buildMasterDataLogFields = (
  scope: MasterDataScope,
  overview: WasteManagementMasterDataOverview
) => ({
  master_data_scope: scope,
  fractions_count: overview.fractions.length,
  regions_count: overview.regions.length,
  cities_count: overview.cities.length,
  streets_count: overview.streets.length,
  house_numbers_count: overview.houseNumbers.length,
  collection_locations_count: overview.collectionLocations.length,
  location_tour_links_count: overview.locationTourLinks.length,
});
