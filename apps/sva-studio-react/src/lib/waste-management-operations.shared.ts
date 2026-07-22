import {
  createWasteMasterDataRepository,
  type SqlExecutionResult,
  type SqlExecutor,
  type SqlStatement,
} from '@sva/data-repositories';
import { loadDefaultExternalInterfaceRecord } from '@sva/data-repositories/server';
import {
  findSelectedWasteManagementInterfaceRecord,
} from '@sva/core';
import type {
  ExternalInterfaceRecord,
  WasteCustomTourDate,
  WasteDateShiftReasonType,
  WasteManagementImportProfileId,
  WasteTourDateShiftFollowUpMode,
  WasteTourRecurrence,
} from '@sva/core';
import { revealField } from '@sva/auth-runtime/server';
import {
  resolveWasteDataSource,
  type ResolvedWasteDataSource,
} from '@sva/server-runtime';
import { Pool } from 'pg';

import type {
  OperationSummary,
  SqlClient,
  WasteOperationRuntimeDeps,
  WasteOperationSqlPool,
} from './waste-management-operations.types.js';

const schemaIdentifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;

export const requiredWasteTables = [
  'waste_regions',
  'waste_cities',
  'waste_streets',
  'waste_house_numbers',
  'waste_collection_locations',
  'waste_fractions',
  'waste_custom_recurrence_presets',
  'waste_tours',
  'waste_location_tour_links',
  'waste_location_tour_pickup_dates',
  'waste_tour_assignments',
  'waste_tour_assignment_locations',
  'waste_email_reminder_subscriptions',
  'waste_email_reminder_subscription_items',
  'waste_email_reminder_outbox',
  'waste_tour_date_shifts',
  'waste_global_date_shifts',
  'waste_holiday_rules',
  'waste_settings',
] as const;

export const quoteIdentifier = (value: string): string => {
  if (!schemaIdentifierPattern.test(value)) {
    throw new Error(`invalid_waste_schema:${value}`);
  }
  return `"${value}"`;
};

export const createSqlExecutor = (client: {
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

export const normalizeOptionalText = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

export const parseBoolean = (value: string, fieldName: string): boolean => {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
    return true;
  }
  if (normalized === 'false' || normalized === '0' || normalized === 'no') {
    return false;
  }
  throw new Error(`invalid_boolean:${fieldName}`);
};

export const parseDelimitedStringArray = (value: string | undefined): readonly string[] => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return [];
  }
  return trimmed
    .split('|')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

export const parseCustomDates = (value: string | undefined): readonly WasteCustomTourDate[] | undefined => {
  const entries = parseDelimitedStringArray(value);
  return entries.length > 0 ? entries.map((date) => ({ date })) : undefined;
};

export const ensureRequiredColumns = (
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

export const parseRecurrence = (value: string | undefined): WasteTourRecurrence | undefined => {
  const trimmed = normalizeOptionalText(value);
  if (!trimmed) {
    return undefined;
  }
  const allowedValues = new Set<WasteTourRecurrence>([
    'weekly',
    'biweekly',
    'fourweekly',
    'yearly',
    'on-demand',
    'custom',
  ]);
  if (!allowedValues.has(trimmed as WasteTourRecurrence)) {
    throw new Error(`invalid_recurrence:${trimmed}`);
  }
  return trimmed as WasteTourRecurrence;
};

export const parseReasonType = (
  contract: {
    isDateShiftReasonType: (value: string) => value is WasteDateShiftReasonType;
  },
  value: string | undefined
): WasteDateShiftReasonType | undefined => {
  const trimmed = normalizeOptionalText(value);
  if (!trimmed) {
    return undefined;
  }
  if (!contract.isDateShiftReasonType(trimmed)) {
    throw new Error(`invalid_reason_type:${trimmed}`);
  }
  return trimmed;
};

export const parseFollowUpMode = (
  contract: {
    isTourDateShiftFollowUpMode: (value: string) => value is WasteTourDateShiftFollowUpMode;
  },
  value: string | undefined
): WasteTourDateShiftFollowUpMode | undefined => {
  const trimmed = normalizeOptionalText(value);
  if (!trimmed) {
    return undefined;
  }
  if (!contract.isTourDateShiftFollowUpMode(trimmed)) {
    throw new Error(`invalid_follow_up_mode:${trimmed}`);
  }
  return trimmed;
};

export const defaultReadBinarySource = async (blobRef: string): Promise<Uint8Array> => {
  if (blobRef.startsWith('data:')) {
    const separatorIndex = blobRef.indexOf(',');
    if (separatorIndex < 0) {
      throw new Error('invalid_blob_ref:data_url');
    }
    const metadata = blobRef.slice(5, separatorIndex);
    const payload = blobRef.slice(separatorIndex + 1);
    return metadata.endsWith(';base64')
      ? Buffer.from(payload, 'base64')
      : Buffer.from(decodeURIComponent(payload), 'utf8');
  }
  if (blobRef.startsWith('blob:')) {
    throw new Error('unsupported_blob_ref:blob_url');
  }
  throw new Error('unsupported_blob_ref:local_file');
};

export const defaultCreatePool = (connectionString: string): WasteOperationSqlPool =>
  new Pool({
    connectionString,
    max: 2,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 5_000,
  });

const loadSelectedWasteInterfaceRecord = async (
  deps: WasteOperationRuntimeDeps,
  instanceId: string
): Promise<ExternalInterfaceRecord | null> => {
  if (!deps.listInterfaceRecords) {
    return await (deps.loadDefaultInterfaceRecord ?? loadDefaultExternalInterfaceRecord)(instanceId, 'supabase');
  }

  const records = await deps.listInterfaceRecords(instanceId);
  return findSelectedWasteManagementInterfaceRecord(records) ?? (await (deps.loadDefaultInterfaceRecord ?? loadDefaultExternalInterfaceRecord)(instanceId, 'supabase'));
};

export const resolveRuntimeDataSource = async (
  deps: WasteOperationRuntimeDeps,
  instanceId: string
): Promise<ResolvedWasteDataSource> =>
  resolveWasteDataSource({
    instanceId,
    loadDefaultInterface: async () => await loadSelectedWasteInterfaceRecord(deps, instanceId),
    revealSecret: deps.revealSecret ?? ((ciphertext, aad) => revealField(ciphertext, aad) ?? undefined),
  });

export const setWasteSearchPath = async (client: SqlClient, schemaName: string): Promise<void> => {
  await client.query(`SET search_path TO ${quoteIdentifier(schemaName)}, public;`);
};

export const withWasteClient = async <T>(
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

export const buildOperationSummary = (startedAt: number, details: Record<string, unknown>): OperationSummary => ({
  durationMs: Math.max(1, Date.now() - startedAt),
  details,
});
