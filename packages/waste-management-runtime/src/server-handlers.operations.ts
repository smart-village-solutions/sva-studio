import type { WasteServerHandlerDeps } from './server-handler-deps.js';
export const createWasteOperationHandlers = (deps: WasteServerHandlerDeps) => {
  const {
    bindWasteAuditActor,
    previewWasteLocationTourPickupDateImport,
    previewWasteManagementLocationTourPickupDateImportInternal,
    startWasteManagementEnrichPostalCodesInternal,
    startWasteManagementExportInternal,
    startWasteManagementImportInternal,
    startWasteManagementInitializeInternal,
    startWasteManagementMainserverSyncInternal,
    startWasteManagementMigrationsInternal,
    startWasteManagementResetInternal,
    startWasteManagementSeedInternal,
    startWasteManagementSyncWasteTypesInternal,
    uploadWasteManagementImportSourceInternal,
    withAuthenticatedWasteManagementHandler,
  } = deps;
  return {
    startMigrations: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        startWasteManagementMigrationsInternal(nextRequest, ctx, bindWasteAuditActor(ctx))
      ),
    startInitialize: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        startWasteManagementInitializeInternal(nextRequest, ctx, bindWasteAuditActor(ctx))
      ),
    startImport: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        startWasteManagementImportInternal(nextRequest, ctx, bindWasteAuditActor(ctx))
      ),
    uploadImportSource: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        uploadWasteManagementImportSourceInternal(nextRequest, ctx, bindWasteAuditActor(ctx))
      ),
    startExport: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        startWasteManagementExportInternal(nextRequest, ctx, bindWasteAuditActor(ctx))
      ),
    previewLocationTourPickupDateImport: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        previewWasteManagementLocationTourPickupDateImportInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          previewWasteLocationTourPickupDateImport,
        })
      ),
    startSeed: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        startWasteManagementSeedInternal(nextRequest, ctx, bindWasteAuditActor(ctx))
      ),
    startMainserverSync: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        startWasteManagementMainserverSyncInternal(nextRequest, ctx, bindWasteAuditActor(ctx))
      ),
    startSyncWasteTypes: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        startWasteManagementSyncWasteTypesInternal(nextRequest, ctx, bindWasteAuditActor(ctx))
      ),
    startEnrichPostalCodes: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        startWasteManagementEnrichPostalCodesInternal(nextRequest, ctx, bindWasteAuditActor(ctx))
      ),
    startReset: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        startWasteManagementResetInternal(nextRequest, ctx, bindWasteAuditActor(ctx))
      ),
  };
};
