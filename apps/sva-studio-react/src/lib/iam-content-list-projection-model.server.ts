import type { IamContentListItem, IamContentListQuery } from '@sva/core';

import type { MainserverContentType } from './iam-content-list-api.shared.js';

type ProjectionOwnership = Readonly<{
  organization_id: string | null;
  owner_user_id: string | null;
  owner_organization_id: string | null;
}>;

export type ProjectionRow = ProjectionOwnership & {
  id: string;
  instance_id: string;
  projection_scope_key: string;
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

export type ProjectionSyncStateRow = {
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

export type ContentProjectionSnapshotState =
  | 'empty'
  | 'partial_running'
  | 'partial_failed'
  | 'complete_fresh'
  | 'complete_refreshing'
  | 'complete_failed';

export type ContentProjectionSyncState = Readonly<{
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

export type ContentProjectionSyncTarget = Readonly<{
  instanceId: string;
  keycloakSubject: string;
  actorAccountId?: string;
  auditActorAccountId?: string;
  actorDisplayName?: string;
  ownershipPrincipal?: Readonly<{ type: 'account' | 'organization'; id: string }>;
  mutationRef?: string;
  contentType: MainserverContentType;
  organizationId?: string;
  actingPrincipalType?: 'organization' | 'user';
  credentialFingerprint?: string;
  authorizationMode?: 'credential_visible_compatibility' | 'exact';
}>;

export type TriggerProjectionRefreshResult = Readonly<{
  status: 'accepted' | 'already_running' | 'completed' | 'failed';
  syncStates: readonly ContentProjectionSyncState[];
}>;

export type MainserverProjectionMutationOperation = 'create' | 'update' | 'delete';

export type TargetedMutationContentType =
  | 'news.article'
  | 'events.event-record'
  | 'poi.point-of-interest'
  | 'generic-items.generic-item'
  | 'faq.faq'
  | 'cockpit-cards.cockpit-card'
  | 'projects.project'
  | 'surveys.survey';

export type ProjectionRefreshTrigger =
  'manual' | 'mutation_follow_up' | 'reconciliation' | 'scheduler';

export type MainserverProjectionRowInput = Pick<
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

export type ProjectionDbClient = Readonly<{
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

export const dedupeProjectionRows = (
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

export const mapProjectionRow = (row: ProjectionRow): IamContentListItem => ({
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

const compareNormalizedProjectionText = (left: string, right: string): number => {
  const normalizedLeft = left.toLocaleLowerCase('en-US');
  const normalizedRight = right.toLocaleLowerCase('en-US');
  if (normalizedLeft < normalizedRight) return -1;
  if (normalizedLeft > normalizedRight) return 1;
  return 0;
};

const compareOptionalProjectionValues = (
  left: string | null,
  right: string | null,
  direction: 1 | -1
): number => {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return compareNormalizedProjectionText(left, right) * direction;
};

const resolveProjectionScopePriority = (row: ProjectionRow): number => {
  if (row.organization_id || row.owner_organization_id) return 2;
  if (row.owner_user_id) return 1;
  return 0;
};

export const buildProjectionDeduplicationKey = (row: ProjectionRow): string =>
  row.source_system === 'mainserver'
    ? ['mainserver', row.source_entity_type, row.source_entity_id].join('::')
    : row.id;

export const comparePreferredProjectionRows = (
  left: ProjectionRow,
  right: ProjectionRow
): number => {
  const scopePriorityResult =
    resolveProjectionScopePriority(right) - resolveProjectionScopePriority(left);
  if (scopePriorityResult !== 0) return scopePriorityResult;

  const updatedAtResult = right.updated_at.localeCompare(left.updated_at);
  if (updatedAtResult !== 0) return updatedAtResult;

  return right.id.localeCompare(left.id);
};

export const compareProjectionRows = (
  left: Pick<ProjectionRow, 'id' | 'title' | 'created_at' | 'updated_at' | 'published_at'>,
  right: Pick<ProjectionRow, 'id' | 'title' | 'created_at' | 'updated_at' | 'published_at'>,
  sortBy: IamContentListQuery['sortBy'],
  sortDirection: IamContentListQuery['sortDirection']
): number => {
  const direction = sortDirection === 'asc' ? 1 : -1;
  let primaryResult: number;

  switch (sortBy) {
    case 'title':
      primaryResult = compareNormalizedProjectionText(left.title, right.title) * direction;
      break;
    case 'createdAt':
      primaryResult =
        compareNormalizedProjectionText(left.created_at, right.created_at) * direction;
      break;
    case 'publishedAt':
      primaryResult = compareOptionalProjectionValues(
        left.published_at,
        right.published_at,
        direction
      );
      break;
    default:
      primaryResult =
        compareNormalizedProjectionText(left.updated_at, right.updated_at) * direction;
  }

  return primaryResult !== 0 ? primaryResult : left.id.localeCompare(right.id);
};
