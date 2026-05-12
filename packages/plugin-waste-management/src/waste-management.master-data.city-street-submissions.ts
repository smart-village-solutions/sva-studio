import { createWasteMasterDataCitySubmissions } from './waste-management.master-data.city-submissions.js';
import { createWasteMasterDataStreetSubmissions } from './waste-management.master-data.street-submissions.js';
import type { WasteMasterDataSubmissionContext } from './waste-management.master-data.submission.types.js';

export const createWasteMasterDataCityStreetSubmissions = (context: WasteMasterDataSubmissionContext) => ({
  ...createWasteMasterDataCitySubmissions(context),
  ...createWasteMasterDataStreetSubmissions(context),
});
