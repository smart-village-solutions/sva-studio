import type { StudioJobListQuery } from '@sva/core';
import type { SqlPrimitive, SqlStatement } from '../iam/repositories/types.js';
import { eventSelectColumns, jobSelectColumns } from './sql-shared.js';

const buildListJobWhereClause = (
  instanceId: string,
  query: StudioJobListQuery
): { readonly clause: string; readonly values: readonly SqlPrimitive[] } => {
  const conditions = ['j.instance_id = $1'];
  const values: SqlPrimitive[] = [instanceId];

  if (query.view === 'active') {
    conditions.push(`j.status IN ('queued', 'running', 'retrying')`);
  }

  if (query.view === 'history') {
    conditions.push(`j.status IN ('succeeded', 'failed', 'cancelled')`);
  }

  if (query.status) {
    values.push(query.status);
    conditions.push(`j.status = $${values.length}`);
  }

  if (query.pluginId) {
    values.push(query.pluginId);
    conditions.push(`j.plugin_id = $${values.length}`);
  }

  if (query.jobTypeId) {
    values.push(query.jobTypeId);
    conditions.push(`j.job_type_id = $${values.length}`);
  }

  if (query.q) {
    values.push(`%${query.q}%`);
    const parameterIndex = values.length;
    conditions.push(
      `(j.id::text ILIKE $${parameterIndex} OR COALESCE(j.correlation_id, '') ILIKE $${parameterIndex} OR COALESCE(j.parent_job_id::text, '') ILIKE $${parameterIndex})`
    );
  }

  return {
    clause: conditions.join('\n  AND '),
    values,
  };
};

export const listJobsStatement = (instanceId: string, query: StudioJobListQuery): SqlStatement => {
  const paginationOffset = (query.page - 1) * query.pageSize;
  const whereClause = buildListJobWhereClause(instanceId, query);
  const pageSizeIndex = whereClause.values.length + 1;
  const offsetIndex = whereClause.values.length + 2;

  return {
    text: `
WITH filtered_jobs AS (
  SELECT
    ${jobSelectColumns}
  FROM iam.studio_jobs j
  WHERE ${whereClause.clause}
)
SELECT
  filtered_jobs.*,
  latest_event.id AS latest_event_id,
  latest_event.event_type AS latest_event_type,
  latest_event.status AS latest_event_status,
  latest_event.progress AS latest_event_progress,
  latest_event.attempts AS latest_event_attempts,
  latest_event.message AS latest_event_message,
  latest_event.details AS latest_event_details,
  latest_event.created_at AS latest_event_created_at,
  COUNT(*) OVER()::int AS total_count
FROM filtered_jobs
LEFT JOIN LATERAL (
  SELECT
    ${eventSelectColumns}
  FROM iam.studio_job_events event
  WHERE event.instance_id = filtered_jobs.instance_id
    AND event.job_id = filtered_jobs.id
  ORDER BY event.created_at DESC
  LIMIT 1
) latest_event ON TRUE
ORDER BY
  COALESCE(filtered_jobs.started_at, filtered_jobs.scheduled_at, filtered_jobs.created_at) DESC,
  filtered_jobs.created_at DESC
LIMIT $${pageSizeIndex}
OFFSET $${offsetIndex}
    `,
    values: [...whereClause.values, query.pageSize, paginationOffset],
  };
};

export const countJobsStatement = (instanceId: string, query: StudioJobListQuery): SqlStatement => {
  const whereClause = buildListJobWhereClause(instanceId, query);

  return {
    text: `
SELECT COUNT(*)::int AS total_count
FROM iam.studio_jobs j
WHERE ${whereClause.clause}
    `,
    values: whereClause.values,
  };
};
