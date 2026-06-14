import { createWasteMasterDataCityStreetMutations } from './waste-management.master-data.city-street-mutations.js';
import { createWasteMasterDataFractionRegionMutations } from './waste-management.master-data.fraction-region-mutations.js';
import { createWasteMasterDataHouseNumberMutations } from './waste-management.master-data.house-number-mutations.js';
import type { WasteMasterDataSubmissionContext } from './waste-management.master-data.submission.types.js';

export const createWasteMasterDataEntityMutations = (context: WasteMasterDataSubmissionContext) => ({
  ...createWasteMasterDataFractionRegionMutations(context),
  ...createWasteMasterDataCityStreetMutations(context),
  ...createWasteMasterDataHouseNumberMutations(context),
});
