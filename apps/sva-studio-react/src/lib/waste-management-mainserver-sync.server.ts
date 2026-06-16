import type {
  WasteCityRecord,
  WasteCollectionLocationRecord,
  WasteFractionRecord,
  WasteLocationTourLinkRecord,
  WasteStreetRecord,
  WasteTourRecord,
} from '@sva/core';
import {
  CREATE_WASTE_PICKUP_TIMES_BATCH_SIZE,
  createSvaMainserverWastePickupTimes,
  deleteSvaMainserverWastePickupTimes,
  listSvaMainserverWasteSyncSnapshot,
  type SvaMainserverWasteSyncItem,
} from '@sva/sva-mainserver/server';
import {
  buildMaterializedLocationTourPickupDates,
  buildStudioRowsFromMaterialization,
} from './waste-management-mainserver-sync.materialization.js';
import {
  getEffectiveYearWindow,
  parseIsoDateUtc,
  type WasteMaterializationContext,
} from './waste-management-mainserver-sync.materialization.shared.js';

import type { WasteOperationRuntimeDeps } from './waste-management-operations.types.js';
import { withWasteClient } from './waste-management-operations.shared.js';

type WasteManagementSyncMainserverJobInput = {
  readonly operation: 'sync-mainserver';
  readonly keycloakSubject?: string;
  readonly activeOrganizationId?: string;
};

type WasteMaterializationSyncState = Omit<WasteMaterializationContext, 'currentYear' | 'nextYear'> & {
  readonly cities: readonly WasteCityRecord[];
  readonly fractions: readonly WasteFractionRecord[];
  readonly locations: readonly WasteCollectionLocationRecord[];
  readonly locationTourPickupDates: NonNullable<WasteMaterializationContext['locationTourPickupDates']>;
  readonly streets: readonly WasteStreetRecord[];
  readonly tours: readonly WasteTourRecord[];
  readonly links: readonly WasteLocationTourLinkRecord[];
};

export type WasteSyncRow = SvaMainserverWasteSyncItem & Readonly<{
  key: string;
}>;

export type WasteManagementMainserverSyncResult = Readonly<{
  studioItemCount: number;
  mainserverItemCount: number;
  createCount: number;
  createBatchCount: number;
  deleteCount: number;
  deleteByIdCount: number;
  deleteByValueCount: number;
  errorCount: number;
  createItems: readonly SvaMainserverWasteSyncItem[];
  deleteItems: readonly SvaMainserverWasteSyncItem[];
}>;

const normalizeKeyPart = (value: string | undefined): string => (value ?? '').trim().toLocaleLowerCase('de-DE');

export const buildWasteSyncKey = (item: {
  pickupDate: string;
  wasteType: string;
  street: string;
  city?: string;
}): string =>
  [
    item.pickupDate,
    normalizeKeyPart(item.wasteType),
    normalizeKeyPart(item.street),
    normalizeKeyPart(item.city),
  ].join('::');

const toSyncRow = (item: SvaMainserverWasteSyncItem): WasteSyncRow => ({
  ...item,
  key: buildWasteSyncKey(item),
});

const filterSyncRowsToYearWindow = (
  rows: readonly WasteSyncRow[],
  currentYear: number,
  nextYear: number
): readonly WasteSyncRow[] => {
  const yearWindow = new Set(getEffectiveYearWindow(currentYear, nextYear));
  return rows.filter((row) => {
    const pickupDate = parseIsoDateUtc(row.pickupDate);
    return pickupDate ? yearWindow.has(pickupDate.getUTCFullYear()) : false;
  });
};

const buildStudioRowsFromSyncState = (
  studioState: WasteMaterializationSyncState,
  now: Date
): readonly WasteSyncRow[] => {
  const currentYear = now.getUTCFullYear();
  const nextYear = currentYear + 1;
  return buildStudioRowsFromMaterialization({
    pickupDates: buildMaterializedLocationTourPickupDates({
      ...studioState,
      locationTourPickupDates: studioState.locationTourPickupDates,
      currentYear,
      nextYear,
    }),
    tours: studioState.tours,
    fractions: studioState.fractions,
    links: studioState.links,
    locations: studioState.locations,
    cities: studioState.cities,
    streets: studioState.streets,
  }).map(toSyncRow);
};

export const runWasteManagementMainserverSync = async (input: {
  studioRows: readonly WasteSyncRow[];
  mainserverRows: readonly WasteSyncRow[];
  dryRun: boolean;
  createItems?: (items: readonly SvaMainserverWasteSyncItem[]) => Promise<void>;
  deleteItems?: (items: readonly SvaMainserverWasteSyncItem[]) => Promise<void>;
}): Promise<WasteManagementMainserverSyncResult> => {
  const studioByKey = new Map(input.studioRows.map((row) => [row.key, row] as const));
  const mainserverByKey = new Map(input.mainserverRows.map((row) => [row.key, row] as const));

  const createItems = input.studioRows
    .filter((row) => !mainserverByKey.has(row.key))
    .map(({ key: _key, ...row }) => row);
  const deleteItems = input.mainserverRows
    .filter((row) => !studioByKey.has(row.key))
    .map(({ key: _key, ...row }) => row);
  const deleteByIdCount = deleteItems.filter((row) => Boolean(row.id?.trim())).length;
  const deleteByValueCount = deleteItems.length - deleteByIdCount;

  if (!input.dryRun) {
    if (createItems.length > 0) {
      await input.createItems?.(createItems);
    }
    if (deleteItems.length > 0) {
      await input.deleteItems?.(deleteItems);
    }
  }

  return {
    studioItemCount: input.studioRows.length,
    mainserverItemCount: input.mainserverRows.length,
    createCount: createItems.length,
    createBatchCount: Math.ceil(createItems.length / CREATE_WASTE_PICKUP_TIMES_BATCH_SIZE),
    deleteCount: deleteItems.length,
    deleteByIdCount,
    deleteByValueCount,
    errorCount: 0,
    createItems,
    deleteItems,
  };
};

export const runWasteManagementMainserverSyncForInstance = async (input: {
  instanceId: string;
  runtimeDeps?: WasteOperationRuntimeDeps;
  syncInput: WasteManagementSyncMainserverJobInput;
}): Promise<WasteManagementMainserverSyncResult> => {
  const studioState = await withWasteClient(input.runtimeDeps ?? {}, input.instanceId, async ({ repository }) => ({
    tours: await repository.listWasteTours(),
    fractions: await repository.listWasteFractions(),
    links: await repository.listWasteLocationTourLinks(),
    locations: await repository.listWasteCollectionLocations(),
    locationTourPickupDates: await repository.listWasteLocationTourPickupDates(),
    cities: await repository.listWasteCities(),
    streets: await repository.listWasteStreets(),
    tourDateShifts: await repository.listWasteTourDateShifts(),
    globalDateShifts: await repository.listWasteGlobalDateShifts(),
    holidayRules: await repository.listWasteHolidayRules(),
  }));

  const now = input.runtimeDeps?.now?.() ?? new Date();
  const currentYear = now.getUTCFullYear();
  const nextYear = currentYear + 1;
  const studioRows = buildStudioRowsFromSyncState(studioState, now);
  const keycloakSubject = input.syncInput.keycloakSubject?.trim() || 'plugin-operation-runtime';
  const activeOrganizationId = input.syncInput.activeOrganizationId?.trim() || undefined;
  const mainserverSnapshot = await listSvaMainserverWasteSyncSnapshot({
    instanceId: input.instanceId,
    keycloakSubject,
    activeOrganizationId,
  });
  const mainserverRows = filterSyncRowsToYearWindow(
    mainserverSnapshot.pickupTimes.map(toSyncRow),
    currentYear,
    nextYear
  );

  return await runWasteManagementMainserverSync({
    studioRows,
    mainserverRows,
    dryRun: false,
    createItems: async (items) => {
      await createSvaMainserverWastePickupTimes({
        instanceId: input.instanceId,
        keycloakSubject,
        activeOrganizationId,
        items,
      });
    },
    deleteItems: async (items) => {
      await deleteSvaMainserverWastePickupTimes({
        instanceId: input.instanceId,
        keycloakSubject,
        activeOrganizationId,
        items,
      });
    },
  });
};
