import type { QueryClient } from './query-client.js';
import type { WasteAuditFilters, WasteAuditRow } from './waste-audit-read-models.types.js';

const buildSearchPattern = (search: string | undefined) => {
  const trimmed = search?.trim();
  return trimmed ? `%${trimmed}%` : null;
};

export const loadWasteAuditRows = async (
  client: QueryClient,
  input: WasteAuditFilters
): Promise<{ readonly rows: readonly WasteAuditRow[]; readonly total: number }> => {
  const searchPattern = buildSearchPattern(input.search);
  const offset = (input.page - 1) * input.pageSize;
  const actionIds = input.actionIds?.length ? input.actionIds : null;

  const [itemsResult, totalResult] = await Promise.all([
    client.query<WasteAuditRow>(
      `
SELECT
  id::text,
  event_type,
  created_at::text,
  account_id::text,
  request_id,
  trace_id,
  payload
FROM iam.activity_logs
WHERE instance_id = $1
  AND payload->>'action_namespace' = 'waste-management'
  AND (
    $2::text[] IS NULL
    OR COALESCE(payload->>'action_id', '') = ANY($2)
  )
  AND (
    $3::text IS NULL
    OR event_type ILIKE $3
    OR COALESCE(payload->>'action_id', '') ILIKE $3
    OR COALESCE(payload->>'resource_type', '') ILIKE $3
    OR COALESCE(payload->>'resource_id', '') ILIKE $3
    OR COALESCE(payload->>'reason_code', '') ILIKE $3
  )
ORDER BY created_at DESC
LIMIT $4 OFFSET $5;
`,
      [input.instanceId, actionIds, searchPattern, input.pageSize, offset]
    ),
    client.query<{ total: number }>(
      `
SELECT COUNT(*)::int AS total
FROM iam.activity_logs
WHERE instance_id = $1
  AND payload->>'action_namespace' = 'waste-management'
  AND (
    $2::text[] IS NULL
    OR COALESCE(payload->>'action_id', '') = ANY($2)
  )
  AND (
    $3::text IS NULL
    OR event_type ILIKE $3
    OR COALESCE(payload->>'action_id', '') ILIKE $3
    OR COALESCE(payload->>'resource_type', '') ILIKE $3
    OR COALESCE(payload->>'resource_id', '') ILIKE $3
    OR COALESCE(payload->>'reason_code', '') ILIKE $3
  );
`,
      [input.instanceId, actionIds, searchPattern]
    ),
  ]);

  return {
    rows: itemsResult.rows,
    total: totalResult.rows[0]?.total ?? 0,
  };
};
