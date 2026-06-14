import {
  getWasteManagementMasterDataOverview,
  getWasteManagementSchedulingOverview,
} from './waste-management.api.js';
import type { WasteToursState } from './use-waste-tours-state.js';

export const loadWasteToursAssignmentOverview = async ({
  isMounted,
  setAssignmentContextLoading,
  setMasterDataOverview,
}: {
  readonly isMounted: () => boolean;
  readonly setAssignmentContextLoading: WasteToursState['setAssignmentContextLoading'];
  readonly setMasterDataOverview: WasteToursState['setMasterDataOverview'];
}) => {
  try {
    const masterDataResponse = await getWasteManagementMasterDataOverview({ scope: 'locations' });
    if (isMounted()) {
      setMasterDataOverview(masterDataResponse);
    }
  } catch {
    if (isMounted()) {
      setMasterDataOverview(null);
    }
  } finally {
    if (isMounted()) {
      setAssignmentContextLoading(false);
    }
  }
};

export const loadWasteToursSchedulingOverview = async ({
  isMounted,
  setSchedulingOverview,
}: {
  readonly isMounted: () => boolean;
  readonly setSchedulingOverview: WasteToursState['setSchedulingOverview'];
}) => {
  try {
    const schedulingResponse = await getWasteManagementSchedulingOverview();
    if (isMounted()) {
      setSchedulingOverview(schedulingResponse);
    }
  } catch {
    if (isMounted()) {
      setSchedulingOverview(null);
    }
  }
};
