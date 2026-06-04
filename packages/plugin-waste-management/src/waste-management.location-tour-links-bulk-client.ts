import type { CreateWasteManagementLocationTourLinksBulkInput } from './waste-management.api.js';
import { createWasteManagementLocationTourLinksBulk } from './waste-management.api.js';

const maxBulkLocationTourLinksPerRequest = 100;

export const submitWasteLocationTourLinksBulkInChunks = async (
  input: CreateWasteManagementLocationTourLinksBulkInput,
  submitBulk: typeof createWasteManagementLocationTourLinksBulk = createWasteManagementLocationTourLinksBulk
): Promise<void> => {
  for (let index = 0; index < input.locationIds.length; index += maxBulkLocationTourLinksPerRequest) {
    await submitBulk({
      ...input,
      locationIds: input.locationIds.slice(index, index + maxBulkLocationTourLinksPerRequest),
    });
  }
};
