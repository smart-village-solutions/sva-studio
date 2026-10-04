import type { WasteServerHandlerDeps } from './server-handler-deps.js';
export const createWasteCollectionLocationHandlers = (deps: WasteServerHandlerDeps) => {
  const {
    bindWasteAuditActor,
    createWasteManagementCollectionLocationInternal,
    createWasteManagementLocationTourLinkInternal,
    createWasteManagementLocationTourLinksBulkInternal,
    deleteWasteCollectionLocation,
    deleteWasteLocationTourLink,
    deleteWasteManagementCollectionLocationInternal,
    deleteWasteManagementLocationTourLinkInternal,
    loadWasteCollectionLocationById,
    loadWasteLocationTourLinkById,
    saveWasteCollectionLocation,
    saveWasteLocationTourLink,
    saveWasteLocationTourLinksBulk,
    updateWasteManagementCollectionLocationInternal,
    updateWasteManagementLocationTourLinkInternal,
    withAuthenticatedWasteManagementHandler,
  } = deps;
  return {
    createCollectionLocation: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        createWasteManagementCollectionLocationInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          saveWasteCollectionLocation,
          loadWasteCollectionLocationById,
        })
      ),
    deleteCollectionLocation: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        deleteWasteManagementCollectionLocationInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          deleteWasteCollectionLocation,
          loadWasteCollectionLocationById,
        })
      ),
    updateCollectionLocation: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        updateWasteManagementCollectionLocationInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          saveWasteCollectionLocation,
          loadWasteCollectionLocationById,
        })
      ),
    createLocationTourLink: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        createWasteManagementLocationTourLinkInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          saveWasteLocationTourLink,
          loadWasteLocationTourLinkById,
        })
      ),
    updateLocationTourLink: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        updateWasteManagementLocationTourLinkInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          saveWasteLocationTourLink,
          loadWasteLocationTourLinkById,
        })
      ),
    deleteLocationTourLink: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        deleteWasteManagementLocationTourLinkInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          deleteWasteLocationTourLink,
          loadWasteLocationTourLinkById,
        })
      ),
    createLocationTourLinksBulk: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        createWasteManagementLocationTourLinksBulkInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          saveWasteLocationTourLinksBulk,
        })
      ),
  };
};
export const createWastePickupDateHandlers = (deps: WasteServerHandlerDeps) => {
  const {
    bindWasteAuditActor,
    createWasteManagementLocationTourPickupDateInternal,
    deleteWasteLocationTourPickupDate,
    deleteWasteManagementLocationTourPickupDateInternal,
    listWasteLocationTourPickupDates,
    loadWasteLocationTourPickupDateById,
    saveWasteLocationTourPickupDate,
    updateWasteManagementLocationTourPickupDateInternal,
    withAuthenticatedWasteManagementHandler,
  } = deps;
  return {
    createLocationTourPickupDate: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        createWasteManagementLocationTourPickupDateInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          saveWasteLocationTourPickupDate,
          loadWasteLocationTourPickupDateById,
          listWasteLocationTourPickupDates,
        })
      ),
    updateLocationTourPickupDate: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        updateWasteManagementLocationTourPickupDateInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          saveWasteLocationTourPickupDate,
          loadWasteLocationTourPickupDateById,
          listWasteLocationTourPickupDates,
        })
      ),
    deleteLocationTourPickupDate: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        deleteWasteManagementLocationTourPickupDateInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          deleteWasteLocationTourPickupDate,
          loadWasteLocationTourPickupDateById,
        })
      ),
  };
};
