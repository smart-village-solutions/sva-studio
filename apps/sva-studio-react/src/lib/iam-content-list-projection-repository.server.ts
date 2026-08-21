import { withInstanceScopedDb } from '@sva/auth-runtime/server';

import {
  dedupeProjectionRows,
  type ContentProjectionSyncTarget,
  type MainserverProjectionRowInput,
  type ProjectionDbClient,
} from './iam-content-list-projection-model.server.js';
import {
  buildMainserverSyncScopeKey,
  buildProjectionTargetKey,
  loadProjectionSyncStateSchemaMode,
  loadProjectionTableSchemaMode,
  type ProjectionSyncStateSchemaMode,
  withProjectionSchemaModeRetry,
} from './iam-content-list-projection-repository-schema.server.js';
import { countProjectedRowsForScopeWithClient } from './iam-content-list-projection-repository-sync-state.server.js';
import {
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
  selector: ProjectionDeleteSelector
): Promise<void> => {
  await withProjectionSchemaModeRetry(target, 'table', async () => {
    const schemaMode = await loadProjectionTableSchemaMode(client, target.instanceId);
    const values: unknown[] = [target.instanceId, target.contentType];
    const predicates = ['instance_id = $1', "source_system = 'mainserver'", 'content_type = $2'];
    if (schemaMode === 'scoped') {
      values.push(buildProjectionTargetKey(target));
      predicates.push(`projection_scope_key = $${values.length}`);
    }
    if (selector.kind !== 'all') {
      values.push(target.contentType);
      predicates.push(`source_entity_type = $${values.length}`);
      if (selector.kind === 'entity') {
        values.push(selector.sourceEntityId);
        predicates.push(`source_entity_id = $${values.length}`);
      } else {
        values.push(selector.retainedEntityIds);
        predicates.push(`NOT (source_entity_id = ANY($${values.length}::text[]))`);
      }
    }
    await client.query(
      `
DELETE FROM iam.content_list_projection
WHERE ${predicates.join('\n  AND ')};
    `,
      values
    );
  });
};

const deleteMainserverProjectionRowsNotInSet = async (
  client: ProjectionDbClient,
  target: ContentProjectionSyncTarget,
  retainedEntityIds: readonly string[]
): Promise<void> => {
  if (retainedEntityIds.length === 0) {
    await deleteMainserverProjectionRows(client, target, { kind: 'all' });
    return;
  }
  await deleteMainserverProjectionRows(client, target, { kind: 'except', retainedEntityIds });
};

export const deleteMainserverProjectionRowByEntity = async (
  client: ProjectionDbClient,
  target: ContentProjectionSyncTarget,
  sourceEntityId: string
): Promise<void> => {
  await deleteMainserverProjectionRows(client, target, { kind: 'entity', sourceEntityId });
};

const toNullableProjectionValue = <T>(value: T | null | undefined): T | null => value ?? null;

const toRequiredProjectionReference = (value: string | null | undefined): string => value ?? '';

const mapMainserverProjectionPayloadRow = (
  row: MainserverProjectionRowInput,
  _actorAccountId: string | undefined,
  projectionScopeKey: string
) => ({
  id: row.id,
  instance_id: row.instanceId,
  projection_scope_key: projectionScopeKey,
  organization_id: toNullableProjectionValue(row.organizationId),
  owner_user_id: toNullableProjectionValue(row.ownerUserId),
  owner_organization_id: toNullableProjectionValue(row.ownerOrganizationId),
  content_type: row.contentType,
  title: row.title,
  published_at: toNullableProjectionValue(row.publishedAt),
  publish_from: toNullableProjectionValue(row.publishFrom),
  publish_until: toNullableProjectionValue(row.publishUntil),
  created_at: row.createdAt,
  created_by: row.createdBy,
  updated_at: row.updatedAt,
  updated_by: row.updatedBy,
  author_display_mode: row.authorDisplayMode,
  author_display_name: row.author,
  source_data_provider_id: toNullableProjectionValue(row.sourceDataProviderId),
  source_data_provider_name: toNullableProjectionValue(row.sourceDataProviderName),
  credential_source: toNullableProjectionValue(row.credentialSource),
  credential_fingerprint: toNullableProjectionValue(row.credentialFingerprint),
  authorization_mode: row.authorizationMode ?? 'credential_visible_compatibility',
  payload_json: row.payload,
  status: row.status,
  validation_state: row.validationState,
  history_ref: row.historyRef,
  current_revision_ref: toRequiredProjectionReference(row.currentRevisionRef),
  last_audit_event_ref: toRequiredProjectionReference(row.lastAuditEventRef),
  source_entity_type: row.sourceEntityType,
  source_entity_id: row.sourceEntityId,
});

const buildMainserverProjectionPayloadJson = (
  rows: readonly MainserverProjectionRowInput[],
  actorAccountId: string | undefined,
  projectionScopeKey: string
): string =>
  JSON.stringify(
    rows.map((row) => mapMainserverProjectionPayloadRow(row, actorAccountId, projectionScopeKey))
  );

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
    const leader = await client.query<{ refresh_run_id?: string | null }>(
      `SELECT refresh_run_id::text FROM iam.content_list_projection_sync_state
       WHERE instance_id = $1 AND source_system = 'mainserver' AND content_type = $2
         AND sync_scope_key = $3 FOR UPDATE;`,
      [target.instanceId, target.contentType, buildMainserverSyncScopeKey(target)]
    );
    if (leader.rows[0]?.refresh_run_id !== refreshRunId) {
      return;
    }
    await upsertMainserverProjectionRows(client, target, projectionPayloadJson);
    const projectedCount = await countProjectedRowsForScopeWithClient(client, target);
    await markMainserverProjectionSyncSucceeded(client, target, projectedCount);
  });
};

export const markMainserverProjectionSyncSucceeded = async (
  client: ProjectionDbClient,
  target: ContentProjectionSyncTarget,
  projectedCount: number
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
VALUES ($1, 'mainserver', $2, $3, 'full_refresh', NOW(), NOW(), NULL, NULL, $4, 'complete_fresh', $4, TRUE, NOW())
ON CONFLICT (instance_id, source_system, content_type, sync_scope_key)
DO UPDATE SET
  last_started_at = NOW(),
  last_succeeded_at = NOW(),
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
        [target.instanceId, target.contentType, buildMainserverSyncScopeKey(target), projectedCount]
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
VALUES ($1, 'mainserver', $2, 'full_refresh', NOW(), NOW(), NULL, NULL, $3, 'complete_fresh', $3, TRUE, NOW())
ON CONFLICT (instance_id, source_system, content_type)
DO UPDATE SET
  last_started_at = NOW(),
  last_succeeded_at = NOW(),
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
      [target.instanceId, target.contentType, projectedCount]
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
}>;

const loadProjectionRefreshLeader = async (
  client: ProjectionDbClient,
  target: ContentProjectionSyncTarget,
  schemaMode: ProjectionSyncStateSchemaMode
): Promise<string | null> => {
  const result = await client.query<{ refresh_run_id?: string | null }>(
    schemaMode === 'scoped'
      ? `SELECT refresh_run_id::text FROM iam.content_list_projection_sync_state
         WHERE instance_id = $1 AND source_system = 'mainserver' AND content_type = $2
           AND sync_scope_key = $3 LIMIT 1 FOR UPDATE;`
      : `SELECT refresh_run_id::text FROM iam.content_list_projection_sync_state
         WHERE instance_id = $1 AND source_system = 'mainserver' AND content_type = $2
         LIMIT 1 FOR UPDATE;`,
    schemaMode === 'scoped'
      ? [target.instanceId, target.contentType, buildMainserverSyncScopeKey(target)]
      : [target.instanceId, target.contentType]
  );
  return result.rows[0]?.refresh_run_id ?? null;
};

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
  await deleteMainserverProjectionRowsNotInSet(
    client,
    input.target,
    rows.map((row) => row.sourceEntityId)
  );
  const projectedCount = await countProjectedRowsForScopeWithClient(client, input.target);
  await markMainserverProjectionSyncSucceeded(client, input.target, projectedCount);
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

  await withInstanceScopedDb(input.target.instanceId, async (client) => {
    await withProjectionSchemaModeRetry(input.target, 'sync-state', async () => {
      const schemaMode = await loadProjectionSyncStateSchemaMode(client, input.target.instanceId);
      const persistedRunId = await loadProjectionRefreshLeader(client, input.target, schemaMode);
      if (persistedRunId !== input.refreshRunId) {
        return;
      }

      if (projectionPayloadJson) {
        await upsertMainserverProjectionRows(client, input.target, projectionPayloadJson);
      }
      const availableCount = await countProjectedRowsForScopeWithClient(client, input.target);
      await updateProjectionRefreshProgress(client, input, schemaMode, availableCount);
      await finalizeProgressiveProjectionRefresh(client, input, dedupedRows);
    });
  });
};
