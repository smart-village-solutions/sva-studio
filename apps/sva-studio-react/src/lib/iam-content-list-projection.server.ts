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
  listSvaMainserverEvents,
  listSvaMainserverNews,
  listSvaMainserverPoi,
  listSvaMainserverSurveys,
} from '@sva/sva-mainserver/server';
import { getWorkspaceContext } from '@sva/server-runtime';

import {
  createListErrorResponse,
  EMPTY_VISIBLE_TYPE_SENTINEL,
  isMainserverContentType,
  MAINSERVER_FETCH_PAGE_SIZE,
  normalizeApiErrorCode,
} from './iam-content-list-api.shared.js';
import {
  buildProjectionReadVisibilityRules,
  type ProjectionReadVisibilityRule,
} from './iam-content-list-visibility.js';
import { mapEventItem, mapNewsItem, mapPoiItem, mapSurveyItem } from './iam-content-list-mainserver.js';

const MAIN_SERVER_SYNC_STALE_MS = 5 * 60 * 1000;
const MAIN_SERVER_SYNC_POLL_INTERVAL_MS = 60 * 1000;
const MAX_SYNC_ITEMS_PER_TYPE = 5_000;

type MainserverContentType = 'news.article' | 'events.event-record' | 'poi.point-of-interest' | 'surveys.survey';

export type ProjectionRow = {
  id: string;
  instance_id: string;
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
  query: (text: string, values?: readonly unknown[]) => Promise<unknown>;
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
let contentProjectionSchedulerStarted = false;

const buildProjectionTargetKey = (target: ContentProjectionSyncTarget): string =>
  `${target.instanceId}::${target.contentType}::${
    target.organizationId ?? `subject:${target.actorAccountId ?? target.keycloakSubject}`
  }`;

const toMainserverContentType = (value: string): MainserverContentType | null => {
  if (
    value === 'news.article' ||
    value === 'events.event-record' ||
    value === 'poi.point-of-interest' ||
    value === 'surveys.survey'
  ) {
    return value;
  }

  return null;
};

const loadProjectionSyncState = async (
  instanceId: string,
  contentType: string
): Promise<ProjectionSyncStateRow | null> =>
  withInstanceScopedDb(instanceId, async (client) => {
    const result = await client.query<ProjectionSyncStateRow>(
      `
SELECT
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
      [instanceId, contentType]
    );

    return result.rows[0] ?? null;
  });

const countProjectedRowsForScope = async (
  instanceId: string,
  contentType: string,
  actorAccountId: string | undefined,
  organizationId?: string
): Promise<number> =>
  withInstanceScopedDb(instanceId, async (client) => {
    const result = await client.query<{ total: string | number }>(
      `
SELECT COUNT(*)::int AS total
FROM iam.content_list_projection
WHERE instance_id = $1
  AND source_system = 'mainserver'
  AND content_type = $2
  AND (
    ($3::text IS NOT NULL AND organization_id::text = $3::text)
    OR (
      $3::text IS NULL
      AND organization_id IS NULL
      AND (
        ($4::text IS NOT NULL AND owner_user_id::text = $4::text)
        OR owner_user_id IS NULL
      )
    )
  );
      `,
      [instanceId, contentType, organizationId ?? null, actorAccountId ?? null]
    );

    return Number(result.rows[0]?.total ?? 0);
  });

const markProjectionSyncStarted = async (
  instanceId: string,
  contentType: string
): Promise<void> => {
  await withInstanceScopedDb(instanceId, async (client) => {
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
      [instanceId, contentType]
    );
  });
};

const markProjectionSyncFailed = async (
  instanceId: string,
  contentType: string,
  errorCode: string,
  errorMessage: string
): Promise<void> => {
  await withInstanceScopedDb(instanceId, async (client) => {
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
      [instanceId, contentType, errorCode, errorMessage]
    );
  });
};

const deleteMainserverProjectionRows = async (
  client: ProjectionDbClient,
  instanceId: string,
  contentType: string,
  organizationId: string | undefined,
  actorAccountId: string | undefined
): Promise<void> => {
  await client.query(
    `
DELETE FROM iam.content_list_projection
WHERE instance_id = $1
  AND source_system = 'mainserver'
  AND content_type = $2
  AND (
    ($3::text IS NOT NULL AND organization_id::text = $3::text)
    OR (
      $3::text IS NULL
      AND organization_id IS NULL
      AND (
        ($4::text IS NOT NULL AND owner_user_id::text = $4::text)
        OR owner_user_id IS NULL
      )
    )
  );
    `,
    [instanceId, contentType, organizationId ?? null, actorAccountId ?? null]
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
  actorAccountId: string | undefined
) => ({
  id: row.id,
  instance_id: row.instanceId,
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
  actorAccountId: string | undefined
): string =>
  JSON.stringify(rows.map((row) => mapMainserverProjectionPayloadRow(row, actorAccountId)));

const upsertMainserverProjectionRows = async (
  client: ProjectionDbClient,
  payloadJson: string
): Promise<void> => {
  await client.query(
    `
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
    `,
    [payloadJson]
  );
};

const markMainserverProjectionSyncSucceeded = async (
  client: ProjectionDbClient,
  instanceId: string,
  contentType: string,
  projectedCount: number
): Promise<void> => {
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
    [instanceId, contentType, projectedCount]
  );
};

const replaceMainserverProjectionRows = async (
  instanceId: string,
  contentType: string,
  keycloakSubject: string,
  actorAccountId: string | undefined,
  organizationId: string | undefined,
  rows: readonly MainserverProjectionRowInput[]
): Promise<void> => {
  const dedupedRows = dedupeProjectionRows(rows, keycloakSubject);
  const projectionPayloadJson = buildMainserverProjectionPayloadJson(dedupedRows, actorAccountId);

  await withInstanceScopedDb(instanceId, async (client) => {
    await deleteMainserverProjectionRows(
      client,
      instanceId,
      contentType,
      organizationId,
      actorAccountId
    );

    if (dedupedRows.length > 0) {
      await upsertMainserverProjectionRows(client, projectionPayloadJson);
    }

    await markMainserverProjectionSyncSucceeded(
      client,
      instanceId,
      contentType,
      dedupedRows.length
    );
  });
};

const fetchAllPages = async <TItem>(
  loadPage: (query: { readonly page: number; readonly pageSize: number }) => Promise<{
    readonly data: readonly TItem[];
    readonly credentialSource?: IamContentListItem['credentialSource'];
    readonly pagination: { readonly hasNextPage: boolean; readonly page?: number };
  }>
): Promise<{
  readonly credentialSource?: IamContentListItem['credentialSource'];
  readonly data: readonly TItem[];
}> => {
  const items: TItem[] = [];
  let credentialSource: IamContentListItem['credentialSource'] | undefined;
  let page = 1;
  let hasNextPage = true;

  while (hasNextPage && items.length < MAX_SYNC_ITEMS_PER_TYPE) {
    const response = await loadPage({ page, pageSize: MAINSERVER_FETCH_PAGE_SIZE });
    credentialSource ??= response.credentialSource;
    const remaining = MAX_SYNC_ITEMS_PER_TYPE - items.length;
    items.push(...response.data.slice(0, remaining));
    hasNextPage = response.pagination.hasNextPage;
    const nextPage = response.pagination.page ?? page;
    if (response.data.length === 0 || nextPage < page) {
      break;
    }
    page = nextPage + 1;
  }

  return {
    data: items,
    ...(credentialSource ? { credentialSource } : {}),
  };
};

type MainserverProjectionPageResult<TItem> = {
  readonly credentialSource?: IamContentListItem['credentialSource'];
  readonly data: readonly TItem[];
};

const resolveMainserverProjectionCredentialSource = <TItem>(
  result: MainserverProjectionPageResult<TItem>,
  projectedOrganizationId: string | undefined
): IamContentListItem['credentialSource'] =>
  result.credentialSource ?? (projectedOrganizationId ? 'organization' : 'user');

const refreshMainserverProjection = async (
  target: ContentProjectionSyncTarget
): Promise<Response | null> => {
  const { instanceId, keycloakSubject, actorAccountId, contentType, organizationId } = target;
  if (!instanceId) {
    return createListErrorResponse(
      400,
      'invalid_instance_id',
      'Kein Instanzkontext für diese Inhalte vorhanden.'
    );
  }

  await markProjectionSyncStarted(instanceId, contentType);

  try {
    const connection = {
      instanceId,
      keycloakSubject,
      activeOrganizationId: organizationId,
    };
    const projectedOrganizationId = organizationId;

    let rows: readonly MainserverProjectionRowInput[] = [];

    if (contentType === 'news.article') {
      const result = await fetchAllPages((pageQuery) =>
        listSvaMainserverNews({
          ...connection,
          includeInvisible: true,
          ...pageQuery,
        })
      );
      const credentialSource = resolveMainserverProjectionCredentialSource(
        result,
        projectedOrganizationId
      );
      rows = result.data.map((item) => ({
        ...mapNewsItem(item, instanceId, []),
        ...(projectedOrganizationId ? { organizationId: projectedOrganizationId } : {}),
        credentialSource,
        sourceEntityType: 'news.article',
        sourceEntityId: item.id,
      }));
    } else if (contentType === 'events.event-record') {
      const result = await fetchAllPages((pageQuery) =>
        listSvaMainserverEvents({
          ...connection,
          includeInvisible: true,
          ...pageQuery,
        })
      );
      const credentialSource = resolveMainserverProjectionCredentialSource(
        result,
        projectedOrganizationId
      );
      rows = result.data.map((item) => ({
        ...mapEventItem(item, instanceId, []),
        ...(projectedOrganizationId ? { organizationId: projectedOrganizationId } : {}),
        credentialSource,
        sourceEntityType: 'events.event-record',
        sourceEntityId: item.id,
      }));
    } else if (contentType === 'poi.point-of-interest') {
      const result = await fetchAllPages((pageQuery) =>
        listSvaMainserverPoi({
          ...connection,
          includeInvisible: true,
          ...pageQuery,
        })
      );
      const credentialSource = resolveMainserverProjectionCredentialSource(
        result,
        projectedOrganizationId
      );
      rows = result.data.map((item) => ({
        ...mapPoiItem(item, instanceId, []),
        ...(projectedOrganizationId ? { organizationId: projectedOrganizationId } : {}),
        credentialSource,
        sourceEntityType: 'poi.point-of-interest',
        sourceEntityId: item.id,
      }));
    } else if (contentType === 'surveys.survey') {
      const result = await fetchAllPages((pageQuery) =>
        listSvaMainserverSurveys({
          ...connection,
          ...pageQuery,
          includeArchived: true,
        })
      );
      const credentialSource = resolveMainserverProjectionCredentialSource(
        result,
        projectedOrganizationId
      );
      rows = result.data.map((item) => ({
        ...mapSurveyItem(item, instanceId, []),
        ...(projectedOrganizationId ? { organizationId: projectedOrganizationId } : {}),
        credentialSource,
        sourceEntityType: 'surveys.survey',
        sourceEntityId: item.id,
      }));
    }

    await replaceMainserverProjectionRows(
      instanceId,
      contentType,
      keycloakSubject,
      actorAccountId,
      projectedOrganizationId,
      rows
    );
    return null;
  } catch (error) {
    const errorCode = normalizeApiErrorCode(
      error && typeof error === 'object' && 'code' in error
        ? (error as { code?: unknown }).code
        : undefined
    );
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Mainserver-Inhalte konnten nicht synchronisiert werden.';
    await markProjectionSyncFailed(instanceId, contentType, errorCode, errorMessage);
    return createListErrorResponse(503, errorCode, errorMessage, getWorkspaceContext().requestId);
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
  const timer = setInterval(() => {
    for (const target of registeredProjectionTargets.values()) {
      void triggerMainserverProjectionRefresh(target, { force: false, awaitCompletion: false });
    }
  }, MAIN_SERVER_SYNC_POLL_INTERVAL_MS);

  timer.unref?.();
};

const computeProjectionSyncState = async (
  target: ContentProjectionSyncTarget
): Promise<ContentProjectionSyncState> => {
  const syncState = await loadProjectionSyncState(target.instanceId, target.contentType);
  const lastSucceededAtMs = syncState?.last_succeeded_at
    ? Date.parse(syncState.last_succeeded_at)
    : Number.NaN;
  const hasGlobalSnapshot = Number.isFinite(lastSucceededAtMs);
  let hasSnapshot = hasGlobalSnapshot;

  if (hasGlobalSnapshot) {
    const projectedRowsForScope = await countProjectedRowsForScope(
      target.instanceId,
      target.contentType,
      target.actorAccountId,
      target.organizationId
    );
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
  }
): Promise<TriggerProjectionRefreshResult> => {
  registerProjectionTarget(target);
  ensureContentProjectionSchedulerStarted();

  const targetKey = buildProjectionTargetKey(target);
  const currentState = await computeProjectionSyncState(target);
  if (!options.force && currentState.hasSnapshot && currentState.isStale === false) {
    return { status: 'completed', syncStates: [currentState] };
  }

  const runningSync = runningProjectionSyncs.get(targetKey);
  if (runningSync) {
    if (options.awaitCompletion) {
      await runningSync;
      return {
        status: 'already_running',
        syncStates: [await computeProjectionSyncState(target)],
      };
    }

    return { status: 'already_running', syncStates: [currentState] };
  }

  const nextSync = refreshMainserverProjection(target).finally(() => {
    if (runningProjectionSyncs.get(targetKey) === nextSync) {
      runningProjectionSyncs.delete(targetKey);
    }
  });
  runningProjectionSyncs.set(targetKey, nextSync);

  if (!options.awaitCompletion) {
    void nextSync;
    return {
      status: 'accepted',
      syncStates: [
        {
          ...currentState,
          isSyncRunning: true,
        },
      ],
    };
  }

  const response = await nextSync;
  return {
    status: response ? 'failed' : 'completed',
    syncStates: [await computeProjectionSyncState(target)],
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
  await Promise.all(
    targets.map((target, index) => {
      const syncState = syncStates[index];
      if (!syncState || syncState.isStale === false) {
        return Promise.resolve();
      }

      return triggerMainserverProjectionRefresh(target, {
        force: !syncState.hasSnapshot,
        awaitCompletion: false,
      }).then(() => undefined);
    })
  );
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

const listSortColumnByField = {
  title: 'projection.title',
  contentType: 'projection.content_type',
  status: 'projection.status',
  updatedAt: 'projection.updated_at',
} as const satisfies Record<IamContentListQuery['sortBy'], string>;

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
    const orderByClause = `ORDER BY ${listSortColumnByField[query.sortBy]} ${
      query.sortDirection === 'asc' ? 'ASC' : 'DESC'
    }, projection.updated_at DESC, projection.id DESC`;

    const totalResult = await client.query<{ total: string | number }>(
      `
SELECT COUNT(*)::int AS total
FROM iam.content_list_projection AS projection
${whereClause};
      `,
      params
    );
    const total = Number(totalResult.rows[0]?.total ?? 0);

    params.push(query.pageSize);
    const limitParam = `$${params.length}`;
    params.push(Math.max(0, (query.page - 1) * query.pageSize));
    const offsetParam = `$${params.length}`;

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
${whereClause}
${orderByClause}
LIMIT ${limitParam}
OFFSET ${offsetParam};
      `,
      params
    );

    return {
      items: result.rows.map(mapProjectionRow),
      total,
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

  const visibilityRules = buildProjectionReadVisibilityRules(
    typeAuthorization.allowedTypes,
    typeAuthorization.permissions
  );
  let actorAccountId: string | undefined;
  const requiresActorAccountId =
    visibilityRules.some((rule) => rule.allowOwn) ||
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
  if (blockingSyncGap) {
    return createListErrorResponse(
      503,
      blockingSyncGap.lastErrorCode
        ? normalizeApiErrorCode(blockingSyncGap.lastErrorCode)
        : 'database_unavailable',
      'Für mindestens einen angefragten Mainserver-Inhaltstyp liegt noch kein synchronisierter Snapshot vor.',
      getWorkspaceContext().requestId
    );
  }

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
  const refreshResults = await Promise.all(
    projectionTargets.map((target) =>
      triggerMainserverProjectionRefresh(target, {
        force: input.force === true,
        awaitCompletion: true,
      })
    )
  );

  const status = refreshResults.some((result) => result.status === 'failed')
    ? 'failed'
    : refreshResults.some((result) => result.status === 'already_running')
      ? 'already_running'
      : refreshResults.length > 0
        ? 'completed'
        : 'accepted';
  const syncStates = refreshResults.flatMap((result) => result.syncStates);

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
}): Promise<void> => {
  await triggerMainserverProjectionRefresh(
    {
      instanceId: input.instanceId,
      keycloakSubject: input.keycloakSubject,
      ...(input.actorAccountId ? { actorAccountId: input.actorAccountId } : {}),
      contentType: input.contentType,
      ...(input.organizationId ? { organizationId: input.organizationId } : {}),
    },
    {
      force: true,
      awaitCompletion: true,
    }
  );
};
