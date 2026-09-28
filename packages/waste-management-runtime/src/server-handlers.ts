import { wasteManagementCoreHandlers } from './handlers.js';
import type {
  AuthenticatedRequestContext,
  WasteAuditEvent,
  WasteManagementHandlerDeps,
} from './handlers/types.js';
import type { WasteServerLoaders } from './server-loaders.js';

export const createWasteManagementHandlers = (input: {
  readonly host: WasteManagementHandlerDeps & {
    readonly emitAuditEvent: (
      event: WasteAuditEvent & {
        actorUserId?: string;
        actorEmail?: string;
        actorDisplayName?: string;
      }
    ) => Promise<void>;
  };
  readonly withAuthenticatedHandler: (
    request: Request,
    handler: (request: Request, ctx: AuthenticatedRequestContext) => Promise<Response>
  ) => Promise<Response>;
  readonly loaders: WasteServerLoaders;
}) => {
  const sharedWasteManagementDeps = input.host;
  const withAuthenticatedWasteManagementHandler = input.withAuthenticatedHandler;
  const {
    wasteManagementOverviewLoaders,
    wasteManagementEntityLoaders,
    wasteManagementEntitySavers,
  } = input.loaders;

  const bindWasteAuditActor = (ctx: AuthenticatedRequestContext) => ({
    ...sharedWasteManagementDeps,
    emitAuditEvent: (event: Parameters<typeof sharedWasteManagementDeps.emitAuditEvent>[0]) =>
      sharedWasteManagementDeps.emitAuditEvent({
        ...event,
        actorUserId: ctx.user.id,
        actorEmail: ctx.user.email,
        actorDisplayName: ctx.user.displayName,
      }),
  });

  const {
    createWasteManagementCityInternal,
    createWasteManagementCollectionLocationInternal,
    getWasteManagementCollectionLocationsInternal,
    getWasteManagementCollectionLocationIdsInternal,
    createWasteManagementFractionInternal,
    deleteWasteManagementCollectionLocationInternal,
    deleteWasteManagementFractionInternal,
    deleteWasteManagementGlobalDateShiftInternal,
    deleteWasteManagementHolidayRuleInternal,
    createWasteManagementGlobalDateShiftInternal,
    updateWasteManagementHolidayRuleInternal,
    createWasteManagementHouseNumberInternal,
    createWasteManagementLocationTourLinkInternal,
    createWasteManagementLocationTourPickupDateInternal,
    createWasteManagementLocationTourLinksBulkInternal,
    createWasteManagementRegionInternal,
    createWasteManagementStreetInternal,
    deleteWasteManagementLocationTourLinkInternal,
    deleteWasteManagementLocationTourPickupDateInternal,
    deleteWasteManagementTourDateShiftInternal,
    createWasteManagementTourDateShiftInternal,
    createWasteManagementTourAssignmentInternal,
    createWasteManagementTourInternal,
    previewWasteAnnualTourTransferInternal,
    createWasteAnnualTourTransferInternal,
    deleteWasteManagementTourInternal,
    deleteWasteManagementTourAssignmentInternal,
    getWasteManagementHistoryInternal,
    getWasteManagementMainserverSyncStatusInternal,
    getWasteManagementMasterDataOverviewInternal,
    getWasteManagementSchedulingOverviewInternal,
    getWasteManagementSettingsInternal,
    getWasteManagementToursOverviewInternal,
    runWasteManagementHolidaySyncInternal,
    retryWasteTenantProvisioningInternal,
    startWasteManagementInitializeInternal,
    startWasteManagementImportInternal,
    uploadWasteManagementImportSourceInternal,
    startWasteManagementExportInternal,
    previewWasteManagementLocationTourPickupDateImportInternal,
    startWasteManagementMigrationsInternal,
    startWasteManagementMainserverSyncInternal,
    startWasteManagementResetInternal,
    startWasteManagementSeedInternal,
    startWasteManagementSyncWasteTypesInternal,
    startWasteManagementEnrichPostalCodesInternal,
    updateWasteManagementCityInternal,
    updateWasteManagementCollectionLocationInternal,
    updateWasteManagementFractionInternal,
    updateWasteManagementGlobalDateShiftInternal,
    updateWasteManagementHouseNumberInternal,
    updateWasteManagementLocationTourLinkInternal,
    updateWasteManagementLocationTourPickupDateInternal,
    updateWasteManagementRegionInternal,
    updateWasteManagementSettingsInternal,
    updateWasteManagementStreetInternal,
    updateWasteManagementTourDateShiftInternal,
    updateWasteManagementTourInternal,
    updateWasteManagementTourValidityBulkInternal,
    updateWasteManagementTourStatusBulkInternal,
    updateWasteManagementTourAssignmentInternal,
  } = wasteManagementCoreHandlers;

  const {
    loadWasteMainserverSyncStatus,
    loadMasterDataOverview,
    loadMasterDataFractionsOverview,
    loadMasterDataLocationsOverview,
    loadMasterDataTargetingOverview,
    loadSchedulingOverview,
    loadToursOverview,
    loadWasteHistoryOverview,
    previewWasteLocationTourPickupDateImport,
    previewWasteAnnualTourTransfer,
  } = wasteManagementOverviewLoaders;
  const {
    loadWasteCustomRecurrencePresets,
    loadWastePdfStaticSettings,
    loadWasteCityById,
    loadWasteCollectionLocationById,
    loadWasteCollectionLocationPage,
    loadWasteCollectionLocationIds,
    loadWasteFractionById,
    loadWasteGlobalDateShiftById,
    loadWasteHolidayRuleById,
    loadWasteHouseNumberById,
    loadWasteLocationTourLinkById,
    loadWasteLocationTourPickupDateById,
    listWasteLocationTourPickupDates,
    listWasteLocationTourLinksByTourId,
    loadWasteRegionById,
    loadWasteStreetById,
    loadWasteTourById,
    loadWasteTourAssignmentById,
    loadWasteTourDateShiftById,
    listWasteTourAssignments,
    listWasteTourDateShiftsByTourId,
  } = wasteManagementEntityLoaders;
  const {
    saveWasteCustomRecurrencePresets,
    saveWastePdfStaticSettings,
    syncWasteHolidayRules,
    saveWasteCity,
    patchWasteCity,
    saveWasteCollectionLocation,
    deleteWasteCollectionLocation,
    saveWasteFraction,
    deleteWasteFraction,
    deleteWasteGlobalDateShift,
    deleteWasteHolidayRule,
    saveWasteGlobalDateShift,
    saveWasteHolidayRule,
    saveWasteHouseNumber,
    deleteWasteLocationTourLink,
    deleteWasteLocationTourPickupDate,
    saveWasteLocationTourLink,
    saveWasteLocationTourPickupDate,
    saveWasteLocationTourLinksBulk,
    saveWasteRegion,
    saveWasteStreet,
    saveWasteTour,
    createWasteAnnualTourTransfer,
    updateWasteTourValidityBulk,
    updateWasteTourStatusBulk,
    saveWasteTourAssignment,
    deleteWasteTour,
    deleteWasteTourAssignment,
    deleteWasteTourDateShift,
    createWasteTourDateShift,
    saveWasteTourDateShift,
  } = wasteManagementEntitySavers;

  const wasteManagementHandlers = {
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
    createTourAssignment: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        createWasteManagementTourAssignmentInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          saveWasteTourAssignment,
          loadWasteTourAssignmentById,
        })
      ),
    updateTourAssignment: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        updateWasteManagementTourAssignmentInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          saveWasteTourAssignment,
          loadWasteTourAssignmentById,
        })
      ),
    deleteTourAssignment: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        deleteWasteManagementTourAssignmentInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          deleteWasteTourAssignment,
          loadWasteTourAssignmentById,
        })
      ),
    createTour: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        createWasteManagementTourInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          saveWasteTour,
          loadWasteTourById,
          listWasteLocationTourLinksByTourId,
          saveWasteLocationTourLink,
          listWasteLocationTourPickupDates,
          saveWasteLocationTourPickupDate,
          listWasteTourAssignments,
          saveWasteTourAssignment,
          listWasteTourDateShiftsByTourId,
          saveWasteTourDateShift,
          deleteWasteTour,
        })
      ),
    updateTour: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        updateWasteManagementTourInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          saveWasteTour,
          loadWasteTourById,
        })
      ),
    updateTourValidityBulk: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        updateWasteManagementTourValidityBulkInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          updateWasteTourValidityBulk,
        })
      ),
    updateTourStatusBulk: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        updateWasteManagementTourStatusBulkInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          updateWasteTourStatusBulk,
        })
      ),
    deleteTour: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        deleteWasteManagementTourInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          deleteWasteTour,
          listWasteLocationTourLinksByTourId,
          deleteWasteLocationTourLink,
          listWasteLocationTourPickupDates,
          deleteWasteLocationTourPickupDate,
          listWasteTourDateShiftsByTourId,
          deleteWasteTourDateShift,
          loadWasteTourById,
        })
      ),
    createTourDateShift: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        createWasteManagementTourDateShiftInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          createWasteTourDateShift,
          loadWasteTourDateShiftById,
        })
      ),
    deleteTourDateShift: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        deleteWasteManagementTourDateShiftInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          deleteWasteTourDateShift,
          loadWasteTourDateShiftById,
        })
      ),
    updateTourDateShift: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        updateWasteManagementTourDateShiftInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          saveWasteTourDateShift,
          loadWasteTourDateShiftById,
        })
      ),
    createGlobalDateShift: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        createWasteManagementGlobalDateShiftInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          saveWasteGlobalDateShift,
          loadWasteGlobalDateShiftById,
        })
      ),
    deleteGlobalDateShift: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        deleteWasteManagementGlobalDateShiftInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          deleteWasteGlobalDateShift,
          loadWasteGlobalDateShiftById,
        })
      ),
    updateGlobalDateShift: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        updateWasteManagementGlobalDateShiftInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          saveWasteGlobalDateShift,
          loadWasteGlobalDateShiftById,
        })
      ),
    deleteHolidayRule: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        deleteWasteManagementHolidayRuleInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          deleteWasteHolidayRule,
          loadWasteHolidayRuleById,
        })
      ),
    updateHolidayRule: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        updateWasteManagementHolidayRuleInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          saveWasteHolidayRule,
          loadWasteHolidayRuleById,
        })
      ),
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

  return wasteManagementHandlers;
};
