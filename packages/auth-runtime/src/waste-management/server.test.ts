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
  createWasteManagementCollectionLocationInternal: vi.fn(async () => new Response('create-location')),
  createWasteManagementFractionInternal: vi.fn(async () => new Response('create-fraction')),
  deleteWasteManagementCollectionLocationInternal: vi.fn(async () => new Response('delete-location')),
  deleteWasteManagementFractionInternal: vi.fn(async () => new Response('delete-fraction')),
  deleteWasteManagementGlobalDateShiftInternal: vi.fn(async () => new Response('delete-global-shift')),
  createWasteManagementGlobalDateShiftInternal: vi.fn(async () => new Response('create-global-shift')),
  createWasteManagementHouseNumberInternal: vi.fn(async () => new Response('create-house-number')),
  createWasteManagementLocationTourLinkInternal: vi.fn(async () => new Response('create-location-tour-link')),
  createWasteManagementLocationTourLinksBulkInternal: vi.fn(async () => new Response('create-location-tour-links-bulk')),
  createWasteManagementRegionInternal: vi.fn(async () => new Response('create-region')),
  createWasteManagementStreetInternal: vi.fn(async () => new Response('create-street')),
  deleteWasteManagementLocationTourLinkInternal: vi.fn(async () => new Response('delete-location-tour-link')),
  deleteWasteManagementTourDateShiftInternal: vi.fn(async () => new Response('delete-tour-date-shift')),
  createWasteManagementTourDateShiftInternal: vi.fn(async () => new Response('create-tour-date-shift')),
  createWasteManagementTourInternal: vi.fn(async () => new Response('create-tour')),
  deleteWasteManagementTourInternal: vi.fn(async () => new Response('delete-tour')),
  getWasteManagementHistoryInternal: vi.fn(async () => new Response('get-history')),
  getWasteManagementMasterDataOverviewInternal: vi.fn(async () => new Response('get-master-data-overview')),
  getWasteManagementSchedulingOverviewInternal: vi.fn(async () => new Response('get-scheduling-overview')),
  getWasteManagementSettingsInternal: vi.fn(async () => new Response('get-settings')),
  getWasteManagementToursOverviewInternal: vi.fn(async () => new Response('get-tours-overview')),
  previewWasteManagementLocationTourPickupDateImportInternal: vi.fn(async () => new Response('preview-import')),
  startWasteManagementInitializeInternal: vi.fn(async () => new Response('start-initialize')),
  startWasteManagementImportInternal: vi.fn(async () => new Response('start-import')),
  startWasteManagementMigrationsInternal: vi.fn(async () => new Response('start-migrations')),
  startWasteManagementResetInternal: vi.fn(async () => new Response('start-reset')),
  startWasteManagementSeedInternal: vi.fn(async () => new Response('start-seed')),
  updateWasteManagementCityInternal: vi.fn(async () => new Response('update-city')),
  updateWasteManagementCollectionLocationInternal: vi.fn(async () => new Response('update-location')),
  updateWasteManagementFractionInternal: vi.fn(async () => new Response('update-fraction')),
  updateWasteManagementGlobalDateShiftInternal: vi.fn(async () => new Response('update-global-shift')),
  updateWasteManagementHouseNumberInternal: vi.fn(async () => new Response('update-house-number')),
  updateWasteManagementLocationTourLinkInternal: vi.fn(async () => new Response('update-location-tour-link')),
  updateWasteManagementRegionInternal: vi.fn(async () => new Response('update-region')),
  updateWasteManagementSettingsInternal: vi.fn(async () => new Response('update-settings')),
  updateWasteManagementStreetInternal: vi.fn(async () => new Response('update-street')),
  updateWasteManagementTourDateShiftInternal: vi.fn(async () => new Response('update-tour-date-shift')),
  updateWasteManagementTourInternal: vi.fn(async () => new Response('update-tour')),
}));

const loaderMocks = vi.hoisted(() => ({
  loadMasterDataOverview: vi.fn(async () => null),
  loadMasterDataFractionsOverview: vi.fn(async () => null),
  loadMasterDataLocationsOverview: vi.fn(async () => null),
  loadSchedulingOverview: vi.fn(async () => null),
  loadToursOverview: vi.fn(async () => null),
  loadWasteHistoryOverview: vi.fn(async () => null),
  loadWasteCityById: vi.fn(async () => null),
  loadWasteCollectionLocationById: vi.fn(async () => null),
  loadWasteFractionById: vi.fn(async () => null),
  loadWasteGlobalDateShiftById: vi.fn(async () => null),
  loadWasteHouseNumberById: vi.fn(async () => null),
  loadWasteLocationTourLinkById: vi.fn(async () => null),
  loadWasteRegionById: vi.fn(async () => null),
  loadWasteStreetById: vi.fn(async () => null),
  loadWasteTourById: vi.fn(async () => null),
  loadWasteTourDateShiftById: vi.fn(async () => null),
  previewWasteLocationTourPickupDateImport: vi.fn(async () => null),
}));

const saverMocks = vi.hoisted(() => ({
  saveWasteCity: vi.fn(async () => null),
  saveWasteCollectionLocation: vi.fn(async () => null),
  deleteWasteCollectionLocation: vi.fn(async () => null),
  saveWasteFraction: vi.fn(async () => null),
  deleteWasteFraction: vi.fn(async () => null),
  deleteWasteGlobalDateShift: vi.fn(async () => null),
  saveWasteGlobalDateShift: vi.fn(async () => null),
  saveWasteHouseNumber: vi.fn(async () => null),
  deleteWasteLocationTourLink: vi.fn(async () => null),
  saveWasteLocationTourLink: vi.fn(async () => null),
  saveWasteLocationTourLinksBulk: vi.fn(async () => []),
  saveWasteRegion: vi.fn(async () => null),
  saveWasteStreet: vi.fn(async () => null),
  saveWasteTour: vi.fn(async () => null),
  deleteWasteTour: vi.fn(async () => null),
  deleteWasteTourDateShift: vi.fn(async () => null),
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
  },
  wasteManagementEntityLoaders: {
    loadWasteCityById: loaderMocks.loadWasteCityById,
    loadWasteCollectionLocationById: loaderMocks.loadWasteCollectionLocationById,
    loadWasteFractionById: loaderMocks.loadWasteFractionById,
    loadWasteGlobalDateShiftById: loaderMocks.loadWasteGlobalDateShiftById,
    loadWasteHouseNumberById: loaderMocks.loadWasteHouseNumberById,
    loadWasteLocationTourLinkById: loaderMocks.loadWasteLocationTourLinkById,
    loadWasteRegionById: loaderMocks.loadWasteRegionById,
    loadWasteStreetById: loaderMocks.loadWasteStreetById,
    loadWasteTourById: loaderMocks.loadWasteTourById,
    loadWasteTourDateShiftById: loaderMocks.loadWasteTourDateShiftById,
  },
  wasteManagementEntitySavers: {
    saveWasteCity: saverMocks.saveWasteCity,
    saveWasteCollectionLocation: saverMocks.saveWasteCollectionLocation,
    deleteWasteCollectionLocation: saverMocks.deleteWasteCollectionLocation,
    saveWasteFraction: saverMocks.saveWasteFraction,
    deleteWasteFraction: saverMocks.deleteWasteFraction,
    deleteWasteGlobalDateShift: saverMocks.deleteWasteGlobalDateShift,
    saveWasteGlobalDateShift: saverMocks.saveWasteGlobalDateShift,
    saveWasteHouseNumber: saverMocks.saveWasteHouseNumber,
    deleteWasteLocationTourLink: saverMocks.deleteWasteLocationTourLink,
    saveWasteLocationTourLink: saverMocks.saveWasteLocationTourLink,
    saveWasteLocationTourLinksBulk: saverMocks.saveWasteLocationTourLinksBulk,
    saveWasteRegion: saverMocks.saveWasteRegion,
    saveWasteStreet: saverMocks.saveWasteStreet,
    saveWasteTour: saverMocks.saveWasteTour,
    deleteWasteTour: saverMocks.deleteWasteTour,
    deleteWasteTourDateShift: saverMocks.deleteWasteTourDateShift,
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
        handlerKey: 'getHistory',
        internal: coreHandlerMocks.getWasteManagementHistoryInternal,
        deps: { ...sharedWasteManagementDepsMock, loadWasteHistoryOverview: loaderMocks.loadWasteHistoryOverview },
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
        deps: { ...sharedWasteManagementDepsMock, loadToursOverview: loaderMocks.loadToursOverview },
      },
      {
        handlerKey: 'getSchedulingOverview',
        internal: coreHandlerMocks.getWasteManagementSchedulingOverviewInternal,
        deps: { ...sharedWasteManagementDepsMock, loadSchedulingOverview: loaderMocks.loadSchedulingOverview },
      },
      {
        handlerKey: 'getSettings',
        internal: coreHandlerMocks.getWasteManagementSettingsInternal,
        deps: sharedWasteManagementDepsMock,
      },
      {
        handlerKey: 'updateSettings',
        internal: coreHandlerMocks.updateWasteManagementSettingsInternal,
        deps: sharedWasteManagementDepsMock,
      },
      {
        handlerKey: 'createFraction',
        internal: coreHandlerMocks.createWasteManagementFractionInternal,
        deps: {
          ...sharedWasteManagementDepsMock,
          saveWasteFraction: saverMocks.saveWasteFraction,
          loadWasteFractionById: loaderMocks.loadWasteFractionById,
        },
      },
      {
        handlerKey: 'updateFraction',
        internal: coreHandlerMocks.updateWasteManagementFractionInternal,
        deps: {
          ...sharedWasteManagementDepsMock,
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
          saveWasteCity: saverMocks.saveWasteCity,
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
        },
      },
      {
        handlerKey: 'deleteTour',
        internal: coreHandlerMocks.deleteWasteManagementTourInternal,
        deps: {
          ...sharedWasteManagementDepsMock,
          deleteWasteTour: saverMocks.deleteWasteTour,
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
        handlerKey: 'createTourDateShift',
        internal: coreHandlerMocks.createWasteManagementTourDateShiftInternal,
        deps: {
          ...sharedWasteManagementDepsMock,
          saveWasteTourDateShift: saverMocks.saveWasteTourDateShift,
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
          previewWasteLocationTourPickupDateImport: loaderMocks.previewWasteLocationTourPickupDateImport,
        },
      },
      {
        handlerKey: 'startSeed',
        internal: coreHandlerMocks.startWasteManagementSeedInternal,
      },
      {
        handlerKey: 'startReset',
        internal: coreHandlerMocks.startWasteManagementResetInternal,
      },
    ] as const;

    for (const entry of cases) {
      const response = await wasteManagementHandlers[entry.handlerKey](request);

      expect(withAuthenticatedWasteManagementHandlerMock).toHaveBeenLastCalledWith(request, expect.any(Function));
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
