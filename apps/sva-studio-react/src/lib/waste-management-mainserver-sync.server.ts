import type {
  WasteCityRecord,
  WasteCollectionLocationRecord,
  WasteFractionRecord,
  WasteLocationTourLinkRecord,
  WasteStreetRecord,
  WasteTourRecord,
} from '@sva/core';
import {
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
import {
  averageBatchDuration,
  buildSyncProgress,
  formatBatchStepLabel,
  reportSyncProgress,
  type WasteSyncBatchProgressDetails,
  type WasteSyncProgressReporter,
} from './waste-management-mainserver-sync.progress.js';
import {
  chunkWasteSyncItems,
  toWasteSyncRow,
  type WasteSyncRow,
} from './waste-management-mainserver-sync.rows.js';

import type { WasteOperationRuntimeDeps } from './waste-management-operations.types.js';
import { withWasteClient } from './waste-management-operations.shared.js';

type WasteManagementSyncMainserverJobInput = {
  readonly operation: 'sync-mainserver';
  readonly keycloakSubject?: string;
  readonly activeOrganizationId?: string;
};

type WasteMaterializationSyncState = Omit<
  WasteMaterializationContext,
  'currentYear' | 'nextYear'
> & {
  readonly cities: readonly WasteCityRecord[];
  readonly fractions: readonly WasteFractionRecord[];
  readonly locations: readonly WasteCollectionLocationRecord[];
  readonly locationTourPickupDates: NonNullable<
    WasteMaterializationContext['locationTourPickupDates']
  >;
  readonly tourAssignments: NonNullable<WasteMaterializationContext['tourAssignments']>;
  readonly streets: readonly WasteStreetRecord[];
  readonly tours: readonly WasteTourRecord[];
  readonly links: readonly WasteLocationTourLinkRecord[];
};

export { buildWasteSyncKey } from './waste-management-mainserver-sync.rows.js';
export type { WasteSyncRow } from './waste-management-mainserver-sync.rows.js';

export type WasteManagementMainserverSyncResult = Readonly<{
  studioItemCount: number;
  mainserverItemCount: number;
  createCount: number;
  createBatchCount: number;
  deleteCount: number;
  deleteByIdCount: number;
  deleteByValueCount: number;
  errorCount: number;
  totalBatchCount: number;
  processedItemCount: number;
  finalCreateCount: number;
  finalDeleteCount: number;
  averageBatchDurationMs: number;
  longestBatchDurationMs: number;
  mainserverSnapshotCount: number;
  studioSnapshotCount: number;
  createItems: readonly SvaMainserverWasteSyncItem[];
  deleteItems: readonly SvaMainserverWasteSyncItem[];
}>;

const DEFAULT_MAINSERVER_SYNC_BATCH_SIZE = 100;

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
      tourAssignments: studioState.tourAssignments,
      currentYear,
      nextYear,
    }),
    tours: studioState.tours,
    fractions: studioState.fractions,
    locations: studioState.locations,
    cities: studioState.cities,
    streets: studioState.streets,
  }).map(toWasteSyncRow);
};

export const runWasteManagementMainserverSync = async (input: {
  studioRows: readonly WasteSyncRow[];
  mainserverRows: readonly WasteSyncRow[];
  dryRun: boolean;
  batchSize?: number;
  getNow?: () => Date;
  createItems?: (items: readonly SvaMainserverWasteSyncItem[]) => Promise<void>;
  deleteItems?: (items: readonly SvaMainserverWasteSyncItem[]) => Promise<void>;
  onBatchProgress?: (details: WasteSyncBatchProgressDetails) => Promise<void> | void;
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
  const totalPlannedItemCount = createItems.length + deleteItems.length;

  if (!input.dryRun && createItems.length > 0 && !input.createItems) {
    throw new Error('waste_mainserver_sync_missing_create_writer');
  }
  if (!input.dryRun && deleteItems.length > 0 && !input.deleteItems) {
    throw new Error('waste_mainserver_sync_missing_delete_writer');
  }

  let processedItemCount = 0;
  let createCount = 0;
  let deleteCount = 0;
  const batchDurationsMs: number[] = [];
  const batchSize = Math.max(1, input.batchSize ?? DEFAULT_MAINSERVER_SYNC_BATCH_SIZE);

  const processBatches = async (params: {
    readonly items: readonly SvaMainserverWasteSyncItem[];
    readonly operationMode: 'create' | 'delete';
    readonly writer?: (items: readonly SvaMainserverWasteSyncItem[]) => Promise<void>;
  }): Promise<void> => {
    const batches = chunkWasteSyncItems(params.items, batchSize);

    if (params.items.length === 0) {
      await input.onBatchProgress?.({
        operationMode: params.operationMode,
        totalItemCount: totalPlannedItemCount,
        totalBatchCount: 0,
        currentBatchIndex: 0,
        currentBatchSize: 0,
        processedItemCount,
        createCount,
        deleteCount,
      });
      return;
    }

    for (const [batchIndex, batch] of batches.entries()) {
      const batchStartedAt = (input.getNow ?? (() => new Date()))().getTime();
      await params.writer?.(batch);
      const batchFinishedAt = input.getNow ?? (() => new Date());
      const batchFinishedAtDate = batchFinishedAt();
      const batchDurationMs = batchFinishedAtDate.getTime() - batchStartedAt;
      batchDurationsMs.push(batchDurationMs);
      processedItemCount += batch.length;
      if (params.operationMode === 'create') {
        createCount += batch.length;
      } else {
        deleteCount += batch.length;
      }

      await input.onBatchProgress?.({
        operationMode: params.operationMode,
        totalItemCount: totalPlannedItemCount,
        totalBatchCount: batches.length,
        currentBatchIndex: batchIndex + 1,
        currentBatchSize: batch.length,
        processedItemCount,
        createCount,
        deleteCount,
        lastSuccessfulBatchAt: batchFinishedAtDate.toISOString(),
        lastBatchDurationMs: batchDurationMs,
        averageBatchDurationMs: averageBatchDuration(batchDurationsMs),
      });
    }
  };

  if (!input.dryRun) {
    await processBatches({
      items: createItems,
      operationMode: 'create',
      writer: input.createItems,
    });
    await processBatches({
      items: deleteItems,
      operationMode: 'delete',
      writer: input.deleteItems,
    });
  }

  return {
    studioItemCount: input.studioRows.length,
    mainserverItemCount: input.mainserverRows.length,
    createCount: createItems.length,
    createBatchCount: Math.ceil(createItems.length / batchSize),
    deleteCount: deleteItems.length,
    deleteByIdCount,
    deleteByValueCount,
    errorCount: 0,
    totalBatchCount:
      Math.ceil(createItems.length / batchSize) + Math.ceil(deleteItems.length / batchSize),
    processedItemCount,
    finalCreateCount: input.dryRun ? createItems.length : createCount,
    finalDeleteCount: input.dryRun ? deleteItems.length : deleteCount,
    averageBatchDurationMs: averageBatchDuration(batchDurationsMs),
    longestBatchDurationMs: batchDurationsMs.length > 0 ? Math.max(...batchDurationsMs) : 0,
    mainserverSnapshotCount: input.mainserverRows.length,
    studioSnapshotCount: input.studioRows.length,
    createItems,
    deleteItems,
  };
};

export const runWasteManagementMainserverSyncForInstance = async (input: {
  instanceId: string;
  runtimeDeps?: WasteOperationRuntimeDeps;
  syncInput: WasteManagementSyncMainserverJobInput;
  progressReporter?: WasteSyncProgressReporter;
  batchSize?: number;
}): Promise<WasteManagementMainserverSyncResult> => {
  await reportSyncProgress(
    input.progressReporter,
    buildSyncProgress({
      completedSteps: 1,
      currentStepKey: 'load-studio-state',
      currentStepLabel: 'load-studio-state',
    })
  );
  const studioState = await withWasteClient(
    input.runtimeDeps ?? {},
    input.instanceId,
    async ({ repository }) => ({
      tours: await repository.listWasteTours(),
      fractions: await repository.listWasteFractions(),
      links: await repository.listWasteLocationTourLinks(),
      locations: await repository.listWasteCollectionLocations(),
      locationTourPickupDates: await repository.listWasteLocationTourPickupDates(),
      tourAssignments: await repository.listWasteTourAssignments(),
      cities: await repository.listWasteCities(),
      streets: await repository.listWasteStreets(),
      tourDateShifts: await repository.listWasteTourDateShifts(),
      globalDateShifts: await repository.listWasteGlobalDateShifts(),
      holidayRules: await repository.listWasteHolidayRules(),
    })
  );

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
  await reportSyncProgress(
    input.progressReporter,
    buildSyncProgress({
      completedSteps: 2,
      currentStepKey: 'load-mainserver-snapshot',
      currentStepLabel: 'load-mainserver-snapshot',
      details: {
        studioSnapshotCount: studioRows.length,
      },
    })
  );
  const mainserverRows = filterSyncRowsToYearWindow(
    mainserverSnapshot.pickupTimes.map(toWasteSyncRow),
    currentYear,
    nextYear
  );
  await reportSyncProgress(
    input.progressReporter,
    buildSyncProgress({
      completedSteps: 3,
      currentStepKey: 'diff-sync-state',
      currentStepLabel: 'diff-sync-state',
      details: {
        studioSnapshotCount: studioRows.length,
        mainserverSnapshotCount: mainserverRows.length,
      },
    })
  );

  const result = await runWasteManagementMainserverSync({
    studioRows,
    mainserverRows,
    dryRun: false,
    batchSize: input.batchSize,
    getNow: input.runtimeDeps?.now,
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
    onBatchProgress: async (details) => {
      const isCreate = details.operationMode === 'create';
      const currentStepKey = isCreate ? 'create-batches' : 'delete-batches';

      await reportSyncProgress(
        input.progressReporter,
        buildSyncProgress({
          completedSteps: isCreate ? 4 : 5,
          currentStepKey,
          currentStepLabel: formatBatchStepLabel(details),
          details,
        })
      );
    },
  });

  await reportSyncProgress(
    input.progressReporter,
    buildSyncProgress({
      completedSteps: 6,
      currentStepKey: 'complete-operation',
      currentStepLabel: 'complete-operation',
      details: {
        totalBatchCount: result.totalBatchCount,
        processedItemCount: result.processedItemCount,
        finalCreateCount: result.finalCreateCount,
        finalDeleteCount: result.finalDeleteCount,
        averageBatchDurationMs: result.averageBatchDurationMs,
        longestBatchDurationMs: result.longestBatchDurationMs,
        studioSnapshotCount: result.studioSnapshotCount,
        mainserverSnapshotCount: result.mainserverSnapshotCount,
      },
    })
  );

  return result;
};
