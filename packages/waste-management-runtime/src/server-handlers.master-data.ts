import type { WasteServerHandlerDeps } from './server-handler-deps.js';
export const createWasteFractionAndRegionHandlers = (deps: WasteServerHandlerDeps) => {
  const {
    bindWasteAuditActor,
    createWasteManagementFractionInternal,
    createWasteManagementRegionInternal,
    deleteWasteFraction,
    deleteWasteManagementFractionInternal,
    loadMasterDataFractionsOverview,
    loadWasteFractionById,
    loadWasteRegionById,
    saveWasteFraction,
    saveWasteRegion,
    updateWasteManagementFractionInternal,
    updateWasteManagementRegionInternal,
    withAuthenticatedWasteManagementHandler,
  } = deps;
  return {
    createFraction: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        createWasteManagementFractionInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          loadMasterDataFractionsOverview,
          saveWasteFraction,
          loadWasteFractionById,
        })
      ),
    deleteFraction: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        deleteWasteManagementFractionInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          deleteWasteFraction,
          loadWasteFractionById,
        })
      ),
    updateFraction: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        updateWasteManagementFractionInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          loadMasterDataFractionsOverview,
          saveWasteFraction,
          loadWasteFractionById,
        })
      ),
    createRegion: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        createWasteManagementRegionInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          saveWasteRegion,
          loadWasteRegionById,
        })
      ),
    updateRegion: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        updateWasteManagementRegionInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          saveWasteRegion,
          loadWasteRegionById,
        })
      ),
  };
};
export const createWasteAddressHandlers = (deps: WasteServerHandlerDeps) => {
  const {
    bindWasteAuditActor,
    createWasteManagementCityInternal,
    createWasteManagementHouseNumberInternal,
    createWasteManagementStreetInternal,
    loadWasteCityById,
    loadWasteHouseNumberById,
    loadWasteStreetById,
    patchWasteCity,
    saveWasteCity,
    saveWasteHouseNumber,
    saveWasteStreet,
    updateWasteManagementCityInternal,
    updateWasteManagementHouseNumberInternal,
    updateWasteManagementStreetInternal,
    withAuthenticatedWasteManagementHandler,
  } = deps;
  return {
    createCity: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        createWasteManagementCityInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          saveWasteCity,
          loadWasteCityById,
        })
      ),
    updateCity: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        updateWasteManagementCityInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          patchWasteCity,
          loadWasteCityById,
        })
      ),
    createStreet: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        createWasteManagementStreetInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          saveWasteStreet,
          loadWasteStreetById,
        })
      ),
    updateStreet: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        updateWasteManagementStreetInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          saveWasteStreet,
          loadWasteStreetById,
        })
      ),
    createHouseNumber: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        createWasteManagementHouseNumberInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          saveWasteHouseNumber,
          loadWasteHouseNumberById,
        })
      ),
    updateHouseNumber: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        updateWasteManagementHouseNumberInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          saveWasteHouseNumber,
          loadWasteHouseNumberById,
        })
      ),
  };
};
