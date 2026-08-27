import type { WasteMainserverSyncStatusRecord } from '@sva/core';

export type WasteMainserverSyncStatusHandlerDeps = {
  readonly loadWasteMainserverSyncStatus?: (
    instanceId: string
  ) => Promise<WasteMainserverSyncStatusRecord>;
};
