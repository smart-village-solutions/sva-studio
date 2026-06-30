import { wasteManagementCoreHandlers } from './core.js';
import { sharedWasteManagementDeps, withAuthenticatedWasteManagementHandler } from './server-context.js';
import {
  wasteManagementEntityLoaders,
  wasteManagementEntitySavers,
  wasteManagementOverviewLoaders,
} from './server-loaders.js';

const {
  createWasteManagementCityInternal,
  createWasteManagementCollectionLocationInternal,
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
  createWasteManagementTourInternal,
  deleteWasteManagementTourInternal,
  getWasteManagementHistoryInternal,
  getWasteManagementMasterDataOverviewInternal,
  getWasteManagementSchedulingOverviewInternal,
  getWasteManagementSettingsInternal,
  getWasteManagementToursOverviewInternal,
  runWasteManagementHolidaySyncInternal,
  startWasteManagementInitializeInternal,
  startWasteManagementImportInternal,
  previewWasteManagementLocationTourPickupDateImportInternal,
  startWasteManagementMigrationsInternal,
  startWasteManagementMainserverSyncInternal,
  startWasteManagementResetInternal,
  startWasteManagementSeedInternal,
  startWasteManagementSyncWasteTypesInternal,
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
} = wasteManagementCoreHandlers;

const {
  loadMasterDataOverview,
  loadMasterDataFractionsOverview,
  loadMasterDataLocationsOverview,
  loadSchedulingOverview,
  loadToursOverview,
  loadWasteHistoryOverview,
  previewWasteLocationTourPickupDateImport,
} = wasteManagementOverviewLoaders;
const {
  loadWasteCustomRecurrencePresets,
  loadWastePdfStaticSettings,
  loadWasteCityById,
  loadWasteCollectionLocationById,
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
  loadWasteTourDateShiftById,
  listWasteTourDateShiftsByTourId,
} = wasteManagementEntityLoaders;
const {
  saveWasteCustomRecurrencePresets,
  saveWastePdfStaticSettings,
  syncWasteHolidayRules,
  saveWasteCity,
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
  deleteWasteTour,
  deleteWasteTourDateShift,
  saveWasteTourDateShift,
} = wasteManagementEntitySavers;

export const wasteManagementHandlers = {
  getHistory: (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      getWasteManagementHistoryInternal(nextRequest, ctx, {
        ...sharedWasteManagementDeps,
        loadWasteHistoryOverview,
      })
    ),
  getMasterDataOverview: (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      getWasteManagementMasterDataOverviewInternal(nextRequest, ctx, {
        ...sharedWasteManagementDeps,
        loadMasterDataOverview,
        loadMasterDataFractionsOverview,
        loadMasterDataLocationsOverview,
      })
    ),
  getToursOverview: (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      getWasteManagementToursOverviewInternal(nextRequest, ctx, {
        ...sharedWasteManagementDeps,
        loadToursOverview,
      })
    ),
  getSchedulingOverview: (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      getWasteManagementSchedulingOverviewInternal(nextRequest, ctx, {
        ...sharedWasteManagementDeps,
        loadSchedulingOverview,
      })
    ),
  getSettings: (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      getWasteManagementSettingsInternal(nextRequest, ctx, {
        ...sharedWasteManagementDeps,
        loadWasteCustomRecurrencePresets,
        loadWastePdfStaticSettings,
      })
    ),
  updateSettings: (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      updateWasteManagementSettingsInternal(nextRequest, ctx, {
        ...sharedWasteManagementDeps,
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
        ...sharedWasteManagementDeps,
        loadWasteCustomRecurrencePresets,
        loadWastePdfStaticSettings,
        syncWasteHolidayRules,
      })
    ),
  createFraction: (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      createWasteManagementFractionInternal(nextRequest, ctx, {
        ...sharedWasteManagementDeps,
        loadMasterDataFractionsOverview,
        saveWasteFraction,
        loadWasteFractionById,
      })
    ),
  deleteFraction: (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      deleteWasteManagementFractionInternal(nextRequest, ctx, {
        ...sharedWasteManagementDeps,
        deleteWasteFraction,
        loadWasteFractionById,
      })
    ),
  updateFraction: (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      updateWasteManagementFractionInternal(nextRequest, ctx, {
        ...sharedWasteManagementDeps,
        loadMasterDataFractionsOverview,
        saveWasteFraction,
        loadWasteFractionById,
      })
    ),
  createRegion: (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      createWasteManagementRegionInternal(nextRequest, ctx, {
        ...sharedWasteManagementDeps,
        saveWasteRegion,
        loadWasteRegionById,
      })
    ),
  updateRegion: (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      updateWasteManagementRegionInternal(nextRequest, ctx, {
        ...sharedWasteManagementDeps,
        saveWasteRegion,
        loadWasteRegionById,
      })
    ),
  createCity: (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      createWasteManagementCityInternal(nextRequest, ctx, {
        ...sharedWasteManagementDeps,
        saveWasteCity,
        loadWasteCityById,
      })
    ),
  updateCity: (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      updateWasteManagementCityInternal(nextRequest, ctx, {
        ...sharedWasteManagementDeps,
        saveWasteCity,
        loadWasteCityById,
      })
    ),
  createStreet: (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      createWasteManagementStreetInternal(nextRequest, ctx, {
        ...sharedWasteManagementDeps,
        saveWasteStreet,
        loadWasteStreetById,
      })
    ),
  updateStreet: (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      updateWasteManagementStreetInternal(nextRequest, ctx, {
        ...sharedWasteManagementDeps,
        saveWasteStreet,
        loadWasteStreetById,
      })
    ),
  createHouseNumber: (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      createWasteManagementHouseNumberInternal(nextRequest, ctx, {
        ...sharedWasteManagementDeps,
        saveWasteHouseNumber,
        loadWasteHouseNumberById,
      })
    ),
  updateHouseNumber: (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      updateWasteManagementHouseNumberInternal(nextRequest, ctx, {
        ...sharedWasteManagementDeps,
        saveWasteHouseNumber,
        loadWasteHouseNumberById,
      })
    ),
  createCollectionLocation: (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      createWasteManagementCollectionLocationInternal(nextRequest, ctx, {
        ...sharedWasteManagementDeps,
        saveWasteCollectionLocation,
        loadWasteCollectionLocationById,
      })
    ),
  deleteCollectionLocation: (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      deleteWasteManagementCollectionLocationInternal(nextRequest, ctx, {
        ...sharedWasteManagementDeps,
        deleteWasteCollectionLocation,
        loadWasteCollectionLocationById,
      })
    ),
  updateCollectionLocation: (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      updateWasteManagementCollectionLocationInternal(nextRequest, ctx, {
        ...sharedWasteManagementDeps,
        saveWasteCollectionLocation,
        loadWasteCollectionLocationById,
      })
    ),
  createLocationTourLink: (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      createWasteManagementLocationTourLinkInternal(nextRequest, ctx, {
        ...sharedWasteManagementDeps,
        saveWasteLocationTourLink,
        loadWasteLocationTourLinkById,
      })
    ),
  updateLocationTourLink: (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      updateWasteManagementLocationTourLinkInternal(nextRequest, ctx, {
        ...sharedWasteManagementDeps,
        saveWasteLocationTourLink,
        loadWasteLocationTourLinkById,
      })
    ),
  deleteLocationTourLink: (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      deleteWasteManagementLocationTourLinkInternal(nextRequest, ctx, {
        ...sharedWasteManagementDeps,
        deleteWasteLocationTourLink,
        loadWasteLocationTourLinkById,
      })
    ),
  createLocationTourLinksBulk: (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      createWasteManagementLocationTourLinksBulkInternal(nextRequest, ctx, {
        ...sharedWasteManagementDeps,
        saveWasteLocationTourLinksBulk,
      })
    ),
  createLocationTourPickupDate: (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      createWasteManagementLocationTourPickupDateInternal(nextRequest, ctx, {
        ...sharedWasteManagementDeps,
        saveWasteLocationTourPickupDate,
        loadWasteLocationTourPickupDateById,
        listWasteLocationTourPickupDates,
      })
    ),
  updateLocationTourPickupDate: (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      updateWasteManagementLocationTourPickupDateInternal(nextRequest, ctx, {
        ...sharedWasteManagementDeps,
        saveWasteLocationTourPickupDate,
        loadWasteLocationTourPickupDateById,
        listWasteLocationTourPickupDates,
      })
    ),
  deleteLocationTourPickupDate: (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      deleteWasteManagementLocationTourPickupDateInternal(nextRequest, ctx, {
        ...sharedWasteManagementDeps,
        deleteWasteLocationTourPickupDate,
        loadWasteLocationTourPickupDateById,
      })
    ),
  createTour: (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      createWasteManagementTourInternal(nextRequest, ctx, {
        ...sharedWasteManagementDeps,
        saveWasteTour,
        loadWasteTourById,
        listWasteLocationTourLinksByTourId,
        saveWasteLocationTourLink,
        listWasteTourDateShiftsByTourId,
        saveWasteTourDateShift,
        deleteWasteTour,
      })
    ),
  updateTour: (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      updateWasteManagementTourInternal(nextRequest, ctx, {
        ...sharedWasteManagementDeps,
        saveWasteTour,
        loadWasteTourById,
      })
    ),
  deleteTour: (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      deleteWasteManagementTourInternal(nextRequest, ctx, {
        ...sharedWasteManagementDeps,
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
        ...sharedWasteManagementDeps,
        saveWasteTourDateShift,
        loadWasteTourDateShiftById,
      })
    ),
  deleteTourDateShift: (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      deleteWasteManagementTourDateShiftInternal(nextRequest, ctx, {
        ...sharedWasteManagementDeps,
        deleteWasteTourDateShift,
        loadWasteTourDateShiftById,
      })
    ),
  updateTourDateShift: (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      updateWasteManagementTourDateShiftInternal(nextRequest, ctx, {
        ...sharedWasteManagementDeps,
        saveWasteTourDateShift,
        loadWasteTourDateShiftById,
      })
    ),
  createGlobalDateShift: (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      createWasteManagementGlobalDateShiftInternal(nextRequest, ctx, {
        ...sharedWasteManagementDeps,
        saveWasteGlobalDateShift,
        loadWasteGlobalDateShiftById,
      })
    ),
  deleteGlobalDateShift: (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      deleteWasteManagementGlobalDateShiftInternal(nextRequest, ctx, {
        ...sharedWasteManagementDeps,
        deleteWasteGlobalDateShift,
        loadWasteGlobalDateShiftById,
      })
    ),
  updateGlobalDateShift: (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      updateWasteManagementGlobalDateShiftInternal(nextRequest, ctx, {
        ...sharedWasteManagementDeps,
        saveWasteGlobalDateShift,
        loadWasteGlobalDateShiftById,
      })
    ),
  deleteHolidayRule: (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      deleteWasteManagementHolidayRuleInternal(nextRequest, ctx, {
        ...sharedWasteManagementDeps,
        deleteWasteHolidayRule,
        loadWasteHolidayRuleById,
      })
    ),
  updateHolidayRule: (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      updateWasteManagementHolidayRuleInternal(nextRequest, ctx, {
        ...sharedWasteManagementDeps,
        saveWasteHolidayRule,
        loadWasteHolidayRuleById,
      })
    ),
  startMigrations: (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      startWasteManagementMigrationsInternal(nextRequest, ctx)
    ),
  startInitialize: (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      startWasteManagementInitializeInternal(nextRequest, ctx)
    ),
  startImport: (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      startWasteManagementImportInternal(nextRequest, ctx)
    ),
  previewLocationTourPickupDateImport: (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      previewWasteManagementLocationTourPickupDateImportInternal(nextRequest, ctx, {
        ...sharedWasteManagementDeps,
        previewWasteLocationTourPickupDateImport,
      })
    ),
  startSeed: (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      startWasteManagementSeedInternal(nextRequest, ctx)
    ),
  startMainserverSync: (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      startWasteManagementMainserverSyncInternal(nextRequest, ctx)
    ),
  startSyncWasteTypes: (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      startWasteManagementSyncWasteTypesInternal(nextRequest, ctx)
    ),
  startReset: (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      startWasteManagementResetInternal(nextRequest, ctx)
    ),
};
