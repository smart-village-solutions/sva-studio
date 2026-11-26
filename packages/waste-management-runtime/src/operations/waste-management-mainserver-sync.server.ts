import type { WasteMainserverSyncItem } from '@sva/waste-management-contracts';
import {
  buildMaterializedLocationTourPickupDates,
  buildStudioRowsFromMaterialization,
} from './waste-management-mainserver-sync.materialization.js';
import {
  getEffectiveYearWindow,
  parseIsoDateUtc,
} from './waste-management-mainserver-sync.materialization.shared.js';
import {
  loadWasteMainserverStudioSnapshot,
  type WasteMaterializationSyncState,
} from './waste-management-mainserver-sync.snapshot.server.js';
import {
  buildSyncProgress,
  formatBatchStepLabel,
  reportSyncProgress,
  type WasteSyncBatchProgressDetails,
  type WasteSyncProgressReporter,
} from './waste-management-mainserver-sync.progress.js';
import { buildWasteSyncPlan, toWasteSyncRow, type WasteSyncRow } from './waste-management-mainserver-sync.rows.js';
import type { WasteOperationRuntimeDeps } from './waste-management-operations.types.js';

type WasteManagementSyncMainserverJobInput = {
  readonly operation: 'sync-mainserver';
  readonly keycloakSubject?: string;
  readonly activeOrganizationId?: string;
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
  createItems: readonly WasteMainserverSyncItem[];
  deleteItems: readonly WasteMainserverSyncItem[];
}>;

export type WasteManagementMainserverSyncExecutionResult = WasteManagementMainserverSyncResult &
  Readonly<{
    sourceRevision: string;
    yearWindow: readonly [number, number];
  }>;

type WasteManagementMainserverSyncPlanDetails = Readonly<{
  createCount: number;
  deleteCount: number;
  totalCount: number;
}>;

const DEFAULT_MAINSERVER_SYNC_BATCH_SIZE = 100;

const filterSyncRowsToYearWindow = (
  rows: readonly WasteMainserverSyncItem[],
  currentYear: number,
  nextYear: number
): readonly WasteSyncRow[] => {
  const yearWindow = new Set(getEffectiveYearWindow(currentYear, nextYear));
  const result: WasteSyncRow[] = [];
  for (const row of rows) {
    const pickupDate = parseIsoDateUtc(row.pickupDate);
    if (pickupDate && yearWindow.has(pickupDate.getUTCFullYear())) {
      result.push(toWasteSyncRow(row));
    }
  }
  return result;
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
      currentYear,
      nextYear,
    }),
    tours: studioState.tours,
    fractions: studioState.fractions,
    locations: studioState.locations,
    houseNumbers: studioState.houseNumbers,
    cities: studioState.cities,
    streets: studioState.streets,
  });
};

type WasteSyncExecutionOptions = {
  dryRun: boolean;
  batchSize?: number;
  getNow?: () => Date;
  createItems?: (items: readonly WasteMainserverSyncItem[]) => Promise<void>;
  deleteItems?: (items: readonly WasteMainserverSyncItem[]) => Promise<void>;
  onPlanReady?: (details: WasteManagementMainserverSyncPlanDetails) => Promise<void> | void;
  onBatchProgress?: (details: WasteSyncBatchProgressDetails) => Promise<void> | void;
};

const executeWasteSyncPlan = async (
  plan: ReturnType<typeof buildWasteSyncPlan>,
  input: WasteSyncExecutionOptions
): Promise<WasteManagementMainserverSyncResult> => {
  const { studioCount, mainserverCount, createItems, deleteItems } = plan;
  const deleteByIdCount = deleteItems.filter((row) => Boolean(row.id?.trim())).length;
  const deleteByValueCount = deleteItems.length - deleteByIdCount;
  const totalPlannedItemCount = createItems.length + deleteItems.length;

  await input.onPlanReady?.({
    createCount: createItems.length,
    deleteCount: deleteItems.length,
    totalCount: totalPlannedItemCount,
  });

  if (!input.dryRun && createItems.length > 0 && !input.createItems) {
    throw new Error('waste_mainserver_sync_missing_create_writer');
  }
  if (!input.dryRun && deleteItems.length > 0 && !input.deleteItems) {
    throw new Error('waste_mainserver_sync_missing_delete_writer');
  }

  let processedItemCount = 0;
  let createCount = 0;
  let deleteCount = 0;
  let totalBatchDurationMs = 0;
  let measuredBatchCount = 0;
  let longestBatchDurationMs: number | undefined;
  const averageBatchDurationMs = () =>
    measuredBatchCount === 0 ? 0 : Math.round(totalBatchDurationMs / measuredBatchCount);
  const batchSize = Math.max(1, input.batchSize ?? DEFAULT_MAINSERVER_SYNC_BATCH_SIZE);

  const processBatches = async (params: {
    readonly items: readonly WasteMainserverSyncItem[];
    readonly operationMode: 'create' | 'delete';
    readonly writer?: (items: readonly WasteMainserverSyncItem[]) => Promise<void>;
  }): Promise<void> => {
    const totalBatchCount = Math.ceil(params.items.length / batchSize);

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

    let currentBatchIndex = 0;
    for (let offset = 0; offset < params.items.length; offset += batchSize) {
      currentBatchIndex += 1;
      const batch = params.items.slice(offset, offset + batchSize);
      const batchStartedAt = (input.getNow?.() ?? new Date()).getTime();
      await params.writer?.(batch);
      const batchFinishedAtDate = input.getNow?.() ?? new Date();
      const batchDurationMs = batchFinishedAtDate.getTime() - batchStartedAt;
      totalBatchDurationMs += batchDurationMs;
      measuredBatchCount += 1;
      longestBatchDurationMs = Math.max(longestBatchDurationMs ?? batchDurationMs, batchDurationMs);
      processedItemCount += batch.length;
      if (params.operationMode === 'create') {
        createCount += batch.length;
      } else {
        deleteCount += batch.length;
      }

      await input.onBatchProgress?.({
        operationMode: params.operationMode,
        totalItemCount: totalPlannedItemCount,
        totalBatchCount,
        currentBatchIndex,
        currentBatchSize: batch.length,
        processedItemCount,
        createCount,
        deleteCount,
        lastSuccessfulBatchAt: batchFinishedAtDate.toISOString(),
        lastBatchDurationMs: batchDurationMs,
        averageBatchDurationMs: averageBatchDurationMs(),
      });
    }
  };

  if (!input.dryRun) {
    await processBatches({
      items: deleteItems,
      operationMode: 'delete',
      writer: input.deleteItems,
    });
    // Existing same-day records must be gone: the bulk API does not update their notes.
    await processBatches({
      items: createItems,
      operationMode: 'create',
      writer: input.createItems,
    });
  }

  return {
    studioItemCount: studioCount,
    mainserverItemCount: mainserverCount,
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
    averageBatchDurationMs: averageBatchDurationMs(),
    longestBatchDurationMs: longestBatchDurationMs ?? 0,
    mainserverSnapshotCount: mainserverCount,
    studioSnapshotCount: studioCount,
    createItems,
    deleteItems,
  };
};

export const runWasteManagementMainserverSync = ({
  studioRows,
  mainserverRows,
  ...execution
}: WasteSyncExecutionOptions & {
  studioRows: readonly WasteSyncRow[];
  mainserverRows: readonly WasteSyncRow[];
}): Promise<WasteManagementMainserverSyncResult> =>
  executeWasteSyncPlan(buildWasteSyncPlan(studioRows, mainserverRows), execution);

type InstanceSyncInput = {
  instanceId: string;
  runtimeDeps?: WasteOperationRuntimeDeps;
  syncInput: WasteManagementSyncMainserverJobInput;
  progressReporter?: WasteSyncProgressReporter;
  batchSize?: number;
};

const prepareInstanceSync = async (input: InstanceSyncInput) => {
  await reportSyncProgress(
    input.progressReporter,
    buildSyncProgress({
      completedSteps: 1,
      currentStepKey: 'load-studio-state',
      currentStepLabel: 'load-studio-state',
    })
  );
  const { studioState, sourceState } = await loadWasteMainserverStudioSnapshot(
    input.runtimeDeps ?? {},
    input.instanceId
  );

  const now = input.runtimeDeps?.now?.() ?? new Date();
  const currentYear = now.getUTCFullYear();
  const nextYear = currentYear + 1;
  const studioRows = buildStudioRowsFromSyncState(studioState, now);
  const keycloakSubject = input.syncInput.keycloakSubject?.trim() || 'plugin-operation-runtime';
  const activeOrganizationId = input.syncInput.activeOrganizationId?.trim() || undefined;
  const listSnapshot = input.runtimeDeps?.listMainserverWasteSyncSnapshot;
  const createPickupTimes = input.runtimeDeps?.createMainserverWastePickupTimes;
  const deletePickupTimes = input.runtimeDeps?.deleteMainserverWastePickupTimes;
  if (!listSnapshot || !createPickupTimes || !deletePickupTimes) {
    throw new Error('waste_mainserver_sync_host_capability_unavailable');
  }
  const mainserverSnapshot = await listSnapshot({
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
    mainserverSnapshot.pickupTimes,
    currentYear,
    nextYear
  );
  return {
    plan: buildWasteSyncPlan(studioRows, mainserverRows),
    sourceRevision: sourceState.sourceRevision,
    yearWindow: [currentYear, nextYear] as const,
    keycloakSubject,
    activeOrganizationId,
    createPickupTimes,
    deletePickupTimes,
  };
};

export const runWasteManagementMainserverSyncForInstance = async (
  input: InstanceSyncInput
): Promise<WasteManagementMainserverSyncExecutionResult> => {
  const prepared = await prepareInstanceSync(input);
  const { plan, keycloakSubject, activeOrganizationId, createPickupTimes, deletePickupTimes } =
    prepared;
  const result = await executeWasteSyncPlan(plan, {
    dryRun: false,
    batchSize: input.batchSize,
    getNow: input.runtimeDeps?.now,
    onPlanReady: async (details) => {
      await reportSyncProgress(
        input.progressReporter,
        buildSyncProgress({
          completedSteps: 3,
          currentStepKey: 'diff-sync-state',
          currentStepLabel: 'diff-sync-state',
          details: {
            studioSnapshotCount: plan.studioCount,
            mainserverSnapshotCount: plan.mainserverCount,
            plannedCreateCount: details.createCount,
            plannedDeleteCount: details.deleteCount,
            plannedTotalCount: details.totalCount,
          },
        })
      );
    },
    createItems: async (items) => {
      await createPickupTimes({
        instanceId: input.instanceId,
        keycloakSubject,
        activeOrganizationId,
        items,
      });
    },
    deleteItems: async (items) => {
      await deletePickupTimes({
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
          completedSteps: isCreate ? 5 : 4,
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

  return {
    ...result,
    sourceRevision: prepared.sourceRevision,
    yearWindow: prepared.yearWindow,
  };
};
