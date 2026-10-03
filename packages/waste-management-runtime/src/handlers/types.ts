import type { WasteAnnualTourTransferHandlerDeps } from './annual-tour-transfer-deps.js';
import type { WasteCollectionLocationReadHandlerDeps } from './collection-location-read-deps.js';
import type { WasteMainserverSyncStatusHandlerDeps } from './mainserver-sync-status-deps.js';
import type { WasteManagementHandlerHostDeps } from './types.host.js';
import type { WasteManagementHandlerMasterDataDeps } from './types.master-data.js';

export type { AuthenticatedRequestContext, WasteAuditEvent } from './types.host.js';
export type WasteManagementHandlerDeps = WasteManagementHandlerHostDeps &
  WasteManagementHandlerMasterDataDeps &
  WasteAnnualTourTransferHandlerDeps &
  WasteCollectionLocationReadHandlerDeps &
  WasteMainserverSyncStatusHandlerDeps;
