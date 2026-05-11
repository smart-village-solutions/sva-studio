import {
  createWasteMasterDataRepository,
  type SqlExecutionResult,
  type SqlExecutor,
  type SqlStatement,
} from '@sva/data-repositories';
import type {
  WasteCollectionLocationRecord,
  WasteGlobalDateShiftRecord,
  WasteHouseNumberRecord,
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
  WasteTourRecord,
} from '@sva/core';
import { resolveWasteDataSource } from '@sva/server-runtime';
import { listWasteManagementAuditRecords, listWasteManagementTechnicalAuditRecords } from '@sva/iam-governance';
import { Pool } from 'pg';

import { withInstanceDb } from '../db.js';
import { revealField } from '../iam-account-management/encryption.js';
import { sharedWasteManagementDeps } from './server-context.js';

const schemaIdentifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;

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
type WasteTechnicalJobHistoryRow = {
  readonly id: string;
  readonly job_type_id: string;
  readonly status: 'succeeded' | 'failed' | 'cancelled';
  readonly finished_at: string | null;
  readonly updated_at: string;
  readonly request_id: string | null;
  readonly latest_event_message: string | null;
  readonly error_code: string | null;
  readonly error_message: string | null;
  readonly total_count: number;
};
type WasteTechnicalJobHistoryCountRow = {
  readonly total_count: number;
};

const withWasteRepository = async <T>(instanceId: string, work: (repository: WasteRepository) => Promise<T>): Promise<T> => {
  const dataSource = await resolveWasteDataSource({
    instanceId,
    loadRecord: sharedWasteManagementDeps.loadWasteDataSourceRecord,
    revealSecret: (ciphertext, aad) => revealField(ciphertext, aad) ?? undefined,
  });

  const pool = new Pool({
    connectionString: dataSource.databaseUrl,
    max: 2,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 5_000,
  });

  try {
    const client = await pool.connect();
    try {
      await setWasteSearchPath(client, dataSource.schemaName);
      return await work(createWasteMasterDataRepository(createSqlExecutor(client)));
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
};

const createLoader =
  <TArgs extends readonly unknown[], TResult>(work: (repository: WasteRepository, ...args: TArgs) => Promise<TResult>) =>
  (instanceId: string, ...args: TArgs) =>
    withWasteRepository(instanceId, (repository) => work(repository, ...args));

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
  return null;
};

const loadMasterDataOverview = (instanceId: string): Promise<WasteManagementMasterDataOverview> =>
  withWasteRepository(instanceId, async (repository) => {
    const [fractions, regions, cities, streets, houseNumbers, collectionLocations, locationTourLinks] = await Promise.all([
      repository.listWasteFractions(),
      repository.listWasteRegions(),
      repository.listWasteCities(),
      repository.listWasteStreets(),
      repository.listWasteHouseNumbers(),
      repository.listWasteCollectionLocations(),
      repository.listWasteLocationTourLinks(),
    ]);
    return { fractions, regions, cities, streets, houseNumbers, collectionLocations, locationTourLinks };
  });

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
      FROM iam.plugin_operation_job_events event_search
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
  FROM iam.plugin_operation_jobs j
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
  FROM iam.plugin_operation_job_events event
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
FROM iam.plugin_operation_jobs j
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
            occurredAt: row.finished_at ?? row.updated_at,
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
  withWasteRepository(instanceId, async (repository) => ({ tours: await repository.listWasteTours() }));

const loadSchedulingOverview = (instanceId: string): Promise<WasteManagementSchedulingOverview> =>
  withWasteRepository(instanceId, async (repository) => {
    const [tourDateShifts, globalDateShifts] = await Promise.all([
      repository.listWasteTourDateShifts(),
      repository.listWasteGlobalDateShifts(),
    ]);
    return { tourDateShifts, globalDateShifts };
  });

const loadWasteFractionById = createLoader((repository, fractionId: string) => repository.getWasteFractionById(fractionId));
const saveWasteFraction = createLoader(
  (repository, input: Parameters<WasteRepository['upsertWasteFraction']>[0]) => repository.upsertWasteFraction(input)
);
const loadWasteRegionById = createLoader((repository, regionId: string) => repository.getWasteRegionById(regionId));
const saveWasteRegion = createLoader((repository, input: Omit<WasteRegionRecord, 'createdAt' | 'updatedAt'>) =>
  repository.upsertWasteRegion(input)
);
const loadWasteCityById = createLoader((repository, cityId: string) => repository.getWasteCityById(cityId));
const saveWasteCity = createLoader((repository, input: Parameters<WasteRepository['upsertWasteCity']>[0]) =>
  repository.upsertWasteCity(input)
);
const loadWasteStreetById = createLoader((repository, streetId: string) => repository.getWasteStreetById(streetId));
const saveWasteStreet = createLoader((repository, input: Omit<WasteStreetRecord, 'createdAt' | 'updatedAt'>) =>
  repository.upsertWasteStreet(input)
);
const loadWasteHouseNumberById = createLoader((repository, houseNumberId: string) =>
  repository.getWasteHouseNumberById(houseNumberId)
);
const saveWasteHouseNumber = createLoader(
  (repository, input: Omit<WasteHouseNumberRecord, 'createdAt' | 'updatedAt'>) => repository.upsertWasteHouseNumber(input)
);
const loadWasteCollectionLocationById = createLoader((repository, locationId: string) =>
  repository.getWasteCollectionLocationById(locationId)
);
const saveWasteCollectionLocation = createLoader(
  (repository, input: Omit<WasteCollectionLocationRecord, 'createdAt' | 'updatedAt'>) =>
    repository.upsertWasteCollectionLocation(input)
);
const loadWasteLocationTourLinkById = createLoader((repository, linkId: string) => repository.getWasteLocationTourLinkById(linkId));
const saveWasteLocationTourLink = createLoader(
  (repository, input: Omit<WasteLocationTourLinkRecord, 'createdAt' | 'updatedAt'>) =>
    repository.upsertWasteLocationTourLink(input)
);
const loadWasteTourById = createLoader((repository, tourId: string) => repository.getWasteTourById(tourId));
const saveWasteTour = createLoader((repository, input: Omit<WasteTourRecord, 'createdAt' | 'updatedAt'>) =>
  repository.upsertWasteTour(input)
);
const loadWasteTourDateShiftById = createLoader((repository, shiftId: string) => repository.getWasteTourDateShiftById(shiftId));
const saveWasteTourDateShift = createLoader(
  (repository, input: Omit<WasteTourDateShiftRecord, 'createdAt' | 'updatedAt'>) => repository.upsertWasteTourDateShift(input)
);
const loadWasteGlobalDateShiftById = createLoader((repository, shiftId: string) => repository.getWasteGlobalDateShiftById(shiftId));
const saveWasteGlobalDateShift = createLoader(
  (repository, input: Omit<WasteGlobalDateShiftRecord, 'createdAt' | 'updatedAt'>) => repository.upsertWasteGlobalDateShift(input)
);

const saveWasteLocationTourLinksBulk = async (
  instanceId: string,
  input: WasteLocationTourLinkBulkCreateInput
): Promise<readonly WasteLocationTourLinkRecord[]> => {
  const dataSource = await resolveWasteDataSource({
    instanceId,
    loadRecord: sharedWasteManagementDeps.loadWasteDataSourceRecord,
    revealSecret: (ciphertext, aad) => revealField(ciphertext, aad) ?? undefined,
  });

  const pool = new Pool({
    connectionString: dataSource.databaseUrl,
    max: 2,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 5_000,
  });

  try {
    const client = await pool.connect();
    try {
      await setWasteSearchPath(client, dataSource.schemaName);
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
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
};

export const wasteManagementOverviewLoaders = {
  loadMasterDataOverview,
  loadWasteHistoryOverview,
  loadToursOverview,
  loadSchedulingOverview,
} as const;

export const wasteManagementEntityLoaders = {
  loadWasteFractionById,
  loadWasteRegionById,
  loadWasteCityById,
  loadWasteStreetById,
  loadWasteHouseNumberById,
  loadWasteCollectionLocationById,
  loadWasteLocationTourLinkById,
  loadWasteTourById,
  loadWasteTourDateShiftById,
  loadWasteGlobalDateShiftById,
} as const;

export const wasteManagementEntitySavers = {
  saveWasteFraction,
  saveWasteRegion,
  saveWasteCity,
  saveWasteStreet,
  saveWasteHouseNumber,
  saveWasteCollectionLocation,
  saveWasteLocationTourLink,
  saveWasteLocationTourLinksBulk,
  saveWasteTour,
  saveWasteTourDateShift,
  saveWasteGlobalDateShift,
} as const;
