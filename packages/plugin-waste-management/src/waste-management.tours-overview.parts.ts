import { getWasteManagementSchedulingOverview } from './waste-management.api.js';
import type { WasteToursState } from './use-waste-tours-state.js';

export const loadWasteToursSchedulingOverview = async ({
  isMounted,
  setSchedulingOverview,
  setSchedulingLoadState,
}: {
  readonly isMounted: () => boolean;
  readonly setSchedulingOverview: WasteToursState['setSchedulingOverview'];
  readonly setSchedulingLoadState: WasteToursState['setSchedulingLoadState'];
}) => {
  try {
    const schedulingResponse = await getWasteManagementSchedulingOverview();
    if (isMounted()) {
      setSchedulingOverview(schedulingResponse);
      setSchedulingLoadState('ready');
    }
  } catch {
    if (isMounted()) {
      setSchedulingOverview(null);
      setSchedulingLoadState('error');
    }
  }
};
