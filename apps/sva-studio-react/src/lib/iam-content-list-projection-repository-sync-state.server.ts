import { withInstanceScopedDb } from '@sva/auth-runtime/server';

import type {
  ContentProjectionSyncTarget,
  ProjectionDbClient,
  ProjectionSyncStateRow,
} from './iam-content-list-projection-model.server.js';
import {
  buildMainserverSyncScopeKey,
  buildProjectionTargetKey,
  loadProjectionSyncStateSchemaMode,
  loadProjectionTableSchemaMode,
  type ProjectionSyncStateSchemaMode,
  withProjectionSchemaModeRetry,
} from './iam-content-list-projection-repository-schema.server.js';

export const loadProjectionSyncState = async (
  target: ContentProjectionSyncTarget
): Promise<ProjectionSyncStateRow | null> =>
  withInstanceScopedDb(target.instanceId, async (client) => {
    const result = await withProjectionSchemaModeRetry(target, 'sync-state', async () => {
      const schemaMode = await loadProjectionSyncStateSchemaMode(client, target.instanceId);
      return schemaMode === 'scoped'
        ? client.query<ProjectionSyncStateRow>(
            `
SELECT
  sync_scope_key,
  last_started_at::text,
  last_succeeded_at::text,
  last_failed_at::text,
  last_error_code,
  last_error_message,
  projected_count,
  snapshot_state,
  refresh_run_id::text,
  refresh_phase,
  completed_page,
  available_count,
  is_total_final,
  skipped_invalid_count
FROM iam.content_list_projection_sync_state
WHERE instance_id = $1
  AND source_system = 'mainserver'
  AND content_type = $2
  AND sync_scope_key = $3
LIMIT 1;
            `,
            [target.instanceId, target.contentType, buildMainserverSyncScopeKey(target)]
          )
        : client.query<ProjectionSyncStateRow>(
            `
SELECT
  content_type AS sync_scope_key,
  last_started_at::text,
  last_succeeded_at::text,
  last_failed_at::text,
  last_error_code,
  last_error_message,
  projected_count,
  snapshot_state,
  refresh_run_id::text,
  refresh_phase,
  completed_page,
  available_count,
  is_total_final,
  skipped_invalid_count
FROM iam.content_list_projection_sync_state
WHERE instance_id = $1
  AND source_system = 'mainserver'
  AND content_type = $2
LIMIT 1;
            `,
            [target.instanceId, target.contentType]
          );
    });

    return result.rows[0] ?? null;
  });

export const countProjectedRowsForScope = async (
  target: ContentProjectionSyncTarget
): Promise<number> =>
  withInstanceScopedDb(target.instanceId, (client) =>
    countProjectedRowsForScopeWithClient(client, target)
  );

export const countProjectedRowsForScopeWithClient = async (
  client: ProjectionDbClient,
  target: ContentProjectionSyncTarget
): Promise<number> => {
  const result = await withProjectionSchemaModeRetry(target, 'table', async () => {
    const schemaMode = await loadProjectionTableSchemaMode(client, target.instanceId);
    return schemaMode === 'scoped'
      ? client.query<{ total?: string | number }>(
          `
SELECT COUNT(*)::int AS total
FROM iam.content_list_projection
WHERE instance_id = $1
  AND source_system = 'mainserver'
  AND content_type = $2
  AND projection_scope_key = $3;
          `,
          [target.instanceId, target.contentType, buildProjectionTargetKey(target)]
        )
      : client.query<{ total?: string | number }>(
          `
SELECT COUNT(*)::int AS total
FROM iam.content_list_projection
WHERE instance_id = $1
  AND source_system = 'mainserver'
  AND content_type = $2;
          `,
          [target.instanceId, target.contentType]
        );
  });

  return Number(result.rows[0]?.total ?? 0);
};

const withProjectionSyncStateClient = async (
  target: ContentProjectionSyncTarget,
  work: (client: ProjectionDbClient, schemaMode: ProjectionSyncStateSchemaMode) => Promise<void>
): Promise<void> => {
  await withInstanceScopedDb(target.instanceId, (client) =>
    withProjectionSchemaModeRetry(target, 'sync-state', async () => {
      const schemaMode = await loadProjectionSyncStateSchemaMode(client, target.instanceId);
      await work(client, schemaMode);
    })
  );
};

export const markProjectionSyncStarted = async (
  target: ContentProjectionSyncTarget,
  refreshRunId: string,
  refreshPhase: 'hot' | 'reconciliation'
): Promise<void> => {
  await withProjectionSyncStateClient(target, async (client, schemaMode) => {
    if (schemaMode === 'scoped') {
      await client.query(
        `
INSERT INTO iam.content_list_projection_sync_state (
  instance_id,
  source_system,
  content_type,
  sync_scope_key,
  sync_mode,
  snapshot_state,
  refresh_run_id,
  refresh_phase,
  completed_page,
  is_total_final,
  last_started_at,
  updated_at
)
VALUES ($1, 'mainserver', $2, $3, 'full_refresh', 'partial_running', $4::uuid, $5, 0, FALSE, NOW(), NOW())
ON CONFLICT (instance_id, source_system, content_type, sync_scope_key)
DO UPDATE SET
  last_started_at = NOW(),
  snapshot_state = CASE WHEN iam.content_list_projection_sync_state.last_succeeded_at IS NULL THEN 'partial_running' ELSE 'complete_refreshing' END,
  refresh_run_id = EXCLUDED.refresh_run_id,
  refresh_phase = EXCLUDED.refresh_phase,
  completed_page = 0,
  skipped_invalid_count = 0,
  is_total_final = FALSE,
  updated_at = NOW();
        `,
        [
          target.instanceId,
          target.contentType,
          buildMainserverSyncScopeKey(target),
          refreshRunId,
          refreshPhase,
        ]
      );
      return;
    }

    await client.query(
      `
INSERT INTO iam.content_list_projection_sync_state (
  instance_id,
  source_system,
  content_type,
  sync_mode,
  snapshot_state,
  refresh_run_id,
  refresh_phase,
  completed_page,
  is_total_final,
  last_started_at,
  updated_at
)
VALUES ($1, 'mainserver', $2, 'full_refresh', 'partial_running', $3::uuid, $4, 0, FALSE, NOW(), NOW())
ON CONFLICT (instance_id, source_system, content_type)
DO UPDATE SET
  last_started_at = NOW(),
  snapshot_state = CASE WHEN iam.content_list_projection_sync_state.last_succeeded_at IS NULL THEN 'partial_running' ELSE 'complete_refreshing' END,
  refresh_run_id = EXCLUDED.refresh_run_id,
  refresh_phase = EXCLUDED.refresh_phase,
  completed_page = 0,
  skipped_invalid_count = 0,
  is_total_final = FALSE,
  updated_at = NOW();
      `,
      [target.instanceId, target.contentType, refreshRunId, refreshPhase]
    );
  });
};

export const markProjectionSyncFailed = async (
  target: ContentProjectionSyncTarget,
  refreshRunId: string,
  errorCode: string,
  errorMessage: string
): Promise<void> => {
  await withProjectionSyncStateClient(target, async (client, schemaMode) => {
    if (schemaMode === 'scoped') {
      await client.query(
        `
UPDATE iam.content_list_projection_sync_state
SET
  last_failed_at = NOW(),
  last_error_code = $5,
  last_error_message = $6,
  snapshot_state = CASE WHEN iam.content_list_projection_sync_state.last_succeeded_at IS NULL THEN 'partial_failed' ELSE 'complete_failed' END,
  is_total_final = FALSE,
  updated_at = NOW()
WHERE instance_id = $1
  AND source_system = 'mainserver'
  AND content_type = $2
  AND sync_scope_key = $3
  AND refresh_run_id = $4::uuid;
        `,
        [
          target.instanceId,
          target.contentType,
          buildMainserverSyncScopeKey(target),
          refreshRunId,
          errorCode,
          errorMessage,
        ]
      );
      return;
    }

    await client.query(
      `
UPDATE iam.content_list_projection_sync_state
SET
  last_failed_at = NOW(),
  last_error_code = $4,
  last_error_message = $5,
  snapshot_state = CASE WHEN iam.content_list_projection_sync_state.last_succeeded_at IS NULL THEN 'partial_failed' ELSE 'complete_failed' END,
  is_total_final = FALSE,
  updated_at = NOW()
WHERE instance_id = $1
  AND source_system = 'mainserver'
  AND content_type = $2
  AND refresh_run_id = $3::uuid;
      `,
      [target.instanceId, target.contentType, refreshRunId, errorCode, errorMessage]
    );
  });
};

export const markProjectionRefreshPhase = async (
  target: ContentProjectionSyncTarget,
  refreshRunId: string,
  refreshPhase: 'hot' | 'reconciliation'
): Promise<void> => {
  await withProjectionSyncStateClient(target, async (client, schemaMode) => {
    await client.query(
      schemaMode === 'scoped'
        ? `
UPDATE iam.content_list_projection_sync_state
SET refresh_phase = $5,
    updated_at = NOW()
WHERE instance_id = $1
  AND source_system = 'mainserver'
  AND content_type = $2
  AND sync_scope_key = $3
  AND refresh_run_id = $4::uuid;
          `
        : `
UPDATE iam.content_list_projection_sync_state
SET refresh_phase = $4,
    updated_at = NOW()
WHERE instance_id = $1
  AND source_system = 'mainserver'
  AND content_type = $2
  AND refresh_run_id = $3::uuid;
          `,
      schemaMode === 'scoped'
        ? [
            target.instanceId,
            target.contentType,
            buildMainserverSyncScopeKey(target),
            refreshRunId,
            refreshPhase,
          ]
        : [target.instanceId, target.contentType, refreshRunId, refreshPhase]
    );
  });
};
