import type { WasteMainserverSyncStatusRecord } from '@sva/waste-management-contracts';

export type WasteMainserverSyncStatusHandlerDeps = {
  readonly loadWasteMainserverSyncStatus?: (
    instanceId: string
  ) => Promise<WasteMainserverSyncStatusRecord>;
};
