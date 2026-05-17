import {
  createDeleteFractionHandler,
  createDeleteFractionsHandler,
  createSetFractionActiveHandler,
  createSubmitFractionHandler,
  createSubmitRegionHandler,
} from './waste-management.master-data.fraction-region-submissions.helpers.js';
import type { WasteMasterDataSubmissionContext } from './waste-management.master-data.submission.types.js';

export const createWasteMasterDataFractionRegionSubmissions = ({
  state,
  pt,
  loadOverview,
}: WasteMasterDataSubmissionContext) => {
  const context = { state, pt, loadOverview };
  return {
    onSubmitFraction: createSubmitFractionHandler(context),
    deleteFraction: createDeleteFractionHandler(context),
    deleteFractions: createDeleteFractionsHandler(context),
    setFractionActive: createSetFractionActiveHandler(context),
    onSubmitRegion: createSubmitRegionHandler(context),
  };
};
