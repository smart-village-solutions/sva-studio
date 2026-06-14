import { createWasteMasterDataCityMutations } from './waste-management.master-data.city-mutations.js';
import { createWasteMasterDataStreetMutations } from './waste-management.master-data.street-mutations.js';
import type { WasteMasterDataSubmissionContext } from './waste-management.master-data.submission.types.js';

export const createWasteMasterDataCityStreetMutations = (context: WasteMasterDataSubmissionContext) => ({
  ...createWasteMasterDataCityMutations(context),
  ...createWasteMasterDataStreetMutations(context),
});
