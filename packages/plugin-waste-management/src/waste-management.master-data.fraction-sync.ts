import type { WasteFractionMutationResponse } from './waste-management.api.js';
import type { Translate } from './waste-management.master-data.submission.types.js';
import type { WasteMasterDataState } from './use-waste-master-data-state.js';

export type FractionRegionSubmissionHelperContext = {
  readonly state: WasteMasterDataState;
  readonly pt: Translate;
  readonly loadOverview: (active?: boolean) => Promise<void>;
  readonly loadCollectionLocationList: () => Promise<void>;
};

export const applyFractionSyncResult = <T>(
  ctx: FractionRegionSubmissionHelperContext,
  response: WasteFractionMutationResponse<T>
) => {
  if (response.syncStatus === 'queued' && response.syncJob) {
    ctx.state.setTrackedSyncWasteTypesJob(response.syncJob);
    return true;
  }

  ctx.state.setTrackedSyncWasteTypesJob(null);
  ctx.state.setMessage({
    kind: 'warning',
    text: ctx.pt('masterData.fractions.messages.syncWarning'),
    retryAction: 'sync-waste-types',
  });
  return false;
};
