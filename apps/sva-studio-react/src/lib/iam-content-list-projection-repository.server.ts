import { withInstanceScopedDb } from '@sva/auth-runtime/server';

import {
  dedupeProjectionRows,
  type ContentProjectionSyncTarget,
  type MainserverProjectionRowInput,
  type ProjectionDbClient,
} from './iam-content-list-projection-model.server.js';
import { reconcilePersistedMainserverProjectionRows } from './iam-content-list-projection-reconciliation.server.js';
import {
  buildMainserverSyncScopeKey,
  buildProjectionTargetKey,
  buildRefreshDeletionScopeKeys,
  loadProjectionSyncStateSchemaMode,
  loadProjectionTableSchemaMode,
  type ProjectionSyncStateSchemaMode,
  withProjectionSchemaModeRetry,
} from './iam-content-list-projection-repository-schema.server.js';
import {
  countProjectedRowsForScopeWithClient,
  hasNewerMainserverProjectionSuccess,
  loadProjectionRefreshLeader,
  lockMainserverProjectionType,
  markMainserverGlobalMutationSucceeded,
  markProjectionSyncFailed,
} from './iam-content-list-projection-repository-sync-state.server.js';
import { deleteTransferredProjectionRowsFromOtherScopes } from './iam-content-list-projection-repository-transfer.server.js';
import {
  buildMainserverProjectionPayloadJson,
  legacyMainserverProjectionUpsertSql,
  scopedMainserverProjectionUpsertSql,
} from './iam-content-list-projection-repository-sql.server.js';

export * from './iam-content-list-projection-repository-schema.server.js';
export * from './iam-content-list-projection-repository-sync-state.server.js';

type ProjectionDeleteSelector =
  | Readonly<{ kind: 'all' }>
  | Readonly<{ kind: 'except'; retainedEntityIds: readonly string[] }>
  | Readonly<{ kind: 'entity'; sourceEntityId: string }>;

const deleteMainserverProjectionRows = async (
  client: ProjectionDbClient,
  target: ContentProjectionSyncTarget,
  selector: ProjectionDeleteSelector,
  refreshCredentialSource?: 'user' | 'organization'
): Promise<void> => {
  await withProjectionSchemaModeRetry(target, 'table', async () => {
    const schemaMode = await loadProjectionTableSchemaMode(client, target.instanceId);
    const values: unknown[] = [target.instanceId, target.contentType];
    const predicates = [
      'projection.instance_id = $1',
      "projection.source_system = 'mainserver'",
      'projection.content_type = $2',
    ];
    if (schemaMode === 'scoped' && selector.kind !== 'entity') {
      values.push(buildRefreshDeletionScopeKeys(target, refreshCredentialSource));
      predicates.push(`projection.projection_scope_key = ANY($${values.length}::text[])`);
    }
    if (selector.kind !== 'all') {
      values.push(target.contentType);
      predicates.push(`projection.source_entity_type = $${values.length}`);
      if (selector.kind === 'entity') {
        values.push(selector.sourceEntityId);
        predicates.push(`projection.source_entity_id = $${values.length}`);
      } else {
        values.push(selector.retainedEntityIds);
        predicates.push(`NOT (projection.source_entity_id = ANY($${values.length}::text[]))`);
      }
    }
    await client.query(
      `
DELETE FROM iam.content_list_projection AS projection
WHERE ${predicates.join('\n  AND ')};
    `,
      values
    );
  });
};

export const deleteMainserverProjectionRowByEntity = async (
  client: ProjectionDbClient,
  target: ContentProjectionSyncTarget,
  sourceEntityId: string
): Promise<void> => {
  await deleteMainserverProjectionRows(client, target, { kind: 'entity', sourceEntityId });
};

const upsertMainserverProjectionRows = async (
  client: ProjectionDbClient,
  target: ContentProjectionSyncTarget,
  payloadJson: string
): Promise<void> => {
  await withProjectionSchemaModeRetry(target, 'table', async () => {
    const schemaMode = await loadProjectionTableSchemaMode(client, target.instanceId);
    await client.query(
      schemaMode === 'scoped'
        ? scopedMainserverProjectionUpsertSql
        : legacyMainserverProjectionUpsertSql,
      [payloadJson]
    );
  });
};

export const upsertSingleMainserverProjectionRow = async (
  target: ContentProjectionSyncTarget,
  actorAccountId: string | undefined,
  row: MainserverProjectionRowInput,
  refreshRunId: string
): Promise<void> => {
  const projectionPayloadJson = buildMainserverProjectionPayloadJson(
    [row],
    actorAccountId,
    buildProjectionTargetKey(target)
  );

  await withInstanceScopedDb(target.instanceId, async (client) => {
    await lockMainserverProjectionType(client, target);
    const schemaMode = await loadProjectionSyncStateSchemaMode(client, target.instanceId);
    const leader = await loadProjectionRefreshLeader(client, target, schemaMode);
    if (leader?.refresh_run_id !== refreshRunId) return;
    if (
      await hasNewerMainserverProjectionSuccess(
        client,
        target,
        leader.last_started_at,
        schemaMode,
        row.credentialSource
      )
    ) {
      throw Object.assign(new Error('Ein neuerer Mainserver-Abgleich hat diesen Lauf überholt.'), {
        code: 'projection_refresh_superseded',
      });
    }
    await upsertMainserverProjectionRows(client, target, projectionPayloadJson);
    await deleteTransferredProjectionRowsFromOtherScopes(client, target, row);
    const projectedCount = await countProjectedRowsForScopeWithClient(client, target);
    await markMainserverProjectionSyncSucceeded(client, target, projectedCount);
    if (target.ownershipPrincipal) await markMainserverGlobalMutationSucceeded(client, target);
  });
};

export const markMainserverProjectionSyncSucceeded = async (
  client: ProjectionDbClient,
  target: ContentProjectionSyncTarget,
  projectedCount: number,
  preserveRefreshStart = false
): Promise<void> => {
  await withProjectionSchemaModeRetry(target, 'sync-state', async () => {
    const schemaMode = await loadProjectionSyncStateSchemaMode(client, target.instanceId);
    if (schemaMode === 'scoped') {
      await client.query(
        `
INSERT INTO iam.content_list_projection_sync_state (
  instance_id,
  source_system,
  content_type,
  sync_scope_key,
  sync_mode,
  last_started_at,
  last_succeeded_at,
  last_error_code,
  last_error_message,
  projected_count,
  snapshot_state,
  available_count,
  is_total_final,
  updated_at
)
VALUES ($1, 'mainserver', $2, $3, 'full_refresh', statement_timestamp(), statement_timestamp(), NULL, NULL, $4, 'complete_fresh', $4, TRUE, NOW())
ON CONFLICT (instance_id, source_system, content_type, sync_scope_key)
DO UPDATE SET
  last_started_at = CASE WHEN $5::boolean THEN iam.content_list_projection_sync_state.last_started_at ELSE statement_timestamp() END,
  last_succeeded_at = statement_timestamp(),
  last_error_code = NULL,
  last_error_message = NULL,
  projected_count = EXCLUDED.projected_count,
  snapshot_state = 'complete_fresh',
  available_count = EXCLUDED.available_count,
  is_total_final = TRUE,
  refresh_run_id = NULL,
  refresh_phase = NULL,
  updated_at = NOW();
      `,
        [
          target.instanceId,
          target.contentType,
          buildMainserverSyncScopeKey(target),
          projectedCount,
          preserveRefreshStart,
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
  last_started_at,
  last_succeeded_at,
  last_error_code,
  last_error_message,
  projected_count,
  snapshot_state,
  available_count,
  is_total_final,
  updated_at
)
VALUES ($1, 'mainserver', $2, 'full_refresh', statement_timestamp(), statement_timestamp(), NULL, NULL, $3, 'complete_fresh', $3, TRUE, NOW())
ON CONFLICT (instance_id, source_system, content_type)
DO UPDATE SET
  last_started_at = CASE WHEN $4::boolean THEN iam.content_list_projection_sync_state.last_started_at ELSE statement_timestamp() END,
  last_succeeded_at = statement_timestamp(),
  last_error_code = NULL,
  last_error_message = NULL,
  projected_count = EXCLUDED.projected_count,
  snapshot_state = 'complete_fresh',
  available_count = EXCLUDED.available_count,
  is_total_final = TRUE,
  refresh_run_id = NULL,
  refresh_phase = NULL,
  updated_at = NOW();
    `,
      [target.instanceId, target.contentType, projectedCount, preserveRefreshStart]
    );
  });
};

type ProgressiveProjectionPersistenceInput = Readonly<{
  readonly target: ContentProjectionSyncTarget;
  readonly keycloakSubject: string;
  readonly actorAccountId: string | undefined;
  readonly rows: readonly MainserverProjectionRowInput[];
  readonly finalize: boolean;
  readonly page: number;
  readonly refreshRunId: string;
  readonly skippedInvalidCount: number;
  readonly refreshCredentialSource?: 'user' | 'organization';
}>;

const updateProjectionRefreshProgress = async (
  client: ProjectionDbClient,
  input: ProgressiveProjectionPersistenceInput,
  schemaMode: ProjectionSyncStateSchemaMode,
  availableCount: number
): Promise<void> => {
  await client.query(
    schemaMode === 'scoped'
      ? `UPDATE iam.content_list_projection_sync_state
         SET snapshot_state = CASE WHEN last_succeeded_at IS NULL THEN 'partial_running' ELSE 'complete_refreshing' END,
             completed_page = GREATEST(completed_page, $5), available_count = $6,
             skipped_invalid_count = $7, is_total_final = FALSE, updated_at = NOW()
         WHERE instance_id = $1 AND source_system = 'mainserver' AND content_type = $2
           AND sync_scope_key = $3 AND (refresh_run_id = $4::uuid OR refresh_run_id IS NULL);`
      : `UPDATE iam.content_list_projection_sync_state
         SET snapshot_state = CASE WHEN last_succeeded_at IS NULL THEN 'partial_running' ELSE 'complete_refreshing' END,
             completed_page = GREATEST(completed_page, $4), available_count = $5,
             skipped_invalid_count = $6, is_total_final = FALSE, updated_at = NOW()
         WHERE instance_id = $1 AND source_system = 'mainserver' AND content_type = $2
           AND (refresh_run_id = $3::uuid OR refresh_run_id IS NULL);`,
    schemaMode === 'scoped'
      ? [
          input.target.instanceId,
          input.target.contentType,
          buildMainserverSyncScopeKey(input.target),
          input.refreshRunId,
          input.page,
          availableCount,
          input.skippedInvalidCount,
        ]
      : [
          input.target.instanceId,
          input.target.contentType,
          input.refreshRunId,
          input.page,
          availableCount,
          input.skippedInvalidCount,
        ]
  );
};

const finalizeProgressiveProjectionRefresh = async (
  client: ProjectionDbClient,
  input: ProgressiveProjectionPersistenceInput,
  rows: readonly MainserverProjectionRowInput[]
): Promise<void> => {
  if (!input.finalize || input.skippedInvalidCount !== 0) return;
  await deleteMainserverProjectionRows(
    client,
    input.target,
    rows.length === 0
      ? { kind: 'all' }
      : { kind: 'except', retainedEntityIds: rows.map((row) => row.sourceEntityId) },
    input.refreshCredentialSource
  );
  const projectedCount = await countProjectedRowsForScopeWithClient(client, input.target);
  await markMainserverProjectionSyncSucceeded(client, input.target, projectedCount, true);
};

export const persistMainserverProjectionRowsProgressively = async (
  input: ProgressiveProjectionPersistenceInput
): Promise<void> => {
  const dedupedRows = dedupeProjectionRows(input.rows, input.keycloakSubject);
  const projectionPayloadJson =
    dedupedRows.length > 0
      ? buildMainserverProjectionPayloadJson(
          dedupedRows,
          input.actorAccountId,
          buildProjectionTargetKey(input.target)
        )
      : null;

  let rowsPersisted = false;
  let superseded = false;
  await withInstanceScopedDb(input.target.instanceId, async (client) => {
    await lockMainserverProjectionType(client, input.target);
    await withProjectionSchemaModeRetry(input.target, 'sync-state', async () => {
      const schemaMode = await loadProjectionSyncStateSchemaMode(client, input.target.instanceId);
      const leader = await loadProjectionRefreshLeader(client, input.target, schemaMode);
      if (leader?.refresh_run_id !== input.refreshRunId) return;
      if (
        await hasNewerMainserverProjectionSuccess(
          client,
          input.target,
          leader.last_started_at,
          schemaMode,
          input.refreshCredentialSource
        )
      ) {
        superseded = true;
        return;
      }

      if (projectionPayloadJson) {
        await upsertMainserverProjectionRows(client, input.target, projectionPayloadJson);
        rowsPersisted = true;
      }
      const availableCount = await countProjectedRowsForScopeWithClient(client, input.target);
      await updateProjectionRefreshProgress(client, input, schemaMode, availableCount);
      await finalizeProgressiveProjectionRefresh(client, input, dedupedRows);
    });
  });
  if (superseded) {
    await markProjectionSyncFailed(
      input.target,
      input.refreshRunId,
      'projection_refresh_superseded',
      'Ein neuerer Mainserver-Abgleich hat diesen Lauf überholt.'
    );
    throw Object.assign(new Error('Ein neuerer Mainserver-Abgleich hat diesen Lauf überholt.'), {
      code: 'projection_refresh_superseded',
    });
  }
  if (rowsPersisted) {
    await reconcilePersistedMainserverProjectionRows(input.target, dedupedRows);
  }
};
