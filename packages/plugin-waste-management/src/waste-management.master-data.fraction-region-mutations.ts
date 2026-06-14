import {
  createDeleteFractionHandler,
  createDeleteFractionsHandler,
  createSetFractionActiveHandler,
  createFractionMutationHandler,
  createSubmitRegionHandler,
} from './waste-management.master-data.fraction-region-mutations.helpers.js';
import type { WasteMasterDataSubmissionContext } from './waste-management.master-data.submission.types.js';

export const createWasteMasterDataFractionRegionMutations = ({
  state,
  pt,
  loadOverview,
}: WasteMasterDataSubmissionContext) => {
  const context = { state, pt, loadOverview };
  return {
    onSubmitFraction: createFractionMutationHandler(context),
    deleteFraction: createDeleteFractionHandler(context),
    deleteFractions: createDeleteFractionsHandler(context),
    setFractionActive: createSetFractionActiveHandler(context),
    onSubmitRegion: createSubmitRegionHandler(context),
  };
};
