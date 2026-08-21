import { withInstanceScopedDb } from '@sva/auth-runtime/server';

import type { MainserverContentType } from './iam-content-list-api.shared.js';
import {
  dedupeProjectionRows,
  type ContentProjectionSyncTarget,
  type MainserverProjectionRowInput,
  type ProjectionDbClient,
  type ProjectionRefreshTrigger,
  type ProjectionSyncStateRow,
} from './iam-content-list-projection-model.server.js';
import { buildMainserverProjectionScopeKey } from './mainserver-projection-scope.server.js';

type ProjectionSyncStateSchemaMode = 'legacy' | 'scoped';
type ProjectionTableSchemaMode = 'legacy' | 'scoped';
type ProjectionSchemaModeCategory = 'sync-state' | 'table' | 'all';

const projectionSyncStateSchemaModes = new Map<string, ProjectionSyncStateSchemaMode>();
const projectionTableSchemaModes = new Map<string, ProjectionTableSchemaMode>();

export const resetProjectionRepositoryRuntimeState = (): void => {
  projectionSyncStateSchemaModes.clear();
  projectionTableSchemaModes.clear();
};
const clearProjectionSchemaModeCache = (
  instanceId: string,
  category: ProjectionSchemaModeCategory
): void => {
  if (category === 'sync-state' || category === 'all') {
    projectionSyncStateSchemaModes.delete(instanceId);
  }
  if (category === 'table' || category === 'all') {
    projectionTableSchemaModes.delete(instanceId);
  }
};

const isProjectionSchemaModeMismatchError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as {
    code?: unknown;
    column?: unknown;
    constraint?: unknown;
    message?: unknown;
  };
  const readString = (value: unknown): string => (typeof value === 'string' ? value : '');
  const code = readString(candidate.code);
  const scopeReferences = [
    'projection_scope_key',
    'sync_scope_key',
    'content_list_projection_scope_key',
    'content_list_projection_sync_state_pkey',
  ];
  const diagnosticText = [candidate.column, candidate.constraint, candidate.message]
    .map(readString)
    .join(' ');

  return (
    ['42703', '42704', '42P10', '23502', '23505'].includes(code) &&
    scopeReferences.some((reference) => diagnosticText.includes(reference))
  );
};

export const withProjectionSchemaModeRetry = async <T>(
  target: ContentProjectionSyncTarget,
  category: ProjectionSchemaModeCategory,
  work: () => Promise<T>
): Promise<T> => {
  try {
    return await work();
  } catch (error) {
    if (!isProjectionSchemaModeMismatchError(error)) {
      throw error;
    }

    clearProjectionSchemaModeCache(target.instanceId, category);
    return work();
  }
};

export const buildProjectionTargetKey = (target: ContentProjectionSyncTarget): string => {
  if (!target.actorAccountId) {
    throw new Error('mainserver_projection_scope_requires_actor_account_id');
  }

  return buildMainserverProjectionScopeKey({
    instanceId: target.instanceId,
    actorAccountId: target.actorAccountId,
    activeOrganizationId: target.organizationId,
    ...(target.actingPrincipalType ? { actingPrincipalType: target.actingPrincipalType } : {}),
    contentType: target.contentType,
  });
};

export const buildMainserverReadScopeKeys = (input: {
  readonly instanceId: string;
  readonly contentTypes: readonly string[];
  readonly actorAccountId: string | undefined;
  readonly activeOrganizationId: string | undefined;
}): readonly string[] => {
  if (!input.actorAccountId) {
    return [];
  }
  const actorAccountId = input.actorAccountId;

  return input.contentTypes
    .flatMap((contentType) => {
      const mainserverContentType = toMainserverContentType(contentType);
      if (!mainserverContentType) {
        return [];
      }

      const principalTypes = input.activeOrganizationId
        ? (['user', 'organization', undefined] as const)
        : (['user', undefined] as const);
      return principalTypes.map((actingPrincipalType) =>
        buildMainserverProjectionScopeKey({
          instanceId: input.instanceId,
          actorAccountId,
          activeOrganizationId: input.activeOrganizationId,
          ...(actingPrincipalType ? { actingPrincipalType } : {}),
          contentType: mainserverContentType,
        })
      );
    })
    .filter((value, index, values) => values.indexOf(value) === index);
};

export const buildMainserverSyncScopeKey = (target: ContentProjectionSyncTarget): string =>
  buildProjectionTargetKey(target);

const loadProjectionSyncStateSchemaMode = async (
  client: ProjectionDbClient,
  instanceId: string
): Promise<ProjectionSyncStateSchemaMode> => {
  const cachedMode = projectionSyncStateSchemaModes.get(instanceId);
  if (cachedMode) {
    return cachedMode;
  }

  const result = await client.query<{ has_sync_scope_key?: boolean }>(
    `
SELECT EXISTS (
  SELECT 1
  FROM information_schema.columns
  WHERE table_schema = 'iam'
    AND table_name = 'content_list_projection_sync_state'
    AND column_name = 'sync_scope_key'
) AS has_sync_scope_key;
    `
  );

  const mode = result.rows[0]?.has_sync_scope_key ? 'scoped' : 'legacy';
  projectionSyncStateSchemaModes.set(instanceId, mode);
  return mode;
};

export const loadProjectionTableSchemaMode = async (
  client: ProjectionDbClient,
  instanceId: string
): Promise<ProjectionTableSchemaMode> => {
  const cachedMode = projectionTableSchemaModes.get(instanceId);
  if (cachedMode) {
    return cachedMode;
  }

  const result = await client.query<{ has_projection_scope_key?: boolean }>(
    `
SELECT EXISTS (
  SELECT 1
  FROM information_schema.columns
  WHERE table_schema = 'iam'
    AND table_name = 'content_list_projection'
    AND column_name = 'projection_scope_key'
) AS has_projection_scope_key;
    `
  );

  const mode = result.rows[0]?.has_projection_scope_key ? 'scoped' : 'legacy';
  projectionTableSchemaModes.set(instanceId, mode);
  return mode;
};

export const buildProjectionLogContext = (
  target: ContentProjectionSyncTarget,
  trigger: ProjectionRefreshTrigger
): Record<string, unknown> => ({
  actor_account_id: target.actorAccountId ?? null,
  content_type: target.contentType,
  instance_id: target.instanceId,
  keycloak_subject: target.keycloakSubject,
  organization_id: target.organizationId ?? null,
  projection_scope_key: buildProjectionTargetKey(target),
  refresh_trigger: trigger,
});

export const toMainserverContentType = (value: string): MainserverContentType | null => {
  if (
    value === 'news.article' ||
    value === 'events.event-record' ||
    value === 'poi.point-of-interest' ||
    value === 'generic-items.generic-item' ||
    value === 'faq.faq' ||
    value === 'cockpit-cards.cockpit-card' ||
    value === 'projects.project' ||
    value === 'surveys.survey'
  ) {
    return value;
  }

  return null;
};

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

const scopedMainserverProjectionUpsertSql = `
INSERT INTO iam.content_list_projection (
  id,
  instance_id,
  projection_scope_key,
  organization_id,
  owner_user_id,
  owner_organization_id,
  content_type,
  title,
  published_at,
  publish_from,
  publish_until,
  created_at,
  created_by,
  updated_at,
  updated_by,
  author_display_mode,
  author_display_name,
  source_data_provider_id,
  source_data_provider_name,
  credential_source,
  credential_fingerprint,
  authorization_mode,
  payload_json,
  status,
  validation_state,
  history_ref,
  current_revision_ref,
  last_audit_event_ref,
  source_system,
  source_entity_type,
  source_entity_id,
  projection_updated_at
)
SELECT
  item.id,
  item.instance_id,
  item.projection_scope_key,
  item.organization_id::uuid,
  item.owner_user_id::uuid,
  item.owner_organization_id::uuid,
  item.content_type,
  item.title,
  item.published_at::timestamptz,
  item.publish_from::timestamptz,
  item.publish_until::timestamptz,
  item.created_at::timestamptz,
  item.created_by,
  item.updated_at::timestamptz,
  item.updated_by,
  item.author_display_mode,
  item.author_display_name,
  item.source_data_provider_id,
  item.source_data_provider_name,
  item.credential_source,
  item.credential_fingerprint,
  item.authorization_mode,
  item.payload_json::jsonb,
  item.status,
  item.validation_state,
  item.history_ref,
  NULLIF(item.current_revision_ref, ''),
  NULLIF(item.last_audit_event_ref, ''),
  'mainserver',
  item.source_entity_type,
  item.source_entity_id,
  NOW()
FROM jsonb_to_recordset($1::jsonb) AS item(
  id text,
  instance_id text,
  projection_scope_key text,
  organization_id text,
  owner_user_id text,
  owner_organization_id text,
  content_type text,
  title text,
  published_at text,
  publish_from text,
  publish_until text,
  created_at text,
  created_by text,
  updated_at text,
  updated_by text,
  author_display_mode text,
  author_display_name text,
  source_data_provider_id text,
  source_data_provider_name text,
  credential_source text,
  credential_fingerprint text,
  authorization_mode text,
  payload_json jsonb,
  status text,
  validation_state text,
  history_ref text,
  current_revision_ref text,
  last_audit_event_ref text,
  source_entity_type text,
  source_entity_id text
)
ON CONFLICT ON CONSTRAINT content_list_projection_scope_key
DO UPDATE SET
  id = EXCLUDED.id,
  title = EXCLUDED.title,
  published_at = EXCLUDED.published_at,
  publish_from = EXCLUDED.publish_from,
  publish_until = EXCLUDED.publish_until,
  created_at = EXCLUDED.created_at,
  created_by = EXCLUDED.created_by,
  updated_at = EXCLUDED.updated_at,
  updated_by = EXCLUDED.updated_by,
  author_display_mode = EXCLUDED.author_display_mode,
  author_display_name = EXCLUDED.author_display_name,
  source_data_provider_id = EXCLUDED.source_data_provider_id,
  source_data_provider_name = EXCLUDED.source_data_provider_name,
  credential_source = EXCLUDED.credential_source,
  credential_fingerprint = EXCLUDED.credential_fingerprint,
  authorization_mode = EXCLUDED.authorization_mode,
  payload_json = EXCLUDED.payload_json,
  status = EXCLUDED.status,
  validation_state = EXCLUDED.validation_state,
  history_ref = EXCLUDED.history_ref,
  current_revision_ref = EXCLUDED.current_revision_ref,
  last_audit_event_ref = EXCLUDED.last_audit_event_ref,
  projection_updated_at = NOW();
`;

const legacyMainserverProjectionUpsertSql = `
INSERT INTO iam.content_list_projection (
  id,
  instance_id,
  organization_id,
  owner_user_id,
  owner_organization_id,
  content_type,
  title,
  published_at,
  publish_from,
  publish_until,
  created_at,
  created_by,
  updated_at,
  updated_by,
  author_display_mode,
  author_display_name,
  source_data_provider_id,
  source_data_provider_name,
  credential_source,
  credential_fingerprint,
  authorization_mode,
  payload_json,
  status,
  validation_state,
  history_ref,
  current_revision_ref,
  last_audit_event_ref,
  source_system,
  source_entity_type,
  source_entity_id,
  projection_updated_at
)
SELECT
  item.id,
  item.instance_id,
  item.organization_id::uuid,
  item.owner_user_id::uuid,
  item.owner_organization_id::uuid,
  item.content_type,
  item.title,
  item.published_at::timestamptz,
  item.publish_from::timestamptz,
  item.publish_until::timestamptz,
  item.created_at::timestamptz,
  item.created_by,
  item.updated_at::timestamptz,
  item.updated_by,
  item.author_display_mode,
  item.author_display_name,
  item.source_data_provider_id,
  item.source_data_provider_name,
  item.credential_source,
  item.credential_fingerprint,
  item.authorization_mode,
  item.payload_json::jsonb,
  item.status,
  item.validation_state,
  item.history_ref,
  NULLIF(item.current_revision_ref, ''),
  NULLIF(item.last_audit_event_ref, ''),
  'mainserver',
  item.source_entity_type,
  item.source_entity_id,
  NOW()
FROM jsonb_to_recordset($1::jsonb) AS item(
  id text,
  instance_id text,
  organization_id text,
  owner_user_id text,
  owner_organization_id text,
  content_type text,
  title text,
  published_at text,
  publish_from text,
  publish_until text,
  created_at text,
  created_by text,
  updated_at text,
  updated_by text,
  author_display_mode text,
  author_display_name text,
  source_data_provider_id text,
  source_data_provider_name text,
  credential_source text,
  credential_fingerprint text,
  authorization_mode text,
  payload_json jsonb,
  status text,
  validation_state text,
  history_ref text,
  current_revision_ref text,
  last_audit_event_ref text,
  source_entity_type text,
  source_entity_id text
)
ON CONFLICT ON CONSTRAINT content_list_projection_scope_key
DO UPDATE SET
  id = EXCLUDED.id,
  title = EXCLUDED.title,
  published_at = EXCLUDED.published_at,
  publish_from = EXCLUDED.publish_from,
  publish_until = EXCLUDED.publish_until,
  created_at = EXCLUDED.created_at,
  created_by = EXCLUDED.created_by,
  updated_at = EXCLUDED.updated_at,
  updated_by = EXCLUDED.updated_by,
  author_display_mode = EXCLUDED.author_display_mode,
  author_display_name = EXCLUDED.author_display_name,
  source_data_provider_id = EXCLUDED.source_data_provider_id,
  source_data_provider_name = EXCLUDED.source_data_provider_name,
  credential_source = EXCLUDED.credential_source,
  credential_fingerprint = EXCLUDED.credential_fingerprint,
  authorization_mode = EXCLUDED.authorization_mode,
  payload_json = EXCLUDED.payload_json,
  status = EXCLUDED.status,
  validation_state = EXCLUDED.validation_state,
  history_ref = EXCLUDED.history_ref,
  current_revision_ref = EXCLUDED.current_revision_ref,
  last_audit_event_ref = EXCLUDED.last_audit_event_ref,
  projection_updated_at = NOW();
`;

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
