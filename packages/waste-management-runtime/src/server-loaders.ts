import type { StudioJobRepository } from '@sva/data-repositories';
import type {
  listExternalInterfaceRecords,
  loadDefaultExternalInterfaceRecord,
} from '@sva/data-repositories/server';
import { createWasteLoaderContext } from './server-loaders.context.js';
import { WasteRecurrenceLoaders } from './server-loaders.recurrence.js';
import { WasteSyncLoaders } from './server-loaders.sync.js';
import { WasteMasterDataLoaders } from './server-loaders.masterdata.js';
import { WasteHistoryLoaders } from './server-loaders.history.js';
import { createScheduling } from './server-loaders.scheduling.js';
import { WasteHolidayLoaders } from './server-loaders.holiday.js';
import { createImportPreview } from './server-loaders.importpreview.js';
import { WasteEntitiesLocationLoaders } from './server-loaders.entitieslocation.js';
import { WasteEntitiesTourLoaders } from './server-loaders.entitiestour.js';
import { createEntitiesRules } from './server-loaders.entitiesrules.js';
import { WasteBulkLoaders } from './server-loaders.bulk.js';
import { createAnnual } from './server-loaders.annual.js';

type IamQueryClient = {
  query<TRow = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[]
  ): Promise<{ rowCount: number; rows: TRow[] }>;
};

export type WasteServerLoaderHost = Readonly<{
  listExternalInterfaceRecords: typeof listExternalInterfaceRecords;
  loadDefaultExternalInterfaceRecord: typeof loadDefaultExternalInterfaceRecord;
  withInstanceDb: <T>(
    instanceId: string,
    work: (client: IamQueryClient) => Promise<T>
  ) => Promise<T>;
  withStudioJobRepository: <T>(
    instanceId: string,
    work: (repository: StudioJobRepository) => Promise<T>
  ) => Promise<T>;
  revealField: (ciphertext: string | null | undefined, aad: string) => string | null | undefined;
  readPluginOperationInput: (input: {
    instanceId: string;
    blobRef: string;
  }) => Promise<{ body: Uint8Array }>;
}>;

export const createWasteServerLoaders = (host: WasteServerLoaderHost) => {
  const context = createWasteLoaderContext(host);
  const { resetWastePoolCache } = context;
  const { saveWasteCustomRecurrencePresets } = new WasteRecurrenceLoaders(context);
  const { loadWasteMainserverSyncStatus } = new WasteSyncLoaders(context, host);
  const {
    loadMasterDataOverview,
    loadMasterDataFractionsOverview,
    loadMasterDataLocationsOverview,
    loadMasterDataTargetingOverview,
  } = new WasteMasterDataLoaders(context);
  const { loadWasteHistoryOverview } = new WasteHistoryLoaders(host);
  const { loadToursOverview, loadSchedulingOverview } = createScheduling(context);
  const { syncWasteHolidayRules } = new WasteHolidayLoaders(context);
  const { previewWasteLocationTourPickupDateImport } = createImportPreview(context, host);
  const {
    loadWasteFractionById,
    saveWasteFraction,
    deleteWasteFraction,
    loadWasteRegionById,
    saveWasteRegion,
    loadWasteCityById,
    saveWasteCity,
    patchWasteCity,
    loadWasteStreetById,
    saveWasteStreet,
    loadWasteHouseNumberById,
    saveWasteHouseNumber,
    loadWasteCollectionLocationById,
    loadWasteCollectionLocationPage,
    loadWasteCollectionLocationIds,
    saveWasteCollectionLocation,
    deleteWasteCollectionLocation,
  } = new WasteEntitiesLocationLoaders(context);
  const {
    loadWasteLocationTourLinkById,
    listWasteLocationTourLinksByTourId,
    saveWasteLocationTourLink,
    deleteWasteLocationTourLink,
    loadWasteLocationTourPickupDateById,
    listWasteLocationTourPickupDates,
    saveWasteLocationTourPickupDate,
    deleteWasteLocationTourPickupDate,
    loadWasteTourAssignmentById,
    listWasteTourAssignments,
    saveWasteTourAssignment,
    deleteWasteTourAssignment,
    loadWasteCustomRecurrencePresets,
    loadWastePdfStaticSettings,
    loadWasteHolidayRuleById,
  } = new WasteEntitiesTourLoaders(context);
  const {
    loadWasteTourById,
    saveWasteTour,
    deleteWasteTour,
    loadWasteTourDateShiftById,
    listWasteTourDateShiftsByTourId,
    deleteWasteTourDateShift,
    saveWasteTourDateShift,
    createWasteTourDateShift,
    loadWasteGlobalDateShiftById,
    deleteWasteGlobalDateShift,
    saveWasteGlobalDateShift,
    saveWasteHolidayRule,
    deleteWasteHolidayRule,
    saveWastePdfStaticSettings,
  } = createEntitiesRules(context);
  const { saveWasteLocationTourLinksBulk, updateWasteTourValidityBulk, updateWasteTourStatusBulk } =
    new WasteBulkLoaders(context);
  const { previewWasteAnnualTourTransfer, createWasteAnnualTourTransfer } = createAnnual(context);

  const wasteManagementOverviewLoaders = {
    loadWasteMainserverSyncStatus,
    loadMasterDataOverview,
    loadMasterDataFractionsOverview,
    loadMasterDataLocationsOverview,
    loadMasterDataTargetingOverview,
    loadWasteHistoryOverview,
    loadToursOverview,
    loadSchedulingOverview,
    previewWasteLocationTourPickupDateImport,
    previewWasteAnnualTourTransfer,
  } as const;

  const wasteManagementEntityLoaders = {
    loadWasteCustomRecurrencePresets,
    loadWastePdfStaticSettings,
    loadWasteHolidayRuleById,
    loadWasteFractionById,
    loadWasteRegionById,
    loadWasteCityById,
    loadWasteStreetById,
    loadWasteHouseNumberById,
    loadWasteCollectionLocationById,
    loadWasteCollectionLocationPage,
    loadWasteCollectionLocationIds,
    loadWasteLocationTourLinkById,
    loadWasteLocationTourPickupDateById,
    loadWasteTourAssignmentById,
    listWasteLocationTourPickupDates,
    listWasteTourAssignments,
    listWasteLocationTourLinksByTourId,
    loadWasteTourById,
    loadWasteTourDateShiftById,
    listWasteTourDateShiftsByTourId,
    loadWasteGlobalDateShiftById,
  } as const;

  const wasteManagementEntitySavers = {
    saveWasteCustomRecurrencePresets,
    saveWastePdfStaticSettings,
    syncWasteHolidayRules,
    saveWasteHolidayRule,
    deleteWasteHolidayRule,
    saveWasteFraction,
    deleteWasteFraction,
    saveWasteRegion,
    saveWasteCity,
    patchWasteCity,
    saveWasteStreet,
    saveWasteHouseNumber,
    saveWasteCollectionLocation,
    deleteWasteCollectionLocation,
    saveWasteLocationTourLink,
    deleteWasteLocationTourLink,
    saveWasteLocationTourPickupDate,
    saveWasteTourAssignment,
    deleteWasteLocationTourPickupDate,
    deleteWasteTourAssignment,
    saveWasteLocationTourLinksBulk,
    saveWasteTour,
    createWasteAnnualTourTransfer,
    updateWasteTourValidityBulk,
    updateWasteTourStatusBulk,
    deleteWasteTour,
    deleteWasteTourDateShift,
    createWasteTourDateShift,
    saveWasteTourDateShift,
    deleteWasteGlobalDateShift,
    saveWasteGlobalDateShift,
  } as const;

  const wasteManagementServerLoaderInternals = {
    resetWastePoolCache,
  } as const;

  return {
    wasteManagementOverviewLoaders,
    wasteManagementEntityLoaders,
    wasteManagementEntitySavers,
    wasteManagementServerLoaderInternals,
  };
};

export type WasteServerLoaders = ReturnType<typeof createWasteServerLoaders>;
