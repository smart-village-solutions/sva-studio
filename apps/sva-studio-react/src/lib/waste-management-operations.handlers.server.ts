import { buildWasteTypesStaticContent, getWasteManagementImportCatalogEntry, wasteManagementOperationsContract } from '@sva/core';
import { createOrUpdateSvaMainserverStaticContent } from '@sva/sva-mainserver/server';
import { runWasteConnectionCheck } from '@sva/server-runtime';

import {
  executeImport,
  parseImportRows,
  parseLocationTourPickupDateImport,
  previewLocationTourPickupDateImport,
} from './waste-management-operations.import.js';
import { baselineIds, seedWasteBaseline } from './waste-management-operations.seed.js';
import {
  applySchemaStatements,
  buildWasteFractionShortLabelBackfillStatement,
  inspectWasteSchema,
} from './waste-management-operations.schema.js';
import { runWasteManagementMainserverSyncForInstance } from './waste-management-mainserver-sync.server.js';
import {
  buildOperationSummary,
  defaultCreatePool,
  normalizeOptionalText,
  resolveRuntimeDataSource,
  withWasteClient,
} from './waste-management-operations.shared.js';
import type { WasteManagementOperationRuntime, WasteOperationRuntimeDeps } from './waste-management-operations.types.js';

const resolveBoundWasteSchemaName = (configuredSchemaName: string, requestedSchema: string | undefined): string => {
  const normalizedRequestedSchema = normalizeOptionalText(requestedSchema);
  if (!normalizedRequestedSchema) {
    return configuredSchemaName;
  }
  if (normalizedRequestedSchema !== configuredSchemaName) {
    throw new Error(`invalid_waste_schema_target:${normalizedRequestedSchema}`);
  }
  return configuredSchemaName;
};

export const createInitializeDataSourceOperation = (
  deps: WasteOperationRuntimeDeps
): WasteManagementOperationRuntime['initializeDataSource'] => async (instanceId, input) => {
  const startedAt = Date.now();
  const dataSource = await resolveRuntimeDataSource(deps, instanceId);
  const schemaName = resolveBoundWasteSchemaName(dataSource.schemaName, input.targetSchema);
  const connectionCheck = await runWasteConnectionCheck({
    dataSource,
    probe: async (resolved) => {
      const pool = (deps.createPool ?? defaultCreatePool)(resolved.databaseUrl);
      try {
        const client = await pool.connect();
        client.release();
      } finally {
        await pool.end();
      }
    },
    now: deps.now,
  });
  const schemaInspection = await withWasteClient(deps, instanceId, async ({ client, dataSource: resolved }) =>
    inspectWasteSchema(client, resolveBoundWasteSchemaName(resolved.schemaName, schemaName))
  );
  return buildOperationSummary(startedAt, {
    operation: 'initialize-data-source',
    mode: 'executed',
    connectionCheck,
    schemaInspection,
  });
};

export const createApplyMigrationsOperation = (
  deps: WasteOperationRuntimeDeps
): WasteManagementOperationRuntime['applyMigrations'] => async (instanceId, input) => {
  const startedAt = Date.now();
  const details = await withWasteClient(deps, instanceId, async ({ client, dataSource }) => {
    const schemaName = resolveBoundWasteSchemaName(dataSource.schemaName, input.targetSchema);
    const statements = applySchemaStatements(schemaName);
    for (const statement of statements) {
      await client.query(statement);
    }
    return {
      operation: 'apply-migrations',
      mode: 'executed',
      requestedByVersion: normalizeOptionalText(input.requestedByVersion),
      schemaInspection: await inspectWasteSchema(client, schemaName),
      appliedStatementCount: statements.length,
    };
  });
  return buildOperationSummary(startedAt, details);
};

export const createImportDataOperation = (
  deps: WasteOperationRuntimeDeps
): WasteManagementOperationRuntime['importData'] => async (instanceId, input, progressReporter) => {
  const startedAt = Date.now();
  const parsedLocationTourPickupDates =
    input.importProfileId === wasteManagementOperationsContract.importProfileIds.locationTourPickupDates
      ? await parseLocationTourPickupDateImport(deps, {
          sourceFormat: input.sourceFormat,
          blobRef: input.blobRef,
          delimiterOverride: input.delimiterOverride,
        })
      : undefined;
  const rows =
    input.importProfileId === wasteManagementOperationsContract.importProfileIds.locationTourPickupDates
      ? []
      : await parseImportRows(deps, {
          profileId: input.importProfileId,
          sourceFormat: input.sourceFormat,
          blobRef: input.blobRef,
        });
  const details = await withWasteClient(deps, instanceId, async ({ repository }) => {
    const catalogEntry = getWasteManagementImportCatalogEntry(input.importProfileId);
    if (!catalogEntry) {
      throw new Error(`unknown_import_profile:${input.importProfileId}`);
    }
    if (parsedLocationTourPickupDates) {
      const preview = await previewLocationTourPickupDateImport(repository, parsedLocationTourPickupDates);
      if (input.dryRun) {
        return {
          operation: 'import-data',
          mode: 'executed',
          importProfileId: input.importProfileId,
          sourceFormat: input.sourceFormat,
          dryRun: true,
          rowCount: preview.validRowCount,
          skippedRows: preview.invalidRowCount,
          errorCount: preview.errors.length,
          preview,
        };
      }
    }
    if (input.dryRun) {
      return {
        operation: 'import-data',
        mode: 'executed',
        importProfileId: input.importProfileId,
        sourceFormat: input.sourceFormat,
        dryRun: true,
        rowCount: rows.length,
      };
    }
    return {
      operation: 'import-data',
      mode: 'executed',
      importProfileId: input.importProfileId,
      sourceFormat: input.sourceFormat,
      dryRun: false,
      ...(await executeImport(repository, {
        profileId: input.importProfileId,
        rows,
        parsedLocationTourPickupDates,
        reportProgress: progressReporter?.reportProgress,
      })),
    };
  });
  return buildOperationSummary(startedAt, details);
};

export const createSeedDataOperation = (
  deps: WasteOperationRuntimeDeps
): WasteManagementOperationRuntime['seedData'] => async (instanceId, input) => {
  const startedAt = Date.now();
  const details = await withWasteClient(deps, instanceId, async ({ repository }) => {
    if (input.seedKey !== 'baseline') {
      throw new Error(`unsupported_seed_key:${input.seedKey}`);
    }
    await seedWasteBaseline(repository);
    return {
      operation: 'seed-data',
      mode: 'executed',
      seedKey: input.seedKey,
      seededEntityCount: Object.keys(baselineIds).length,
    };
  });
  return buildOperationSummary(startedAt, details);
};

export const createSyncMainserverOperation = (
  deps: WasteOperationRuntimeDeps
): WasteManagementOperationRuntime['syncMainserver'] => async (instanceId, input, progressReporter) => {
  const startedAt = Date.now();
  const details = await runWasteManagementMainserverSyncForInstance({
    instanceId,
    runtimeDeps: deps,
    syncInput: input,
    progressReporter,
  });
  return buildOperationSummary(startedAt, {
    operation: 'sync-mainserver',
    mode: 'executed',
    studioItemCount: details.studioItemCount,
    mainserverItemCount: details.mainserverItemCount,
    createCount: details.createCount,
    createBatchCount: details.createBatchCount,
    deleteCount: details.deleteCount,
    deleteByIdCount: details.deleteByIdCount,
    deleteByValueCount: details.deleteByValueCount,
    errorCount: details.errorCount,
    totalBatchCount: details.totalBatchCount,
    processedItemCount: details.processedItemCount,
    finalCreateCount: details.finalCreateCount,
    finalDeleteCount: details.finalDeleteCount,
    averageBatchDurationMs: details.averageBatchDurationMs,
    longestBatchDurationMs: details.longestBatchDurationMs,
    studioSnapshotCount: details.studioSnapshotCount,
    mainserverSnapshotCount: details.mainserverSnapshotCount,
  });
};

export const createSyncWasteTypesOperation = (
  deps: WasteOperationRuntimeDeps
): WasteManagementOperationRuntime['syncWasteTypes'] => async (instanceId, input) => {
  const startedAt = Date.now();
  const details = await withWasteClient(deps, instanceId, async ({ client, repository }) => {
    await client.query(buildWasteFractionShortLabelBackfillStatement('waste_fractions'));
    const fractions = await repository.listWasteFractions();
    const artifact = await buildWasteTypesStaticContent(fractions);
    const writeResult = await createOrUpdateSvaMainserverStaticContent({
      instanceId,
      keycloakSubject: normalizeOptionalText(input.keycloakSubject) ?? 'plugin-operation-runtime',
      activeOrganizationId: normalizeOptionalText(input.activeOrganizationId),
      staticContent: {
        name: artifact.name,
        content: artifact.content,
      },
    });

    return {
      operation: 'sync-waste-types',
      mode: 'executed',
      staticContentName: artifact.name,
      version: artifact.version,
      fractionCount: artifact.fractionCount,
      staticContentId: writeResult.id,
    };
  });

  return buildOperationSummary(startedAt, details);
};

export const createResetDataOperation = (
  deps: WasteOperationRuntimeDeps
): WasteManagementOperationRuntime['resetData'] => async (instanceId, input) => {
  const startedAt = Date.now();
  const normalizedConfirmationToken = input.confirmationToken.trim();
  if (normalizedConfirmationToken.length === 0) {
    throw new Error('missing_reset_confirmation_token');
  }
  if (normalizedConfirmationToken !== wasteManagementOperationsContract.resetConfirmationToken) {
    throw new Error('invalid_reset_confirmation_token');
  }
  const details = await withWasteClient(deps, instanceId, async ({ client }) => {
    const tableOrder = [
      'waste_location_tour_pickup_dates',
      'waste_location_tour_links',
      'waste_tour_date_shifts',
      'waste_global_date_shifts',
      'waste_collection_locations',
      'waste_house_numbers',
      'waste_streets',
      'waste_tours',
      'waste_fractions',
      'waste_cities',
      'waste_regions',
    ] as const;
    const deletedRows: Record<string, number> = {};
    for (const tableName of tableOrder) {
      const result = await client.query(`DELETE FROM ${tableName};`);
      deletedRows[tableName] = result.rowCount ?? 0;
    }
    return {
      operation: 'reset-data',
      mode: 'executed',
      confirmationTokenLength: normalizedConfirmationToken.length,
      deletedRows,
    };
  });
  return buildOperationSummary(startedAt, details);
};
