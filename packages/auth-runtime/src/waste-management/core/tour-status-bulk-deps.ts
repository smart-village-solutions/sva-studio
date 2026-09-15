import type { WasteTourStatusBulkUpdateInput, WasteTourStatusBulkUpdateResult } from '@sva/core';

export type WasteTourStatusBulkHandlerDeps = {
  readonly updateWasteTourStatusBulk?: (
    instanceId: string,
    input: WasteTourStatusBulkUpdateInput
  ) => Promise<WasteTourStatusBulkUpdateResult>;
};
