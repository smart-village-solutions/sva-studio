import {
  createWasteMasterDataRepository,
  type SqlExecutionResult,
  type SqlExecutor,
  type SqlStatement,
} from '@sva/data-repositories';
import { listExternalInterfaceRecords, loadDefaultExternalInterfaceRecord } from '@sva/data-repositories/server';
import {
  findSelectedWasteManagementInterfaceRecord,
  WasteCollectionLocationRecord,
  type WasteCustomRecurrencePresetRecord,
  WasteGlobalDateShiftRecord,
  type WasteHolidayRuleRecord,
  type WasteHolidayStateCode,
  type WasteHolidaySyncStatus,
  WasteHouseNumberRecord,
  WasteLocationTourPickupDateRecord,
  WasteLocationTourLinkBulkCreateInput,
  WasteLocationTourLinkRecord,
  WasteManagementHistoryOverview,
  WasteManagementMasterDataOverview,
  WasteManagementSchedulingOverview,
  WasteManagementTechnicalHistoryRecord,
  WasteManagementToursOverview,
  WasteRegionRecord,
  WasteStreetRecord,
  WasteTourDateShiftRecord,
  type WasteTourRecurrence,
  WasteTourRecord,
} from '@sva/core';
import { createSdkLogger, resolveWasteDataSource } from '@sva/server-runtime';
import { listWasteManagementAuditRecords, listWasteManagementTechnicalAuditRecords } from '@sva/iam-governance';
import { Pool } from 'pg';

import { withInstanceDb } from '../db.js';
import { revealField } from '../iam-account-management/encryption.js';
import { buildWasteHolidayApiUrl, deriveHolidayRuleConfigurationStatus, normalizeWasteHolidayApiResponse, wasteHolidaySyncHorizonYears } from './core/holiday-sync.js';
import type { SaveWasteCustomRecurrencePresetsInput } from './core/types.js';
import { previewWasteLocationTourPickupDateImport as buildWasteLocationTourPickupDateImportPreview } from './import-preview.js';

const schemaIdentifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;
const logger = createSdkLogger({ component: 'waste-management-auth-runtime', level: 'info' });

const quoteIdentifier = (value: string): string => {
  if (!schemaIdentifierPattern.test(value)) {
    throw new Error(`invalid_waste_schema:${value}`);
  }
  return `"${value}"`;
};

const setWasteSearchPath = async (
  client: {
    query: <TRow = Record<string, unknown>>(text: string, values?: readonly unknown[]) => Promise<{
      readonly rowCount: number | null;
      readonly rows: readonly TRow[];
    }>;
  },
  schemaName: string
): Promise<void> => {
  await client.query(`SET search_path TO ${quoteIdentifier(schemaName)}, public;`);
};

const createSqlExecutor = (
  client: {
    query: <TRow = Record<string, unknown>>(text: string, values?: readonly unknown[]) => Promise<{
      readonly rowCount: number | null;
      readonly rows: readonly TRow[];
    }>;
  }
): SqlExecutor => ({
  async execute<TRow = Record<string, unknown>>(statement: SqlStatement): Promise<SqlExecutionResult<TRow>> {
    const result = await client.query<TRow>(statement.text, statement.values);
    return {
      rowCount: result.rowCount ?? 0,
      rows: result.rows,
    };
  },
});

type WasteRepository = ReturnType<typeof createWasteMasterDataRepository>;
type WasteDataSource = Awaited<ReturnType<typeof resolveWasteDataSource>>;
type WasteTechnicalJobHistoryRow = {
  readonly id: string;
  readonly job_type_id: string;
  readonly status: 'succeeded' | 'failed' | 'cancelled';
  readonly finished_at: string | Date | null;
  readonly updated_at: string | Date;
  readonly request_id: string | null;
  readonly latest_event_message: string | null;
  readonly error_code: string | null;
  readonly error_message: string | null;
  readonly total_count: number;
};
type WasteTechnicalJobHistoryCountRow = {
  readonly total_count: number;
};
type WastePoolEntry = {
  readonly key: string;
  readonly dataSource: WasteDataSource;
  readonly pool: Pool;
  lastUsedAt: number;
};

const toIsoTimestamp = (value: string | Date): string => (value instanceof Date ? value.toISOString() : value);

const wastePoolCache = new Map<string, WastePoolEntry>();
const WASTE_POOL_IDLE_TTL_MS = 5 * 60 * 1_000;
const WASTE_POOL_MAX_ENTRIES = 32;

const measureWasteStep = async <T>(
  operation: string,
  step: string,
  metadata: Record<string, unknown>,
  work: () => Promise<T>
): Promise<T> => {
  const startedAt = Date.now();
  try {
    return await work();
  } finally {
    logger.info('waste_management_loader_timing', {
      operation,
      step,
      duration_ms: Date.now() - startedAt,
      ...metadata,
    });
  }
};

const measureWasteRepositoryStep = <T>(
  instanceId: string,
  operation: string,
  repositoryStep: string,
  work: () => Promise<T>
): Promise<T> =>
  measureWasteStep(operation, `repository.${repositoryStep}`, { instance_id: instanceId }, work);

const createWastePoolKey = (dataSource: WasteDataSource): string => `${dataSource.databaseUrl}::${dataSource.schemaName}`;

const loadSelectedWasteInterfaceRecord = async (instanceId: string) => {
  const records = await listExternalInterfaceRecords(instanceId);
  return findSelectedWasteManagementInterfaceRecord(records) ?? (await loadDefaultExternalInterfaceRecord(instanceId, 'supabase'));
};

const resolveScopedWasteDataSource = (instanceId: string, operation: string): Promise<WasteDataSource> =>
  measureWasteStep(operation, 'resolve_data_source', { instance_id: instanceId }, async () =>
    resolveWasteDataSource({
      instanceId,
      loadDefaultInterface: async () => await loadSelectedWasteInterfaceRecord(instanceId),
      revealSecret: (ciphertext, aad) => revealField(ciphertext, aad) ?? undefined,
    })
  );

const closeWastePoolEntry = async (entry: WastePoolEntry): Promise<void> => {
  const cachedEntry = wastePoolCache.get(entry.key);
  if (cachedEntry === entry) {
    wastePoolCache.delete(entry.key);
  }
  await entry.pool.end();
};

const evictExpiredWastePoolEntries = async (now = Date.now()): Promise<void> => {
  const expiredEntries = [...wastePoolCache.values()].filter((entry) => now - entry.lastUsedAt >= WASTE_POOL_IDLE_TTL_MS);
  await Promise.all(expiredEntries.map(async (entry) => closeWastePoolEntry(entry)));
};

const evictLeastRecentlyUsedWastePoolEntry = async (): Promise<void> => {
  const oldestEntry = [...wastePoolCache.values()].reduce<WastePoolEntry | null>(
    (oldest, candidate) => (oldest === null || candidate.lastUsedAt < oldest.lastUsedAt ? candidate : oldest),
    null
  );
  if (oldestEntry) {
    await closeWastePoolEntry(oldestEntry);
  }
};

const getOrCreateWastePoolEntry = async (dataSource: WasteDataSource, now = Date.now()): Promise<WastePoolEntry> => {
  await evictExpiredWastePoolEntries(now);

  const key = createWastePoolKey(dataSource);
  const existingEntry = wastePoolCache.get(key);
  if (existingEntry) {
    existingEntry.lastUsedAt = now;
    return existingEntry;
  }

  if (wastePoolCache.size >= WASTE_POOL_MAX_ENTRIES) {
    await evictLeastRecentlyUsedWastePoolEntry();
  }

  const nextEntry: WastePoolEntry = {
    key,
    dataSource,
    pool: new Pool({
      connectionString: dataSource.databaseUrl,
      max: 2,
      idleTimeoutMillis: 5_000,
      connectionTimeoutMillis: 5_000,
    }),
    lastUsedAt: now,
  };
  wastePoolCache.set(key, nextEntry);
  return nextEntry;
};

const resetWastePoolCache = async (): Promise<void> => {
  const entries = [...wastePoolCache.values()];
  wastePoolCache.clear();
  await Promise.all(entries.map(async (entry) => entry.pool.end()));
};

const withWasteClient = async <T>(
  instanceId: string,
  operation: string,
  work: (client: {
    query: <TRow = Record<string, unknown>>(text: string, values?: readonly unknown[]) => Promise<{
      readonly rowCount: number | null;
      readonly rows: readonly TRow[];
    }>;
    release: () => void;
  }) => Promise<T>
): Promise<T> => {
  const dataSource = await resolveScopedWasteDataSource(instanceId, operation);
  const poolEntry = await getOrCreateWastePoolEntry(dataSource);

  const client = await measureWasteStep(
    operation,
    'acquire_pool_client',
    { instance_id: instanceId, schema_name: dataSource.schemaName },
    async () => {
      try {
        return await poolEntry.pool.connect();
      } catch (error) {
        await closeWastePoolEntry(poolEntry);
        throw error;
      }
    }
  );

  try {
    try {
      await measureWasteStep(
        operation,
        'set_search_path',
        { instance_id: instanceId, schema_name: dataSource.schemaName },
        async () => setWasteSearchPath(client, dataSource.schemaName)
      );
    } catch (error) {
      await closeWastePoolEntry(poolEntry);
      throw error;
    }

    poolEntry.lastUsedAt = Date.now();
    return await work(client);
  } finally {
    client.release();
  }
};

const withWasteRepository = async <T>(
  instanceId: string,
  operation: string,
  work: (repository: WasteRepository) => Promise<T>
): Promise<T> =>
  withWasteClient(instanceId, operation, async (client) => work(createWasteMasterDataRepository(createSqlExecutor(client))));

const createLoader =
  <TArgs extends readonly unknown[], TResult>(
    operation: string,
    work: (repository: WasteRepository, ...args: TArgs) => Promise<TResult>
  ) =>
  (instanceId: string, ...args: TArgs) =>
    withWasteRepository(instanceId, operation, (repository) => work(repository, ...args));

const wasteDefaultTourRecurrenceValues = new Set<WasteTourRecurrence>([
  'weekly',
  'biweekly',
  'fourweekly',
  'yearly',
  'on-demand',
  'custom',
]);

const isWasteTourRecurrence = (value: string): value is WasteTourRecurrence =>
  wasteDefaultTourRecurrenceValues.has(value as WasteTourRecurrence);

const listWasteToursForCustomRecurrencePresets = async (
  repository: WasteRepository,
  instanceId: string
): Promise<readonly WasteTourRecord[]> =>
  measureWasteRepositoryStep(
    instanceId,
    'save_waste_custom_recurrence_presets',
    'list_waste_tours',
    () => repository.listWasteTours()
  );

const assertDeletedPresetFallback = ({
  presetId,
  fallback,
  nextPresetMap,
}: {
  readonly presetId: string;
  readonly fallback: SaveWasteCustomRecurrencePresetsInput['deletedPresetFallbacks'][string] | undefined;
  readonly nextPresetMap: ReadonlyMap<string, Omit<WasteCustomRecurrencePresetRecord, 'createdAt' | 'updatedAt'>>;
}): void => {
  if (!fallback) {
    throw new Error(`custom_recurrence_fallback_required:${presetId}`);
  }

  if (fallback.kind === 'preset') {
    if (!nextPresetMap.has(fallback.value)) {
      throw new Error(`custom_recurrence_fallback_invalid:${presetId}`);
    }
    return;
  }

  if (!isWasteTourRecurrence(fallback.value)) {
    throw new Error(`custom_recurrence_fallback_invalid:${presetId}`);
  }
};

const validateDeletedPresetFallbacks = ({
  tours,
  deletedPresetIds,
  deletedPresetFallbacks,
  nextPresetMap,
}: {
  readonly tours: readonly WasteTourRecord[];
  readonly deletedPresetIds: readonly string[];
  readonly deletedPresetFallbacks: SaveWasteCustomRecurrencePresetsInput['deletedPresetFallbacks'];
  readonly nextPresetMap: ReadonlyMap<string, Omit<WasteCustomRecurrencePresetRecord, 'createdAt' | 'updatedAt'>>;
}): void => {
  for (const presetId of deletedPresetIds) {
    const hasAffectedTours = tours.some((tour) => tour.customRecurrenceId === presetId);
    if (!hasAffectedTours) {
      continue;
    }

    assertDeletedPresetFallback({
      presetId,
      fallback: deletedPresetFallbacks[presetId],
      nextPresetMap,
    });
  }
};

const reassignToursToFallback = async ({
  repository,
  instanceId,
  presetId,
  fallback,
  affectedTours,
  nextPresetMap,
}: {
  readonly repository: WasteRepository;
  readonly instanceId: string;
  readonly presetId: string;
  readonly fallback: NonNullable<SaveWasteCustomRecurrencePresetsInput['deletedPresetFallbacks'][string]>;
  readonly affectedTours: readonly WasteTourRecord[];
  readonly nextPresetMap: ReadonlyMap<string, Omit<WasteCustomRecurrencePresetRecord, 'createdAt' | 'updatedAt'>>;
}): Promise<void> => {
  if (fallback.kind === 'preset') {
    const fallbackPreset = nextPresetMap.get(fallback.value);
    if (!fallbackPreset) {
      throw new Error(`custom_recurrence_fallback_invalid:${presetId}`);
    }

    for (const tour of affectedTours) {
      await measureWasteRepositoryStep(
        instanceId,
        'save_waste_custom_recurrence_presets',
        'reassign_waste_tour_custom_recurrence_preset',
        () =>
          repository.upsertWasteTour({
            ...tour,
            recurrence: null,
            customRecurrenceId: fallbackPreset.id,
            customRecurrenceName: fallbackPreset.name,
            customRecurrenceIntervalDays: fallbackPreset.intervalDays,
          })
      );
    }
    return;
  }

  if (!isWasteTourRecurrence(fallback.value)) {
    throw new Error(`custom_recurrence_fallback_invalid:${presetId}`);
  }
  const fallbackRecurrence: WasteTourRecurrence = fallback.value;

  for (const tour of affectedTours) {
    await measureWasteRepositoryStep(
      instanceId,
      'save_waste_custom_recurrence_presets',
      'reassign_waste_tour_default_recurrence',
      () =>
        repository.upsertWasteTour({
          ...tour,
          recurrence: fallbackRecurrence,
          customRecurrenceId: undefined,
          customRecurrenceName: undefined,
          customRecurrenceIntervalDays: undefined,
        })
    );
  }
};

const applyDeletedCustomRecurrencePresets = async ({
  repository,
  instanceId,
  deletedPresetIds,
  deletedPresetFallbacks,
  nextPresetMap,
}: {
  readonly repository: WasteRepository;
  readonly instanceId: string;
  readonly deletedPresetIds: readonly string[];
  readonly deletedPresetFallbacks: SaveWasteCustomRecurrencePresetsInput['deletedPresetFallbacks'];
  readonly nextPresetMap: ReadonlyMap<string, Omit<WasteCustomRecurrencePresetRecord, 'createdAt' | 'updatedAt'>>;
}): Promise<void> => {
  if (deletedPresetIds.length === 0) {
    return;
  }

  const tours = await listWasteToursForCustomRecurrencePresets(repository, instanceId);

  for (const presetId of deletedPresetIds) {
    const affectedTours = tours.filter((tour) => tour.customRecurrenceId === presetId);
    if (affectedTours.length > 0) {
      const fallback = deletedPresetFallbacks[presetId];
      assertDeletedPresetFallback({ presetId, fallback, nextPresetMap });
      await reassignToursToFallback({
        repository,
        instanceId,
        presetId,
        fallback,
        affectedTours,
        nextPresetMap,
      });
    }

    await measureWasteRepositoryStep(
      instanceId,
      'save_waste_custom_recurrence_presets',
      'delete_waste_custom_recurrence_preset',
      () => repository.deleteWasteCustomRecurrencePreset(presetId)
    );
  }
};

const saveWasteCustomRecurrencePresets = async (
  instanceId: string,
  input: SaveWasteCustomRecurrencePresetsInput
): Promise<void> =>
  withWasteRepository(instanceId, 'save_waste_custom_recurrence_presets', async (repository) => {
    const currentPresets = await measureWasteRepositoryStep(
      instanceId,
      'save_waste_custom_recurrence_presets',
      'list_waste_custom_recurrence_presets',
      () => repository.listWasteCustomRecurrencePresets()
    );
    const currentPresetIds = new Set(currentPresets.map((preset) => preset.id));
    const nextPresetMap = new Map<string, Omit<WasteCustomRecurrencePresetRecord, 'createdAt' | 'updatedAt'>>(
      input.nextItems.map((preset) => [preset.id, preset])
    );
    const deletedPresetIds = [...currentPresetIds].filter((presetId) => !nextPresetMap.has(presetId));

    if (deletedPresetIds.length > 0) {
      validateDeletedPresetFallbacks({
        tours: await listWasteToursForCustomRecurrencePresets(repository, instanceId),
        deletedPresetIds,
        deletedPresetFallbacks: input.deletedPresetFallbacks,
        nextPresetMap,
      });
    }

    for (const preset of input.nextItems) {
      await measureWasteRepositoryStep(
        instanceId,
        'save_waste_custom_recurrence_presets',
        'upsert_waste_custom_recurrence_preset',
        () => repository.upsertWasteCustomRecurrencePreset(preset)
      );
    }

    await applyDeletedCustomRecurrencePresets({
      repository,
      instanceId,
      deletedPresetIds,
      deletedPresetFallbacks: input.deletedPresetFallbacks,
      nextPresetMap,
    });
  });

const mapJobTypeIdToTechnicalEventType = (
  jobTypeId: string,
  status: 'succeeded' | 'failed' | 'cancelled'
): WasteManagementTechnicalHistoryRecord['eventType'] | null => {
  if (jobTypeId === 'waste-management.apply-migrations') {
    return status === 'succeeded' ? 'migration.succeeded' : 'migration.failed';
  }
  if (jobTypeId === 'waste-management.initialize-data-source') {
    return status === 'succeeded' ? 'datasource.reconfigured' : 'connection-check.failed';
  }
  if (jobTypeId === 'waste-management.import-data') {
    return status === 'succeeded' ? 'import.succeeded' : 'import.failed';
  }
  if (jobTypeId === 'waste-management.seed-data') {
    return status === 'succeeded' ? 'seed.succeeded' : 'seed.failed';
  }
  if (jobTypeId === 'waste-management.reset-data') {
    return status === 'succeeded' ? 'reset.succeeded' : 'reset.failed';
  }
  if (jobTypeId === 'waste-management.sync-waste-types') {
    return status === 'succeeded' ? 'sync.succeeded' : 'sync.failed';
  }
  return null;
};

const loadMasterDataOverview = (instanceId: string): Promise<WasteManagementMasterDataOverview> =>
  withWasteRepository(instanceId, 'load_master_data_overview', async (repository) =>
    measureWasteStep('load_master_data_overview', 'query_overview', { instance_id: instanceId }, async () => {
      const fractions = await measureWasteRepositoryStep(instanceId, 'load_master_data_overview', 'list_waste_fractions', () =>
        repository.listWasteFractions()
      );
      const regions = await measureWasteRepositoryStep(instanceId, 'load_master_data_overview', 'list_waste_regions', () =>
        repository.listWasteRegions()
      );
      const cities = await measureWasteRepositoryStep(instanceId, 'load_master_data_overview', 'list_waste_cities', () =>
        repository.listWasteCities()
      );
      const streets = await measureWasteRepositoryStep(instanceId, 'load_master_data_overview', 'list_waste_streets', () =>
        repository.listWasteStreets()
      );
      const houseNumbers = await measureWasteRepositoryStep(instanceId, 'load_master_data_overview', 'list_waste_house_numbers', () =>
        repository.listWasteHouseNumbers()
      );
      const collectionLocations = await measureWasteRepositoryStep(
        instanceId,
        'load_master_data_overview',
        'list_waste_collection_locations',
        () => repository.listWasteCollectionLocations()
      );
      const locationTourLinks = await measureWasteRepositoryStep(
        instanceId,
        'load_master_data_overview',
        'list_waste_location_tour_links',
        () => repository.listWasteLocationTourLinks()
      );
      return { fractions, regions, cities, streets, houseNumbers, collectionLocations, locationTourLinks };
    })
  );

const loadMasterDataFractionsOverview = (instanceId: string): Promise<WasteManagementMasterDataOverview> =>
  withWasteRepository(instanceId, 'load_master_data_fractions_overview', async (repository) =>
    measureWasteStep('load_master_data_fractions_overview', 'query_overview', { instance_id: instanceId }, async () => ({
      fractions: await measureWasteRepositoryStep(instanceId, 'load_master_data_fractions_overview', 'list_waste_fractions', () =>
        repository.listWasteFractions()
      ),
      regions: [],
      cities: [],
      streets: [],
      houseNumbers: [],
      collectionLocations: [],
      locationTourLinks: [],
    }))
  );

const loadMasterDataLocationsOverview = (instanceId: string): Promise<WasteManagementMasterDataOverview> =>
  withWasteRepository(instanceId, 'load_master_data_locations_overview', async (repository) =>
    measureWasteStep('load_master_data_locations_overview', 'query_overview', { instance_id: instanceId }, async () => {
      const regions = await measureWasteRepositoryStep(instanceId, 'load_master_data_locations_overview', 'list_waste_regions', () =>
        repository.listWasteRegions()
      );
      const cities = await measureWasteRepositoryStep(instanceId, 'load_master_data_locations_overview', 'list_waste_cities', () =>
        repository.listWasteCities()
      );
      const streets = await measureWasteRepositoryStep(instanceId, 'load_master_data_locations_overview', 'list_waste_streets', () =>
        repository.listWasteStreets()
      );
      const houseNumbers = await measureWasteRepositoryStep(
        instanceId,
        'load_master_data_locations_overview',
        'list_waste_house_numbers',
        () => repository.listWasteHouseNumbers()
      );
      const collectionLocations = await measureWasteRepositoryStep(
        instanceId,
        'load_master_data_locations_overview',
        'list_waste_collection_locations',
        () => repository.listWasteCollectionLocations()
      );
      const locationTourLinks = await measureWasteRepositoryStep(
        instanceId,
        'load_master_data_locations_overview',
        'list_waste_location_tour_links',
        () => repository.listWasteLocationTourLinks()
      );

      return {
        fractions: [],
        regions,
        cities,
        streets,
        houseNumbers,
        collectionLocations,
        locationTourLinks,
      };
    })
  );

const loadWasteHistoryOverview = async (query: {
  instanceId: string;
  search?: string;
  page: number;
  pageSize: number;
}): Promise<WasteManagementHistoryOverview> => {
  const audit = await withInstanceDb(query.instanceId, (client) => listWasteManagementAuditRecords(client, query));

  const technicalOffset = (query.page - 1) * query.pageSize;
  const technicalLimit = technicalOffset + query.pageSize;

  const loadTechnicalAuditHistoryPrefix = async (): Promise<{
    readonly items: readonly WasteManagementTechnicalHistoryRecord[];
    readonly total: number;
  }> => {
    const items: WasteManagementTechnicalHistoryRecord[] = [];
    let currentPage = 1;
    let total = 0;

    do {
      const technicalAuditPage = await withInstanceDb(query.instanceId, (client) =>
        listWasteManagementTechnicalAuditRecords(client, {
          ...query,
          page: currentPage,
          pageSize: query.pageSize,
        })
      );
      items.push(...technicalAuditPage.items);
      total = technicalAuditPage.total;
      currentPage += 1;
    } while (items.length < total && items.length < technicalLimit);

    return {
      items,
      total,
    };
  };

  const loadTechnicalJobHistoryPage = async (): Promise<{
    readonly items: readonly WasteManagementTechnicalHistoryRecord[];
    readonly total: number;
  }> => {
    const supportedJobTypeIds = [
      'waste-management.initialize-data-source',
      'waste-management.apply-migrations',
      'waste-management.import-data',
      'waste-management.seed-data',
      'waste-management.reset-data',
      'waste-management.sync-waste-types',
    ] as const;
    const buildJobHistoryWhereClause = (): {
      readonly clause: string;
      readonly values: readonly unknown[];
    } => {
      const values: unknown[] = [query.instanceId, supportedJobTypeIds];
      const conditions = [
        'j.instance_id = $1',
        `j.job_type_id = ANY($2::text[])`,
        `j.status IN ('succeeded', 'failed', 'cancelled')`,
      ];

      if (query.search) {
        values.push(`%${query.search}%`);
        const parameterIndex = values.length;
        conditions.push(
          `(
    j.id::text ILIKE $${parameterIndex}
    OR COALESCE(j.correlation_id, '') ILIKE $${parameterIndex}
    OR COALESCE(j.parent_job_id::text, '') ILIKE $${parameterIndex}
    OR COALESCE(j.request_id, '') ILIKE $${parameterIndex}
    OR COALESCE(j.error_payload ->> 'code', '') ILIKE $${parameterIndex}
    OR COALESCE(j.error_payload ->> 'message', '') ILIKE $${parameterIndex}
    OR EXISTS (
      SELECT 1
      FROM iam.studio_job_events event_search
      WHERE event_search.instance_id = $1
        AND event_search.job_id = j.id
        AND COALESCE(event_search.message, '') ILIKE $${parameterIndex}
    )
  )`
        );
      }

      return {
        clause: conditions.join('\n  AND '),
        values,
      };
    };

    const whereClause = buildJobHistoryWhereClause();
    const pageSizeIndex = whereClause.values.length + 1;

    const rows = await withInstanceDb(query.instanceId, async (client) => {
      const result = await client.query<WasteTechnicalJobHistoryRow>(
        `
WITH filtered_jobs AS (
  SELECT
    j.id,
    j.job_type_id,
    j.status,
    j.finished_at,
    j.updated_at,
    j.request_id,
    j.error_payload
  FROM iam.studio_jobs j
  WHERE ${whereClause.clause}
)
SELECT
  filtered_jobs.id,
  filtered_jobs.job_type_id,
  filtered_jobs.status,
  filtered_jobs.finished_at,
  filtered_jobs.updated_at,
  filtered_jobs.request_id,
  latest_event.message AS latest_event_message,
  filtered_jobs.error_payload ->> 'code' AS error_code,
  filtered_jobs.error_payload ->> 'message' AS error_message,
  COUNT(*) OVER()::int AS total_count
FROM filtered_jobs
LEFT JOIN LATERAL (
  SELECT event.message
  FROM iam.studio_job_events event
  WHERE event.instance_id = $1
    AND event.job_id = filtered_jobs.id
  ORDER BY event.created_at DESC
  LIMIT 1
) latest_event ON TRUE
ORDER BY
  COALESCE(filtered_jobs.finished_at, filtered_jobs.updated_at) DESC,
  filtered_jobs.updated_at DESC,
  filtered_jobs.id DESC
LIMIT $${pageSizeIndex}
        `,
        [...whereClause.values, technicalLimit]
      );
      return result.rows;
    });

    const total =
      rows[0]?.total_count ??
      (query.page > 1
        ? await withInstanceDb(query.instanceId, async (client) => {
            const result = await client.query<WasteTechnicalJobHistoryCountRow>(
              `
SELECT COUNT(*)::int AS total_count
FROM iam.studio_jobs j
WHERE ${whereClause.clause}
              `,
              whereClause.values
            );
            return result.rows[0]?.total_count ?? 0;
          })
        : 0);

    return {
      items: rows
        .map((row): WasteManagementTechnicalHistoryRecord | null => {
          const eventType = mapJobTypeIdToTechnicalEventType(row.job_type_id, row.status);
          if (!eventType) {
            return null;
          }

          return {
            id: `job:${row.id}:${row.status}`,
            eventType,
            outcome: row.status === 'succeeded' ? 'success' : 'failure',
            occurredAt: row.finished_at ? toIsoTimestamp(row.finished_at) : toIsoTimestamp(row.updated_at),
            source: 'job',
            jobId: row.id,
            jobTypeId: row.job_type_id,
            requestId: row.request_id ?? undefined,
            message: row.latest_event_message ?? row.error_message ?? undefined,
            errorCode: row.error_code ?? undefined,
          };
        })
        .filter((item): item is WasteManagementTechnicalHistoryRecord => item !== null),
      total,
    };
  };

  const [
    { items: technicalJobItems, total: technicalJobTotal },
    { items: technicalAuditItems, total: technicalAuditTotal },
  ] = await Promise.all([
    loadTechnicalJobHistoryPage(),
    loadTechnicalAuditHistoryPrefix(),
  ]);

  const mergedTechnicalItems = [...technicalAuditItems, ...technicalJobItems].sort((left, right) =>
    right.occurredAt.localeCompare(left.occurredAt)
  );

  return {
    audit,
    technical: {
      items: mergedTechnicalItems.slice(technicalOffset, technicalOffset + query.pageSize),
      total: technicalAuditTotal + technicalJobTotal,
    },
  };
};

const loadToursOverview = (instanceId: string): Promise<WasteManagementToursOverview> =>
  withWasteRepository(instanceId, 'load_tours_overview', async (repository) =>
    measureWasteStep('load_tours_overview', 'query_overview', { instance_id: instanceId }, async () => ({
      tours: await repository.listWasteTours(),
      customRecurrencePresets: await repository.listWasteCustomRecurrencePresets(),
    }))
  );

const loadSchedulingOverview = (instanceId: string): Promise<WasteManagementSchedulingOverview> =>
  withWasteRepository(instanceId, 'load_scheduling_overview', async (repository) =>
    measureWasteStep('load_scheduling_overview', 'query_overview', { instance_id: instanceId }, async () => {
      const locationTourPickupDates = await measureWasteRepositoryStep(
        instanceId,
        'load_scheduling_overview',
        'list_waste_location_tour_pickup_dates',
        () => repository.listWasteLocationTourPickupDates()
      );
      const tourDateShifts = await measureWasteRepositoryStep(
        instanceId,
        'load_scheduling_overview',
        'list_waste_tour_date_shifts',
        () => repository.listWasteTourDateShifts()
      );
      const globalDateShifts = await measureWasteRepositoryStep(
        instanceId,
        'load_scheduling_overview',
        'list_waste_global_date_shifts',
        () => repository.listWasteGlobalDateShifts()
      );
      const holidayRules = await measureWasteRepositoryStep(
        instanceId,
        'load_scheduling_overview',
        'list_waste_holiday_rules',
        () => repository.listWasteHolidayRules()
      );
      return { locationTourPickupDates, tourDateShifts, globalDateShifts, holidayRules };
    })
  );

const hasManualHolidayConflict = (
  holidayDate: string,
  globalDateShifts: readonly WasteGlobalDateShiftRecord[]
): boolean =>
  globalDateShifts.some((shift) => shift.originalDate === holidayDate || shift.actualDate === holidayDate);

const syncWasteHolidayRules = async (
  instanceId: string,
  stateCode: WasteHolidayStateCode
): Promise<WasteHolidaySyncStatus> =>
  withWasteRepository(instanceId, 'sync_waste_holiday_rules', async (repository) => {
    const currentYear = new Date().getUTCFullYear();
    const years = Array.from({ length: wasteHolidaySyncHorizonYears }, (_, index) => currentYear + index);
    const existingRules = await measureWasteRepositoryStep(
      instanceId,
      'sync_waste_holiday_rules',
      'list_waste_holiday_rules',
      () => repository.listWasteHolidayRules({ stateCode })
    );
    const globalDateShifts = await measureWasteRepositoryStep(
      instanceId,
      'sync_waste_holiday_rules',
      'list_waste_global_date_shifts',
      () => repository.listWasteGlobalDateShifts()
    );
    const existingRuleMap = new Map<string, WasteHolidayRuleRecord>(
      existingRules.map((rule) => [`${rule.holidayDate}::${rule.holidayName}`, rule] as const)
    );
    const confirmedRuleKeys = new Set<string>();
    const successfulYears = new Set<number>();
    let failedYears = 0;

    for (const year of years) {
      try {
        const response = await fetch(buildWasteHolidayApiUrl(year, stateCode));
        if (!response.ok) {
          throw new Error(`holiday_api_http_${response.status}`);
        }
        const payload = (await response.json()) as unknown;
        const entries = normalizeWasteHolidayApiResponse(payload);
        successfulYears.add(year);

        for (const entry of entries) {
          const key = `${entry.holidayDate}::${entry.holidayName}`;
          confirmedRuleKeys.add(key);
          const existingRule = existingRuleMap.get(key);
          const nextRule: Omit<WasteHolidayRuleRecord, 'createdAt' | 'updatedAt'> = {
            id: existingRule?.id ?? crypto.randomUUID(),
            holidayDate: entry.holidayDate,
            holidayName: entry.holidayName,
            year,
            stateCode,
            sourceStatus: 'confirmed',
            configurationStatus: deriveHolidayRuleConfigurationStatus(existingRule ?? {}),
            conflictStatus: hasManualHolidayConflict(entry.holidayDate, globalDateShifts) ? 'manual-global-rule' : 'none',
            scope: existingRule?.scope,
            strategy: existingRule?.strategy,
          };
          await measureWasteRepositoryStep(
            instanceId,
            'sync_waste_holiday_rules',
            'upsert_waste_holiday_rule',
            () => repository.upsertWasteHolidayRule(nextRule)
          );
        }
      } catch {
        failedYears += 1;
      }
    }

    const notConfirmedRules = existingRules.filter(
      (rule) => successfulYears.has(rule.year) && !confirmedRuleKeys.has(`${rule.holidayDate}::${rule.holidayName}`)
    );
    for (const rule of notConfirmedRules) {
      await measureWasteRepositoryStep(
        instanceId,
        'sync_waste_holiday_rules',
        'upsert_waste_holiday_rule_not_confirmed',
        () =>
          repository.upsertWasteHolidayRule({
            id: rule.id,
            holidayDate: rule.holidayDate,
            holidayName: rule.holidayName,
            year: rule.year,
            stateCode: rule.stateCode,
            sourceStatus: 'not-confirmed',
            configurationStatus: deriveHolidayRuleConfigurationStatus(rule),
            conflictStatus: hasManualHolidayConflict(rule.holidayDate, globalDateShifts) ? 'manual-global-rule' : 'none',
            scope: rule.scope,
            strategy: rule.strategy,
          })
      );
    }

    if (failedYears === 0) {
      return 'success';
    }
    if (successfulYears.size > 0) {
      return 'partial_success';
    }
    return 'failed';
  });

const previewWasteLocationTourPickupDateImport = (input: {
  readonly instanceId: string;
  readonly sourceFormat: 'text/csv' | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  readonly blobRef: string;
  readonly delimiterOverride?: ';' | ',' | '\t' | '|';
}) =>
  withWasteRepository(input.instanceId, 'preview_location_tour_pickup_date_import', async (repository) =>
    measureWasteStep(
      'preview_location_tour_pickup_date_import',
      'simulate_import',
      { instance_id: input.instanceId },
      async () =>
        buildWasteLocationTourPickupDateImportPreview(repository, {
          sourceFormat: input.sourceFormat,
          blobRef: input.blobRef,
          delimiterOverride: input.delimiterOverride,
        })
    )
  );

const loadWasteFractionById = createLoader('load_waste_fraction_by_id', (repository, fractionId: string) =>
  repository.getWasteFractionById(fractionId)
);
const saveWasteFraction = createLoader(
  'save_waste_fraction',
  (repository, input: Parameters<WasteRepository['upsertWasteFraction']>[0]) => repository.upsertWasteFraction(input)
);
const deleteWasteFraction = createLoader('delete_waste_fraction', (repository, fractionId: string) =>
  repository.deleteWasteFraction(fractionId)
);
const loadWasteRegionById = createLoader('load_waste_region_by_id', (repository, regionId: string) =>
  repository.getWasteRegionById(regionId)
);
const saveWasteRegion = createLoader('save_waste_region', (repository, input: Omit<WasteRegionRecord, 'createdAt' | 'updatedAt'>) =>
  repository.upsertWasteRegion(input)
);
const loadWasteCityById = createLoader('load_waste_city_by_id', (repository, cityId: string) => repository.getWasteCityById(cityId));
const saveWasteCity = createLoader('save_waste_city', (repository, input: Parameters<WasteRepository['upsertWasteCity']>[0]) =>
  repository.upsertWasteCity(input)
);
const loadWasteStreetById = createLoader('load_waste_street_by_id', (repository, streetId: string) =>
  repository.getWasteStreetById(streetId)
);
const saveWasteStreet = createLoader('save_waste_street', (repository, input: Omit<WasteStreetRecord, 'createdAt' | 'updatedAt'>) =>
  repository.upsertWasteStreet(input)
);
const loadWasteHouseNumberById = createLoader('load_waste_house_number_by_id', (repository, houseNumberId: string) =>
  repository.getWasteHouseNumberById(houseNumberId)
);
const saveWasteHouseNumber = createLoader(
  'save_waste_house_number',
  (repository, input: Omit<WasteHouseNumberRecord, 'createdAt' | 'updatedAt'>) => repository.upsertWasteHouseNumber(input)
);
const loadWasteCollectionLocationById = createLoader('load_waste_collection_location_by_id', (repository, locationId: string) =>
  repository.getWasteCollectionLocationById(locationId)
);
const saveWasteCollectionLocation = createLoader(
  'save_waste_collection_location',
  (repository, input: Omit<WasteCollectionLocationRecord, 'createdAt' | 'updatedAt'>) =>
    repository.upsertWasteCollectionLocation(input)
);
const deleteWasteCollectionLocation = createLoader(
  'delete_waste_collection_location',
  (repository, locationId: string) => repository.deleteWasteCollectionLocation(locationId)
);
const loadWasteLocationTourLinkById = createLoader('load_waste_location_tour_link_by_id', (repository, linkId: string) =>
  repository.getWasteLocationTourLinkById(linkId)
);
const listWasteLocationTourLinksByTourId = createLoader(
  'list_waste_location_tour_links_by_tour_id',
  (repository, tourId: string) => repository.listWasteLocationTourLinksByTourId(tourId)
);
const saveWasteLocationTourLink = createLoader(
  'save_waste_location_tour_link',
  (repository, input: Omit<WasteLocationTourLinkRecord, 'createdAt' | 'updatedAt'>) =>
    repository.upsertWasteLocationTourLink(input)
);
const deleteWasteLocationTourLink = createLoader(
  'delete_waste_location_tour_link',
  (repository, linkId: string) => repository.deleteWasteLocationTourLink(linkId)
);
const loadWasteLocationTourPickupDateById = createLoader(
  'load_waste_location_tour_pickup_date_by_id',
  (repository, pickupDateId: string) => repository.getWasteLocationTourPickupDateById(pickupDateId)
);
const listWasteLocationTourPickupDates = createLoader(
  'list_waste_location_tour_pickup_dates',
  (
    repository,
    filter?: { readonly locationId?: string; readonly tourId?: string; readonly pickupDate?: string }
  ) => repository.listWasteLocationTourPickupDates(filter)
);
const saveWasteLocationTourPickupDate = createLoader(
  'save_waste_location_tour_pickup_date',
  (repository, input: Omit<WasteLocationTourPickupDateRecord, 'createdAt' | 'updatedAt'>) =>
    repository.upsertWasteLocationTourPickupDate(input)
);
const deleteWasteLocationTourPickupDate = createLoader(
  'delete_waste_location_tour_pickup_date',
  (repository, pickupDateId: string) => repository.deleteWasteLocationTourPickupDate(pickupDateId)
);
const loadWasteCustomRecurrencePresets = createLoader(
  'load_waste_custom_recurrence_presets',
  (repository) => repository.listWasteCustomRecurrencePresets()
);
const loadWasteHolidayRuleById = createLoader('load_waste_holiday_rule_by_id', async (repository, ruleId: string) => {
  const rules = await repository.listWasteHolidayRules();
  return rules.find((rule) => rule.id === ruleId) ?? null;
});
const loadWasteTourById = createLoader('load_waste_tour_by_id', (repository, tourId: string) => repository.getWasteTourById(tourId));
const saveWasteTour = createLoader('save_waste_tour', (repository, input: Omit<WasteTourRecord, 'createdAt' | 'updatedAt'>) =>
  repository.upsertWasteTour(input)
);
const deleteWasteTour = createLoader('delete_waste_tour', (repository, tourId: string) => repository.deleteWasteTour(tourId));
const loadWasteTourDateShiftById = createLoader('load_waste_tour_date_shift_by_id', (repository, shiftId: string) =>
  repository.getWasteTourDateShiftById(shiftId)
);
const listWasteTourDateShiftsByTourId = createLoader(
  'list_waste_tour_date_shifts_by_tour_id',
  (repository, tourId: string) => repository.listWasteTourDateShiftsByTourId(tourId)
);
const deleteWasteTourDateShift = createLoader(
  'delete_waste_tour_date_shift',
  (repository, shiftId: string) => repository.deleteWasteTourDateShift(shiftId)
);
const saveWasteTourDateShift = createLoader(
  'save_waste_tour_date_shift',
  (repository, input: Omit<WasteTourDateShiftRecord, 'createdAt' | 'updatedAt'>) => repository.upsertWasteTourDateShift(input)
);
const loadWasteGlobalDateShiftById = createLoader('load_waste_global_date_shift_by_id', (repository, shiftId: string) =>
  repository.getWasteGlobalDateShiftById(shiftId)
);
const deleteWasteGlobalDateShift = createLoader(
  'delete_waste_global_date_shift',
  (repository, shiftId: string) => repository.deleteWasteGlobalDateShift(shiftId)
);
const saveWasteGlobalDateShift = createLoader(
  'save_waste_global_date_shift',
  (repository, input: Omit<WasteGlobalDateShiftRecord, 'createdAt' | 'updatedAt'>) => repository.upsertWasteGlobalDateShift(input)
);
const saveWasteHolidayRule = createLoader(
  'save_waste_holiday_rule',
  (repository, input: Omit<WasteHolidayRuleRecord, 'createdAt' | 'updatedAt'>) => repository.upsertWasteHolidayRule(input)
);
const deleteWasteHolidayRule = createLoader(
  'delete_waste_holiday_rule',
  (repository, ruleId: string) => repository.deleteWasteHolidayRule(ruleId)
);

const saveWasteLocationTourLinksBulk = async (
  instanceId: string,
  input: WasteLocationTourLinkBulkCreateInput
): Promise<readonly WasteLocationTourLinkRecord[]> => {
  return withWasteClient(instanceId, 'save_waste_location_tour_links_bulk', async (client) => {
    try {
      await client.query('BEGIN');
      const repository = createWasteMasterDataRepository(createSqlExecutor(client));
      const createdItems: WasteLocationTourLinkRecord[] = [];
      for (const locationId of input.locationIds) {
        const id = crypto.randomUUID();
        await repository.upsertWasteLocationTourLink({
          id,
          locationId,
          tourId: input.tourId,
          startDate: input.startDate,
          endDate: input.endDate,
        });

        const saved = await repository.getWasteLocationTourLinkById(id);
        if (!saved) {
          throw new Error(`bulk_location_tour_link_verification_failed:${id}`);
        }
        createdItems.push(saved);
      }
      await client.query('COMMIT');
      return createdItems;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
};

export const wasteManagementOverviewLoaders = {
  loadMasterDataOverview,
  loadMasterDataFractionsOverview,
  loadMasterDataLocationsOverview,
  loadWasteHistoryOverview,
  loadToursOverview,
  loadSchedulingOverview,
  previewWasteLocationTourPickupDateImport,
} as const;

export const wasteManagementEntityLoaders = {
  loadWasteCustomRecurrencePresets,
  loadWasteHolidayRuleById,
  loadWasteFractionById,
  loadWasteRegionById,
  loadWasteCityById,
  loadWasteStreetById,
  loadWasteHouseNumberById,
  loadWasteCollectionLocationById,
  loadWasteLocationTourLinkById,
  loadWasteLocationTourPickupDateById,
  listWasteLocationTourPickupDates,
  listWasteLocationTourLinksByTourId,
  loadWasteTourById,
  loadWasteTourDateShiftById,
  listWasteTourDateShiftsByTourId,
  loadWasteGlobalDateShiftById,
} as const;

export const wasteManagementEntitySavers = {
  saveWasteCustomRecurrencePresets,
  syncWasteHolidayRules,
  saveWasteHolidayRule,
  deleteWasteHolidayRule,
  saveWasteFraction,
  deleteWasteFraction,
  saveWasteRegion,
  saveWasteCity,
  saveWasteStreet,
  saveWasteHouseNumber,
  saveWasteCollectionLocation,
  deleteWasteCollectionLocation,
  saveWasteLocationTourLink,
  deleteWasteLocationTourLink,
  saveWasteLocationTourPickupDate,
  deleteWasteLocationTourPickupDate,
  saveWasteLocationTourLinksBulk,
  saveWasteTour,
  deleteWasteTour,
  deleteWasteTourDateShift,
  saveWasteTourDateShift,
  deleteWasteGlobalDateShift,
  saveWasteGlobalDateShift,
} as const;

export const wasteManagementServerLoaderInternals = {
  resetWastePoolCache,
} as const;
