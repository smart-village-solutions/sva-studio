import type {
  WasteTourStatusBulkUpdateInput,
  WasteTourStatusBulkUpdateResult,
} from '@sva/waste-management-contracts';

export type WasteTourStatusBulkHandlerDeps = {
  readonly updateWasteTourStatusBulk?: (
    instanceId: string,
    input: WasteTourStatusBulkUpdateInput
  ) => Promise<WasteTourStatusBulkUpdateResult>;
};
