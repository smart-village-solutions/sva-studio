import type { SqlExecutor } from '../iam/repositories/types.js';

import { queryRows, statement } from './repository-shared.js';

type RoleAggregateRow = {
  sync_state: 'synced' | 'pending' | 'failed' | null;
  role_count: number;
  failed_count: number;
  pending_count: number;
  last_synced_at: string | null;
  last_error_code: string | null;
};

const loadRoleAggregate = async (executor: SqlExecutor, instanceId: string): Promise<RoleAggregateRow | null> => {
  const rows = await queryRows<RoleAggregateRow>(
    executor,
    statement(
      `
SELECT
  CASE
    WHEN COUNT(*) = 0 THEN NULL
    WHEN COUNT(*) FILTER (WHERE sync_state = 'failed') > 0 THEN 'failed'
    WHEN COUNT(*) FILTER (WHERE sync_state = 'pending') > 0 THEN 'pending'
    ELSE 'synced'
  END AS sync_state,
  COUNT(*)::int AS role_count,
  COUNT(*) FILTER (WHERE sync_state = 'failed')::int AS failed_count,
  COUNT(*) FILTER (WHERE sync_state = 'pending')::int AS pending_count,
  MAX(last_synced_at)::text AS last_synced_at,
  MAX(last_error_code) FILTER (WHERE last_error_code IS NOT NULL) AS last_error_code
FROM iam.roles
WHERE instance_id = $1;
`,
      [instanceId]
    )
  );
  return rows[0] ?? null;
};

const loadCorrelation = async (executor: SqlExecutor, instanceId: string): Promise<string | undefined> => {
  const rows = await queryRows<{ request_id: string | null }>(
    executor,
    statement(
      `
SELECT request_id
FROM iam.activity_logs
WHERE instance_id = $1
  AND event_type = 'role.reconciled'
ORDER BY created_at DESC, id DESC
LIMIT 1;
`,
      [instanceId]
    )
  );
  return rows[0]?.request_id ?? undefined;
};

const loadLegacyArtifactCount = async (executor: SqlExecutor, instanceId: string): Promise<number> => {
  const rows = await queryRows<{ legacy_artifact_count: number }>(
    executor,
    statement(
      `
SELECT (
  COALESCE((SELECT COUNT(*)::int FROM iam.roles WHERE instance_id = $1 AND role_key = 'core_admin'), 0) +
  COALESCE((SELECT COUNT(*)::int FROM iam.groups WHERE instance_id = $1 AND group_key = 'admins'), 0)
) AS legacy_artifact_count;
`,
      [instanceId]
    )
  );
  return rows[0]?.legacy_artifact_count ?? 0;
};

const buildSyncSummary = (aggregate: RoleAggregateRow): string => {
  if (aggregate.failed_count > 0 && aggregate.pending_count > 0) {
    return `${aggregate.failed_count} Rollen mit Fehler, ${aggregate.pending_count} Rollen im Backlog.`;
  }
  if (aggregate.failed_count > 0) {
    return `${aggregate.failed_count} Rollen mit Fehler.`;
  }
  if (aggregate.pending_count > 0) {
    return `${aggregate.pending_count} Rollen im Backlog.`;
  }
  return 'Letzter Rollenabgleich ist synchron.';
};

export const getRoleReconcileSummary = async (
  executor: SqlExecutor,
  instanceId: string
): Promise<{
  status: 'ready' | 'degraded' | 'blocked' | 'unknown';
  summary: string;
  checkedAt?: string;
  errorCode?: string;
  requestId?: string;
} | null> => {
  const aggregate = await loadRoleAggregate(executor, instanceId);
  if (!aggregate?.sync_state || aggregate.role_count === 0) {
    return null;
  }
  const requestId = await loadCorrelation(executor, instanceId);
  const legacyArtifactCount = await loadLegacyArtifactCount(executor, instanceId);
  const hasLegacyAdminArtifacts = legacyArtifactCount > 0;
  const summary = hasLegacyAdminArtifacts
    ? aggregate.failed_count > 0 || aggregate.pending_count > 0
      ? `${buildSyncSummary(aggregate)} ${legacyArtifactCount} Legacy-Admin-Artefakte erfordern manuelle Bereinigung.`
      : `${legacyArtifactCount} Legacy-Admin-Artefakte erfordern manuelle Bereinigung.`
    : buildSyncSummary(aggregate);
  return {
    status:
      aggregate.sync_state === 'failed' || aggregate.sync_state === 'pending' || hasLegacyAdminArtifacts
        ? 'degraded'
        : 'ready',
    summary,
    ...(aggregate.last_synced_at ? { checkedAt: aggregate.last_synced_at } : {}),
    ...(aggregate.last_error_code
      ? { errorCode: aggregate.last_error_code }
      : hasLegacyAdminArtifacts
        ? { errorCode: 'LEGACY_ADMIN_ARTIFACT_DRIFT' }
        : {}),
    ...(requestId ? { requestId } : {}),
  };
};
