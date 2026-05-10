import { readFile } from 'node:fs/promises';
import { resolve as resolvePath } from 'node:path';

import { createWasteMasterDataRepository, type SqlExecutionResult, type SqlExecutor, type SqlStatement } from '@sva/data-repositories';
import { loadWasteDataSourceRecord } from '@sva/data-repositories/server';
import {
  getWasteManagementImportCatalogEntry,
  wasteManagementMasterDataContract,
  type WasteCustomTourDate,
  type WasteDateShiftReasonType,
  type WasteManagementApplyMigrationsJobInput,
  type WasteManagementImportJobInput,
  type WasteManagementImportProfileId,
  type WasteManagementImportSourceFormat,
  type WasteManagementInitializeJobInput,
  type WasteManagementResetJobInput,
  type WasteManagementSeedJobInput,
  type WasteTourDateShiftFollowUpMode,
  type WasteTourRecurrence,
} from '@sva/core';
import { revealField } from '@sva/iam-admin/encryption';
import {
  buildWasteDatabaseUrlAad,
  buildWasteServiceRoleKeyAad,
  resolveWasteDataSource,
  runWasteConnectionCheck,
  type ResolvedWasteDataSource,
} from '@sva/server-runtime';
import { Pool } from 'pg';
import * as XLSX from 'xlsx';

const schemaIdentifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;

const requiredWasteTables = [
  'waste_regions',
  'waste_cities',
  'waste_streets',
  'waste_house_numbers',
  'waste_collection_locations',
  'waste_fractions',
  'waste_tours',
  'waste_location_tour_links',
  'waste_tour_date_shifts',
  'waste_global_date_shifts',
] as const;

const baselineIds = {
  region: '00000000-0000-4000-8000-000000000001',
  city: '00000000-0000-4000-8000-000000000002',
  street: '00000000-0000-4000-8000-000000000003',
  houseNumber: '00000000-0000-4000-8000-000000000004',
  location: '00000000-0000-4000-8000-000000000005',
  fractionRest: '00000000-0000-4000-8000-000000000006',
  fractionBio: '00000000-0000-4000-8000-000000000007',
  tour: '00000000-0000-4000-8000-000000000008',
  link: '00000000-0000-4000-8000-000000000009',
  tourShift: '00000000-0000-4000-8000-00000000000a',
  globalShift: '00000000-0000-4000-8000-00000000000b',
} as const;

type SqlClient = {
  query: <TRow = Record<string, unknown>>(text: string, values?: readonly unknown[]) => Promise<{
    readonly rowCount: number | null;
    readonly rows: readonly TRow[];
  }>;
  release: () => void;
};

type WasteOperationSqlPool = {
  connect: () => Promise<SqlClient>;
  end: () => Promise<void>;
};

type WasteOperationRuntimeDeps = {
  readonly now?: () => Date;
  readonly loadDataSourceRecord?: typeof loadWasteDataSourceRecord;
  readonly revealSecret?: (ciphertext: string | null | undefined, aad: string) => string | undefined;
  readonly createPool?: (connectionString: string) => WasteOperationSqlPool;
  readonly readBinarySource?: (blobRef: string) => Promise<Uint8Array>;
};

type OperationSummary = {
  readonly durationMs: number;
  readonly details: Record<string, unknown>;
};

const quoteIdentifier = (value: string): string => {
  if (!schemaIdentifierPattern.test(value)) {
    throw new Error(`invalid_waste_schema:${value}`);
  }

  return `"${value}"`;
};

const createSqlExecutor = (client: {
  query: <TRow = Record<string, unknown>>(text: string, values?: readonly unknown[]) => Promise<{
    readonly rowCount: number | null;
    readonly rows: readonly TRow[];
  }>;
}): SqlExecutor => ({
  async execute<TRow = Record<string, unknown>>(statement: SqlStatement): Promise<SqlExecutionResult<TRow>> {
    const result = await client.query<TRow>(statement.text, statement.values);
    return {
      rowCount: result.rowCount ?? 0,
      rows: result.rows,
    };
  },
});

const normalizeOptionalText = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const parseBoolean = (value: string, fieldName: string): boolean => {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
    return true;
  }
  if (normalized === 'false' || normalized === '0' || normalized === 'no') {
    return false;
  }
  throw new Error(`invalid_boolean:${fieldName}`);
};

const parseDelimitedStringArray = (value: string | undefined): readonly string[] => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return [];
  }

  return trimmed
    .split('|')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

const parseCustomDates = (value: string | undefined): readonly WasteCustomTourDate[] | undefined => {
  const entries = parseDelimitedStringArray(value);
  if (entries.length === 0) {
    return undefined;
  }

  return entries.map((date) => ({ date }));
};

const ensureRequiredColumns = (
  headers: readonly string[],
  requiredColumns: readonly { readonly key: string }[],
  profileId: WasteManagementImportProfileId
): void => {
  const headerSet = new Set(headers);
  for (const column of requiredColumns) {
    if (!headerSet.has(column.key)) {
      throw new Error(`missing_import_column:${profileId}:${column.key}`);
    }
  }
};

const defaultReadBinarySource = async (blobRef: string): Promise<Uint8Array> => {
  if (blobRef.startsWith('data:')) {
    const separatorIndex = blobRef.indexOf(',');
    if (separatorIndex < 0) {
      throw new Error('invalid_blob_ref:data_url');
    }
    const metadata = blobRef.slice(5, separatorIndex);
    const payload = blobRef.slice(separatorIndex + 1);
    if (metadata.endsWith(';base64')) {
      return Buffer.from(payload, 'base64');
    }
    return Buffer.from(decodeURIComponent(payload), 'utf8');
  }

  if (blobRef.startsWith('blob:')) {
    throw new Error('unsupported_blob_ref:blob_url');
  }

  const resolvedPath = blobRef.startsWith('file://') ? new URL(blobRef) : resolvePath(process.cwd(), blobRef);
  return readFile(resolvedPath);
};

const defaultCreatePool = (connectionString: string): WasteOperationSqlPool =>
  new Pool({
    connectionString,
    max: 2,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 5_000,
  });

const resolveRuntimeDataSource = async (
  deps: WasteOperationRuntimeDeps,
  instanceId: string
): Promise<ResolvedWasteDataSource> =>
  resolveWasteDataSource({
    instanceId,
    loadRecord: deps.loadDataSourceRecord ?? loadWasteDataSourceRecord,
    revealSecret:
      deps.revealSecret ??
      ((ciphertext, aad) => {
        if (aad === buildWasteDatabaseUrlAad(instanceId) || aad === buildWasteServiceRoleKeyAad(instanceId)) {
          return revealField(ciphertext, aad) ?? undefined;
        }
        return undefined;
      }),
  });

const setWasteSearchPath = async (client: SqlClient, schemaName: string): Promise<void> => {
  await client.query(`SET search_path TO ${quoteIdentifier(schemaName)}, public;`);
};

const inspectWasteSchema = async (client: SqlClient, schemaName: string) => {
  const tableQuery = await client.query<{ readonly table_name: string }>(
    `
SELECT table_name
FROM information_schema.tables
WHERE table_schema = $1
  AND table_name = ANY($2::text[])
ORDER BY table_name ASC;
`,
    [schemaName, [...requiredWasteTables]]
  );

  const presentTables = tableQuery.rows.map((row) => row.table_name);
  const missingTables = requiredWasteTables.filter((tableName) => !presentTables.includes(tableName));

  return {
    schemaName,
    presentTables,
    missingTables,
  };
};

const applySchemaStatements = (schemaName: string): readonly string[] => {
  const schema = quoteIdentifier(schemaName);

  return [
    'CREATE EXTENSION IF NOT EXISTS pgcrypto;',
    'CREATE EXTENSION IF NOT EXISTS btree_gist;',
    `CREATE SCHEMA IF NOT EXISTS ${schema};`,
    `CREATE TABLE IF NOT EXISTS ${schema}.waste_regions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
    `CREATE TABLE IF NOT EXISTS ${schema}.waste_cities (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      region_id UUID REFERENCES ${schema}.waste_regions(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
    `CREATE TABLE IF NOT EXISTS ${schema}.waste_streets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      city_id UUID NOT NULL REFERENCES ${schema}.waste_cities(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
    `CREATE TABLE IF NOT EXISTS ${schema}.waste_house_numbers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      number TEXT NOT NULL,
      street_id UUID NOT NULL REFERENCES ${schema}.waste_streets(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
    `CREATE TABLE IF NOT EXISTS ${schema}.waste_collection_locations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      city_id UUID NOT NULL REFERENCES ${schema}.waste_cities(id) ON DELETE CASCADE,
      region_id UUID REFERENCES ${schema}.waste_regions(id) ON DELETE SET NULL,
      street_id UUID REFERENCES ${schema}.waste_streets(id) ON DELETE SET NULL,
      house_number_id UUID REFERENCES ${schema}.waste_house_numbers(id) ON DELETE SET NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
    `CREATE TABLE IF NOT EXISTS ${schema}.waste_fractions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      label_translations JSONB,
      container_size TEXT,
      color TEXT NOT NULL DEFAULT '#808080',
      description TEXT,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
    `CREATE TABLE IF NOT EXISTS ${schema}.waste_tours (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      description TEXT,
      waste_fraction_ids TEXT[] NOT NULL DEFAULT '{}',
      recurrence TEXT CHECK (recurrence IN ('weekly', 'biweekly', 'fourweekly', 'yearly', 'on-demand', 'custom')),
      first_date DATE,
      end_date DATE,
      custom_dates JSONB,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
    `CREATE TABLE IF NOT EXISTS ${schema}.waste_location_tour_links (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      location_id UUID NOT NULL REFERENCES ${schema}.waste_collection_locations(id) ON DELETE CASCADE,
      tour_id UUID NOT NULL REFERENCES ${schema}.waste_tours(id) ON DELETE CASCADE,
      start_date DATE,
      end_date DATE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
    `CREATE TABLE IF NOT EXISTS ${schema}.waste_tour_date_shifts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tour_id UUID NOT NULL REFERENCES ${schema}.waste_tours(id) ON DELETE CASCADE,
      original_date TEXT NOT NULL,
      actual_date TEXT NOT NULL,
      has_year BOOLEAN NOT NULL DEFAULT TRUE,
      reason_type TEXT,
      reason_key TEXT,
      follow_up_mode TEXT,
      description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
    `CREATE TABLE IF NOT EXISTS ${schema}.waste_global_date_shifts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      original_date TEXT NOT NULL,
      actual_date TEXT NOT NULL,
      has_year BOOLEAN NOT NULL DEFAULT TRUE,
      reason_type TEXT,
      reason_key TEXT,
      description TEXT,
      tour_ids TEXT[],
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
    `CREATE INDEX IF NOT EXISTS idx_waste_regions_name ON ${schema}.waste_regions(name);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_cities_name ON ${schema}.waste_cities(name);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_cities_region_id ON ${schema}.waste_cities(region_id);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_streets_name ON ${schema}.waste_streets(name);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_streets_city_id ON ${schema}.waste_streets(city_id);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_house_numbers_number ON ${schema}.waste_house_numbers(number);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_house_numbers_street_id ON ${schema}.waste_house_numbers(street_id);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_collection_locations_city_id ON ${schema}.waste_collection_locations(city_id);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_collection_locations_region_id ON ${schema}.waste_collection_locations(region_id);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_collection_locations_street_id ON ${schema}.waste_collection_locations(street_id);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_collection_locations_house_number_id ON ${schema}.waste_collection_locations(house_number_id);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_collection_locations_active ON ${schema}.waste_collection_locations(active);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_fractions_name ON ${schema}.waste_fractions(name);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_fractions_active ON ${schema}.waste_fractions(active);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_tours_name ON ${schema}.waste_tours(name);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_tours_active ON ${schema}.waste_tours(active);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_tours_recurrence ON ${schema}.waste_tours(recurrence);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_tours_waste_fraction_ids ON ${schema}.waste_tours USING GIN(waste_fraction_ids);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_location_tour_links_location_id ON ${schema}.waste_location_tour_links(location_id);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_location_tour_links_tour_id ON ${schema}.waste_location_tour_links(tour_id);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_location_tour_links_dates ON ${schema}.waste_location_tour_links(start_date, end_date);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_tour_date_shifts_tour_id ON ${schema}.waste_tour_date_shifts(tour_id);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_tour_date_shifts_original ON ${schema}.waste_tour_date_shifts(original_date);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_global_date_shifts_original ON ${schema}.waste_global_date_shifts(original_date);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_global_date_shifts_has_year ON ${schema}.waste_global_date_shifts(has_year);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_global_date_shifts_tour_ids ON ${schema}.waste_global_date_shifts USING GIN(tour_ids);`,
  ];
};

const withWasteClient = async <T>(
  deps: WasteOperationRuntimeDeps,
  instanceId: string,
  work: (input: {
    readonly dataSource: ResolvedWasteDataSource;
    readonly client: SqlClient;
    readonly repository: ReturnType<typeof createWasteMasterDataRepository>;
  }) => Promise<T>
): Promise<T> => {
  const dataSource = await resolveRuntimeDataSource(deps, instanceId);
  const pool = (deps.createPool ?? defaultCreatePool)(dataSource.databaseUrl);

  try {
    const client = await pool.connect();
    try {
      await setWasteSearchPath(client, dataSource.schemaName);
      const repository = createWasteMasterDataRepository(createSqlExecutor(client));
      return await work({ dataSource, client, repository });
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
};

const parseImportWorkbookRows = (source: Uint8Array): readonly Record<string, string>[] => {
  const workbook = XLSX.read(source, {
    type: 'array',
    raw: false,
  });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return [];
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: '',
  });

  return rawRows.map((row: Record<string, unknown>) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : String(value ?? '')])
    )
  );
};

const parseRecurrence = (value: string | undefined): WasteTourRecurrence | undefined => {
  const trimmed = normalizeOptionalText(value);
  if (!trimmed) {
    return undefined;
  }

  const allowedValues = new Set<WasteTourRecurrence>(['weekly', 'biweekly', 'fourweekly', 'yearly', 'on-demand', 'custom']);
  if (!allowedValues.has(trimmed as WasteTourRecurrence)) {
    throw new Error(`invalid_recurrence:${trimmed}`);
  }

  return trimmed as WasteTourRecurrence;
};

const parseReasonType = (value: string | undefined): WasteDateShiftReasonType | undefined => {
  const trimmed = normalizeOptionalText(value);
  if (!trimmed) {
    return undefined;
  }

  if (!wasteManagementMasterDataContract.isDateShiftReasonType(trimmed)) {
    throw new Error(`invalid_reason_type:${trimmed}`);
  }

  return trimmed;
};

const parseFollowUpMode = (value: string | undefined): WasteTourDateShiftFollowUpMode | undefined => {
  const trimmed = normalizeOptionalText(value);
  if (!trimmed) {
    return undefined;
  }

  if (!wasteManagementMasterDataContract.isTourDateShiftFollowUpMode(trimmed)) {
    throw new Error(`invalid_follow_up_mode:${trimmed}`);
  }

  return trimmed;
};

const executeImport = async (
  repository: ReturnType<typeof createWasteMasterDataRepository>,
  input: {
    readonly profileId: WasteManagementImportProfileId;
    readonly rows: readonly Record<string, string>[];
    readonly dryRun: boolean;
  }
) => {
  const counts = {
    rows: input.rows.length,
    upserts: 0,
  };

  if (input.profileId === 'waste-management.geografie-abholorte') {
    for (const row of input.rows) {
      await repository.upsertWasteRegion({
        id: row.region_id,
        name: row.region_name,
      });
      counts.upserts += 1;

      await repository.upsertWasteCity({
        id: row.city_id,
        name: row.city_name,
        regionId: row.region_id,
      });
      counts.upserts += 1;

      if (normalizeOptionalText(row.street_id) && normalizeOptionalText(row.street_name)) {
        await repository.upsertWasteStreet({
          id: row.street_id,
          name: row.street_name,
          cityId: row.city_id,
        });
        counts.upserts += 1;
      }

      if (normalizeOptionalText(row.house_number_id) && normalizeOptionalText(row.house_number_value) && normalizeOptionalText(row.street_id)) {
        await repository.upsertWasteHouseNumber({
          id: row.house_number_id,
          number: row.house_number_value,
          streetId: row.street_id,
        });
        counts.upserts += 1;
      }

      await repository.upsertWasteCollectionLocation({
        id: row.location_id,
        regionId: normalizeOptionalText(row.region_id),
        cityId: row.city_id,
        streetId: normalizeOptionalText(row.street_id),
        houseNumberId: normalizeOptionalText(row.house_number_id),
        active: parseBoolean(row.active, 'active'),
      });
      counts.upserts += 1;
    }

    return counts;
  }

  if (input.profileId === 'waste-management.touren') {
    for (const row of input.rows) {
      await repository.upsertWasteTour({
        id: row.tour_id,
        name: row.tour_name,
        description: normalizeOptionalText(row.description),
        wasteFractionIds: parseDelimitedStringArray(row.waste_fraction_ids),
        recurrence: parseRecurrence(row.recurrence) ?? null,
        firstDate: normalizeOptionalText(row.first_date),
        endDate: normalizeOptionalText(row.end_date),
        customDates: parseCustomDates(row.custom_dates),
        active: parseBoolean(row.active, 'active'),
      });
      counts.upserts += 1;
    }

    return counts;
  }

  for (const row of input.rows) {
    const shiftContext = normalizeOptionalText(row.shift_context);
    if (shiftContext !== 'global' && shiftContext !== 'tour') {
      throw new Error(`invalid_shift_context:${row.shift_context}`);
    }

    if (shiftContext === 'tour') {
      const tourId = normalizeOptionalText(row.tour_id);
      if (!tourId) {
        throw new Error(`missing_tour_id:${row.shift_id}`);
      }

      await repository.upsertWasteTourDateShift({
        id: row.shift_id,
        tourId,
        originalDate: row.original_date,
        actualDate: row.actual_date,
        hasYear: parseBoolean(row.has_year, 'has_year'),
        reasonType: parseReasonType(row.reason_type),
        reasonKey: normalizeOptionalText(row.reason_key),
        followUpMode: parseFollowUpMode(row.follow_up_mode),
        description: normalizeOptionalText(row.description),
      });
      counts.upserts += 1;
      continue;
    }

    await repository.upsertWasteGlobalDateShift({
      id: row.shift_id,
      originalDate: row.original_date,
      actualDate: row.actual_date,
      hasYear: parseBoolean(row.has_year, 'has_year'),
      reasonType: parseReasonType(row.reason_type),
      reasonKey: normalizeOptionalText(row.reason_key),
      description: normalizeOptionalText(row.description),
      tourIds: parseDelimitedStringArray(row.tour_ids),
    });
    counts.upserts += 1;
  }

  return counts;
};

const seedWasteBaseline = async (repository: ReturnType<typeof createWasteMasterDataRepository>) => {
  await repository.upsertWasteRegion({
    id: baselineIds.region,
    name: 'Musterregion',
  });
  await repository.upsertWasteCity({
    id: baselineIds.city,
    name: 'Musterstadt',
    regionId: baselineIds.region,
  });
  await repository.upsertWasteStreet({
    id: baselineIds.street,
    name: 'Hauptstraße',
    cityId: baselineIds.city,
  });
  await repository.upsertWasteHouseNumber({
    id: baselineIds.houseNumber,
    number: '42',
    streetId: baselineIds.street,
  });
  await repository.upsertWasteCollectionLocation({
    id: baselineIds.location,
    cityId: baselineIds.city,
    regionId: baselineIds.region,
    streetId: baselineIds.street,
    houseNumberId: baselineIds.houseNumber,
    active: true,
  });
  await repository.upsertWasteFraction({
    id: baselineIds.fractionRest,
    name: 'Restmüll',
    translations: { de: 'Restmüll', en: 'Residual waste' },
    containerSize: '120l',
    color: '#4B5563',
    description: 'Baseline-Fraktion für Seed-Daten',
    active: true,
  });
  await repository.upsertWasteFraction({
    id: baselineIds.fractionBio,
    name: 'Biotonne',
    translations: { de: 'Biotonne', en: 'Organic waste' },
    containerSize: '120l',
    color: '#16A34A',
    description: 'Baseline-Fraktion für Seed-Daten',
    active: true,
  });
  await repository.upsertWasteTour({
    id: baselineIds.tour,
    name: 'Baseline-Tour',
    description: 'Automatisch angelegte Seed-Tour',
    wasteFractionIds: [baselineIds.fractionRest, baselineIds.fractionBio],
    recurrence: 'weekly',
    firstDate: '2026-01-12',
    endDate: '2026-12-31',
    customDates: undefined,
    active: true,
  });
  await repository.upsertWasteLocationTourLink({
    id: baselineIds.link,
    locationId: baselineIds.location,
    tourId: baselineIds.tour,
    startDate: '2026-01-12',
    endDate: undefined,
  });
  await repository.upsertWasteTourDateShift({
    id: baselineIds.tourShift,
    tourId: baselineIds.tour,
    originalDate: '2026-04-03',
    actualDate: '2026-04-04',
    hasYear: true,
    reasonType: 'holiday',
    reasonKey: 'good-friday',
    followUpMode: 'propagate-series',
    description: 'Seed-Verschiebung für Feiertagslogik',
  });
  await repository.upsertWasteGlobalDateShift({
    id: baselineIds.globalShift,
    originalDate: '2026-12-25',
    actualDate: '2026-12-24',
    hasYear: true,
    reasonType: 'holiday',
    reasonKey: 'christmas-day',
    description: 'Globale Seed-Verschiebung',
    tourIds: [baselineIds.tour],
  });
};

const parseImportRows = async (
  deps: WasteOperationRuntimeDeps,
  input: {
    readonly profileId: WasteManagementImportProfileId;
    readonly sourceFormat: WasteManagementImportSourceFormat;
    readonly blobRef?: string;
  }
): Promise<readonly Record<string, string>[]> => {
  if (!input.blobRef) {
    throw new Error('missing_blob_ref');
  }

  const catalogEntry = getWasteManagementImportCatalogEntry(input.profileId);
  if (!catalogEntry) {
    throw new Error(`unknown_import_profile:${input.profileId}`);
  }

  const source = await (deps.readBinarySource ?? defaultReadBinarySource)(input.blobRef);
  const rows = parseImportWorkbookRows(source);
  const headers = rows[0] ? Object.keys(rows[0]) : [];
  ensureRequiredColumns(headers, catalogEntry.requiredColumns, input.profileId);
  return rows;
};

const buildOperationSummary = (startedAt: number, details: Record<string, unknown>): OperationSummary => ({
  durationMs: Math.max(1, Date.now() - startedAt),
  details,
});

export type WasteManagementOperationRuntime = {
  initializeDataSource: (instanceId: string, input: WasteManagementInitializeJobInput) => Promise<OperationSummary>;
  applyMigrations: (instanceId: string, input: WasteManagementApplyMigrationsJobInput) => Promise<OperationSummary>;
  importData: (instanceId: string, input: WasteManagementImportJobInput) => Promise<OperationSummary>;
  seedData: (instanceId: string, input: WasteManagementSeedJobInput) => Promise<OperationSummary>;
  resetData: (instanceId: string, input: WasteManagementResetJobInput) => Promise<OperationSummary>;
};

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

      const schemaInspection = await inspectWasteSchema(client, schemaName);
      return {
        operation: 'apply-migrations',
        mode: 'executed',
        requestedByVersion: normalizeOptionalText(input.requestedByVersion),
        schemaInspection,
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

      const counts = await executeImport(repository, {
        profileId: input.importProfileId,
        rows,
        dryRun: false,
      });
      return {
        operation: 'import-data',
        mode: 'executed',
        importProfileId: input.importProfileId,
        sourceFormat: input.sourceFormat,
        dryRun: false,
        ...counts,
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
