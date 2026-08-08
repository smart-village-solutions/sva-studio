import { randomUUID } from 'node:crypto';

import {
  type IamContentAccessSummary,
  type IamContentListItem,
  type IamContentListQuery,
} from '@sva/core';
import {
  evaluateAuthorizeDecision,
  type AuthorizeRequest,
  type EffectivePermission,
} from '@sva/iam-core';
import {
  type AuthenticatedRequestContext,
  loadCurrentMainserverDataProviderBinding,
  readEffectiveSvaMainserverCredentialsWithStatus,
  readMainserverScopeResolverMode,
  resolveActorAccountId,
  recordSuccessfulExternalContentMutation,
  recordSuccessfulExternalContentDeletion,
  resolveEffectivePermissions,
  withInstanceScopedDb,
} from '@sva/auth-runtime/server';
import {
  getSvaMainserverEvent,
  getSvaMainserverGenericItem,
  getSvaMainserverNews,
  getSvaMainserverPoi,
  getSvaMainserverSurvey,
  listSvaMainserverProjection,
  listSvaMainserverEvents,
  listSvaMainserverGenericItems,
  listSvaMainserverNews,
  listSvaMainserverPoi,
  listSvaMainserverSurveys,
} from '@sva/sva-mainserver/server';
import type { SvaMainserverProjectionListItem } from '@sva/sva-mainserver';
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
import {
  mapEventItem,
  mapGenericItem,
  mapNewsItem,
  mapPoiItem,
  mapSurveyItem,
} from './iam-content-list-mainserver.js';
import { runMainserverProjectionRoundRobin } from './mainserver-projection-refresh-coordinator.server.js';
import { buildMainserverProjectionScopeKey } from './mainserver-projection-scope.server.js';

const MAIN_SERVER_SYNC_STALE_MS = 5 * 60 * 1000;
const MAIN_SERVER_SYNC_POLL_INTERVAL_MS = 60 * 1000;
const MAX_SYNC_ITEMS_PER_TYPE = 5_000;
type ProjectionSyncStateSchemaMode = 'legacy' | 'scoped';
type ProjectionTableSchemaMode = 'legacy' | 'scoped';
type ProjectionSchemaModeCategory = 'sync-state' | 'table' | 'all';
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
  credential_fingerprint: string | null;
  authorization_mode: IamContentListItem['authorizationMode'] | null;
  source_system: 'iam' | 'mainserver';
  source_entity_type: string;
  source_entity_id: string;
  resolved_content_id?: string | null;
};

type ProjectionSyncStateRow = {
  sync_scope_key: string;
  last_started_at: string | null;
  last_succeeded_at: string | null;
  last_failed_at: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
  projected_count: number;
  snapshot_state?: ContentProjectionSnapshotState;
  refresh_run_id?: string | null;
  refresh_phase?: 'hot' | 'reconciliation' | null;
  completed_page?: number;
  available_count?: number;
  is_total_final?: boolean;
  skipped_invalid_count?: number;
};

type ContentProjectionSnapshotState =
  | 'empty'
  | 'partial_running'
  | 'partial_failed'
  | 'complete_fresh'
  | 'complete_refreshing'
  | 'complete_failed';

type ContentProjectionSyncState = Readonly<{
  contentType: MainserverContentType;
  lastStartedAt?: string;
  lastSucceededAt?: string;
  lastFailedAt?: string;
  lastErrorCode?: string;
  isStale: boolean;
  isSyncRunning: boolean;
  hasSnapshot: boolean;
  snapshotState: ContentProjectionSnapshotState;
  refreshPhase?: 'hot' | 'reconciliation';
  completedPage: number;
  availableCount: number;
  isTotalFinal: boolean;
  skippedInvalidCount: number;
}>;

type ContentProjectionSyncTarget = Readonly<{
  instanceId: string;
  keycloakSubject: string;
  actorAccountId?: string;
  actorDisplayName?: string;
  mutationRef?: string;
  contentType: MainserverContentType;
  organizationId?: string;
  actingPrincipalType?: 'organization' | 'user';
  credentialFingerprint?: string;
  authorizationMode?: 'credential_visible_compatibility' | 'exact';
}>;

type TriggerProjectionRefreshResult = Readonly<{
  status: 'accepted' | 'already_running' | 'completed' | 'failed';
  syncStates: readonly ContentProjectionSyncState[];
}>;

type MainserverProjectionMutationOperation = 'create' | 'update' | 'delete';
type GenericItemProjectionContentType =
  'generic-items.generic-item' | 'faq.faq' | 'cockpit-cards.cockpit-card' | 'projects.project';
type TargetedMutationContentType =
  | 'news.article'
  | 'events.event-record'
  | 'poi.point-of-interest'
  | 'generic-items.generic-item'
  | 'faq.faq'
  | 'cockpit-cards.cockpit-card'
  | 'projects.project'
  | 'surveys.survey';
type ProjectionRefreshTrigger = 'manual' | 'mutation_follow_up' | 'reconciliation' | 'scheduler';

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
  | 'credentialFingerprint'
  | 'authorizationMode'
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
  query: <TRow = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[]
  ) => Promise<{
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
  | 'credentialFingerprint'
  | 'authorizationMode'
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
      credentialFingerprint: row.credential_fingerprint,
      authorizationMode: row.authorization_mode,
    }).filter(([, value]) => typeof value === 'string' && value.length > 0)
  ) as Partial<OptionalProjectionItemFields>;

const mapProjectionRow = (row: ProjectionRow): IamContentListItem => ({
  id:
    row.content_type === 'projects.project' && row.resolved_content_id
      ? row.resolved_content_id
      : row.id,
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

const comparePreferredProjectionRows = (left: ProjectionRow, right: ProjectionRow): number => {
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
  const code = typeof candidate.code === 'string' ? candidate.code : '';
  const column = typeof candidate.column === 'string' ? candidate.column : '';
  const constraint = typeof candidate.constraint === 'string' ? candidate.constraint : '';
  const message = typeof candidate.message === 'string' ? candidate.message : '';
  const referencesProjectionScope =
    column === 'projection_scope_key' ||
    column === 'sync_scope_key' ||
    constraint === 'content_list_projection_scope_key' ||
    constraint === 'content_list_projection_sync_state_pkey' ||
    message.includes('projection_scope_key') ||
    message.includes('sync_scope_key') ||
    message.includes('content_list_projection_scope_key') ||
    message.includes('content_list_projection_sync_state_pkey');

  return (
    referencesProjectionScope &&
    (code === '42703' ||
      code === '42704' ||
      code === '42P10' ||
      code === '23502' ||
      code === '23505')
  );
};

const withProjectionSchemaModeRetry = async <T>(
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

const buildProjectionTargetKey = (target: ContentProjectionSyncTarget): string => {
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

const buildMainserverReadScopeKeys = (input: {
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
    value === 'faq.faq' ||
    value === 'cockpit-cards.cockpit-card' ||
    value === 'projects.project' ||
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

const countProjectedRowsForScope = async (target: ContentProjectionSyncTarget): Promise<number> =>
  withInstanceScopedDb(target.instanceId, async (client) => {
    const result = await withProjectionSchemaModeRetry(target, 'table', async () => {
      const schemaMode = await loadProjectionTableSchemaMode(client, target.instanceId);
      return schemaMode === 'scoped'
        ? client.query<{ total: string | number }>(
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
        : client.query<{ total: string | number }>(
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
  });

const countProjectedRowsForScopeWithClient = async (
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

const markProjectionSyncStarted = async (
  target: ContentProjectionSyncTarget,
  refreshRunId: string,
  refreshPhase: 'hot' | 'reconciliation'
): Promise<void> => {
  await withInstanceScopedDb(target.instanceId, async (client) => {
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
  });
};

const markProjectionSyncFailed = async (
  target: ContentProjectionSyncTarget,
  refreshRunId: string,
  errorCode: string,
  errorMessage: string
): Promise<void> => {
  await withInstanceScopedDb(target.instanceId, async (client) => {
    await withProjectionSchemaModeRetry(target, 'sync-state', async () => {
      const schemaMode = await loadProjectionSyncStateSchemaMode(client, target.instanceId);
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
  });
};

const markProjectionRefreshPhase = async (
  target: ContentProjectionSyncTarget,
  refreshRunId: string,
  refreshPhase: 'hot' | 'reconciliation'
): Promise<void> => {
  await withInstanceScopedDb(target.instanceId, async (client) => {
    await withProjectionSchemaModeRetry(target, 'sync-state', async () => {
      const schemaMode = await loadProjectionSyncStateSchemaMode(client, target.instanceId);
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
  });
};

const deleteMainserverProjectionRows = async (
  client: ProjectionDbClient,
  target: ContentProjectionSyncTarget
): Promise<void> => {
  await withProjectionSchemaModeRetry(target, 'table', async () => {
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
  });
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

  await withProjectionSchemaModeRetry(target, 'table', async () => {
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
  });
};

const deleteMainserverProjectionRowByEntity = async (
  client: ProjectionDbClient,
  target: ContentProjectionSyncTarget,
  sourceEntityId: string
): Promise<void> => {
  await withProjectionSchemaModeRetry(target, 'table', async () => {
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
  });
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

const upsertSingleMainserverProjectionRow = async (
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

const markMainserverProjectionSyncSucceeded = async (
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

const persistMainserverProjectionRowsProgressively = async (input: {
  readonly target: ContentProjectionSyncTarget;
  readonly keycloakSubject: string;
  readonly actorAccountId: string | undefined;
  readonly rows: readonly MainserverProjectionRowInput[];
  readonly finalize: boolean;
  readonly page: number;
  readonly refreshRunId: string;
  readonly skippedInvalidCount: number;
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
    await withProjectionSchemaModeRetry(input.target, 'sync-state', async () => {
      const schemaMode = await loadProjectionSyncStateSchemaMode(client, input.target.instanceId);
      const leaderResult = await client.query<{ refresh_run_id?: string | null }>(
        schemaMode === 'scoped'
          ? `
SELECT refresh_run_id::text
FROM iam.content_list_projection_sync_state
WHERE instance_id = $1
  AND source_system = 'mainserver'
  AND content_type = $2
  AND sync_scope_key = $3
LIMIT 1
FOR UPDATE;
          `
          : `
SELECT refresh_run_id::text
FROM iam.content_list_projection_sync_state
WHERE instance_id = $1
  AND source_system = 'mainserver'
  AND content_type = $2
LIMIT 1
FOR UPDATE;
          `,
        schemaMode === 'scoped'
          ? [
              input.target.instanceId,
              input.target.contentType,
              buildMainserverSyncScopeKey(input.target),
            ]
          : [input.target.instanceId, input.target.contentType]
      );
      const persistedRunId = leaderResult.rows[0]?.refresh_run_id;
      if (persistedRunId !== input.refreshRunId) {
        return;
      }

      if (projectionPayloadJson) {
        await upsertMainserverProjectionRows(client, input.target, projectionPayloadJson);
      }
      const availableCount = await countProjectedRowsForScopeWithClient(client, input.target);

      await client.query(
        schemaMode === 'scoped'
          ? `
UPDATE iam.content_list_projection_sync_state
SET snapshot_state = CASE WHEN last_succeeded_at IS NULL THEN 'partial_running' ELSE 'complete_refreshing' END,
    completed_page = GREATEST(completed_page, $5),
    available_count = $6,
    skipped_invalid_count = $7,
    is_total_final = FALSE,
    updated_at = NOW()
WHERE instance_id = $1
  AND source_system = 'mainserver'
  AND content_type = $2
  AND sync_scope_key = $3
  AND (refresh_run_id = $4::uuid OR refresh_run_id IS NULL);
          `
          : `
UPDATE iam.content_list_projection_sync_state
SET snapshot_state = CASE WHEN last_succeeded_at IS NULL THEN 'partial_running' ELSE 'complete_refreshing' END,
    completed_page = GREATEST(completed_page, $4),
    available_count = $5,
    skipped_invalid_count = $6,
    is_total_final = FALSE,
    updated_at = NOW()
WHERE instance_id = $1
  AND source_system = 'mainserver'
  AND content_type = $2
  AND (refresh_run_id = $3::uuid OR refresh_run_id IS NULL);
          `,
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

      if (input.finalize) {
        await deleteMainserverProjectionRowsNotInSet(
          client,
          input.target,
          dedupedRows.map((row) => row.sourceEntityId)
        );
        const projectedCount = await countProjectedRowsForScopeWithClient(client, input.target);
        await markMainserverProjectionSyncSucceeded(client, input.target, projectedCount);
      }
    });
  });
};

type MainserverProjectionLoadedPage = Readonly<{
  readonly rows: readonly MainserverProjectionRowInput[];
  readonly hasNextPage: boolean;
  readonly nextPage: number;
  readonly skippedInvalidCount: number;
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
  actingPrincipalType?: 'organization' | 'user'
): IamContentListItem['credentialSource'] =>
  result.credentialSource ?? actingPrincipalType ?? 'user';

const hasNextProjectionPage = (
  result: MainserverProjectionPageResult<unknown>,
  pageQuery: {
    readonly page: number;
    readonly pageSize: number;
  },
  continueAfterEmptyPage = false
): boolean => {
  const nextPage = result.pagination.page ?? pageQuery.page;
  return (
    (continueAfterEmptyPage || result.data.length > 0) &&
    nextPage >= pageQuery.page &&
    result.pagination.hasNextPage &&
    pageQuery.page * pageQuery.pageSize < MAX_SYNC_ITEMS_PER_TYPE
  );
};

const buildLoadedProjectionPage = <TItem>(input: {
  readonly result: MainserverProjectionPageResult<TItem>;
  readonly pagingResult?: MainserverProjectionPageResult<unknown>;
  readonly pageQuery: {
    readonly page: number;
    readonly pageSize: number;
  };
  readonly mapRow: (
    item: TItem,
    credentialSource: IamContentListItem['credentialSource']
  ) => MainserverProjectionRowInput;
  readonly projectedOrganizationId: string | undefined;
  readonly actingPrincipalType?: 'organization' | 'user';
  readonly continueAfterEmptyPage?: boolean;
}): MainserverProjectionLoadedPage => {
  const credentialSource = resolveMainserverProjectionCredentialSource(
    input.result,
    input.actingPrincipalType
  );
  const pagingResult = input.pagingResult ?? input.result;
  const nextPage = pagingResult.pagination.page ?? input.pageQuery.page;

  return {
    rows: input.result.data.map((item) => input.mapRow(item, credentialSource)),
    hasNextPage: hasNextProjectionPage(pagingResult, input.pageQuery, input.continueAfterEmptyPage),
    nextPage: nextPage + 1,
    skippedInvalidCount: 0,
  };
};

type MainserverProjectionPageLoader = (
  input: Readonly<{
    target: ContentProjectionSyncTarget;
    pageQuery: {
      readonly page: number;
      readonly pageSize: number;
    };
  }>
) => Promise<MainserverProjectionLoadedPage>;

const toProjectionPrincipalContext = (target: ContentProjectionSyncTarget) =>
  target.actingPrincipalType ? { actingPrincipalType: target.actingPrincipalType } : {};

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
        ...toProjectionPrincipalContext(target),
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
      ...toProjectionPrincipalContext(target),
    }),
  'generic-items.generic-item': async ({ target, pageQuery }) =>
    buildLoadedProjectionPage({
      result: await listSvaMainserverGenericItems({
        instanceId: target.instanceId,
        keycloakSubject: target.keycloakSubject,
        activeOrganizationId: target.organizationId,
        ...toProjectionPrincipalContext(target),
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
      ...toProjectionPrincipalContext(target),
    }),
  'faq.faq': async ({ target, pageQuery }) =>
    listSvaMainserverGenericItems({
      instanceId: target.instanceId,
      keycloakSubject: target.keycloakSubject,
      activeOrganizationId: target.organizationId,
      ...toProjectionPrincipalContext(target),
      includeInvisible: true,
      ...pageQuery,
    }).then((result) =>
      buildLoadedProjectionPage({
        result: { ...result, data: result.data.filter((item) => item.genericType === 'FAQ') },
        pagingResult: result,
        pageQuery,
        mapRow: (item, credentialSource) => ({
          ...mapGenericItem(item, target.instanceId, []),
          contentType: 'faq.faq',
          ...(target.organizationId ? { organizationId: target.organizationId } : {}),
          credentialSource,
          sourceEntityType: 'faq.faq',
          sourceEntityId: item.id,
        }),
        projectedOrganizationId: target.organizationId,
        ...toProjectionPrincipalContext(target),
      })
    ),
  'cockpit-cards.cockpit-card': async ({ target, pageQuery }) =>
    listSvaMainserverGenericItems({
      instanceId: target.instanceId,
      keycloakSubject: target.keycloakSubject,
      activeOrganizationId: target.organizationId,
      ...toProjectionPrincipalContext(target),
      includeInvisible: true,
      ...pageQuery,
    }).then((result) =>
      buildLoadedProjectionPage({
        result: {
          ...result,
          data: result.data.filter((item) => item.genericType === 'COCKPIT_CARD'),
        },
        pagingResult: result,
        pageQuery,
        mapRow: (item, credentialSource) => ({
          ...mapGenericItem(item, target.instanceId, []),
          contentType: 'cockpit-cards.cockpit-card',
          ...(target.organizationId ? { organizationId: target.organizationId } : {}),
          credentialSource,
          sourceEntityType: 'cockpit-cards.cockpit-card',
          sourceEntityId: item.id,
        }),
        projectedOrganizationId: target.organizationId,
        ...toProjectionPrincipalContext(target),
      })
    ),
  'projects.project': async ({ target, pageQuery }) =>
    listSvaMainserverGenericItems({
      instanceId: target.instanceId,
      keycloakSubject: target.keycloakSubject,
      activeOrganizationId: target.organizationId,
      ...toProjectionPrincipalContext(target),
      includeInvisible: true,
      ...pageQuery,
    }).then((result) =>
      buildLoadedProjectionPage({
        result: {
          ...result,
          data: result.data.filter(
            (item) =>
              item.genericType === 'FeaturedProject' &&
              !(
                item.payload &&
                typeof item.payload === 'object' &&
                !Array.isArray(item.payload) &&
                (item.payload as Record<string, unknown>).deleted === true
              )
          ),
        },
        pagingResult: result,
        pageQuery,
        mapRow: (item, credentialSource) => ({
          ...mapGenericItem(item, target.instanceId, []),
          contentType: 'projects.project',
          ...(target.organizationId ? { organizationId: target.organizationId } : {}),
          credentialSource,
          sourceEntityType: 'projects.project',
          sourceEntityId: item.id,
        }),
        projectedOrganizationId: target.organizationId,
        ...toProjectionPrincipalContext(target),
        continueAfterEmptyPage: true,
      })
    ),
  'news.article': async ({ target, pageQuery }) =>
    buildLoadedProjectionPage({
      result: await listSvaMainserverNews({
        instanceId: target.instanceId,
        keycloakSubject: target.keycloakSubject,
        activeOrganizationId: target.organizationId,
        ...toProjectionPrincipalContext(target),
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
      ...toProjectionPrincipalContext(target),
    }),
  'poi.point-of-interest': async ({ target, pageQuery }) =>
    buildLoadedProjectionPage({
      result: await listSvaMainserverPoi({
        instanceId: target.instanceId,
        keycloakSubject: target.keycloakSubject,
        activeOrganizationId: target.organizationId,
        ...toProjectionPrincipalContext(target),
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
      ...toProjectionPrincipalContext(target),
    }),
  'surveys.survey': async ({ target, pageQuery }) =>
    buildLoadedProjectionPage({
      result: await listSvaMainserverSurveys({
        instanceId: target.instanceId,
        keycloakSubject: target.keycloakSubject,
        activeOrganizationId: target.organizationId,
        ...toProjectionPrincipalContext(target),
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
      ...toProjectionPrincipalContext(target),
    }),
};

type ProjectionBindingState = Readonly<{
  authorizationMode: 'credential_visible_compatibility' | 'exact';
  userDataProviderId?: string;
  organizationDataProviderId?: string;
  userCredentialFingerprint?: string;
  organizationCredentialFingerprint?: string;
}>;

const resolveProjectionBindingState = async (
  target: ContentProjectionSyncTarget
): Promise<ProjectionBindingState> => {
  if (!target.actorAccountId) {
    return { authorizationMode: 'credential_visible_compatibility' };
  }

  try {
    const [userCredentials, organizationCredentials] = await Promise.all([
      readEffectiveSvaMainserverCredentialsWithStatus({
        instanceId: target.instanceId,
        keycloakSubject: target.keycloakSubject,
        activeOrganizationId: target.organizationId,
        actingPrincipalType: 'user',
      }),
      target.organizationId
        ? readEffectiveSvaMainserverCredentialsWithStatus({
            instanceId: target.instanceId,
            keycloakSubject: target.keycloakSubject,
            activeOrganizationId: target.organizationId,
            actingPrincipalType: 'organization',
          })
        : Promise.resolve(undefined),
    ]);
    const [userBinding, organizationBinding] = await Promise.all([
      userCredentials.status === 'ok'
        ? loadCurrentMainserverDataProviderBinding({
            instanceId: target.instanceId,
            principalType: 'user',
            principalId: target.actorAccountId,
            credentialFingerprint: userCredentials.credentialFingerprint,
          })
        : Promise.resolve(undefined),
      target.organizationId && organizationCredentials?.status === 'ok'
        ? loadCurrentMainserverDataProviderBinding({
            instanceId: target.instanceId,
            principalType: 'organization',
            principalId: target.organizationId,
            credentialFingerprint: organizationCredentials.credentialFingerprint,
          })
        : Promise.resolve(undefined),
    ]);
    const exactCandidate = target.organizationId
      ? Boolean(userBinding && organizationBinding)
      : Boolean(userBinding);
    const exact = readMainserverScopeResolverMode() === 'automatic' && exactCandidate;
    return {
      authorizationMode: exact ? 'exact' : 'credential_visible_compatibility',
      ...(userBinding ? { userDataProviderId: userBinding.dataProviderId } : {}),
      ...(organizationBinding
        ? { organizationDataProviderId: organizationBinding.dataProviderId }
        : {}),
      ...(userCredentials.status === 'ok'
        ? { userCredentialFingerprint: userCredentials.credentialFingerprint }
        : {}),
      ...(organizationCredentials?.status === 'ok'
        ? { organizationCredentialFingerprint: organizationCredentials.credentialFingerprint }
        : {}),
    };
  } catch (error) {
    contentProjectionLogger.warn('mainserver_projection_binding_state_failed', {
      operation: 'mainserver_projection_binding_state',
      instance_id: target.instanceId,
      content_type: target.contentType,
      error_code: error instanceof Error ? error.name : 'unknown_error',
    });
    return { authorizationMode: 'credential_visible_compatibility' };
  }
};

const enrichProjectionRowsWithBindingState = async (
  target: ContentProjectionSyncTarget,
  page: MainserverProjectionLoadedPage
): Promise<MainserverProjectionLoadedPage> => {
  const state = await resolveProjectionBindingState(target);
  return {
    ...page,
    rows: page.rows.map((row) => {
      const providerId = row.sourceDataProviderId;
      const exact = state.authorizationMode === 'exact';
      return {
        ...row,
        ownerUserId:
          exact && providerId === state.userDataProviderId ? target.actorAccountId : undefined,
        ownerOrganizationId:
          exact && providerId === state.organizationDataProviderId
            ? target.organizationId
            : undefined,
        credentialFingerprint:
          row.credentialSource === 'organization'
            ? state.organizationCredentialFingerprint
            : state.userCredentialFingerprint,
        authorizationMode: state.authorizationMode,
      };
    }),
  };
};

const loadMainserverProjectionPage = async (
  target: ContentProjectionSyncTarget,
  pageQuery: {
    readonly page: number;
    readonly pageSize: number;
  }
): Promise<MainserverProjectionLoadedPage> => {
  if (!target.instanceId) {
    throw createListErrorResponse(
      400,
      'invalid_instance_id',
      'Kein Instanzkontext für diese Inhalte vorhanden.'
    );
  }
  if ((process.env.SVA_CONTENT_PROJECTION_ADAPTER_MODE ?? 'slim') !== 'legacy') {
    const result = await listSvaMainserverProjection({
      instanceId: target.instanceId,
      keycloakSubject: target.keycloakSubject,
      activeOrganizationId: target.organizationId,
      ...toProjectionPrincipalContext(target),
      contentType: target.contentType,
      includeInvisible: true,
      ...pageQuery,
    });
    const credentialSource = result.credentialSource ?? target.actingPrincipalType ?? 'user';
    return enrichProjectionRowsWithBindingState(target, {
      rows: result.data.map((item: SvaMainserverProjectionListItem) => ({
        id: item.id,
        instanceId: target.instanceId,
        ...(target.organizationId ? { organizationId: target.organizationId } : {}),
        contentType: target.contentType,
        title: item.title,
        ...(item.publishedAt ? { publishedAt: item.publishedAt } : {}),
        createdAt: item.createdAt,
        createdBy: item.author ?? 'mainserver',
        updatedAt: item.updatedAt,
        updatedBy: item.author ?? 'mainserver',
        authorDisplayMode: 'organization',
        author: item.author ?? 'mainserver',
        ...(item.dataProvider?.id ? { sourceDataProviderId: item.dataProvider.id } : {}),
        ...(item.dataProvider?.name ? { sourceDataProviderName: item.dataProvider.name } : {}),
        credentialSource,
        payload: {},
        status:
          item.visible === false || item.active === false || item.status === 'DRAFT'
            ? 'draft'
            : item.status === 'ARCHIVED'
              ? 'archived'
              : 'published',
        validationState: 'valid',
        historyRef: `mainserver:${target.contentType}:${item.id}`,
        sourceEntityType: target.contentType,
        sourceEntityId: item.id,
      })),
      hasNextPage: hasNextProjectionPage(
        result,
        pageQuery,
        target.contentType === 'faq.faq' ||
          target.contentType === 'cockpit-cards.cockpit-card' ||
          target.contentType === 'projects.project'
      ),
      nextPage: (result.pagination.page ?? pageQuery.page) + 1,
      skippedInvalidCount: result.skippedInvalidCount,
    });
  }
  return enrichProjectionRowsWithBindingState(
    target,
    await mainserverProjectionPageLoaders[target.contentType]({
      target,
      pageQuery,
    })
  );
};

const refreshMainserverProjectionBatch = (
  targets: readonly ContentProjectionSyncTarget[],
  trigger: ProjectionRefreshTrigger
): Readonly<{
  hotCompletion: Promise<Map<string, Response | null>>;
  completion: Promise<Map<string, Response | null>>;
}> => {
  const responses = new Map<string, Response | null>();
  const accumulatedRows = new Map<string, MainserverProjectionRowInput[]>();
  const refreshRunIds = new Map<string, string>();
  const skippedInvalidCounts = new Map<string, number>();
  let resolveHotCompletion: ((responses: Map<string, Response | null>) => void) | undefined;
  const hotCompletion = new Promise<Map<string, Response | null>>((resolve) => {
    resolveHotCompletion = resolve;
  });

  const completion = (async () => {
    for (const target of targets) {
      const targetKey = buildProjectionTargetKey(target);
      const refreshRunId = randomUUID();
      await markProjectionSyncStarted(target, refreshRunId, 'hot');
      accumulatedRows.set(targetKey, []);
      refreshRunIds.set(targetKey, refreshRunId);
      skippedInvalidCounts.set(targetKey, 0);
    }

    await runMainserverProjectionRoundRobin(
      targets,
      MAINSERVER_PROGRESSIVE_FETCH_PAGE_SIZE,
      async (target, pageQuery) => {
        const result = await loadMainserverProjectionPage(target, pageQuery);
        const targetKey = buildProjectionTargetKey(target);
        skippedInvalidCounts.set(
          targetKey,
          (skippedInvalidCounts.get(targetKey) ?? 0) + result.skippedInvalidCount
        );
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
          page: pages.length,
          refreshRunId: refreshRunIds.get(targetKey) as string,
          skippedInvalidCount: skippedInvalidCounts.get(targetKey) ?? 0,
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
        await markProjectionSyncFailed(
          target,
          refreshRunIds.get(buildProjectionTargetKey(target)) as string,
          errorCode,
          errorMessage
        );
        responses.set(
          buildProjectionTargetKey(target),
          createListErrorResponse(503, errorCode, errorMessage, getWorkspaceContext().requestId)
        );
      },
      async () => {
        resolveHotCompletion?.(new Map(responses));
        for (const target of targets) {
          const targetKey = buildProjectionTargetKey(target);
          if (!responses.has(targetKey)) {
            await markProjectionRefreshPhase(
              target,
              refreshRunIds.get(targetKey) as string,
              'reconciliation'
            );
          }
        }
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
        page: Math.max(
          1,
          Math.ceil(
            (accumulatedRows.get(targetKey)?.length ?? 0) / MAINSERVER_PROGRESSIVE_FETCH_PAGE_SIZE
          )
        ),
        refreshRunId: refreshRunIds.get(targetKey) as string,
        skippedInvalidCount: skippedInvalidCounts.get(targetKey) ?? 0,
      });
      responses.set(targetKey, null);
    }

    resolveHotCompletion?.(new Map(responses));
    return responses;
  })().catch((error: unknown) => {
    resolveHotCompletion?.(new Map(responses));
    throw error;
  });

  return { hotCompletion, completion };
};

type MainserverMutationProjectionLoader = (
  input: Readonly<{
    target: ContentProjectionSyncTarget;
    entityId: string;
    credentialSource: IamContentListItem['credentialSource'];
    projectedOrganizationId: string | undefined;
  }>
) => Promise<MainserverProjectionRowInput>;

const requireMutationProjectionPrincipalContext = (
  target: ContentProjectionSyncTarget
): Readonly<{
  actingPrincipalType: 'organization' | 'user';
  credentialFingerprint: string;
  authorizationMode: 'credential_visible_compatibility' | 'exact';
}> => {
  if (!target.actingPrincipalType || !target.credentialFingerprint || !target.authorizationMode) {
    throw new Error('mainserver_projection_mutation_principal_context_required');
  }
  return {
    actingPrincipalType: target.actingPrincipalType,
    credentialFingerprint: target.credentialFingerprint,
    authorizationMode: target.authorizationMode,
  };
};

const toMutationProjectionConnectionContext = (target: ContentProjectionSyncTarget) => {
  const context = requireMutationProjectionPrincipalContext(target);
  return {
    actingPrincipalType: context.actingPrincipalType,
    credentialFingerprint: context.credentialFingerprint,
  } as const;
};

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
      ...toMutationProjectionConnectionContext(target),
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
      ...toMutationProjectionConnectionContext(target),
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
  'faq.faq': async ({ target, entityId, credentialSource, projectedOrganizationId }) => {
    const item = await getSvaMainserverGenericItem({
      activeOrganizationId: target.organizationId,
      ...toMutationProjectionConnectionContext(target),
      genericItemId: entityId,
      instanceId: target.instanceId,
      keycloakSubject: target.keycloakSubject,
    });
    return {
      ...mapGenericItem(item, target.instanceId, []),
      contentType: 'faq.faq',
      ...(projectedOrganizationId ? { organizationId: projectedOrganizationId } : {}),
      credentialSource,
      sourceEntityType: 'faq.faq',
      sourceEntityId: item.id,
    };
  },
  'cockpit-cards.cockpit-card': async ({
    target,
    entityId,
    credentialSource,
    projectedOrganizationId,
  }) => {
    const item = await getSvaMainserverGenericItem({
      activeOrganizationId: target.organizationId,
      ...toMutationProjectionConnectionContext(target),
      genericItemId: entityId,
      instanceId: target.instanceId,
      keycloakSubject: target.keycloakSubject,
    });
    return {
      ...mapGenericItem(item, target.instanceId, []),
      contentType: 'cockpit-cards.cockpit-card',
      ...(projectedOrganizationId ? { organizationId: projectedOrganizationId } : {}),
      credentialSource,
      sourceEntityType: 'cockpit-cards.cockpit-card',
      sourceEntityId: item.id,
    };
  },
  'projects.project': async ({ target, entityId, credentialSource, projectedOrganizationId }) => {
    const item = await getSvaMainserverGenericItem({
      activeOrganizationId: target.organizationId,
      ...toMutationProjectionConnectionContext(target),
      genericItemId: entityId,
      instanceId: target.instanceId,
      keycloakSubject: target.keycloakSubject,
    });
    return {
      ...mapGenericItem(item, target.instanceId, []),
      contentType: 'projects.project',
      ...(projectedOrganizationId ? { organizationId: projectedOrganizationId } : {}),
      credentialSource,
      sourceEntityType: 'projects.project',
      sourceEntityId: item.id,
    };
  },
  'news.article': async ({ target, entityId, credentialSource, projectedOrganizationId }) => {
    const item = await getSvaMainserverNews({
      activeOrganizationId: target.organizationId,
      ...toMutationProjectionConnectionContext(target),
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
      ...toMutationProjectionConnectionContext(target),
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
  'surveys.survey': async ({ target, entityId, credentialSource, projectedOrganizationId }) => {
    const item = await getSvaMainserverSurvey({
      activeOrganizationId: target.organizationId,
      ...toMutationProjectionConnectionContext(target),
      instanceId: target.instanceId,
      keycloakSubject: target.keycloakSubject,
      surveyId: entityId,
    });
    return {
      ...mapSurveyItem(item, target.instanceId, []),
      ...(projectedOrganizationId ? { organizationId: projectedOrganizationId } : {}),
      credentialSource,
      sourceEntityType: 'surveys.survey',
      sourceEntityId: item.id,
    };
  },
};

const loadMainserverProjectionMutationRow = async (
  target: ContentProjectionSyncTarget,
  entityId: string
): Promise<MainserverProjectionRowInput> => {
  const projectedOrganizationId = target.organizationId;
  const principalContext = requireMutationProjectionPrincipalContext(target);
  const credentialSource: IamContentListItem['credentialSource'] =
    principalContext.actingPrincipalType;
  const loader =
    mainserverMutationProjectionLoaders[target.contentType as TargetedMutationContentType];
  if (loader) {
    const row = await loader({
      target,
      entityId,
      credentialSource,
      projectedOrganizationId,
    });
    return {
      ...row,
      credentialSource,
      credentialFingerprint: principalContext.credentialFingerprint,
      authorizationMode: principalContext.authorizationMode,
    };
  }

  throw new Error(
    `Unsupported targeted projection refresh for content type "${target.contentType}".`
  );
};

const enrichMutationProjectionRowWithBinding = async (
  target: ContentProjectionSyncTarget,
  row: MainserverProjectionRowInput
): Promise<MainserverProjectionRowInput> => {
  const principalContext = requireMutationProjectionPrincipalContext(target);
  const rowWithoutSyntheticOwner = {
    ...row,
    ownerUserId: undefined,
    ownerOrganizationId: undefined,
    credentialSource: principalContext.actingPrincipalType,
    credentialFingerprint: principalContext.credentialFingerprint,
    authorizationMode: principalContext.authorizationMode,
  } satisfies MainserverProjectionRowInput;

  if (principalContext.authorizationMode !== 'exact' || !row.sourceDataProviderId) {
    return rowWithoutSyntheticOwner;
  }

  const principalId =
    principalContext.actingPrincipalType === 'organization'
      ? target.organizationId
      : target.actorAccountId;
  if (!principalId) {
    return rowWithoutSyntheticOwner;
  }

  try {
    const binding = await loadCurrentMainserverDataProviderBinding({
      instanceId: target.instanceId,
      principalType: principalContext.actingPrincipalType,
      principalId,
      credentialFingerprint: principalContext.credentialFingerprint,
    });
    if (binding?.dataProviderId !== row.sourceDataProviderId) {
      return rowWithoutSyntheticOwner;
    }

    return {
      ...rowWithoutSyntheticOwner,
      ...(principalContext.actingPrincipalType === 'organization'
        ? { ownerOrganizationId: principalId }
        : { ownerUserId: principalId }),
    };
  } catch (error) {
    contentProjectionLogger.warn('mainserver_projection_mutation_binding_failed', {
      ...buildProjectionLogContext(target, 'mutation_follow_up'),
      error_code: error instanceof Error ? error.name : 'unknown_error',
    });
    return rowWithoutSyntheticOwner;
  }
};

const refreshMainserverProjectionForMutation = async (input: {
  readonly target: ContentProjectionSyncTarget;
  readonly operation: MainserverProjectionMutationOperation;
  readonly entityId: string;
  readonly row?: MainserverProjectionRowInput;
}): Promise<void> => {
  const { target, operation, entityId, row: providedRow } = input;
  const { actorAccountId } = target;
  const targetKey = buildProjectionTargetKey(target);
  const refreshRunId = randomUUID();
  const precedingSync = runningProjectionSyncs.get(targetKey) ?? Promise.resolve(null);
  const mutationWork = precedingSync.then(async () => {
    await markProjectionSyncStarted(target, refreshRunId, 'hot');

    try {
      if (operation === 'delete') {
        if (actorAccountId && target.actorDisplayName && target.mutationRef) {
          await recordSuccessfulExternalContentDeletion({
            instanceId: target.instanceId,
            actorAccountId,
            actorDisplayName: target.actorDisplayName,
            mutationRef: target.mutationRef,
            sourceSystem: 'mainserver',
            sourceEntityType: target.contentType,
            sourceEntityId: entityId,
          });
        }
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
          await deleteMainserverProjectionRowByEntity(client, target, entityId);
          const projectedCount = await countProjectedRowsForScopeWithClient(client, target);
          await markMainserverProjectionSyncSucceeded(client, target, projectedCount);
        });
        return;
      }

      let lastError: unknown;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const loadedRow =
            providedRow ?? (await loadMainserverProjectionMutationRow(target, entityId));
          const row = await enrichMutationProjectionRowWithBinding(target, loadedRow);
          await upsertSingleMainserverProjectionRow(target, actorAccountId, row, refreshRunId);
          if (
            actorAccountId &&
            target.actorDisplayName &&
            target.mutationRef &&
            (operation === 'create' || operation === 'update')
          ) {
            await recordSuccessfulExternalContentMutation({
              instanceId: target.instanceId,
              actorAccountId,
              actorDisplayName: target.actorDisplayName,
              mutationRef: target.mutationRef,
              operation,
              sourceSystem: 'mainserver',
              sourceEntityType: target.contentType,
              sourceEntityId: entityId,
              contentType: target.contentType,
              ...(row.organizationId ? { organizationId: row.organizationId } : {}),
              title: row.title,
              payload: row.payload,
              status: row.status,
              ...(row.publishedAt ? { publishedAt: row.publishedAt } : {}),
              authorDisplayMode: row.authorDisplayMode,
              authorDisplayName: row.author,
            });
          }
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
      await markProjectionSyncFailed(target, refreshRunId, errorCode, errorMessage);
    }
  });
  const mutationSync = mutationWork
    .then(
      () => null as Response | null,
      () => null as Response | null
    )
    .finally(() => {
      if (runningProjectionSyncs.get(targetKey) === mutationSync) {
        runningProjectionSyncs.delete(targetKey);
      }
    });

  runningProjectionSyncs.set(targetKey, mutationSync);
  await mutationWork;
};

const genericItemProjectionContentTypes = [
  'generic-items.generic-item',
  'faq.faq',
  'cockpit-cards.cockpit-card',
  'projects.project',
] as const satisfies readonly GenericItemProjectionContentType[];

const resolveSpecializedGenericItemProjectionContentType = (
  genericType: string
): Exclude<GenericItemProjectionContentType, 'generic-items.generic-item'> | undefined => {
  if (genericType === 'FAQ') {
    return 'faq.faq';
  }
  if (genericType === 'COCKPIT_CARD') {
    return 'cockpit-cards.cockpit-card';
  }
  if (genericType === 'FeaturedProject') {
    return 'projects.project';
  }
  return undefined;
};

const deleteStaleGenericItemSiblingProjection = async (
  target: ContentProjectionSyncTarget,
  entityId: string
): Promise<void> => {
  const targetKey = buildProjectionTargetKey(target);
  const precedingSync = runningProjectionSyncs.get(targetKey) ?? Promise.resolve(null);
  const deleteWork = precedingSync.then(() =>
    withInstanceScopedDb(target.instanceId, async (client) => {
      await deleteMainserverProjectionRowByEntity(client, target, entityId);
    })
  );
  const siblingSync = deleteWork
    .then(
      () => null as Response | null,
      () => null as Response | null
    )
    .finally(() => {
      if (runningProjectionSyncs.get(targetKey) === siblingSync) {
        runningProjectionSyncs.delete(targetKey);
      }
    });

  runningProjectionSyncs.set(targetKey, siblingSync);
  await deleteWork;
};

const refreshGenericItemProjectionSnapshots = async (
  target: ContentProjectionSyncTarget
): Promise<void> => {
  for (const contentType of genericItemProjectionContentTypes) {
    await triggerMainserverProjectionRefresh(
      { ...target, contentType },
      { force: true, awaitCompletion: true, trigger: 'mutation_follow_up' }
    );
  }
};

const refreshGenericItemSiblingProjections = async (input: {
  readonly target: ContentProjectionSyncTarget;
  readonly operation: MainserverProjectionMutationOperation;
  readonly entityId: string;
}): Promise<void> => {
  if (
    input.operation === 'delete' &&
    input.target.actorAccountId &&
    input.target.actorDisplayName &&
    input.target.mutationRef
  ) {
    await recordSuccessfulExternalContentDeletion({
      instanceId: input.target.instanceId,
      actorAccountId: input.target.actorAccountId,
      actorDisplayName: input.target.actorDisplayName,
      mutationRef: input.target.mutationRef,
      sourceSystem: 'mainserver',
      sourceEntityType: input.target.contentType,
      sourceEntityId: input.entityId,
    });
  }
  let item: Awaited<ReturnType<typeof getSvaMainserverGenericItem>> | undefined;
  try {
    item =
      input.operation === 'delete'
        ? undefined
        : await getSvaMainserverGenericItem({
            activeOrganizationId: input.target.organizationId,
            ...toMutationProjectionConnectionContext(input.target),
            genericItemId: input.entityId,
            instanceId: input.target.instanceId,
            keycloakSubject: input.target.keycloakSubject,
          });
  } catch {
    await refreshGenericItemProjectionSnapshots(input.target);
    return;
  }
  const specializedContentType = item
    ? resolveSpecializedGenericItemProjectionContentType(item.genericType)
    : undefined;

  for (const contentType of genericItemProjectionContentTypes) {
    const target = { ...input.target, contentType } satisfies ContentProjectionSyncTarget;
    const shouldProject =
      contentType === 'generic-items.generic-item' || contentType === specializedContentType;
    const row =
      item && shouldProject
        ? {
            ...mapGenericItem(item, target.instanceId, []),
            contentType,
            ...(target.organizationId ? { organizationId: target.organizationId } : {}),
            credentialSource: requireMutationProjectionPrincipalContext(target).actingPrincipalType,
            credentialFingerprint:
              requireMutationProjectionPrincipalContext(target).credentialFingerprint,
            authorizationMode: requireMutationProjectionPrincipalContext(target).authorizationMode,
            sourceEntityType: contentType,
            sourceEntityId: item.id,
          }
        : undefined;

    if (!shouldProject || input.operation === 'delete') {
      await deleteStaleGenericItemSiblingProjection(target, input.entityId);
    } else {
      await refreshMainserverProjectionForMutation({
        target,
        operation: input.operation,
        entityId: input.entityId,
        ...(row ? { row } : {}),
      });
    }
  }
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

  const hasLegacyGlobalSnapshot = hasGlobalSnapshot && !syncState?.sync_scope_key;
  if (
    !hasLegacyGlobalSnapshot &&
    (hasGlobalSnapshot ||
      (process.env.SVA_CONTENT_PROJECTION_PARTIAL_READS_ENABLED ?? 'true') === 'true')
  ) {
    const projectedRowsForScope = await countProjectedRowsForScope(target);
    hasSnapshot =
      projectedRowsForScope > 0 || (hasGlobalSnapshot && (syncState?.projected_count ?? 0) === 0);
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
    snapshotState: syncState?.snapshot_state ?? (hasSnapshot ? 'complete_fresh' : 'empty'),
    ...(syncState?.refresh_phase ? { refreshPhase: syncState.refresh_phase } : {}),
    completedPage: syncState?.completed_page ?? 0,
    availableCount: syncState?.available_count ?? syncState?.projected_count ?? 0,
    isTotalFinal: syncState?.is_total_final ?? hasSnapshot,
    skippedInvalidCount: syncState?.skipped_invalid_count ?? 0,
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
  const hotSyncs = new Map<string, Promise<Response | null>>();
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
    const batchRun = refreshMainserverProjectionBatch(idleTargets, options.trigger);
    for (const target of idleTargets) {
      const targetKey = buildProjectionTargetKey(target);
      const targetPromise = batchRun.completion
        .then((responses) => responses.get(targetKey) ?? null)
        .catch((error: unknown) => {
          contentProjectionLogger.warn('mainserver_projection_reconciliation_failed', {
            ...buildProjectionLogContext(target, options.trigger),
            error_message:
              error instanceof Error ? error.message : 'Mainserver-Reconciliation fehlgeschlagen.',
          });
          return new Response(null, { status: 500 });
        })
        .finally(() => {
          if (runningProjectionSyncs.get(targetKey) === targetPromise) {
            runningProjectionSyncs.delete(targetKey);
          }
        });
      runningProjectionSyncs.set(targetKey, targetPromise);
      pendingSyncs.set(targetKey, targetPromise);
      hotSyncs.set(
        targetKey,
        batchRun.hotCompletion.then((responses) => responses.get(targetKey) ?? null)
      );
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

  const hotCompletionEnabled =
    (process.env.SVA_CONTENT_PROJECTION_HOT_COMPLETION_ENABLED ?? 'true') !== 'false';
  const awaitedSyncs = hotCompletionEnabled && hotSyncs.size > 0 ? hotSyncs : pendingSyncs;
  const results = await Promise.all([...awaitedSyncs.values()]);
  return {
    status: results.some((result) => result !== null)
      ? 'failed'
      : idleTargets.length === 0
        ? 'already_running'
        : hotCompletionEnabled && hotSyncs.size > 0
          ? 'accepted'
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
    if (!mainserverContentType || !ctx.user.instanceId || !actorAccountId) {
      return [];
    }

    return [
      {
        instanceId: ctx.user.instanceId,
        keycloakSubject: ctx.user.id,
        actorAccountId,
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
  const enforceExactScopes = readMainserverScopeResolverMode() === 'automatic';
  const perTypeClauses = rules.flatMap((rule) => {
    const allowClauses: string[] = [];
    if (rule.allowGlobal) {
      allowClauses.push('TRUE');
    }
    if (rule.allowCredentialCompatibility) {
      allowClauses.push(
        enforceExactScopes
          ? `(projection.source_system = 'mainserver' AND projection.authorization_mode = 'credential_visible_compatibility')`
          : `(projection.source_system = 'mainserver')`
      );
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
  actorAccountId: string | undefined,
  activeOrganizationId: string | undefined
): Promise<{ readonly items: readonly IamContentListItem[]; readonly total: number }> =>
  withInstanceScopedDb(instanceId, async (client) => {
    const target = {
      instanceId,
      keycloakSubject: '',
      ...(actorAccountId ? { actorAccountId } : {}),
      contentType: 'news.article' as MainserverContentType,
      ...(activeOrganizationId ? { organizationId: activeOrganizationId } : {}),
    } satisfies ContentProjectionSyncTarget;

    return withProjectionSchemaModeRetry(target, 'table', async () => {
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

      const projectionSchemaMode = await loadProjectionTableSchemaMode(client, instanceId);
      if (projectionSchemaMode === 'scoped') {
        const mainserverScopeKeys = buildMainserverReadScopeKeys({
          instanceId,
          contentTypes: rules.map((rule) => rule.contentType),
          actorAccountId,
          activeOrganizationId,
        });
        params.push([...mainserverScopeKeys]);
        const mainserverScopeParam = `$${params.length}`;
        conditions.push(
          `(
          projection.source_system <> 'mainserver'
          OR projection.projection_scope_key = ANY(${mainserverScopeParam}::text[])
        )`
        );
      }

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
  projection.credential_fingerprint,
  projection.authorization_mode,
  projection.source_system,
  projection.source_entity_type,
  projection.source_entity_id,
  project_reference.content_id AS resolved_content_id
FROM iam.content_list_projection AS projection
LEFT JOIN LATERAL (
  SELECT reference.content_id::text AS content_id
  FROM iam.external_content_references AS reference
  WHERE projection.content_type = 'projects.project'
    AND reference.instance_id = projection.instance_id
    AND reference.source_system = 'mainserver'
    AND reference.source_entity_type = 'GenericItem'
    AND reference.source_entity_id = projection.source_entity_id
    AND reference.reconciliation_status = 'bound'
  LIMIT 1
) AS project_reference ON TRUE
${whereClause}
  AND NOT (
    projection.content_type = 'projects.project'
    AND projection.payload_json->>'deleted' = 'true'
  );
      `,
        params
      );

      const dedupedRows = new Map<string, ProjectionRow>();
      for (const row of result.rows) {
        const deduplicationKey = buildProjectionDeduplicationKey(row);
        const existingRow = dedupedRows.get(deduplicationKey);
        if (!existingRow || comparePreferredProjectionRows(row, existingRow) < 0) {
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
  const updateRequest = buildListAccessAuthorizeRequest({
    instanceId,
    action: buildUpdateAction(item.contentType),
    item,
    organizationId,
    actorAccountId,
  });
  const exactUpdateAllowed = evaluateAuthorizeDecision(updateRequest, permissions).allowed;
  const compatibilityPermissions = permissions.map((permission) => ({
    ...permission,
    ...(permission.accessScope === 'own' || permission.accessScope === 'organization'
      ? { accessScope: undefined }
      : {}),
  }));
  const canUpdate =
    exactUpdateAllowed ||
    ((item.authorizationMode === 'credential_visible_compatibility' ||
      readMainserverScopeResolverMode() !== 'automatic') &&
      evaluateAuthorizeDecision(updateRequest, compatibilityPermissions).allowed);

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

  const mainserverTypes = typeAuthorization.allowedTypes.filter(isMainserverContentType);
  const initialVisibilityRules = buildProjectionReadVisibilityRules(
    typeAuthorization.allowedTypes,
    typeAuthorization.permissions
  );
  let actorAccountId: string | undefined;
  const requiresActorAccountId =
    mainserverTypes.length > 0 ||
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

    if (!actorAccountId && mainserverTypes.length > 0) {
      return createListErrorResponse(
        503,
        'database_unavailable',
        'Der Akteurkontext fuer Mainserver-Inhalte konnte nicht geladen werden.',
        getWorkspaceContext().requestId
      );
    }
  }

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
    actorAccountId,
    ctx.activeOrganizationId
  );
  const authorizedItems = await enrichProjectionItemsWithAccess(
    instanceId,
    ctx.activeOrganizationId,
    items,
    typeAuthorization.permissions,
    actorAccountId
  );
  const isTotalFinal = responseSyncStates.every((syncState) => syncState.isTotalFinal);

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
              availableCount: total,
              ...(isTotalFinal ? { totalCount: total } : {}),
              isTotalFinal,
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
  const requiresActorAccountId =
    mainserverTypes.length > 0 ||
    typeAuthorization.permissions.some(
      (permission) => permission.accessScope === 'own' || permission.accessScope === 'organization'
    );
  let actorAccountId: string | undefined;
  if (requiresActorAccountId && instanceId) {
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
  if (!actorAccountId && mainserverTypes.length > 0) {
    return createListErrorResponse(
      503,
      'database_unavailable',
      'Der Akteurkontext fuer Mainserver-Inhalte konnte nicht geladen werden.',
      getWorkspaceContext().requestId
    );
  }
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
  readonly actorDisplayName?: string;
  readonly mutationRef?: string;
  readonly contentType: MainserverContentType;
  readonly organizationId?: string;
  readonly actingPrincipalType: 'organization' | 'user';
  readonly credentialFingerprint: string;
  readonly authorizationMode: 'credential_visible_compatibility' | 'exact';
  readonly operation?: MainserverProjectionMutationOperation;
  readonly entityId?: string;
}): Promise<void> => {
  if (!input.actorAccountId) {
    return;
  }

  const target = {
    instanceId: input.instanceId,
    keycloakSubject: input.keycloakSubject,
    actorAccountId: input.actorAccountId,
    ...(input.actorDisplayName ? { actorDisplayName: input.actorDisplayName } : {}),
    ...(input.mutationRef ? { mutationRef: input.mutationRef } : {}),
    contentType: input.contentType,
    ...(input.organizationId ? { organizationId: input.organizationId } : {}),
    actingPrincipalType: input.actingPrincipalType,
    credentialFingerprint: input.credentialFingerprint,
    authorizationMode: input.authorizationMode,
  } satisfies ContentProjectionSyncTarget;

  const supportsTargetedMutationRefresh =
    input.contentType in mainserverMutationProjectionLoaders &&
    typeof input.entityId === 'string' &&
    input.entityId.length > 0 &&
    (input.operation === 'create' || input.operation === 'update' || input.operation === 'delete');

  if (supportsTargetedMutationRefresh) {
    if (
      genericItemProjectionContentTypes.includes(
        input.contentType as GenericItemProjectionContentType
      )
    ) {
      await refreshGenericItemSiblingProjections({
        target,
        operation: input.operation,
        entityId: input.entityId,
      });
      return;
    }
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
