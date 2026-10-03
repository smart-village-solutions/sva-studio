import type { WasteServerHandlerDeps } from './server-handler-deps.js';
export const createWasteOverviewHandlers = (deps: WasteServerHandlerDeps) => {
  const {
    bindWasteAuditActor,
    getWasteManagementCollectionLocationIdsInternal,
    getWasteManagementCollectionLocationsInternal,
    getWasteManagementHistoryInternal,
    getWasteManagementMainserverSyncStatusInternal,
    getWasteManagementMasterDataOverviewInternal,
    getWasteManagementToursOverviewInternal,
    loadMasterDataFractionsOverview,
    loadMasterDataLocationsOverview,
    loadMasterDataOverview,
    loadMasterDataTargetingOverview,
    loadToursOverview,
    loadWasteCollectionLocationIds,
    loadWasteCollectionLocationPage,
    loadWasteHistoryOverview,
    loadWasteMainserverSyncStatus,
    withAuthenticatedWasteManagementHandler,
  } = deps;
  return {
    getMainserverSyncStatus: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        getWasteManagementMainserverSyncStatusInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          loadWasteMainserverSyncStatus,
        })
      ),
    getCollectionLocations: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        getWasteManagementCollectionLocationsInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          loadWasteCollectionLocationPage,
        })
      ),
    getCollectionLocationIds: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        getWasteManagementCollectionLocationIdsInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          loadWasteCollectionLocationIds,
        })
      ),
    getHistory: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        getWasteManagementHistoryInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          loadWasteHistoryOverview,
        })
      ),
    getMasterDataOverview: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        getWasteManagementMasterDataOverviewInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          loadMasterDataOverview,
          loadMasterDataFractionsOverview,
          loadMasterDataLocationsOverview,
          loadMasterDataTargetingOverview,
        })
      ),
    getToursOverview: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        getWasteManagementToursOverviewInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          loadToursOverview,
        })
      ),
  };
};
export const createWasteSettingsAndTransferHandlers = (deps: WasteServerHandlerDeps) => {
  const {
    bindWasteAuditActor,
    createWasteAnnualTourTransfer,
    createWasteAnnualTourTransferInternal,
    getWasteManagementSchedulingOverviewInternal,
    getWasteManagementSettingsInternal,
    loadSchedulingOverview,
    loadWasteCustomRecurrencePresets,
    loadWastePdfStaticSettings,
    previewWasteAnnualTourTransfer,
    previewWasteAnnualTourTransferInternal,
    retryWasteTenantProvisioningInternal,
    runWasteManagementHolidaySyncInternal,
    saveWasteCustomRecurrencePresets,
    saveWastePdfStaticSettings,
    syncWasteHolidayRules,
    updateWasteManagementSettingsInternal,
    withAuthenticatedWasteManagementHandler,
  } = deps;
  return {
    previewAnnualTourTransfer: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        previewWasteAnnualTourTransferInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          previewWasteAnnualTourTransfer,
        })
      ),
    createAnnualTourTransfer: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        createWasteAnnualTourTransferInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          createWasteAnnualTourTransfer,
        })
      ),
    getSchedulingOverview: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        getWasteManagementSchedulingOverviewInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          loadSchedulingOverview,
        })
      ),
    getSettings: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        getWasteManagementSettingsInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          loadWasteCustomRecurrencePresets,
          loadWastePdfStaticSettings,
        })
      ),
    updateSettings: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        updateWasteManagementSettingsInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          loadWasteCustomRecurrencePresets,
          loadWastePdfStaticSettings,
          saveWasteCustomRecurrencePresets,
          saveWastePdfStaticSettings,
          syncWasteHolidayRules,
        })
      ),
    runHolidaySync: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        runWasteManagementHolidaySyncInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          loadWasteCustomRecurrencePresets,
          loadWastePdfStaticSettings,
          saveWastePdfStaticSettings,
          syncWasteHolidayRules,
        })
      ),
    retryProvisioning: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        retryWasteTenantProvisioningInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
        })
      ),
  };
};
