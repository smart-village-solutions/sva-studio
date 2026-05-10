import { createWasteMasterDataCityStreetSubmissions } from './waste-management.master-data.city-street-submissions.js';
import { createWasteMasterDataFractionRegionSubmissions } from './waste-management.master-data.fraction-region-submissions.js';
import { createWasteMasterDataHouseNumberSubmissions } from './waste-management.master-data.house-number-submissions.js';
import type { WasteMasterDataSubmissionContext } from './waste-management.master-data.submission.types.js';

export const createWasteMasterDataEntitySubmissions = ({
}: WasteMasterDataSubmissionContext) => ({
  ...createWasteMasterDataFractionRegionSubmissions({ state, pt, search, loadOverview }),
  ...createWasteMasterDataCityStreetSubmissions({ state, pt, search, loadOverview }),
  ...createWasteMasterDataHouseNumberSubmissions({ state, pt, search, loadOverview }),
});
