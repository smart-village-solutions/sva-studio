import { runSqlAsSchemaOwner } from './database-operations.mjs';
import {
  sqlIdentifier,
  sqlLiteral,
  assertRuntimePrincipalTarget,
} from './principal-reconciliation.mjs';
import { postgresIdentifierPattern } from './runtime-config.mjs';
import { createReadStream, createWriteStream } from 'node:fs';
import { once } from 'node:events';
import { finished } from 'node:stream/promises';

export const validateDatabasePostchecks = ({
  appPrincipal,
  gooseVersion,
  iamSchema,
  registryEntries,
}) => {
  if (
    !/^\d+$/u.test(gooseVersion) ||
    iamSchema !== 't' ||
    appPrincipal !== '1' ||
    !/^\d+$/u.test(registryEntries)
  )
    throw new Error('database_postcheck_failed');
};

export const validateWasteDatabasePostchecks = ({ requiredTables, regionsTable, toursTable }) => {
  if (
    !/^\d+$/u.test(requiredTables) ||
    Number(requiredTables) < 3 ||
    regionsTable !== 't' ||
    toursTable !== 't'
  )
    throw new Error('database_postcheck_failed');
};

const bbPrignitzWasteImportInventory = Object.freeze({
  waste_tours: 65,
  waste_cities: 596,
  waste_regions: 14,
  waste_streets: 1438,
  waste_fractions: 7,
  waste_holiday_rules: 120,
  waste_house_numbers: 1438,
  waste_tour_date_shifts: 0,
  waste_global_date_shifts: 0,
  waste_location_tour_links: 2938,
  waste_collection_locations: 718,
  waste_custom_recurrence_presets: 0,
  waste_location_tour_pickup_dates: 160,
});

export const validateWasteImportInventory = (inventory) => {
  if (
    !inventory ||
    typeof inventory !== 'object' ||
    Array.isArray(inventory) ||
    Object.keys(inventory).length !== Object.keys(bbPrignitzWasteImportInventory).length ||
    Object.entries(bbPrignitzWasteImportInventory).some(
      ([table, expected]) => inventory[table] !== expected
    )
  )
    throw new Error('waste_import_inventory_mismatch');
  return Object.values(bbPrignitzWasteImportInventory).reduce((total, count) => total + count, 0);
};

export const wasteImportBackfillSql = (schemaOwner) => {
  if (!postgresIdentifierPattern.test(schemaOwner))
    throw new Error('runtime_principal_target_invalid');
  return `SET ROLE ${sqlIdentifier(schemaOwner)};
INSERT INTO public.waste_tour_assignments (id, tour_id, pickup_date, note, created_at, updated_at)
SELECT legacy_pickup.id, legacy_pickup.tour_id, legacy_pickup.pickup_date, legacy_pickup.note, legacy_pickup.created_at, legacy_pickup.updated_at
FROM public.waste_location_tour_pickup_dates AS legacy_pickup
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.waste_tour_assignment_locations (assignment_id, collection_location_id)
SELECT assignment.id, legacy_pickup.location_id
FROM public.waste_location_tour_pickup_dates AS legacy_pickup
INNER JOIN public.waste_tour_assignments AS assignment
  ON assignment.id = legacy_pickup.id
  AND assignment.tour_id = legacy_pickup.tour_id
  AND assignment.pickup_date = legacy_pickup.pickup_date
ON CONFLICT (assignment_id, collection_location_id) DO NOTHING;`;
};

export const wasteRuntimeConnectLockSql = (target, locked) => {
  assertRuntimePrincipalTarget(target);
  if (target.database !== 'waste') throw new Error('runtime_principal_target_invalid');
  return `SET ROLE ${sqlIdentifier(target.schemaOwner)};
${locked ? 'REVOKE' : 'GRANT'} CONNECT ON DATABASE ${sqlIdentifier(target.postgresDatabase)} ${locked ? 'FROM' : 'TO'} ${sqlIdentifier(target.runtimeUser)}, ${sqlIdentifier(target.publicRuntimeUser)};`;
};

export const restoreSchemaResetSql = (schemaOwner) => {
  const owner = sqlIdentifier(schemaOwner);
  return `SET ROLE ${owner}; DROP SCHEMA IF EXISTS iam CASCADE; DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public AUTHORIZATION ${owner}; CREATE SCHEMA iam AUTHORIZATION ${owner};`;
};

export const wasteRestoreSchemaResetSql = (schemaOwner) => {
  const owner = sqlIdentifier(schemaOwner);
  return `SET ROLE ${owner}; DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public AUTHORIZATION ${owner};`;
};

export const ssfRestoreSchemaResetSql = (schemaOwner) => {
  const owner = sqlIdentifier(schemaOwner);
  return `SET ROLE ${owner}; DROP SCHEMA IF EXISTS ssf CASCADE; DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public AUTHORIZATION ${owner};`;
};

export const writeWasteImportSql = async (source, target, schemaOwner) => {
  if (!postgresIdentifierPattern.test(schemaOwner))
    throw new Error('runtime_principal_target_invalid');
  const input = createReadStream(source);
  const output = createWriteStream(target, { mode: 0o600 });
  try {
    if (!output.write(`SET ROLE ${sqlIdentifier(schemaOwner)};\n`)) await once(output, 'drain');
    for await (const chunk of input) {
      if (!output.write(chunk)) await once(output, 'drain');
    }
    output.end();
    await finished(output);
  } catch (error) {
    output.destroy();
    throw error;
  }
};

const wasteImportInventorySql = `SELECT json_build_object(
${Object.keys(bbPrignitzWasteImportInventory)
  .map((table) => `  ${sqlLiteral(table)}, (SELECT count(*) FROM public.${sqlIdentifier(table)})`)
  .join(',\n')}
)::text;`;

export const readWasteImportInventory = async (target, pgEnv) => {
  const output = await runSqlAsSchemaOwner(target, pgEnv, wasteImportInventorySql);
  try {
    return JSON.parse(output);
  } catch (error) {
    throw new Error('waste_import_inventory_mismatch', { cause: error });
  }
};

export const checkRestoredDatabase = async (context) => {
  if (context.target.database === 'waste') {
    const requiredTables = await runSqlAsSchemaOwner(
      context.target,
      context.pgEnv,
      `SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'waste\\_%' ESCAPE '\\'`
    );
    const regionsTable = await runSqlAsSchemaOwner(
      context.target,
      context.pgEnv,
      `SELECT to_regclass('public.waste_regions') IS NOT NULL`
    );
    const toursTable = await runSqlAsSchemaOwner(
      context.target,
      context.pgEnv,
      `SELECT to_regclass('public.waste_tours') IS NOT NULL`
    );
    validateWasteDatabasePostchecks({ requiredTables, regionsTable, toursTable });
    context.complete('database-postchecks', { requiredTables: Number(requiredTables) });
  } else if (context.target.database === 'ssf') {
    const gooseVersion = await runSqlAsSchemaOwner(
      context.target,
      context.pgEnv,
      'SELECT max(version_id) FROM public.goose_db_version WHERE is_applied'
    );
    const requiredTables = await runSqlAsSchemaOwner(
      context.target,
      context.pgEnv,
      `SELECT count(*) FROM information_schema.tables WHERE table_schema = 'ssf' AND table_name = ANY (ARRAY['server_settings', 'server_locales', 'tenant_settings', 'tenant_locales', 'authorization_projections'])`
    );
    if (!Number.isSafeInteger(Number(gooseVersion)) || Number(requiredTables) !== 5)
      throw new Error('ssf_database_postcheck_failed');
    context.complete('database-postchecks', {
      gooseVersion: Number(gooseVersion),
      requiredTables: 5,
    });
  } else {
    const gooseVersion = await runSqlAsSchemaOwner(
      context.target,
      context.pgEnv,
      'SELECT max(version_id) FROM public.goose_db_version WHERE is_applied'
    );
    const iamSchema = await runSqlAsSchemaOwner(
      context.target,
      context.pgEnv,
      `SELECT to_regclass('iam.instances') IS NOT NULL`
    );
    const appPrincipal = context.principalProbe.runtimeRoleTablesReady ? '1' : '0';
    const registryEntries = await runSqlAsSchemaOwner(
      context.target,
      context.pgEnv,
      'SELECT count(*) FROM iam.instances'
    );
    validateDatabasePostchecks({ appPrincipal, gooseVersion, iamSchema, registryEntries });
    context.complete('database-postchecks', {
      gooseVersion,
      registryEntries: Number(registryEntries),
    });
  }
};
