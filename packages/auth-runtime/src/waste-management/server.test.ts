import { beforeEach, describe, expect, it, vi } from 'vitest';

const sharedWasteManagementDepsMock = vi.hoisted(() => ({
  dependencyMarker: 'shared-waste-management-deps',
}));

const requestContextMock = vi.hoisted(() => ({
  instanceId: 'instance-1',
}));

const withAuthenticatedWasteManagementHandlerMock = vi.hoisted(() =>
  vi.fn(
    async (
      request: Request,
      handler: (request: Request, ctx: typeof requestContextMock) => Promise<Response>
    ) => handler(request, requestContextMock)
  )
);

const coreHandlerMocks = vi.hoisted(() => ({
  createWasteManagementCityInternal: vi.fn(async () => new Response('create-city')),
  createWasteManagementCollectionLocationInternal: vi.fn(
    async () => new Response('create-location')
  ),
  createWasteManagementFractionInternal: vi.fn(async () => new Response('create-fraction')),
  deleteWasteManagementCollectionLocationInternal: vi.fn(
    async () => new Response('delete-location')
  ),
  deleteWasteManagementFractionInternal: vi.fn(async () => new Response('delete-fraction')),
  deleteWasteManagementGlobalDateShiftInternal: vi.fn(
    async () => new Response('delete-global-shift')
  ),
  deleteWasteManagementHolidayRuleInternal: vi.fn(async () => new Response('delete-holiday-rule')),
  createWasteManagementGlobalDateShiftInternal: vi.fn(
    async () => new Response('create-global-shift')
  ),
  updateWasteManagementHolidayRuleInternal: vi.fn(async () => new Response('update-holiday-rule')),
  createWasteManagementHouseNumberInternal: vi.fn(async () => new Response('create-house-number')),
  createWasteManagementLocationTourLinkInternal: vi.fn(
    async () => new Response('create-location-tour-link')
  ),
  createWasteManagementLocationTourLinksBulkInternal: vi.fn(
    async () => new Response('create-location-tour-links-bulk')
  ),
  createWasteManagementRegionInternal: vi.fn(async () => new Response('create-region')),
  createWasteManagementStreetInternal: vi.fn(async () => new Response('create-street')),
  deleteWasteManagementLocationTourLinkInternal: vi.fn(
    async () => new Response('delete-location-tour-link')
  ),
  deleteWasteManagementTourDateShiftInternal: vi.fn(
    async () => new Response('delete-tour-date-shift')
  ),
  createWasteManagementTourDateShiftInternal: vi.fn(
    async () => new Response('create-tour-date-shift')
  ),
  createWasteManagementTourInternal: vi.fn(async () => new Response('create-tour')),
  previewWasteAnnualTourTransferInternal: vi.fn(
    async () => new Response('preview-annual-transfer')
  ),
  createWasteAnnualTourTransferInternal: vi.fn(async () => new Response('create-annual-transfer')),
  createWasteManagementTourAssignmentInternal: vi.fn(
    async () => new Response('create-tour-assignment')
  ),
  deleteWasteManagementTourInternal: vi.fn(async () => new Response('delete-tour')),
  deleteWasteManagementTourAssignmentInternal: vi.fn(
    async () => new Response('delete-tour-assignment')
  ),
  getWasteManagementHistoryInternal: vi.fn(async () => new Response('get-history')),
  getWasteManagementCollectionLocationsInternal: vi.fn(
    async () => new Response('get-collection-locations')
  ),
  getWasteManagementCollectionLocationIdsInternal: vi.fn(
    async () => new Response('get-collection-location-ids')
  ),
  getWasteManagementMasterDataOverviewInternal: vi.fn(
    async () => new Response('get-master-data-overview')
  ),
  getWasteManagementSchedulingOverviewInternal: vi.fn(
    async () => new Response('get-scheduling-overview')
  ),
  getWasteManagementSettingsInternal: vi.fn(async () => new Response('get-settings')),
  getWasteManagementToursOverviewInternal: vi.fn(async () => new Response('get-tours-overview')),
  runWasteManagementHolidaySyncInternal: vi.fn(async () => new Response('run-holiday-sync')),
  previewWasteManagementLocationTourPickupDateImportInternal: vi.fn(
    async () => new Response('preview-import')
  ),
  startWasteManagementInitializeInternal: vi.fn(async () => new Response('start-initialize')),
  startWasteManagementImportInternal: vi.fn(async () => new Response('start-import')),
  startWasteManagementMigrationsInternal: vi.fn(async () => new Response('start-migrations')),
  startWasteManagementMainserverSyncInternal: vi.fn(
    async () => new Response('start-mainserver-sync')
  ),
  startWasteManagementResetInternal: vi.fn(async () => new Response('start-reset')),
  startWasteManagementSeedInternal: vi.fn(async () => new Response('start-seed')),
  startWasteManagementSyncWasteTypesInternal: vi.fn(
    async () => new Response('start-sync-waste-types')
  ),
  startWasteManagementEnrichPostalCodesInternal: vi.fn(
    async () => new Response('start-enrich-postal-codes')
  ),
  updateWasteManagementCityInternal: vi.fn(async () => new Response('update-city')),
  updateWasteManagementCollectionLocationInternal: vi.fn(
    async () => new Response('update-location')
  ),
  updateWasteManagementFractionInternal: vi.fn(async () => new Response('update-fraction')),
  updateWasteManagementGlobalDateShiftInternal: vi.fn(
    async () => new Response('update-global-shift')
  ),
  updateWasteManagementHouseNumberInternal: vi.fn(async () => new Response('update-house-number')),
  updateWasteManagementLocationTourLinkInternal: vi.fn(
    async () => new Response('update-location-tour-link')
  ),
  updateWasteManagementRegionInternal: vi.fn(async () => new Response('update-region')),
  updateWasteManagementSettingsInternal: vi.fn(async () => new Response('update-settings')),
  updateWasteManagementStreetInternal: vi.fn(async () => new Response('update-street')),
  updateWasteManagementTourDateShiftInternal: vi.fn(
    async () => new Response('update-tour-date-shift')
  ),
  updateWasteManagementTourInternal: vi.fn(async () => new Response('update-tour')),
  updateWasteManagementTourValidityBulkInternal: vi.fn(
    async () => new Response('update-tour-validity-bulk')
  ),
  updateWasteManagementTourAssignmentInternal: vi.fn(
    async () => new Response('update-tour-assignment')
  ),
}));

const loaderMocks = vi.hoisted(() => ({
  loadMasterDataOverview: vi.fn(async () => null),
  loadMasterDataFractionsOverview: vi.fn(async () => null),
  loadMasterDataLocationsOverview: vi.fn(async () => null),
  loadSchedulingOverview: vi.fn(async () => null),
  loadToursOverview: vi.fn(async () => null),
  loadWasteHistoryOverview: vi.fn(async () => null),
  loadWasteCustomRecurrencePresets: vi.fn(async () => []),
  loadWasteCityById: vi.fn(async () => null),
  loadWasteCollectionLocationById: vi.fn(async () => null),
  loadWasteCollectionLocationPage: vi.fn(async () => null),
  loadWasteCollectionLocationIds: vi.fn(async () => []),
  loadWasteFractionById: vi.fn(async () => null),
  loadWasteGlobalDateShiftById: vi.fn(async () => null),
  loadWasteHolidayRuleById: vi.fn(async () => null),
  loadWasteHouseNumberById: vi.fn(async () => null),
  loadWasteLocationTourLinkById: vi.fn(async () => null),
  loadWasteLocationTourPickupDateById: vi.fn(async () => null),
  listWasteLocationTourPickupDates: vi.fn(async () => []),
  listWasteLocationTourLinksByTourId: vi.fn(async () => []),
  loadWasteRegionById: vi.fn(async () => null),
  loadWasteStreetById: vi.fn(async () => null),
  loadWasteTourById: vi.fn(async () => null),
  loadWasteTourAssignmentById: vi.fn(async () => null),
  listWasteTourAssignments: vi.fn(async () => []),
  loadWasteTourDateShiftById: vi.fn(async () => null),
  listWasteTourDateShiftsByTourId: vi.fn(async () => []),
  previewWasteLocationTourPickupDateImport: vi.fn(async () => null),
  previewWasteAnnualTourTransfer: vi.fn(async () => null),
}));

const saverMocks = vi.hoisted(() => ({
  saveWasteCustomRecurrencePresets: vi.fn(async () => null),
  saveWastePdfStaticSettings: vi.fn(async () => null),
  syncWasteHolidayRules: vi.fn(async () => 'success'),
  saveWasteCity: vi.fn(async () => null),
  patchWasteCity: vi.fn(async () => null),
  saveWasteCollectionLocation: vi.fn(async () => null),
  deleteWasteCollectionLocation: vi.fn(async () => null),
  saveWasteFraction: vi.fn(async () => null),
  deleteWasteFraction: vi.fn(async () => null),
  deleteWasteGlobalDateShift: vi.fn(async () => null),
  saveWasteGlobalDateShift: vi.fn(async () => null),
  saveWasteHolidayRule: vi.fn(async () => null),
  deleteWasteHolidayRule: vi.fn(async () => null),
  saveWasteHouseNumber: vi.fn(async () => null),
  deleteWasteLocationTourLink: vi.fn(async () => null),
  deleteWasteLocationTourPickupDate: vi.fn(async () => null),
  saveWasteLocationTourLink: vi.fn(async () => null),
  saveWasteLocationTourPickupDate: vi.fn(async () => null),
  saveWasteLocationTourLinksBulk: vi.fn(async () => []),
  saveWasteRegion: vi.fn(async () => null),
  saveWasteStreet: vi.fn(async () => null),
  saveWasteTour: vi.fn(async () => null),
  createWasteAnnualTourTransfer: vi.fn(async () => null),
  updateWasteTourValidityBulk: vi.fn(async () => ({ updatedCount: 1 })),
  saveWasteTourAssignment: vi.fn(async () => null),
  deleteWasteTour: vi.fn(async () => null),
  deleteWasteTourAssignment: vi.fn(async () => null),
  deleteWasteTourDateShift: vi.fn(async () => null),
  createWasteTourDateShift: vi.fn(async () => null),
  saveWasteTourDateShift: vi.fn(async () => null),
}));

vi.mock('./server-context.js', () => ({
  sharedWasteManagementDeps: sharedWasteManagementDepsMock,
  withAuthenticatedWasteManagementHandler: withAuthenticatedWasteManagementHandlerMock,
}));

vi.mock('./core.js', () => ({
  wasteManagementCoreHandlers: coreHandlerMocks,
}));

vi.mock('./server-loaders.js', () => ({
  wasteManagementOverviewLoaders: {
    loadMasterDataOverview: loaderMocks.loadMasterDataOverview,
    loadMasterDataFractionsOverview: loaderMocks.loadMasterDataFractionsOverview,
    loadMasterDataLocationsOverview: loaderMocks.loadMasterDataLocationsOverview,
    loadSchedulingOverview: loaderMocks.loadSchedulingOverview,
    loadToursOverview: loaderMocks.loadToursOverview,
    loadWasteHistoryOverview: loaderMocks.loadWasteHistoryOverview,
    previewWasteLocationTourPickupDateImport: loaderMocks.previewWasteLocationTourPickupDateImport,
    previewWasteAnnualTourTransfer: loaderMocks.previewWasteAnnualTourTransfer,
  },
  wasteManagementEntityLoaders: {
    loadWasteCustomRecurrencePresets: loaderMocks.loadWasteCustomRecurrencePresets,
    loadWasteCityById: loaderMocks.loadWasteCityById,
    loadWasteCollectionLocationById: loaderMocks.loadWasteCollectionLocationById,
    loadWasteCollectionLocationPage: loaderMocks.loadWasteCollectionLocationPage,
    loadWasteCollectionLocationIds: loaderMocks.loadWasteCollectionLocationIds,
    loadWasteFractionById: loaderMocks.loadWasteFractionById,
    loadWasteGlobalDateShiftById: loaderMocks.loadWasteGlobalDateShiftById,
    loadWasteHolidayRuleById: loaderMocks.loadWasteHolidayRuleById,
    loadWasteHouseNumberById: loaderMocks.loadWasteHouseNumberById,
    loadWasteLocationTourLinkById: loaderMocks.loadWasteLocationTourLinkById,
    loadWasteLocationTourPickupDateById: loaderMocks.loadWasteLocationTourPickupDateById,
    listWasteLocationTourPickupDates: loaderMocks.listWasteLocationTourPickupDates,
    listWasteLocationTourLinksByTourId: loaderMocks.listWasteLocationTourLinksByTourId,
    loadWasteRegionById: loaderMocks.loadWasteRegionById,
    loadWasteStreetById: loaderMocks.loadWasteStreetById,
    loadWasteTourById: loaderMocks.loadWasteTourById,
    loadWasteTourAssignmentById: loaderMocks.loadWasteTourAssignmentById,
    listWasteTourAssignments: loaderMocks.listWasteTourAssignments,
    loadWasteTourDateShiftById: loaderMocks.loadWasteTourDateShiftById,
    listWasteTourDateShiftsByTourId: loaderMocks.listWasteTourDateShiftsByTourId,
  },
  wasteManagementEntitySavers: {
    saveWasteCustomRecurrencePresets: saverMocks.saveWasteCustomRecurrencePresets,
    saveWastePdfStaticSettings: saverMocks.saveWastePdfStaticSettings,
    syncWasteHolidayRules: saverMocks.syncWasteHolidayRules,
    saveWasteCity: saverMocks.saveWasteCity,
    patchWasteCity: saverMocks.patchWasteCity,
    saveWasteCollectionLocation: saverMocks.saveWasteCollectionLocation,
    deleteWasteCollectionLocation: saverMocks.deleteWasteCollectionLocation,
    saveWasteFraction: saverMocks.saveWasteFraction,
    deleteWasteFraction: saverMocks.deleteWasteFraction,
    deleteWasteGlobalDateShift: saverMocks.deleteWasteGlobalDateShift,
    saveWasteGlobalDateShift: saverMocks.saveWasteGlobalDateShift,
    saveWasteHolidayRule: saverMocks.saveWasteHolidayRule,
    deleteWasteHolidayRule: saverMocks.deleteWasteHolidayRule,
    saveWasteHouseNumber: saverMocks.saveWasteHouseNumber,
    deleteWasteLocationTourLink: saverMocks.deleteWasteLocationTourLink,
    deleteWasteLocationTourPickupDate: saverMocks.deleteWasteLocationTourPickupDate,
    saveWasteLocationTourLink: saverMocks.saveWasteLocationTourLink,
    saveWasteLocationTourPickupDate: saverMocks.saveWasteLocationTourPickupDate,
    saveWasteLocationTourLinksBulk: saverMocks.saveWasteLocationTourLinksBulk,
    saveWasteRegion: saverMocks.saveWasteRegion,
    saveWasteStreet: saverMocks.saveWasteStreet,
    saveWasteTour: saverMocks.saveWasteTour,
    createWasteAnnualTourTransfer: saverMocks.createWasteAnnualTourTransfer,
    updateWasteTourValidityBulk: saverMocks.updateWasteTourValidityBulk,
    saveWasteTourAssignment: saverMocks.saveWasteTourAssignment,
    deleteWasteTour: saverMocks.deleteWasteTour,
    deleteWasteTourAssignment: saverMocks.deleteWasteTourAssignment,
    deleteWasteTourDateShift: saverMocks.deleteWasteTourDateShift,
    createWasteTourDateShift: saverMocks.createWasteTourDateShift,
    saveWasteTourDateShift: saverMocks.saveWasteTourDateShift,
  },
}));

import { wasteManagementHandlers } from './server.js';

describe('wasteManagementHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('wires every handler to the authenticated wrapper and its delegated dependency set', async () => {
    const request = new Request('https://studio.test/api/v1/waste-management');
    const cases = [
      {
        handlerKey: 'getCollectionLocations',
        internal: coreHandlerMocks.getWasteManagementCollectionLocationsInternal,
        deps: {
          ...sharedWasteManagementDepsMock,
          loadWasteCollectionLocationPage: loaderMocks.loadWasteCollectionLocationPage,
        },
      },
      {
        handlerKey: 'getCollectionLocationIds',
        internal: coreHandlerMocks.getWasteManagementCollectionLocationIdsInternal,
        deps: {
          ...sharedWasteManagementDepsMock,
          loadWasteCollectionLocationIds: loaderMocks.loadWasteCollectionLocationIds,
        },
      },
      {
        handlerKey: 'getHistory',
        internal: coreHandlerMocks.getWasteManagementHistoryInternal,
        deps: {
          ...sharedWasteManagementDepsMock,
          loadWasteHistoryOverview: loaderMocks.loadWasteHistoryOverview,
        },
      },
      {
        handlerKey: 'getMasterDataOverview',
        internal: coreHandlerMocks.getWasteManagementMasterDataOverviewInternal,
        deps: {
          ...sharedWasteManagementDepsMock,
          loadMasterDataOverview: loaderMocks.loadMasterDataOverview,
          loadMasterDataFractionsOverview: loaderMocks.loadMasterDataFractionsOverview,
          loadMasterDataLocationsOverview: loaderMocks.loadMasterDataLocationsOverview,
        },
      },
      {
        handlerKey: 'getToursOverview',
        internal: coreHandlerMocks.getWasteManagementToursOverviewInternal,
        deps: {
          ...sharedWasteManagementDepsMock,
          loadToursOverview: loaderMocks.loadToursOverview,
        },
      },
      {
        handlerKey: 'getSchedulingOverview',
        internal: coreHandlerMocks.getWasteManagementSchedulingOverviewInternal,
        deps: {
          ...sharedWasteManagementDepsMock,
          loadSchedulingOverview: loaderMocks.loadSchedulingOverview,
        },
      },
      {
        handlerKey: 'previewAnnualTourTransfer',
        internal: coreHandlerMocks.previewWasteAnnualTourTransferInternal,
        deps: {
          ...sharedWasteManagementDepsMock,
          previewWasteAnnualTourTransfer: loaderMocks.previewWasteAnnualTourTransfer,
        },
      },
      {
        handlerKey: 'createAnnualTourTransfer',
        internal: coreHandlerMocks.createWasteAnnualTourTransferInternal,
        deps: {
          ...sharedWasteManagementDepsMock,
          createWasteAnnualTourTransfer: saverMocks.createWasteAnnualTourTransfer,
        },
      },
      {
        handlerKey: 'getSettings',
        internal: coreHandlerMocks.getWasteManagementSettingsInternal,
        deps: {
          ...sharedWasteManagementDepsMock,
          loadWasteCustomRecurrencePresets: loaderMocks.loadWasteCustomRecurrencePresets,
        },
      },
      {
        handlerKey: 'updateSettings',
        internal: coreHandlerMocks.updateWasteManagementSettingsInternal,
        deps: {
          ...sharedWasteManagementDepsMock,
          loadWasteCustomRecurrencePresets: loaderMocks.loadWasteCustomRecurrencePresets,
          loadWastePdfStaticSettings: loaderMocks.loadWastePdfStaticSettings,
          saveWastePdfStaticSettings: saverMocks.saveWastePdfStaticSettings,
          saveWasteCustomRecurrencePresets: saverMocks.saveWasteCustomRecurrencePresets,
          syncWasteHolidayRules: saverMocks.syncWasteHolidayRules,
        },
      },
      {
        handlerKey: 'runHolidaySync',
        internal: coreHandlerMocks.runWasteManagementHolidaySyncInternal,
        deps: {
          ...sharedWasteManagementDepsMock,
          loadWasteCustomRecurrencePresets: loaderMocks.loadWasteCustomRecurrencePresets,
          loadWastePdfStaticSettings: loaderMocks.loadWastePdfStaticSettings,
          saveWastePdfStaticSettings: saverMocks.saveWastePdfStaticSettings,
          syncWasteHolidayRules: saverMocks.syncWasteHolidayRules,
        },
      },
      {
        handlerKey: 'createFraction',
        internal: coreHandlerMocks.createWasteManagementFractionInternal,
        deps: {
          ...sharedWasteManagementDepsMock,
          loadMasterDataFractionsOverview: loaderMocks.loadMasterDataFractionsOverview,
          saveWasteFraction: saverMocks.saveWasteFraction,
          loadWasteFractionById: loaderMocks.loadWasteFractionById,
        },
      },
      {
        handlerKey: 'updateFraction',
        internal: coreHandlerMocks.updateWasteManagementFractionInternal,
        deps: {
          ...sharedWasteManagementDepsMock,
          loadMasterDataFractionsOverview: loaderMocks.loadMasterDataFractionsOverview,
          saveWasteFraction: saverMocks.saveWasteFraction,
          loadWasteFractionById: loaderMocks.loadWasteFractionById,
        },
      },
      {
        handlerKey: 'deleteFraction',
        internal: coreHandlerMocks.deleteWasteManagementFractionInternal,
        deps: {
          ...sharedWasteManagementDepsMock,
          deleteWasteFraction: saverMocks.deleteWasteFraction,
          loadWasteFractionById: loaderMocks.loadWasteFractionById,
        },
      },
      {
        handlerKey: 'createRegion',
        internal: coreHandlerMocks.createWasteManagementRegionInternal,
        deps: {
          ...sharedWasteManagementDepsMock,
          saveWasteRegion: saverMocks.saveWasteRegion,
          loadWasteRegionById: loaderMocks.loadWasteRegionById,
        },
      },
      {
        handlerKey: 'updateRegion',
        internal: coreHandlerMocks.updateWasteManagementRegionInternal,
        deps: {
          ...sharedWasteManagementDepsMock,
          saveWasteRegion: saverMocks.saveWasteRegion,
          loadWasteRegionById: loaderMocks.loadWasteRegionById,
        },
      },
      {
        handlerKey: 'createCity',
        internal: coreHandlerMocks.createWasteManagementCityInternal,
        deps: {
          ...sharedWasteManagementDepsMock,
          saveWasteCity: saverMocks.saveWasteCity,
          loadWasteCityById: loaderMocks.loadWasteCityById,
        },
      },
      {
        handlerKey: 'updateCity',
        internal: coreHandlerMocks.updateWasteManagementCityInternal,
        deps: {
          ...sharedWasteManagementDepsMock,
          patchWasteCity: saverMocks.patchWasteCity,
          loadWasteCityById: loaderMocks.loadWasteCityById,
        },
      },
      {
        handlerKey: 'createStreet',
        internal: coreHandlerMocks.createWasteManagementStreetInternal,
        deps: {
          ...sharedWasteManagementDepsMock,
          saveWasteStreet: saverMocks.saveWasteStreet,
          loadWasteStreetById: loaderMocks.loadWasteStreetById,
        },
      },
      {
        handlerKey: 'updateStreet',
        internal: coreHandlerMocks.updateWasteManagementStreetInternal,
        deps: {
          ...sharedWasteManagementDepsMock,
          saveWasteStreet: saverMocks.saveWasteStreet,
          loadWasteStreetById: loaderMocks.loadWasteStreetById,
        },
      },
      {
        handlerKey: 'createHouseNumber',
        internal: coreHandlerMocks.createWasteManagementHouseNumberInternal,
        deps: {
          ...sharedWasteManagementDepsMock,
          saveWasteHouseNumber: saverMocks.saveWasteHouseNumber,
          loadWasteHouseNumberById: loaderMocks.loadWasteHouseNumberById,
        },
      },
      {
        handlerKey: 'updateHouseNumber',
        internal: coreHandlerMocks.updateWasteManagementHouseNumberInternal,
        deps: {
          ...sharedWasteManagementDepsMock,
          saveWasteHouseNumber: saverMocks.saveWasteHouseNumber,
          loadWasteHouseNumberById: loaderMocks.loadWasteHouseNumberById,
        },
      },
      {
        handlerKey: 'createCollectionLocation',
        internal: coreHandlerMocks.createWasteManagementCollectionLocationInternal,
        deps: {
          ...sharedWasteManagementDepsMock,
          saveWasteCollectionLocation: saverMocks.saveWasteCollectionLocation,
          loadWasteCollectionLocationById: loaderMocks.loadWasteCollectionLocationById,
        },
      },
      {
        handlerKey: 'deleteCollectionLocation',
        internal: coreHandlerMocks.deleteWasteManagementCollectionLocationInternal,
        deps: {
          ...sharedWasteManagementDepsMock,
          deleteWasteCollectionLocation: saverMocks.deleteWasteCollectionLocation,
          loadWasteCollectionLocationById: loaderMocks.loadWasteCollectionLocationById,
        },
      },
      {
        handlerKey: 'updateCollectionLocation',
        internal: coreHandlerMocks.updateWasteManagementCollectionLocationInternal,
        deps: {
          ...sharedWasteManagementDepsMock,
          saveWasteCollectionLocation: saverMocks.saveWasteCollectionLocation,
          loadWasteCollectionLocationById: loaderMocks.loadWasteCollectionLocationById,
        },
      },
      {
        handlerKey: 'createLocationTourLink',
        internal: coreHandlerMocks.createWasteManagementLocationTourLinkInternal,
        deps: {
          ...sharedWasteManagementDepsMock,
          saveWasteLocationTourLink: saverMocks.saveWasteLocationTourLink,
          loadWasteLocationTourLinkById: loaderMocks.loadWasteLocationTourLinkById,
        },
      },
      {
        handlerKey: 'updateLocationTourLink',
        internal: coreHandlerMocks.updateWasteManagementLocationTourLinkInternal,
        deps: {
          ...sharedWasteManagementDepsMock,
          saveWasteLocationTourLink: saverMocks.saveWasteLocationTourLink,
          loadWasteLocationTourLinkById: loaderMocks.loadWasteLocationTourLinkById,
        },
      },
      {
        handlerKey: 'deleteLocationTourLink',
        internal: coreHandlerMocks.deleteWasteManagementLocationTourLinkInternal,
        deps: {
          ...sharedWasteManagementDepsMock,
          deleteWasteLocationTourLink: saverMocks.deleteWasteLocationTourLink,
          loadWasteLocationTourLinkById: loaderMocks.loadWasteLocationTourLinkById,
        },
      },
      {
        handlerKey: 'createLocationTourLinksBulk',
        internal: coreHandlerMocks.createWasteManagementLocationTourLinksBulkInternal,
        deps: {
          ...sharedWasteManagementDepsMock,
          saveWasteLocationTourLinksBulk: saverMocks.saveWasteLocationTourLinksBulk,
        },
      },
      {
        handlerKey: 'createTour',
        internal: coreHandlerMocks.createWasteManagementTourInternal,
        deps: {
          ...sharedWasteManagementDepsMock,
          saveWasteTour: saverMocks.saveWasteTour,
          loadWasteTourById: loaderMocks.loadWasteTourById,
          listWasteLocationTourLinksByTourId: loaderMocks.listWasteLocationTourLinksByTourId,
          saveWasteLocationTourLink: saverMocks.saveWasteLocationTourLink,
          listWasteLocationTourPickupDates: loaderMocks.listWasteLocationTourPickupDates,
          saveWasteLocationTourPickupDate: saverMocks.saveWasteLocationTourPickupDate,
          listWasteTourAssignments: loaderMocks.listWasteTourAssignments,
          saveWasteTourAssignment: saverMocks.saveWasteTourAssignment,
          listWasteTourDateShiftsByTourId: loaderMocks.listWasteTourDateShiftsByTourId,
          saveWasteTourDateShift: saverMocks.saveWasteTourDateShift,
          deleteWasteTour: saverMocks.deleteWasteTour,
        },
      },
      {
        handlerKey: 'deleteTour',
        internal: coreHandlerMocks.deleteWasteManagementTourInternal,
        deps: {
          ...sharedWasteManagementDepsMock,
          deleteWasteTour: saverMocks.deleteWasteTour,
          listWasteLocationTourLinksByTourId: loaderMocks.listWasteLocationTourLinksByTourId,
          deleteWasteLocationTourLink: saverMocks.deleteWasteLocationTourLink,
          listWasteLocationTourPickupDates: loaderMocks.listWasteLocationTourPickupDates,
          deleteWasteLocationTourPickupDate: saverMocks.deleteWasteLocationTourPickupDate,
          listWasteTourDateShiftsByTourId: loaderMocks.listWasteTourDateShiftsByTourId,
          deleteWasteTourDateShift: saverMocks.deleteWasteTourDateShift,
          loadWasteTourById: loaderMocks.loadWasteTourById,
        },
      },
      {
        handlerKey: 'updateTour',
        internal: coreHandlerMocks.updateWasteManagementTourInternal,
        deps: {
          ...sharedWasteManagementDepsMock,
          saveWasteTour: saverMocks.saveWasteTour,
          loadWasteTourById: loaderMocks.loadWasteTourById,
        },
      },
      {
        handlerKey: 'updateTourValidityBulk',
        internal: coreHandlerMocks.updateWasteManagementTourValidityBulkInternal,
        deps: {
          ...sharedWasteManagementDepsMock,
          updateWasteTourValidityBulk: saverMocks.updateWasteTourValidityBulk,
        },
      },
      {
        handlerKey: 'createTourAssignment',
        internal: coreHandlerMocks.createWasteManagementTourAssignmentInternal,
        deps: {
          ...sharedWasteManagementDepsMock,
          saveWasteTourAssignment: saverMocks.saveWasteTourAssignment,
          loadWasteTourAssignmentById: loaderMocks.loadWasteTourAssignmentById,
        },
      },
      {
        handlerKey: 'updateTourAssignment',
        internal: coreHandlerMocks.updateWasteManagementTourAssignmentInternal,
        deps: {
          ...sharedWasteManagementDepsMock,
          saveWasteTourAssignment: saverMocks.saveWasteTourAssignment,
          loadWasteTourAssignmentById: loaderMocks.loadWasteTourAssignmentById,
        },
      },
      {
        handlerKey: 'deleteTourAssignment',
        internal: coreHandlerMocks.deleteWasteManagementTourAssignmentInternal,
        deps: {
          ...sharedWasteManagementDepsMock,
          deleteWasteTourAssignment: saverMocks.deleteWasteTourAssignment,
          loadWasteTourAssignmentById: loaderMocks.loadWasteTourAssignmentById,
        },
      },
      {
        handlerKey: 'createTourDateShift',
        internal: coreHandlerMocks.createWasteManagementTourDateShiftInternal,
        deps: {
          ...sharedWasteManagementDepsMock,
          createWasteTourDateShift: saverMocks.createWasteTourDateShift,
          loadWasteTourDateShiftById: loaderMocks.loadWasteTourDateShiftById,
        },
      },
      {
        handlerKey: 'deleteTourDateShift',
        internal: coreHandlerMocks.deleteWasteManagementTourDateShiftInternal,
        deps: {
          ...sharedWasteManagementDepsMock,
          deleteWasteTourDateShift: saverMocks.deleteWasteTourDateShift,
          loadWasteTourDateShiftById: loaderMocks.loadWasteTourDateShiftById,
        },
      },
      {
        handlerKey: 'updateTourDateShift',
        internal: coreHandlerMocks.updateWasteManagementTourDateShiftInternal,
        deps: {
          ...sharedWasteManagementDepsMock,
          saveWasteTourDateShift: saverMocks.saveWasteTourDateShift,
          loadWasteTourDateShiftById: loaderMocks.loadWasteTourDateShiftById,
        },
      },
      {
        handlerKey: 'createGlobalDateShift',
        internal: coreHandlerMocks.createWasteManagementGlobalDateShiftInternal,
        deps: {
          ...sharedWasteManagementDepsMock,
          saveWasteGlobalDateShift: saverMocks.saveWasteGlobalDateShift,
          loadWasteGlobalDateShiftById: loaderMocks.loadWasteGlobalDateShiftById,
        },
      },
      {
        handlerKey: 'deleteGlobalDateShift',
        internal: coreHandlerMocks.deleteWasteManagementGlobalDateShiftInternal,
        deps: {
          ...sharedWasteManagementDepsMock,
          deleteWasteGlobalDateShift: saverMocks.deleteWasteGlobalDateShift,
          loadWasteGlobalDateShiftById: loaderMocks.loadWasteGlobalDateShiftById,
        },
      },
      {
        handlerKey: 'updateGlobalDateShift',
        internal: coreHandlerMocks.updateWasteManagementGlobalDateShiftInternal,
        deps: {
          ...sharedWasteManagementDepsMock,
          saveWasteGlobalDateShift: saverMocks.saveWasteGlobalDateShift,
          loadWasteGlobalDateShiftById: loaderMocks.loadWasteGlobalDateShiftById,
        },
      },
      {
        handlerKey: 'deleteHolidayRule',
        internal: coreHandlerMocks.deleteWasteManagementHolidayRuleInternal,
        deps: {
          ...sharedWasteManagementDepsMock,
          deleteWasteHolidayRule: saverMocks.deleteWasteHolidayRule,
          loadWasteHolidayRuleById: loaderMocks.loadWasteHolidayRuleById,
        },
      },
      {
        handlerKey: 'updateHolidayRule',
        internal: coreHandlerMocks.updateWasteManagementHolidayRuleInternal,
        deps: {
          ...sharedWasteManagementDepsMock,
          saveWasteHolidayRule: saverMocks.saveWasteHolidayRule,
          loadWasteHolidayRuleById: loaderMocks.loadWasteHolidayRuleById,
        },
      },
      {
        handlerKey: 'startInitialize',
        internal: coreHandlerMocks.startWasteManagementInitializeInternal,
      },
      {
        handlerKey: 'startMigrations',
        internal: coreHandlerMocks.startWasteManagementMigrationsInternal,
      },
      {
        handlerKey: 'startImport',
        internal: coreHandlerMocks.startWasteManagementImportInternal,
      },
      {
        handlerKey: 'previewLocationTourPickupDateImport',
        internal: coreHandlerMocks.previewWasteManagementLocationTourPickupDateImportInternal,
        deps: {
          ...sharedWasteManagementDepsMock,
          previewWasteLocationTourPickupDateImport:
            loaderMocks.previewWasteLocationTourPickupDateImport,
        },
      },
      {
        handlerKey: 'startSeed',
        internal: coreHandlerMocks.startWasteManagementSeedInternal,
      },
      {
        handlerKey: 'startMainserverSync',
        internal: coreHandlerMocks.startWasteManagementMainserverSyncInternal,
      },
      {
        handlerKey: 'startSyncWasteTypes',
        internal: coreHandlerMocks.startWasteManagementSyncWasteTypesInternal,
      },
      {
        handlerKey: 'startEnrichPostalCodes',
        internal: coreHandlerMocks.startWasteManagementEnrichPostalCodesInternal,
      },
      {
        handlerKey: 'startReset',
        internal: coreHandlerMocks.startWasteManagementResetInternal,
      },
    ] as const;

    for (const entry of cases) {
      const response = await wasteManagementHandlers[entry.handlerKey](request);

      expect(withAuthenticatedWasteManagementHandlerMock).toHaveBeenLastCalledWith(
        request,
        expect.any(Function)
      );
      expect(entry.internal).toHaveBeenCalledTimes(1);
      if ('deps' in entry) {
        expect(entry.internal).toHaveBeenCalledWith(request, requestContextMock, entry.deps);
      } else {
        expect(entry.internal).toHaveBeenCalledWith(request, requestContextMock);
      }
      expect(await response.text()).not.toHaveLength(0);
      vi.clearAllMocks();
    }
  });
});
