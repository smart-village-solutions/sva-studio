import {
  type IamContentAccessSummary,
  type IamContentListItem,
  type IamContentListQuery,
} from '@sva/core';
import { evaluateAuthorizeDecision, type AuthorizeRequest, type EffectivePermission } from '@sva/iam-core';
import {
  type AuthenticatedRequestContext,
  resolveActorAccountId,
  resolveEffectivePermissions,
  withInstanceScopedDb,
} from '@sva/auth-runtime/server';
import {
  getSvaMainserverEvent,
  getSvaMainserverGenericItem,
  getSvaMainserverNews,
  getSvaMainserverPoi,
  listSvaMainserverEvents,
  listSvaMainserverGenericItems,
  listSvaMainserverNews,
  listSvaMainserverPoi,
  listSvaMainserverSurveys,
} from '@sva/sva-mainserver/server';
import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';

import {
  createListErrorResponse,
  EMPTY_VISIBLE_TYPE_SENTINEL,
  isMainserverContentType,
  MAINSERVER_PROGRESSIVE_FETCH_PAGE_SIZE,
  type MainserverContentType,
  normalizeApiErrorCode,
} from './iam-content-list-api.shared.js';
import {
  buildProjectionReadVisibilityRules,
  type ProjectionReadVisibilityRule,
} from './iam-content-list-visibility.js';
import { mapEventItem, mapGenericItem, mapNewsItem, mapPoiItem, mapSurveyItem } from './iam-content-list-mainserver.js';
import { runMainserverProjectionRoundRobin } from './mainserver-projection-refresh-coordinator.server.js';
import { buildMainserverProjectionScopeKey } from './mainserver-projection-scope.server.js';

const MAIN_SERVER_SYNC_STALE_MS = 5 * 60 * 1000;
const MAIN_SERVER_SYNC_POLL_INTERVAL_MS = 60 * 1000;
const MAX_SYNC_ITEMS_PER_TYPE = 5_000;
type ProjectionSyncStateSchemaMode = 'legacy' | 'scoped';
type ProjectionTableSchemaMode = 'legacy' | 'scoped';
const contentProjectionLogger = createSdkLogger({
  component: 'iam-content-list-projection',
  level: 'info',
});

export type ProjectionRow = {
  id: string;
  instance_id: string;
  projection_scope_key: string;
  organization_id: string | null;
  owner_user_id: string | null;
  owner_organization_id: string | null;
  content_type: string;
  title: string;
  published_at: string | null;
  publish_from: string | null;
  publish_until: string | null;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
  author_display_mode: IamContentListItem['authorDisplayMode'];
  author_display_name: string;
  payload_json: IamContentListItem['payload'];
  status: IamContentListItem['status'];
  validation_state: IamContentListItem['validationState'];
  history_ref: string;
  current_revision_ref: string | null;
  last_audit_event_ref: string | null;
  source_data_provider_id: string | null;
  source_data_provider_name: string | null;
  credential_source: IamContentListItem['credentialSource'] | null;
  source_system: 'iam' | 'mainserver';
  source_entity_type: string;
  source_entity_id: string;
};

type ProjectionSyncStateRow = {
  sync_scope_key: string;
  last_started_at: string | null;
  last_succeeded_at: string | null;
  last_failed_at: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
  projected_count: number;
};

type ContentProjectionSyncState = Readonly<{
  contentType: MainserverContentType;
  lastStartedAt?: string;
  lastSucceededAt?: string;
  lastFailedAt?: string;
  lastErrorCode?: string;
  isStale: boolean;
  isSyncRunning: boolean;
  hasSnapshot: boolean;
}>;

type ContentProjectionSyncTarget = Readonly<{
  instanceId: string;
  keycloakSubject: string;
  actorAccountId?: string;
  contentType: MainserverContentType;
  organizationId?: string;
}>;

type TriggerProjectionRefreshResult = Readonly<{
  status: 'accepted' | 'already_running' | 'completed' | 'failed';
  syncStates: readonly ContentProjectionSyncState[];
}>;

type MainserverProjectionMutationOperation = 'create' | 'update' | 'delete';
type TargetedMutationContentType =
  | 'news.article'
  | 'events.event-record'
  | 'poi.point-of-interest'
  | 'generic-items.generic-item';
type ProjectionRefreshTrigger =
  | 'manual'
  | 'mutation_follow_up'
  | 'reconciliation'
  | 'scheduler';

type MainserverProjectionRowInput = Pick<
  IamContentListItem,
  | 'id'
  | 'instanceId'
  | 'organizationId'
  | 'ownerUserId'
  | 'ownerOrganizationId'
  | 'contentType'
  | 'title'
  | 'publishedAt'
  | 'publishFrom'
  | 'publishUntil'
  | 'createdAt'
  | 'createdBy'
  | 'updatedAt'
  | 'updatedBy'
  | 'authorDisplayMode'
  | 'author'
  | 'sourceDataProviderId'
  | 'sourceDataProviderName'
  | 'credentialSource'
  | 'payload'
  | 'status'
  | 'validationState'
  | 'historyRef'
  | 'currentRevisionRef'
  | 'lastAuditEventRef'
> &
  Readonly<{
    sourceEntityType: string;
    sourceEntityId: string;
  }>;

type ProjectionDbClient = Readonly<{
  query: <TRow = Record<string, unknown>>(text: string, values?: readonly unknown[]) => Promise<{
    readonly rowCount: number | null;
    readonly rows: readonly TRow[];
  }>;
}>;

const buildProjectionScopeKey = (
  row: MainserverProjectionRowInput,
  fallbackOwnerSubjectId: string
): string =>
  [
    row.instanceId,
    row.contentType,
    row.sourceEntityType,
    row.sourceEntityId,
    row.organizationId ?? '',
    row.ownerUserId ?? (row.organizationId ? '' : fallbackOwnerSubjectId),
    row.ownerOrganizationId ?? '',
  ].join('::');

const dedupeProjectionRows = (
  rows: readonly MainserverProjectionRowInput[],
  fallbackOwnerSubjectId: string
): readonly MainserverProjectionRowInput[] => {
  const deduped = new Map<string, MainserverProjectionRowInput>();

  for (const row of rows) {
    deduped.set(buildProjectionScopeKey(row, fallbackOwnerSubjectId), row);
  }

  return [...deduped.values()];
};

type OptionalProjectionItemFields = Pick<
  IamContentListItem,
  | 'organizationId'
  | 'ownerUserId'
  | 'ownerOrganizationId'
  | 'publishedAt'
  | 'publishFrom'
  | 'publishUntil'
  | 'currentRevisionRef'
  | 'lastAuditEventRef'
  | 'sourceDataProviderId'
  | 'sourceDataProviderName'
  | 'credentialSource'
>;

const pickPresentProjectionFields = (row: ProjectionRow): Partial<OptionalProjectionItemFields> =>
  Object.fromEntries(
    Object.entries({
      organizationId: row.organization_id,
      ownerUserId: row.owner_user_id,
      ownerOrganizationId: row.owner_organization_id,
      publishedAt: row.published_at,
      publishFrom: row.publish_from,
      publishUntil: row.publish_until,
      currentRevisionRef: row.current_revision_ref,
      lastAuditEventRef: row.last_audit_event_ref,
      sourceDataProviderId: row.source_data_provider_id,
      sourceDataProviderName: row.source_data_provider_name,
      credentialSource: row.credential_source,
    }).filter(([, value]) => typeof value === 'string' && value.length > 0)
  ) as Partial<OptionalProjectionItemFields>;

const mapProjectionRow = (row: ProjectionRow): IamContentListItem => ({
  id: row.id,
  instanceId: row.instance_id,
  ...pickPresentProjectionFields(row),
  contentType: row.content_type,
  title: row.title,
  createdAt: row.created_at,
  createdBy: row.created_by,
  updatedAt: row.updated_at,
  updatedBy: row.updated_by,
  authorDisplayMode: row.author_display_mode,
  author: row.author_display_name,
  payload: row.payload_json,
  status: row.status,
  validationState: row.validation_state,
  historyRef: row.history_ref,
});

const projectionListCollator = new Intl.Collator('de', {
  sensitivity: 'base',
  numeric: true,
});

const resolveProjectionScopePriority = (row: ProjectionRow): number => {
  if (row.organization_id || row.owner_organization_id) {
    return 2;
  }

  if (row.owner_user_id) {
    return 1;
  }

  return 0;
};

const buildProjectionDeduplicationKey = (row: ProjectionRow): string =>
  row.source_system === 'mainserver'
    ? ['mainserver', row.source_entity_type, row.source_entity_id].join('::')
    : row.id;

const comparePreferredProjectionRows = (
  left: ProjectionRow,
  right: ProjectionRow
): number => {
  const scopePriorityResult =
    resolveProjectionScopePriority(right) - resolveProjectionScopePriority(left);
  if (scopePriorityResult !== 0) {
    return scopePriorityResult;
  }

  const updatedAtResult = right.updated_at.localeCompare(left.updated_at);
  if (updatedAtResult !== 0) {
    return updatedAtResult;
  }

  return right.id.localeCompare(left.id);
};

const compareProjectionRows = (
  left: ProjectionRow,
  right: ProjectionRow,
  sortBy: IamContentListQuery['sortBy'],
  sortDirection: IamContentListQuery['sortDirection']
): number => {
  const direction = sortDirection === 'asc' ? 1 : -1;

  const primaryResult =
    sortBy === 'contentType'
      ? projectionListCollator.compare(left.content_type, right.content_type)
      : sortBy === 'title'
        ? projectionListCollator.compare(left.title, right.title)
        : sortBy === 'status'
          ? projectionListCollator.compare(left.status, right.status)
          : projectionListCollator.compare(left.updated_at, right.updated_at);
  if (primaryResult !== 0) {
    return primaryResult * direction;
  }

  return comparePreferredProjectionRows(left, right);
};

const buildReadAction = (contentType: string): string =>
  isMainserverContentType(contentType)
    ? `${contentType.split('.')[0] ?? 'content'}.read`
    : 'content.read';

const buildCreateAction = (contentType: string): string =>
  isMainserverContentType(contentType)
    ? `${contentType.split('.')[0] ?? 'content'}.create`
    : 'content.create';

const buildUpdateAction = (contentType: string): string =>
  isMainserverContentType(contentType)
    ? `${contentType.split('.')[0] ?? 'content'}.update`
    : 'content.updateMetadata';

const buildListAccessAuthorizeRequest = (input: {
  readonly instanceId: string;
  readonly action: string;
  readonly item: IamContentListItem;
  readonly organizationId?: string;
  readonly actorAccountId?: string;
}): AuthorizeRequest => {
  const workspaceContext = getWorkspaceContext();
  const includeCreatedBy = input.action === buildUpdateAction(input.item.contentType);

  return {
    instanceId: input.instanceId,
    action: input.action,
    resource: {
      type: input.action.split('.')[0] || 'content',
      ...(includeCreatedBy ? { id: input.item.id } : {}),
      ...(input.organizationId ? { organizationId: input.organizationId } : {}),
      attributes: {
        contentType: input.item.contentType,
        ...(input.organizationId ? { organizationId: input.organizationId } : {}),
        ...(includeCreatedBy && input.item.ownerUserId
          ? { ownerUserId: input.item.ownerUserId }
          : {}),
        ...(includeCreatedBy && input.item.ownerOrganizationId
          ? { ownerOrganizationId: input.item.ownerOrganizationId }
          : {}),
      },
    },
    context: {
      ...(input.organizationId ? { organizationId: input.organizationId } : {}),
      ...(workspaceContext.requestId ? { requestId: workspaceContext.requestId } : {}),
      ...(workspaceContext.traceId ? { traceId: workspaceContext.traceId } : {}),
      attributes: {
        contentType: input.item.contentType,
        ...(input.actorAccountId ? { actorAccountId: input.actorAccountId } : {}),
      },
    },
  };
};

const runningProjectionSyncs = new Map<string, Promise<Response | null>>();
const registeredProjectionTargets = new Map<string, ContentProjectionSyncTarget>();
const projectionSyncStateSchemaModes = new Map<string, ProjectionSyncStateSchemaMode>();
const projectionTableSchemaModes = new Map<string, ProjectionTableSchemaMode>();
let contentProjectionSchedulerStarted = false;
let contentProjectionSchedulerTimer: ReturnType<typeof setInterval> | null = null;

const buildProjectionTargetKey = (target: ContentProjectionSyncTarget): string =>
  buildMainserverProjectionScopeKey({
    instanceId: target.instanceId,
    actorAccountId: target.actorAccountId ?? `missing-account:${target.keycloakSubject}`,
    activeOrganizationId: target.organizationId,
    contentType: target.contentType,
  });

const buildMainserverSyncScopeKey = (target: ContentProjectionSyncTarget): string =>
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

const loadProjectionTableSchemaMode = async (
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

const buildProjectionLogContext = (
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

const toMainserverContentType = (value: string): MainserverContentType | null => {
  if (
    value === 'news.article' ||
    value === 'events.event-record' ||
    value === 'poi.point-of-interest' ||
    value === 'generic-items.generic-item' ||
    value === 'surveys.survey'
  ) {
    return value;
  }

  return null;
};

const loadProjectionSyncState = async (
  target: ContentProjectionSyncTarget
): Promise<ProjectionSyncStateRow | null> =>
  withInstanceScopedDb(target.instanceId, async (client) => {
    const schemaMode = await loadProjectionSyncStateSchemaMode(client, target.instanceId);
    const result =
      schemaMode === 'scoped'
        ? await client.query<ProjectionSyncStateRow>(
            `
SELECT
  sync_scope_key,
  last_started_at::text,
  last_succeeded_at::text,
  last_failed_at::text,
  last_error_code,
  last_error_message,
  projected_count
FROM iam.content_list_projection_sync_state
WHERE instance_id = $1
  AND source_system = 'mainserver'
  AND content_type = $2
  AND sync_scope_key = $3
LIMIT 1;
            `,
            [target.instanceId, target.contentType, buildMainserverSyncScopeKey(target)]
          )
        : await client.query<ProjectionSyncStateRow>(
            `
SELECT
  content_type AS sync_scope_key,
  last_started_at::text,
  last_succeeded_at::text,
  last_failed_at::text,
  last_error_code,
  last_error_message,
  projected_count
FROM iam.content_list_projection_sync_state
WHERE instance_id = $1
  AND source_system = 'mainserver'
  AND content_type = $2
LIMIT 1;
            `,
            [target.instanceId, target.contentType]
          );

    return result.rows[0] ?? null;
  });

const countProjectedRowsForScope = async (
  target: ContentProjectionSyncTarget
): Promise<number> =>
  withInstanceScopedDb(target.instanceId, async (client) => {
    const schemaMode = await loadProjectionTableSchemaMode(client, target.instanceId);
    const result =
      schemaMode === 'scoped'
        ? await client.query<{ total: string | number }>(
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
        : await client.query<{ total: string | number }>(
            `
SELECT COUNT(*)::int AS total
FROM iam.content_list_projection
WHERE instance_id = $1
  AND source_system = 'mainserver'
  AND content_type = $2;
            `,
            [target.instanceId, target.contentType]
          );

    return Number(result.rows[0]?.total ?? 0);
  });

const countProjectedRowsForScopeWithClient = async (
  client: ProjectionDbClient,
  target: ContentProjectionSyncTarget
): Promise<number> => {
  const schemaMode = await loadProjectionTableSchemaMode(client, target.instanceId);
  const result =
    schemaMode === 'scoped'
      ? await client.query<{ total?: string | number }>(
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
      : await client.query<{ total?: string | number }>(
          `
SELECT COUNT(*)::int AS total
FROM iam.content_list_projection
WHERE instance_id = $1
  AND source_system = 'mainserver'
  AND content_type = $2;
          `,
          [target.instanceId, target.contentType]
        );

  return Number(result.rows[0]?.total ?? 0);
};

const markProjectionSyncStarted = async (
  target: ContentProjectionSyncTarget
): Promise<void> => {
  await withInstanceScopedDb(target.instanceId, async (client) => {
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
  updated_at
)
VALUES ($1, 'mainserver', $2, $3, 'full_refresh', NOW(), NOW())
ON CONFLICT (instance_id, source_system, content_type, sync_scope_key)
DO UPDATE SET
  last_started_at = NOW(),
  updated_at = NOW();
        `,
        [target.instanceId, target.contentType, buildMainserverSyncScopeKey(target)]
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
  updated_at
)
VALUES ($1, 'mainserver', $2, 'full_refresh', NOW(), NOW())
ON CONFLICT (instance_id, source_system, content_type)
DO UPDATE SET
  last_started_at = NOW(),
  updated_at = NOW();
      `,
      [target.instanceId, target.contentType]
    );
  });
};

const markProjectionSyncFailed = async (
  target: ContentProjectionSyncTarget,
  errorCode: string,
  errorMessage: string
): Promise<void> => {
  await withInstanceScopedDb(target.instanceId, async (client) => {
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
  last_failed_at,
  last_error_code,
  last_error_message,
  updated_at
)
VALUES ($1, 'mainserver', $2, $3, 'full_refresh', NOW(), $4, $5, NOW())
ON CONFLICT (instance_id, source_system, content_type, sync_scope_key)
DO UPDATE SET
  last_failed_at = NOW(),
  last_error_code = EXCLUDED.last_error_code,
  last_error_message = EXCLUDED.last_error_message,
  updated_at = NOW();
        `,
        [
          target.instanceId,
          target.contentType,
          buildMainserverSyncScopeKey(target),
          errorCode,
          errorMessage,
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
  last_failed_at,
  last_error_code,
  last_error_message,
  updated_at
)
VALUES ($1, 'mainserver', $2, 'full_refresh', NOW(), $3, $4, NOW())
ON CONFLICT (instance_id, source_system, content_type)
DO UPDATE SET
  last_failed_at = NOW(),
  last_error_code = EXCLUDED.last_error_code,
  last_error_message = EXCLUDED.last_error_message,
  updated_at = NOW();
      `,
      [target.instanceId, target.contentType, errorCode, errorMessage]
    );
  });
};

const deleteMainserverProjectionRows = async (
  client: ProjectionDbClient,
  target: ContentProjectionSyncTarget
): Promise<void> => {
  const schemaMode = await loadProjectionTableSchemaMode(client, target.instanceId);
  await client.query(
    schemaMode === 'scoped'
      ? `
DELETE FROM iam.content_list_projection
WHERE instance_id = $1
  AND source_system = 'mainserver'
  AND content_type = $2
  AND projection_scope_key = $3;
        `
      : `
DELETE FROM iam.content_list_projection
WHERE instance_id = $1
  AND source_system = 'mainserver'
  AND content_type = $2;
        `,
    schemaMode === 'scoped'
      ? [target.instanceId, target.contentType, buildProjectionTargetKey(target)]
      : [target.instanceId, target.contentType]
  );
};

const deleteMainserverProjectionRowsNotInSet = async (
  client: ProjectionDbClient,
  target: ContentProjectionSyncTarget,
  retainedEntityIds: readonly string[]
): Promise<void> => {
  if (retainedEntityIds.length === 0) {
    await deleteMainserverProjectionRows(client, target);
    return;
  }

  const schemaMode = await loadProjectionTableSchemaMode(client, target.instanceId);
  await client.query(
    schemaMode === 'scoped'
      ? `
DELETE FROM iam.content_list_projection
WHERE instance_id = $1
  AND source_system = 'mainserver'
  AND content_type = $2
  AND projection_scope_key = $3
  AND source_entity_type = $4
  AND NOT (source_entity_id = ANY($5::text[]));
        `
      : `
DELETE FROM iam.content_list_projection
WHERE instance_id = $1
  AND source_system = 'mainserver'
  AND content_type = $2
  AND source_entity_type = $3
  AND NOT (source_entity_id = ANY($4::text[]));
        `,
    schemaMode === 'scoped'
      ? [
          target.instanceId,
          target.contentType,
          buildProjectionTargetKey(target),
          target.contentType,
          retainedEntityIds,
        ]
      : [target.instanceId, target.contentType, target.contentType, retainedEntityIds]
  );
};

const deleteMainserverProjectionRowByEntity = async (
  client: ProjectionDbClient,
  target: ContentProjectionSyncTarget,
  sourceEntityId: string
): Promise<void> => {
  const schemaMode = await loadProjectionTableSchemaMode(client, target.instanceId);
  await client.query(
    schemaMode === 'scoped'
      ? `
DELETE FROM iam.content_list_projection
WHERE instance_id = $1
  AND source_system = 'mainserver'
  AND content_type = $2
  AND projection_scope_key = $3
  AND source_entity_type = $4
  AND source_entity_id = $5;
        `
      : `
DELETE FROM iam.content_list_projection
WHERE instance_id = $1
  AND source_system = 'mainserver'
  AND content_type = $2
  AND source_entity_type = $3
  AND source_entity_id = $4;
        `,
    schemaMode === 'scoped'
      ? [
          target.instanceId,
          target.contentType,
          buildProjectionTargetKey(target),
          target.contentType,
          sourceEntityId,
        ]
      : [target.instanceId, target.contentType, target.contentType, sourceEntityId]
  );
};

const toNullableProjectionValue = <T>(value: T | null | undefined): T | null => value ?? null;

const toRequiredProjectionReference = (value: string | null | undefined): string => value ?? '';

const resolveProjectionOwnerUserId = (
  row: MainserverProjectionRowInput,
  actorAccountId: string | undefined
): string | null => row.ownerUserId ?? (row.organizationId ? null : (actorAccountId ?? null));

const mapMainserverProjectionPayloadRow = (
  row: MainserverProjectionRowInput,
  actorAccountId: string | undefined,
  projectionScopeKey: string
) => ({
  id: row.id,
  instance_id: row.instanceId,
  projection_scope_key: projectionScopeKey,
  organization_id: toNullableProjectionValue(row.organizationId),
  owner_user_id: resolveProjectionOwnerUserId(row, actorAccountId),
  owner_organization_id: toNullableProjectionValue(row.ownerOrganizationId ?? row.organizationId),
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
  const schemaMode = await loadProjectionTableSchemaMode(client, target.instanceId);
  await client.query(
    schemaMode === 'scoped'
      ? scopedMainserverProjectionUpsertSql
      : legacyMainserverProjectionUpsertSql,
    [payloadJson]
  );
};

const upsertSingleMainserverProjectionRow = async (
  target: ContentProjectionSyncTarget,
  actorAccountId: string | undefined,
  row: MainserverProjectionRowInput
): Promise<void> => {
  const projectionPayloadJson = buildMainserverProjectionPayloadJson(
    [row],
    actorAccountId,
    buildProjectionTargetKey(target)
  );

  await withInstanceScopedDb(target.instanceId, async (client) => {
    await upsertMainserverProjectionRows(client, target, projectionPayloadJson);
    const projectedCount = await countProjectedRowsForScopeWithClient(client, target);
    await markMainserverProjectionSyncSucceeded(client, target, projectedCount);
  });
};

const markMainserverProjectionSyncSucceeded = async (
  client: ProjectionDbClient,
  target: ContentProjectionSyncTarget,
  projectedCount: number
): Promise<void> => {
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
  updated_at
)
VALUES ($1, 'mainserver', $2, $3, 'full_refresh', NOW(), NOW(), NULL, NULL, $4, NOW())
ON CONFLICT (instance_id, source_system, content_type, sync_scope_key)
DO UPDATE SET
  last_started_at = NOW(),
  last_succeeded_at = NOW(),
  last_error_code = NULL,
  last_error_message = NULL,
  projected_count = EXCLUDED.projected_count,
  updated_at = NOW();
      `,
      [
        target.instanceId,
        target.contentType,
        buildMainserverSyncScopeKey(target),
        projectedCount,
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
  updated_at
)
VALUES ($1, 'mainserver', $2, 'full_refresh', NOW(), NOW(), NULL, NULL, $3, NOW())
ON CONFLICT (instance_id, source_system, content_type)
DO UPDATE SET
  last_started_at = NOW(),
  last_succeeded_at = NOW(),
  last_error_code = NULL,
  last_error_message = NULL,
  projected_count = EXCLUDED.projected_count,
  updated_at = NOW();
    `,
    [target.instanceId, target.contentType, projectedCount]
  );
};

const persistMainserverProjectionRowsProgressively = async (input: {
  readonly target: ContentProjectionSyncTarget;
  readonly keycloakSubject: string;
  readonly actorAccountId: string | undefined;
  readonly rows: readonly MainserverProjectionRowInput[];
  readonly finalize: boolean;
}): Promise<void> => {
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
    if (projectionPayloadJson) {
      await upsertMainserverProjectionRows(client, input.target, projectionPayloadJson);
    }

    if (input.finalize) {
      await deleteMainserverProjectionRowsNotInSet(
        client,
        input.target,
        dedupedRows.map((row) => row.sourceEntityId)
      );
    }

    const projectedCount = await countProjectedRowsForScopeWithClient(client, input.target);
    await markMainserverProjectionSyncSucceeded(client, input.target, projectedCount);
  });
};

type MainserverProjectionLoadedPage = Readonly<{
  readonly rows: readonly MainserverProjectionRowInput[];
  readonly hasNextPage: boolean;
  readonly nextPage: number;
}>;

type MainserverProjectionPageResult<TItem> = {
  readonly credentialSource?: IamContentListItem['credentialSource'];
  readonly data: readonly TItem[];
  readonly pagination: {
    readonly hasNextPage: boolean;
    readonly page?: number;
  };
};

const resolveMainserverProjectionCredentialSource = <TItem>(
  result: MainserverProjectionPageResult<TItem>,
  projectedOrganizationId: string | undefined
): IamContentListItem['credentialSource'] =>
  result.credentialSource ?? (projectedOrganizationId ? 'organization' : 'user');

const hasNextProjectionPage = (
  result: MainserverProjectionPageResult<unknown>,
  pageQuery: {
    readonly page: number;
    readonly pageSize: number;
  }
): boolean => {
  const nextPage = result.pagination.page ?? pageQuery.page;
  return (
    result.data.length > 0 &&
    nextPage >= pageQuery.page &&
    result.pagination.hasNextPage &&
    pageQuery.page * pageQuery.pageSize < MAX_SYNC_ITEMS_PER_TYPE
  );
};

const buildLoadedProjectionPage = <TItem>(input: {
  readonly result: MainserverProjectionPageResult<TItem>;
  readonly pageQuery: {
    readonly page: number;
    readonly pageSize: number;
  };
  readonly mapRow: (item: TItem, credentialSource: IamContentListItem['credentialSource']) => MainserverProjectionRowInput;
  readonly projectedOrganizationId: string | undefined;
}): MainserverProjectionLoadedPage => {
  const credentialSource = resolveMainserverProjectionCredentialSource(
    input.result,
    input.projectedOrganizationId
  );
  const nextPage = input.result.pagination.page ?? input.pageQuery.page;

  return {
    rows: input.result.data.map((item) => input.mapRow(item, credentialSource)),
    hasNextPage: hasNextProjectionPage(input.result, input.pageQuery),
    nextPage: nextPage + 1,
  };
};

type MainserverProjectionPageLoader = (input: Readonly<{
  target: ContentProjectionSyncTarget;
  pageQuery: {
    readonly page: number;
    readonly pageSize: number;
  };
}>) => Promise<MainserverProjectionLoadedPage>;

const mainserverProjectionPageLoaders: Record<
  MainserverContentType,
  MainserverProjectionPageLoader
> = {
  'events.event-record': async ({ target, pageQuery }) =>
    buildLoadedProjectionPage({
      result: await listSvaMainserverEvents({
        instanceId: target.instanceId,
        keycloakSubject: target.keycloakSubject,
        activeOrganizationId: target.organizationId,
        includeInvisible: true,
        ...pageQuery,
      }),
      pageQuery,
      mapRow: (item, credentialSource) => ({
        ...mapEventItem(item, target.instanceId, []),
        ...(target.organizationId ? { organizationId: target.organizationId } : {}),
        credentialSource,
        sourceEntityType: 'events.event-record',
        sourceEntityId: item.id,
      }),
      projectedOrganizationId: target.organizationId,
    }),
  'generic-items.generic-item': async ({ target, pageQuery }) =>
    buildLoadedProjectionPage({
      result: await listSvaMainserverGenericItems({
        instanceId: target.instanceId,
        keycloakSubject: target.keycloakSubject,
        activeOrganizationId: target.organizationId,
        includeInvisible: true,
        ...pageQuery,
      }),
      pageQuery,
      mapRow: (item, credentialSource) => ({
        ...mapGenericItem(item, target.instanceId, []),
        ...(target.organizationId ? { organizationId: target.organizationId } : {}),
        credentialSource,
        sourceEntityType: 'generic-items.generic-item',
        sourceEntityId: item.id,
      }),
      projectedOrganizationId: target.organizationId,
    }),
  'news.article': async ({ target, pageQuery }) =>
    buildLoadedProjectionPage({
      result: await listSvaMainserverNews({
        instanceId: target.instanceId,
        keycloakSubject: target.keycloakSubject,
        activeOrganizationId: target.organizationId,
        includeInvisible: true,
        orderBy: 'updatedAt_DESC',
        ...pageQuery,
      }),
      pageQuery,
      mapRow: (item, credentialSource) => ({
        ...mapNewsItem(item, target.instanceId, []),
        ...(target.organizationId ? { organizationId: target.organizationId } : {}),
        credentialSource,
        sourceEntityType: 'news.article',
        sourceEntityId: item.id,
      }),
      projectedOrganizationId: target.organizationId,
    }),
  'poi.point-of-interest': async ({ target, pageQuery }) =>
    buildLoadedProjectionPage({
      result: await listSvaMainserverPoi({
        instanceId: target.instanceId,
        keycloakSubject: target.keycloakSubject,
        activeOrganizationId: target.organizationId,
        includeInvisible: true,
        ...pageQuery,
      }),
      pageQuery,
      mapRow: (item, credentialSource) => ({
        ...mapPoiItem(item, target.instanceId, []),
        ...(target.organizationId ? { organizationId: target.organizationId } : {}),
        credentialSource,
        sourceEntityType: 'poi.point-of-interest',
        sourceEntityId: item.id,
      }),
      projectedOrganizationId: target.organizationId,
    }),
  'surveys.survey': async ({ target, pageQuery }) =>
    buildLoadedProjectionPage({
      result: await listSvaMainserverSurveys({
        instanceId: target.instanceId,
        keycloakSubject: target.keycloakSubject,
        activeOrganizationId: target.organizationId,
        includeArchived: true,
        ...pageQuery,
      }),
      pageQuery,
      mapRow: (item, credentialSource) => ({
        ...mapSurveyItem(item, target.instanceId, []),
        ...(target.organizationId ? { organizationId: target.organizationId } : {}),
        credentialSource,
        sourceEntityType: 'surveys.survey',
        sourceEntityId: item.id,
      }),
      projectedOrganizationId: target.organizationId,
    }),
};

const loadMainserverProjectionPage = async (
  target: ContentProjectionSyncTarget,
  pageQuery: {
    readonly page: number;
    readonly pageSize: number;
  }
): Promise<MainserverProjectionLoadedPage> => {
  if (!target.instanceId) {
    throw createListErrorResponse(400, 'invalid_instance_id', 'Kein Instanzkontext für diese Inhalte vorhanden.');
  }
  return mainserverProjectionPageLoaders[target.contentType]({
    target,
    pageQuery,
  });
};

const refreshMainserverProjectionBatch = async (
  targets: readonly ContentProjectionSyncTarget[],
  trigger: ProjectionRefreshTrigger
): Promise<Map<string, Response | null>> => {
  const responses = new Map<string, Response | null>();
  const accumulatedRows = new Map<string, MainserverProjectionRowInput[]>();

  for (const target of targets) {
    await markProjectionSyncStarted(target);
    accumulatedRows.set(buildProjectionTargetKey(target), []);
  }

  await runMainserverProjectionRoundRobin(
    targets,
    MAINSERVER_PROGRESSIVE_FETCH_PAGE_SIZE,
    async (target, pageQuery) => {
      const result = await loadMainserverProjectionPage(target, pageQuery);
      return {
        data: result.rows,
        hasNextPage: result.hasNextPage,
        nextPage: result.nextPage,
      };
    },
    async (target, pages) => {
      const targetKey = buildProjectionTargetKey(target);
      const rows = pages.flatMap((page) => page).slice(0, MAX_SYNC_ITEMS_PER_TYPE);
      accumulatedRows.set(targetKey, rows);
      const latestPage = pages.at(-1) ?? [];
      contentProjectionLogger.info('mainserver_projection_page_loaded', {
        ...buildProjectionLogContext(target, trigger),
        loaded_row_count: latestPage.length,
        page: pages.length,
        page_size: MAINSERVER_PROGRESSIVE_FETCH_PAGE_SIZE,
        projected_row_count: rows.length,
      });
      await persistMainserverProjectionRowsProgressively({
        target,
        keycloakSubject: target.keycloakSubject,
        actorAccountId: target.actorAccountId,
        rows: latestPage,
        finalize: false,
      });
    },
    async (target, _pages, error) => {
      const errorCode = normalizeApiErrorCode(
        error && typeof error === 'object' && 'code' in error
          ? (error as { code?: unknown }).code
          : undefined
      );
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Mainserver-Inhalte konnten nicht synchronisiert werden.';
      contentProjectionLogger.warn('mainserver_projection_page_failed', {
        ...buildProjectionLogContext(target, trigger),
        error_code: errorCode,
        error_message: errorMessage,
        page: _pages.length + 1,
        page_size: MAINSERVER_PROGRESSIVE_FETCH_PAGE_SIZE,
      });
      await markProjectionSyncFailed(target, errorCode, errorMessage);
      responses.set(
        buildProjectionTargetKey(target),
        createListErrorResponse(503, errorCode, errorMessage, getWorkspaceContext().requestId)
      );
    }
  );

  for (const target of targets) {
    const targetKey = buildProjectionTargetKey(target);
    if (responses.has(targetKey)) {
      continue;
    }

    await persistMainserverProjectionRowsProgressively({
      target,
      keycloakSubject: target.keycloakSubject,
      actorAccountId: target.actorAccountId,
      rows: accumulatedRows.get(targetKey) ?? [],
      finalize: true,
    });
    responses.set(targetKey, null);
  }

  return responses;
};

type MainserverMutationProjectionLoader = (
  input: Readonly<{
    target: ContentProjectionSyncTarget;
    entityId: string;
    credentialSource: IamContentListItem['credentialSource'];
    projectedOrganizationId: string | undefined;
  }>
) => Promise<MainserverProjectionRowInput>;

const mainserverMutationProjectionLoaders: Record<
  TargetedMutationContentType,
  MainserverMutationProjectionLoader
> = {
  'events.event-record': async ({
    target,
    entityId,
    credentialSource,
    projectedOrganizationId,
  }) => {
    const item = await getSvaMainserverEvent({
      activeOrganizationId: target.organizationId,
      eventId: entityId,
      instanceId: target.instanceId,
      keycloakSubject: target.keycloakSubject,
    });
    return {
      ...mapEventItem(item, target.instanceId, []),
      ...(projectedOrganizationId ? { organizationId: projectedOrganizationId } : {}),
      credentialSource,
      sourceEntityType: 'events.event-record',
      sourceEntityId: item.id,
    };
  },
  'generic-items.generic-item': async ({
    target,
    entityId,
    credentialSource,
    projectedOrganizationId,
  }) => {
    const item = await getSvaMainserverGenericItem({
      activeOrganizationId: target.organizationId,
      genericItemId: entityId,
      instanceId: target.instanceId,
      keycloakSubject: target.keycloakSubject,
    });
    return {
      ...mapGenericItem(item, target.instanceId, []),
      ...(projectedOrganizationId ? { organizationId: projectedOrganizationId } : {}),
      credentialSource,
      sourceEntityType: 'generic-items.generic-item',
      sourceEntityId: item.id,
    };
  },
  'news.article': async ({ target, entityId, credentialSource, projectedOrganizationId }) => {
    const item = await getSvaMainserverNews({
      activeOrganizationId: target.organizationId,
      instanceId: target.instanceId,
      keycloakSubject: target.keycloakSubject,
      newsId: entityId,
    });
    return {
      ...mapNewsItem(item, target.instanceId, []),
      ...(projectedOrganizationId ? { organizationId: projectedOrganizationId } : {}),
      credentialSource,
      sourceEntityType: 'news.article',
      sourceEntityId: item.id,
    };
  },
  'poi.point-of-interest': async ({
    target,
    entityId,
    credentialSource,
    projectedOrganizationId,
  }) => {
    const item = await getSvaMainserverPoi({
      activeOrganizationId: target.organizationId,
      instanceId: target.instanceId,
      keycloakSubject: target.keycloakSubject,
      poiId: entityId,
    });
    return {
      ...mapPoiItem(item, target.instanceId, []),
      ...(projectedOrganizationId ? { organizationId: projectedOrganizationId } : {}),
      credentialSource,
      sourceEntityType: 'poi.point-of-interest',
      sourceEntityId: item.id,
    };
  },
};

const loadMainserverProjectionMutationRow = async (
  target: ContentProjectionSyncTarget,
  entityId: string
): Promise<MainserverProjectionRowInput> => {
  const projectedOrganizationId = target.organizationId;
  const credentialSource: IamContentListItem['credentialSource'] = projectedOrganizationId
    ? 'organization'
    : 'user';
  const loader = mainserverMutationProjectionLoaders[target.contentType as TargetedMutationContentType];
  if (loader) {
    return loader({
      target,
      entityId,
      credentialSource,
      projectedOrganizationId,
    });
  }

  throw new Error(`Unsupported targeted projection refresh for content type "${target.contentType}".`);
};

const refreshMainserverProjectionForMutation = async (input: {
  readonly target: ContentProjectionSyncTarget;
  readonly operation: MainserverProjectionMutationOperation;
  readonly entityId: string;
}): Promise<void> => {
  const { target, operation, entityId } = input;
  const { actorAccountId } = target;
  const targetKey = buildProjectionTargetKey(target);
  const previousSync = runningProjectionSyncs.get(targetKey);
  const mutationWork = (previousSync ?? Promise.resolve(null))
    .catch(() => null)
    .then(async () => {
      await markProjectionSyncStarted(target);

      try {
        if (operation === 'delete') {
          await withInstanceScopedDb(target.instanceId, async (client) => {
            await deleteMainserverProjectionRowByEntity(client, target, entityId);
            const projectedCount = await countProjectedRowsForScopeWithClient(client, target);
            await markMainserverProjectionSyncSucceeded(client, target, projectedCount);
          });
          return;
        }

        let lastError: unknown;
        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            const row = await loadMainserverProjectionMutationRow(target, entityId);
            await upsertSingleMainserverProjectionRow(target, actorAccountId, row);
            return;
          } catch (error) {
            lastError = error;
          }
        }

        throw lastError instanceof Error
          ? lastError
          : new Error('Mainserver mutation follow-up refresh failed.');
      } catch (error) {
        const errorCode = normalizeApiErrorCode(
          error && typeof error === 'object' && 'code' in error
            ? (error as { code?: unknown }).code
            : undefined
        );
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Mainserver-Mutationsprojektion konnte nicht nachgeladen werden.';
        contentProjectionLogger.warn('mainserver_projection_mutation_refresh_failed', {
          ...buildProjectionLogContext(target, 'mutation_follow_up'),
          entity_id: entityId,
          error_code: errorCode,
          error_message: errorMessage,
          operation,
        });
        await markProjectionSyncFailed(target, errorCode, errorMessage);
      }
    });
  const mutationSync = mutationWork
    .then(() => null as Response | null, () => null as Response | null)
    .finally(() => {
      if (runningProjectionSyncs.get(targetKey) === mutationSync) {
        runningProjectionSyncs.delete(targetKey);
      }
    });

  runningProjectionSyncs.set(targetKey, mutationSync);
  await mutationWork;
};

const registerProjectionTarget = (target: ContentProjectionSyncTarget): void => {
  registeredProjectionTargets.set(buildProjectionTargetKey(target), target);
};

const ensureContentProjectionSchedulerStarted = (): void => {
  if (contentProjectionSchedulerStarted) {
    return;
  }

  contentProjectionSchedulerStarted = true;
  contentProjectionSchedulerTimer = setInterval(() => {
    const targets = [...registeredProjectionTargets.values()];
    if (targets.length === 0) {
      return;
    }

    void triggerMainserverProjectionRefreshBatch(targets, {
      force: false,
      awaitCompletion: false,
      trigger: 'scheduler',
    });
  }, MAIN_SERVER_SYNC_POLL_INTERVAL_MS);

  contentProjectionSchedulerTimer.unref?.();
};

export const resetContentProjectionRuntimeStateForTests = (): void => {
  runningProjectionSyncs.clear();
  registeredProjectionTargets.clear();
  projectionSyncStateSchemaModes.clear();
  projectionTableSchemaModes.clear();

  if (contentProjectionSchedulerTimer) {
    clearInterval(contentProjectionSchedulerTimer);
    contentProjectionSchedulerTimer = null;
  }

  contentProjectionSchedulerStarted = false;
};

const computeProjectionSyncState = async (
  target: ContentProjectionSyncTarget
): Promise<ContentProjectionSyncState> => {
  const syncState = await loadProjectionSyncState(target);
  const lastSucceededAtMs = syncState?.last_succeeded_at
    ? Date.parse(syncState.last_succeeded_at)
    : Number.NaN;
  const hasGlobalSnapshot = Number.isFinite(lastSucceededAtMs);
  let hasSnapshot = hasGlobalSnapshot;

  if (hasGlobalSnapshot) {
    const projectedRowsForScope = await countProjectedRowsForScope(target);
    hasSnapshot = projectedRowsForScope > 0 || (syncState?.projected_count ?? 0) === 0;
  }

  return {
    contentType: target.contentType,
    ...(syncState?.last_started_at ? { lastStartedAt: syncState.last_started_at } : {}),
    ...(syncState?.last_succeeded_at ? { lastSucceededAt: syncState.last_succeeded_at } : {}),
    ...(syncState?.last_failed_at ? { lastFailedAt: syncState.last_failed_at } : {}),
    ...(syncState?.last_error_code ? { lastErrorCode: syncState.last_error_code } : {}),
    isStale:
      !hasSnapshot ||
      !Number.isFinite(lastSucceededAtMs) ||
      Date.now() - lastSucceededAtMs >= MAIN_SERVER_SYNC_STALE_MS,
    isSyncRunning: runningProjectionSyncs.has(buildProjectionTargetKey(target)),
    hasSnapshot,
  };
};

const triggerMainserverProjectionRefresh = async (
  target: ContentProjectionSyncTarget,
  options: {
    readonly force: boolean;
    readonly awaitCompletion: boolean;
    readonly trigger: ProjectionRefreshTrigger;
  }
): Promise<TriggerProjectionRefreshResult> => {
  return triggerMainserverProjectionRefreshBatch([target], options);
};

const triggerMainserverProjectionRefreshBatch = async (
  targets: readonly ContentProjectionSyncTarget[],
  options: {
    readonly force: boolean;
    readonly awaitCompletion: boolean;
    readonly trigger: ProjectionRefreshTrigger;
  }
): Promise<TriggerProjectionRefreshResult> => {
  if (targets.length === 0) {
    return { status: 'accepted', syncStates: [] };
  }

  for (const target of targets) {
    registerProjectionTarget(target);
  }
  ensureContentProjectionSchedulerStarted();

  const currentStates = await computeProjectionSyncStates(targets);
  const targetsToRefresh = targets.filter((_target, index) => {
    const currentState = currentStates[index];
    return options.force || !currentState || !currentState.hasSnapshot || currentState.isStale;
  });

  if (targetsToRefresh.length === 0) {
    return { status: 'completed', syncStates: currentStates };
  }

  const pendingSyncs = new Map<string, Promise<Response | null>>();
  const idleTargets: ContentProjectionSyncTarget[] = [];

  for (const target of targetsToRefresh) {
    const targetKey = buildProjectionTargetKey(target);
    const runningSync = runningProjectionSyncs.get(targetKey);
    if (runningSync) {
      pendingSyncs.set(targetKey, runningSync);
      continue;
    }

    idleTargets.push(target);
  }

  if (idleTargets.length > 0) {
    const batchPromise = refreshMainserverProjectionBatch(idleTargets, options.trigger);
    for (const target of idleTargets) {
      const targetKey = buildProjectionTargetKey(target);
      const targetPromise = batchPromise
        .then((responses) => responses.get(targetKey) ?? null)
        .finally(() => {
          if (runningProjectionSyncs.get(targetKey) === targetPromise) {
            runningProjectionSyncs.delete(targetKey);
          }
        });
      runningProjectionSyncs.set(targetKey, targetPromise);
      pendingSyncs.set(targetKey, targetPromise);
    }
  }

  if (!options.awaitCompletion) {
    return {
      status: pendingSyncs.size > idleTargets.length ? 'already_running' : 'accepted',
      syncStates: currentStates.map((syncState, index) =>
        targetsToRefresh.includes(targets[index] as ContentProjectionSyncTarget)
          ? {
              ...syncState,
              isSyncRunning: true,
            }
          : syncState
      ),
    };
  }

  const results = await Promise.all([...pendingSyncs.values()]);
  return {
    status: results.some((result) => result !== null)
      ? 'failed'
      : idleTargets.length === 0
        ? 'already_running'
        : 'completed',
    syncStates: await computeProjectionSyncStates(targets),
  };
};

const buildProjectionTargets = (
  ctx: AuthenticatedRequestContext,
  contentTypes: readonly string[],
  actorAccountId: string | undefined
): readonly ContentProjectionSyncTarget[] =>
  contentTypes.flatMap((contentType) => {
    const mainserverContentType = toMainserverContentType(contentType);
    if (!mainserverContentType || !ctx.user.instanceId) {
      return [];
    }

    return [
      {
        instanceId: ctx.user.instanceId,
        keycloakSubject: ctx.user.id,
        ...(actorAccountId ? { actorAccountId } : {}),
        contentType: mainserverContentType,
        ...(ctx.activeOrganizationId ? { organizationId: ctx.activeOrganizationId } : {}),
      } satisfies ContentProjectionSyncTarget,
    ];
  });

const computeProjectionSyncStates = async (
  targets: readonly ContentProjectionSyncTarget[]
): Promise<readonly ContentProjectionSyncState[]> =>
  Promise.all(targets.map((target) => computeProjectionSyncState(target)));

const maybeStartBackgroundProjectionRefresh = async (
  targets: readonly ContentProjectionSyncTarget[],
  syncStates: readonly ContentProjectionSyncState[]
): Promise<void> => {
  const staleTargets = targets.filter((_target, index) => syncStates[index]?.isStale === true);
  if (staleTargets.length === 0) {
    return;
  }

  await triggerMainserverProjectionRefreshBatch(staleTargets, {
    force: staleTargets.some((target) => {
      const index = targets.indexOf(target);
      return syncStates[index]?.hasSnapshot === false;
    }),
    awaitCompletion: false,
    trigger: 'reconciliation',
  }).then(() => undefined);
};

const resolveEffectiveTypes = (query: IamContentListQuery): readonly string[] => {
  const visibleTypes =
    query.visibleTypes?.filter(
      (value) => value.trim().length > 0 && value !== EMPTY_VISIBLE_TYPE_SENTINEL
    ) ?? [];
  if (query.type && visibleTypes.length > 0) {
    return visibleTypes.includes(query.type) ? [query.type] : [];
  }
  if (query.type) {
    return [query.type];
  }
  return visibleTypes;
};

const loadProjectedContentTypes = async (instanceId: string): Promise<readonly string[]> =>
  withInstanceScopedDb(instanceId, async (client) => {
    const result = await client.query<{ content_type: string }>(
      `
SELECT DISTINCT projection.content_type
FROM iam.content_list_projection AS projection
WHERE projection.instance_id = $1
ORDER BY projection.content_type ASC;
      `,
      [instanceId]
    );

    return result.rows
      .map((row) => row.content_type.trim())
      .filter((contentType) => contentType.length > 0);
  });

const buildProjectionReadVisibilitySql = (
  rules: readonly ProjectionReadVisibilityRule[],
  actorAccountId: string | undefined,
  params: unknown[]
): string => {
  const perTypeClauses = rules.flatMap((rule) => {
    const allowClauses: string[] = [];
    if (rule.allowGlobal) {
      allowClauses.push('TRUE');
    }
    if (rule.allowOrganizationIds.length > 0) {
      params.push([...rule.allowOrganizationIds]);
      allowClauses.push(`projection.owner_organization_id::text = ANY($${params.length}::text[])`);
    }
    if (rule.allowOwn && actorAccountId) {
      params.push(actorAccountId);
      allowClauses.push(`projection.owner_user_id::text = $${params.length}`);
    }

    if (allowClauses.length === 0) {
      return [];
    }

    params.push(rule.contentType);
    const typeParam = `$${params.length}`;

    return [`(projection.content_type = ${typeParam} AND (${allowClauses.join(' OR ')}))`];
  });

  return perTypeClauses.length > 0 ? `(${perTypeClauses.join(' OR ')})` : 'FALSE';
};

const loadProjectionPage = async (
  instanceId: string,
  query: IamContentListQuery,
  rules: readonly ProjectionReadVisibilityRule[],
  actorAccountId: string | undefined
): Promise<{ readonly items: readonly IamContentListItem[]; readonly total: number }> =>
  withInstanceScopedDb(instanceId, async (client) => {
    const conditions = ['projection.instance_id = $1'];
    const params: unknown[] = [instanceId];
    conditions.push(buildProjectionReadVisibilitySql(rules, actorAccountId, params));

    if (query.status) {
      params.push(query.status);
      conditions.push(`projection.status = $${params.length}`);
    }

    if (query.q && query.q.trim().length > 0) {
      params.push(`%${query.q.trim().toLowerCase()}%`);
      const searchParam = `$${params.length}`;
      conditions.push(
        `(
          LOWER(projection.title) LIKE ${searchParam}
          OR LOWER(projection.content_type) LIKE ${searchParam}
          OR LOWER(projection.author_display_name) LIKE ${searchParam}
          OR LOWER(projection.payload_json::text) LIKE ${searchParam}
        )`
      );
    }

    params.push(actorAccountId ?? null);
    const actorAccountParam = `$${params.length}`;
    conditions.push(
      `(
        projection.source_system <> 'mainserver'
        OR projection.organization_id IS NOT NULL
        OR projection.owner_user_id IS NULL
        OR (${actorAccountParam}::text IS NOT NULL AND projection.owner_user_id::text = ${actorAccountParam})
      )`
    );

    const whereClause = `WHERE ${conditions.join('\n  AND ')}`;

    const result = await client.query<ProjectionRow>(
      `
SELECT
  projection.id,
  projection.instance_id,
  projection.organization_id::text,
  projection.owner_user_id::text,
  projection.owner_organization_id::text,
  projection.content_type,
  projection.title,
  projection.published_at::text,
  projection.publish_from::text,
  projection.publish_until::text,
  projection.created_at::text,
  projection.created_by,
  projection.updated_at::text,
  projection.updated_by,
  projection.author_display_mode,
  projection.author_display_name,
  projection.payload_json,
  projection.status,
  projection.validation_state,
  projection.history_ref,
  projection.current_revision_ref,
  projection.last_audit_event_ref,
  projection.source_data_provider_id,
  projection.source_data_provider_name,
  projection.credential_source,
  projection.source_system,
  projection.source_entity_type,
  projection.source_entity_id
FROM iam.content_list_projection AS projection
${whereClause};
      `,
      params
    );

    const dedupedRows = new Map<string, ProjectionRow>();
    for (const row of result.rows) {
      const deduplicationKey = buildProjectionDeduplicationKey(row);
      const existingRow = dedupedRows.get(deduplicationKey);
      if (
        !existingRow ||
        comparePreferredProjectionRows(row, existingRow) < 0
      ) {
        dedupedRows.set(deduplicationKey, row);
      }
    }
    const filteredRows = [...dedupedRows.values()].sort((left, right) =>
      compareProjectionRows(left, right, query.sortBy, query.sortDirection)
    );
    const offset = Math.max(0, (query.page - 1) * query.pageSize);
    const paginatedRows = filteredRows.slice(offset, offset + query.pageSize);

    return {
      items: paginatedRows.map(mapProjectionRow),
      total: filteredRows.length,
    };
  });

const resolveItemAccess = async (
  instanceId: string,
  activeOrganizationId: string | undefined,
  item: IamContentListItem,
  permissions: readonly EffectivePermission[],
  actorAccountId: string | undefined
): Promise<IamContentAccessSummary> => {
  const organizationId = item.organizationId ?? activeOrganizationId;
  const canCreate = evaluateAuthorizeDecision(
    buildListAccessAuthorizeRequest({
      instanceId,
      action: buildCreateAction(item.contentType),
      item,
      organizationId,
      actorAccountId,
    }),
    permissions
  ).allowed;
  const canUpdate = evaluateAuthorizeDecision(
    buildListAccessAuthorizeRequest({
      instanceId,
      action: buildUpdateAction(item.contentType),
      item,
      organizationId,
      actorAccountId,
    }),
    permissions
  ).allowed;

  return canUpdate
    ? {
        state: 'editable',
        canRead: true,
        canCreate,
        canUpdate: true,
        organizationIds: item.organizationId ? [item.organizationId] : [],
        sourceKinds: [],
      }
    : {
        state: 'read_only',
        canRead: true,
        canCreate,
        canUpdate: false,
        reasonCode: 'content_update_missing',
        organizationIds: item.organizationId ? [item.organizationId] : [],
        sourceKinds: [],
      };
};

const enrichProjectionItemsWithAccess = async (
  instanceId: string,
  activeOrganizationId: string | undefined,
  items: readonly IamContentListItem[],
  permissions: readonly EffectivePermission[],
  actorAccountId: string | undefined
): Promise<readonly IamContentListItem[]> => {
  const itemsWithAccess: IamContentListItem[] = [];

  for (const item of items) {
    itemsWithAccess.push({
      ...item,
      access: await resolveItemAccess(
        instanceId,
        activeOrganizationId,
        item,
        permissions,
        actorAccountId
      ),
    });
  }

  return itemsWithAccess;
};

const buildTypeAuthorizeRequest = (
  instanceId: string,
  contentType: string,
  organizationId: string | undefined
): AuthorizeRequest => {
  const action = buildReadAction(contentType);
  const workspaceContext = getWorkspaceContext();

  return {
    instanceId,
    action,
    resource: {
      type: action.split('.')[0] || 'content',
      ...(organizationId ? { organizationId } : {}),
      attributes: {
        contentType,
        ...(organizationId ? { organizationId } : {}),
      },
    },
    context: {
      ...(organizationId ? { organizationId } : {}),
      ...(workspaceContext.requestId ? { requestId: workspaceContext.requestId } : {}),
      ...(workspaceContext.traceId ? { traceId: workspaceContext.traceId } : {}),
      attributes: {
        contentType,
      },
    },
  };
};

const hasDeferredRowScopedReadPermission = (
  permissions: readonly EffectivePermission[],
  contentType: string
): boolean => {
  const action = buildReadAction(contentType);
  const resourceType = action.split('.')[0] ?? 'content';

  return permissions.some((permission) => {
    if (
      permission.action !== action ||
      permission.resourceType !== resourceType ||
      permission.resourceId
    ) {
      return false;
    }

    if (permission.accessScope === 'own') {
      return true;
    }

    if (permission.accessScope === 'organization') {
      return true;
    }

    return false;
  });
};

const authorizeRequestedTypes = async (
  ctx: AuthenticatedRequestContext,
  effectiveTypes: readonly string[]
): Promise<
  | {
      readonly allowedTypes: readonly string[];
      readonly permissions: readonly EffectivePermission[];
    }
  | Response
> => {
  const instanceId = ctx.user.instanceId;
  if (!instanceId) {
    return createListErrorResponse(
      400,
      'invalid_instance_id',
      'Kein Instanzkontext für diese Inhalte vorhanden.',
      getWorkspaceContext().requestId
    );
  }

  const resolvedPermissions = await resolveEffectivePermissions({
    instanceId,
    keycloakSubject: ctx.user.id,
    ...(ctx.activeOrganizationId ? { organizationId: ctx.activeOrganizationId } : {}),
  });
  if (!resolvedPermissions.ok) {
    return createListErrorResponse(
      503,
      'database_unavailable',
      'Berechtigungen konnten nicht geprüft werden.',
      getWorkspaceContext().requestId
    );
  }

  const allowedTypes: string[] = [];
  let sawForbidden = false;

  for (const contentType of effectiveTypes) {
    const decision = evaluateAuthorizeDecision(
      buildTypeAuthorizeRequest(instanceId, contentType, ctx.activeOrganizationId),
      resolvedPermissions.permissions
    );

    if (
      decision.allowed ||
      hasDeferredRowScopedReadPermission(resolvedPermissions.permissions, contentType)
    ) {
      allowedTypes.push(contentType);
      continue;
    }

    sawForbidden = true;
  }

  if (allowedTypes.length === 0 && sawForbidden) {
    return createListErrorResponse(
      403,
      'forbidden',
      'Keine Berechtigung für diese Inhalte.',
      getWorkspaceContext().requestId
    );
  }

  return {
    allowedTypes,
    permissions: resolvedPermissions.permissions,
  };
};

export const listProjectedContents = async (
  ctx: AuthenticatedRequestContext,
  query: IamContentListQuery
): Promise<Response> => {
  const instanceId = ctx.user.instanceId;
  if (!instanceId) {
    return createListErrorResponse(
      400,
      'invalid_instance_id',
      'Kein Instanzkontext für diese Inhalte vorhanden.',
      getWorkspaceContext().requestId
    );
  }

  const requestedTypes = resolveEffectiveTypes(query);
  const effectiveTypes =
    requestedTypes.length > 0 ? requestedTypes : await loadProjectedContentTypes(instanceId);
  if (query.type && effectiveTypes.length === 0) {
    return new Response(
      JSON.stringify({
        data: [],
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          total: 0,
        },
        ...(getWorkspaceContext().requestId ? { requestId: getWorkspaceContext().requestId } : {}),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const typeAuthorization = await authorizeRequestedTypes(ctx, effectiveTypes);
  if (typeAuthorization instanceof Response) {
    return typeAuthorization;
  }

  const initialVisibilityRules = buildProjectionReadVisibilityRules(
    typeAuthorization.allowedTypes,
    typeAuthorization.permissions
  );
  let actorAccountId: string | undefined;
  const requiresActorAccountId =
    initialVisibilityRules.some((rule) => rule.allowOwn) ||
    typeAuthorization.permissions.some(
      (permission) => permission.accessScope === 'own' || permission.accessScope === 'organization'
    );
  if (requiresActorAccountId) {
    try {
      actorAccountId = await withInstanceScopedDb(instanceId, async (client) =>
        resolveActorAccountId(client, {
          instanceId,
          keycloakSubject: ctx.user.id,
        })
      );
    } catch (error) {
      return createListErrorResponse(
        503,
        'database_unavailable',
        error instanceof Error ? error.message : 'Der Akteurkontext konnte nicht geladen werden.',
        getWorkspaceContext().requestId
      );
    }
  }

  const mainserverTypes = typeAuthorization.allowedTypes.filter(isMainserverContentType);
  const projectionTargets = buildProjectionTargets(ctx, mainserverTypes, actorAccountId);
  const syncStates = await computeProjectionSyncStates(projectionTargets);
  await maybeStartBackgroundProjectionRefresh(projectionTargets, syncStates);
  const responseSyncStates =
    projectionTargets.length > 0
      ? await computeProjectionSyncStates(projectionTargets)
      : syncStates;

  const shouldBlockOnMissingSnapshot = Boolean(query.type) || (query.visibleTypes?.length ?? 0) > 0;
  const blockingSyncGap = shouldBlockOnMissingSnapshot
    ? responseSyncStates.find((syncState) => syncState.hasSnapshot === false)
    : undefined;
  if (blockingSyncGap && query.type) {
    return createListErrorResponse(
      503,
      blockingSyncGap.lastErrorCode
        ? normalizeApiErrorCode(blockingSyncGap.lastErrorCode)
        : 'database_unavailable',
      'Für mindestens einen angefragten Mainserver-Inhaltstyp liegt noch kein synchronisierter Snapshot vor.',
      getWorkspaceContext().requestId
    );
  }

  const unavailableMainserverTypes = new Set<MainserverContentType>(
    responseSyncStates
      .filter((syncState) => syncState.hasSnapshot === false)
      .map((syncState) => syncState.contentType)
  );
  const loadableAllowedTypes = typeAuthorization.allowedTypes.filter((contentType) => {
    if (!isMainserverContentType(contentType)) {
      return true;
    }

    const mainserverContentType: MainserverContentType = contentType;
    return !unavailableMainserverTypes.has(mainserverContentType);
  });
  const visibilityRules = buildProjectionReadVisibilityRules(
    loadableAllowedTypes,
    typeAuthorization.permissions
  );

  const { items, total } = await loadProjectionPage(
    instanceId,
    query,
    visibilityRules,
    actorAccountId
  );
  const authorizedItems = await enrichProjectionItemsWithAccess(
    instanceId,
    ctx.activeOrganizationId,
    items,
    typeAuthorization.permissions,
    actorAccountId
  );

  return new Response(
    JSON.stringify({
      data: authorizedItems,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
      },
      ...(responseSyncStates.length > 0
        ? {
            metadata: {
              mainserverSyncStates: responseSyncStates,
              hasStaleMainserverContent: responseSyncStates.some((syncState) => syncState.isStale),
              hasBlockingSyncGap: responseSyncStates.some(
                (syncState) => syncState.hasSnapshot === false
              ),
              hasRunningMainserverSync: responseSyncStates.some(
                (syncState) => syncState.isSyncRunning
              ),
            },
          }
        : {}),
      ...(getWorkspaceContext().requestId ? { requestId: getWorkspaceContext().requestId } : {}),
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};

export const refreshProjectedContents = async (
  ctx: AuthenticatedRequestContext,
  input: {
    readonly visibleTypes?: readonly string[];
    readonly force?: boolean;
  }
): Promise<Response> => {
  const normalizedVisibleTypes =
    input.visibleTypes?.filter(
      (value) => value.trim().length > 0 && value !== EMPTY_VISIBLE_TYPE_SENTINEL
    ) ?? [];
  const typeAuthorization = await authorizeRequestedTypes(ctx, normalizedVisibleTypes);
  if (typeAuthorization instanceof Response) {
    return typeAuthorization;
  }

  const mainserverTypes = typeAuthorization.allowedTypes.filter(isMainserverContentType);
  const instanceId = ctx.user.instanceId;
  const requiresActorAccountId = typeAuthorization.permissions.some(
    (permission) => permission.accessScope === 'own' || permission.accessScope === 'organization'
  );
  const actorAccountId =
    requiresActorAccountId && instanceId
      ? await withInstanceScopedDb(instanceId, async (client) =>
          resolveActorAccountId(client, {
            instanceId,
            keycloakSubject: ctx.user.id,
          })
        )
      : undefined;
  const projectionTargets = buildProjectionTargets(ctx, mainserverTypes, actorAccountId);
  const refreshResult = await triggerMainserverProjectionRefreshBatch(projectionTargets, {
    force: input.force === true,
    awaitCompletion: true,
    trigger: 'manual',
  });
  const status = refreshResult.status;
  const syncStates = refreshResult.syncStates;

  return new Response(
    JSON.stringify({
      data: {
        status,
        syncStates,
      },
      ...(getWorkspaceContext().requestId ? { requestId: getWorkspaceContext().requestId } : {}),
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};

export const refreshProjectedContentsForMainserverMutation = async (input: {
  readonly instanceId: string;
  readonly keycloakSubject: string;
  readonly actorAccountId?: string;
  readonly contentType: MainserverContentType;
  readonly organizationId?: string;
  readonly operation?: MainserverProjectionMutationOperation;
  readonly entityId?: string;
}): Promise<void> => {
  const target = {
    instanceId: input.instanceId,
    keycloakSubject: input.keycloakSubject,
    ...(input.actorAccountId ? { actorAccountId: input.actorAccountId } : {}),
    contentType: input.contentType,
    ...(input.organizationId ? { organizationId: input.organizationId } : {}),
  } satisfies ContentProjectionSyncTarget;

  const supportsTargetedMutationRefresh =
    input.contentType in mainserverMutationProjectionLoaders &&
    typeof input.entityId === 'string' &&
    input.entityId.length > 0 &&
    (input.operation === 'create' || input.operation === 'update' || input.operation === 'delete');

  if (supportsTargetedMutationRefresh) {
    await refreshMainserverProjectionForMutation({
      target,
      operation: input.operation,
      entityId: input.entityId,
    });
    return;
  }

  await triggerMainserverProjectionRefresh(target, {
    force: true,
    awaitCompletion: true,
    trigger: 'mutation_follow_up',
  });
};
