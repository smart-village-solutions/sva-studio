import type {
  ContentJsonValue,
  IamContentAuthorizationMode,
  IamContentAuthorDisplayMode,
  IamContentListItem,
  IamContentStatus,
  IamContentValidationState,
} from '@sva/core';
import { buildMainserverProjectionScopeKey } from '@sva/core';

import { withInstanceScopedDb } from '../iam-account-management/shared.js';

type ProjectionRow = Readonly<{
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
  author_display_mode: IamContentAuthorDisplayMode;
  author_display_name: string;
  source_data_provider_id: string | null;
  source_data_provider_name: string | null;
  credential_source: NonNullable<IamContentListItem['credentialSource']>;
  authorization_mode: IamContentAuthorizationMode;
  payload_json: ContentJsonValue;
  status: IamContentStatus;
  validation_state: IamContentValidationState;
  history_ref: string;
  current_revision_ref: string | null;
  last_audit_event_ref: string | null;
}>;

const optional = <K extends string, V>(key: K, value: V | null): Partial<Record<K, V>> =>
  value === null ? {} : ({ [key]: value } as Record<K, V>);

const mapProjectionRow = (row: ProjectionRow): IamContentListItem => ({
  id: row.id,
  instanceId: row.instance_id,
  contentType: row.content_type,
  title: row.title,
  createdAt: row.created_at,
  createdBy: row.created_by,
  updatedAt: row.updated_at,
  updatedBy: row.updated_by,
  authorDisplayMode: row.author_display_mode,
  author: row.author_display_name,
  credentialSource: row.credential_source,
  authorizationMode: row.authorization_mode,
  payload: row.payload_json,
  status: row.status,
  validationState: row.validation_state,
  historyRef: row.history_ref,
  ...optional('organizationId', row.organization_id),
  ...optional('ownerUserId', row.owner_user_id),
  ...optional('ownerOrganizationId', row.owner_organization_id),
  ...optional('publishedAt', row.published_at),
  ...optional('publishFrom', row.publish_from),
  ...optional('publishUntil', row.publish_until),
  ...optional('sourceDataProviderId', row.source_data_provider_id),
  ...optional('sourceDataProviderName', row.source_data_provider_name),
  ...optional('currentRevisionRef', row.current_revision_ref),
  ...optional('lastAuditEventRef', row.last_audit_event_ref),
});

export const loadMainserverContentProjectionCandidates = async (input: {
  readonly instanceId: string;
  readonly contentType: string;
  readonly sourceEntityId: string;
  readonly actorAccountId?: string;
  readonly activeOrganizationId?: string;
  readonly allowGlobalMutation?: boolean;
}): Promise<readonly IamContentListItem[]> =>
  withInstanceScopedDb(input.instanceId, async (client) => {
    const actorAccountId = input.actorAccountId;
    const globalPrincipalTypes: readonly (undefined | 'organization' | 'user')[] =
      input.activeOrganizationId ? [undefined, 'user', 'organization'] : [undefined, 'user'];
    const globalProjectionScopeKeys =
      input.allowGlobalMutation && actorAccountId
        ? globalPrincipalTypes.map((actingPrincipalType) =>
            buildMainserverProjectionScopeKey({
              instanceId: input.instanceId,
              actorAccountId,
              ...(input.activeOrganizationId
                ? { activeOrganizationId: input.activeOrganizationId }
                : {}),
              ...(actingPrincipalType ? { actingPrincipalType } : {}),
              contentType: input.contentType,
            })
          )
        : [];
    const selectClause =
      globalProjectionScopeKeys.length > 0
        ? 'SELECT'
        : 'SELECT DISTINCT ON (credential_source, owner_user_id, owner_organization_id)';
    const principalClause =
      globalProjectionScopeKeys.length > 0
        ? `projection_scope_key = ANY($4::text[])
  AND credential_source IN ('organization', 'user')`
        : `authorization_mode = 'exact'
  AND (
    (credential_source = 'user' AND owner_user_id = $4::uuid)
    OR (credential_source = 'organization' AND owner_organization_id = $5::uuid)
  )`;
    const orderClause =
      globalProjectionScopeKeys.length > 0
        ? 'projection_updated_at DESC'
        : `credential_source,
  owner_user_id,
  owner_organization_id,
  projection_updated_at DESC`;
    const limit = globalProjectionScopeKeys.length > 0 ? 1 : 2;
    const result = await client.query<ProjectionRow>(
      `
${selectClause}
  id,
  instance_id,
  organization_id::text,
  owner_user_id::text,
  owner_organization_id::text,
  content_type,
  title,
  published_at::text,
  publish_from::text,
  publish_until::text,
  created_at::text,
  created_by,
  updated_at::text,
  updated_by,
  author_display_mode,
  author_display_name,
  source_data_provider_id,
  source_data_provider_name,
  credential_source,
  authorization_mode,
  payload_json,
  status,
  validation_state,
  history_ref,
  current_revision_ref,
  last_audit_event_ref
FROM iam.content_list_projection
WHERE instance_id = $1
  AND source_system = 'mainserver'
  AND content_type = $2
  AND source_entity_id = $3
  AND ${principalClause}
ORDER BY
  ${orderClause}
LIMIT ${limit};
      `,
      globalProjectionScopeKeys.length > 0
        ? [input.instanceId, input.contentType, input.sourceEntityId, globalProjectionScopeKeys]
        : [
            input.instanceId,
            input.contentType,
            input.sourceEntityId,
            input.actorAccountId ?? null,
            input.activeOrganizationId ?? null,
          ]
    );
    return result.rows.map(mapProjectionRow);
  });
