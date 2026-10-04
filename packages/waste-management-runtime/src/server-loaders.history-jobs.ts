import type { WasteManagementTechnicalHistoryRecord } from '@sva/waste-management-contracts';
import type { WasteServerLoaderHost } from './server-loaders.js';

export type WasteHistoryQuery = {
  instanceId: string;
  search?: string;
  page: number;
  pageSize: number;
};
const supportedJobTypeIds = [
  'waste-management.initialize-data-source',
  'waste-management.apply-migrations',
  'waste-management.import-data',
  'waste-management.seed-data',
  'waste-management.reset-data',
  'waste-management.sync-waste-types',
  'waste-management.enrich-postal-codes',
] as const;
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
const toIsoTimestamp = (value: string | Date): string =>
  value instanceof Date ? value.toISOString() : value;

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
  if (jobTypeId === 'waste-management.enrich-postal-codes') {
    return status === 'succeeded'
      ? 'postal-code-enrichment.succeeded'
      : 'postal-code-enrichment.failed';
  }
  return null;
};

const buildJobHistoryWhereClause = (
  query: WasteHistoryQuery
): {
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

export class WasteHistoryJobLoader {
  constructor(private readonly host: WasteServerLoaderHost) {}

  private loadRows = async (
    query: WasteHistoryQuery,
    technicalLimit: number,
    whereClause: ReturnType<typeof buildJobHistoryWhereClause>
  ): Promise<readonly WasteTechnicalJobHistoryRow[]> => {
    const pageSizeIndex = whereClause.values.length + 1;

    const rows = await this.host.withInstanceDb(query.instanceId, async (client) => {
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
    return rows;
  };

  private loadTotal = async (
    query: WasteHistoryQuery,
    rows: readonly WasteTechnicalJobHistoryRow[],
    whereClause: ReturnType<typeof buildJobHistoryWhereClause>
  ): Promise<number> => {
    const total =
      rows[0]?.total_count ??
      (query.page > 1
        ? await this.host.withInstanceDb(query.instanceId, async (client) => {
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
    return total;
  };

  private mapRows = (
    rows: readonly WasteTechnicalJobHistoryRow[]
  ): readonly WasteManagementTechnicalHistoryRecord[] =>
    rows
      .map((row): WasteManagementTechnicalHistoryRecord | null => {
        const eventType = mapJobTypeIdToTechnicalEventType(row.job_type_id, row.status);
        if (!eventType) {
          return null;
        }

        return {
          id: `job:${row.id}:${row.status}`,
          eventType,
          outcome: row.status === 'succeeded' ? 'success' : 'failure',
          occurredAt: row.finished_at
            ? toIsoTimestamp(row.finished_at)
            : toIsoTimestamp(row.updated_at),
          source: 'job',
          jobId: row.id,
          jobTypeId: row.job_type_id,
          jobStatus: row.status,
          requestId: row.request_id ?? undefined,
          message: row.latest_event_message ?? row.error_message ?? undefined,
          errorCode: row.error_code ?? undefined,
        };
      })
      .filter((item): item is WasteManagementTechnicalHistoryRecord => item !== null);

  loadTechnicalJobHistoryPage = async (query: WasteHistoryQuery, technicalLimit: number) => {
    const whereClause = buildJobHistoryWhereClause(query);
    const rows = await this.loadRows(query, technicalLimit, whereClause);
    return { items: this.mapRows(rows), total: await this.loadTotal(query, rows, whereClause) };
  };
}
