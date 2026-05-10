import { getWasteManagementImportCatalogEntry } from '@sva/core';
import { runWasteConnectionCheck } from '@sva/server-runtime';

import { executeImport, parseImportRows } from './waste-management-operations.import.js';
import { baselineIds, seedWasteBaseline } from './waste-management-operations.seed.js';
import { applySchemaStatements, inspectWasteSchema } from './waste-management-operations.schema.js';
import {
  buildOperationSummary,
  defaultCreatePool,
  normalizeOptionalText,
  resolveRuntimeDataSource,
  withWasteClient,
} from './waste-management-operations.shared.js';
import type {
  WasteManagementOperationRuntime,
  WasteOperationRuntimeDeps,
} from './waste-management-operations.types.js';

export type { OperationSummary, WasteManagementOperationRuntime, WasteOperationRuntimeDeps } from './waste-management-operations.types.js';

export const createWasteManagementOperationRuntime = (
  deps: WasteOperationRuntimeDeps = {}
): WasteManagementOperationRuntime => ({
  async initializeDataSource(instanceId, input) {
    const startedAt = Date.now();
    const dataSource = await resolveRuntimeDataSource(deps, instanceId);
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
      inspectWasteSchema(client, input.targetSchema ?? resolved.schemaName)
    );
    return buildOperationSummary(startedAt, {
      operation: 'initialize-data-source',
      mode: 'executed',
      connectionCheck,
      schemaInspection,
    });
  },

  async applyMigrations(instanceId, input) {
    const startedAt = Date.now();
    const details = await withWasteClient(deps, instanceId, async ({ client, dataSource }) => {
      const schemaName = input.targetSchema ?? dataSource.schemaName;
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
  },

  async importData(instanceId, input) {
    const startedAt = Date.now();
    const rows = await parseImportRows(deps, {
      profileId: input.importProfileId,
      sourceFormat: input.sourceFormat,
      blobRef: input.blobRef,
    });
    const details = await withWasteClient(deps, instanceId, async ({ repository }) => {
      const catalogEntry = getWasteManagementImportCatalogEntry(input.importProfileId);
      if (!catalogEntry) {
        throw new Error(`unknown_import_profile:${input.importProfileId}`);
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
        ...(await executeImport(repository, { profileId: input.importProfileId, rows })),
      };
    });
    return buildOperationSummary(startedAt, details);
  },

  async seedData(instanceId, input) {
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
  },

  async resetData(instanceId, input) {
    const startedAt = Date.now();
    if (input.confirmationToken.trim().length === 0) {
      throw new Error('missing_reset_confirmation_token');
    }
    const details = await withWasteClient(deps, instanceId, async ({ client }) => {
      const tableOrder = [
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
        confirmationTokenLength: input.confirmationToken.trim().length,
        deletedRows,
      };
    });
    return buildOperationSummary(startedAt, details);
  },
});
