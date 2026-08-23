import type { IamContentListItem, IamContentListQuery } from '@sva/core';
import { readMainserverScopeResolverMode, withInstanceScopedDb } from '@sva/auth-runtime/server';

import {
  EMPTY_VISIBLE_TYPE_SENTINEL,
  type MainserverContentType,
} from './iam-content-list-api.shared.js';
import {
  buildProjectionDeduplicationKey,
  comparePreferredProjectionRows,
  compareProjectionRows,
  mapProjectionRow,
  type ContentProjectionSyncTarget,
  type ProjectionRow,
} from './iam-content-list-projection-model.server.js';
import {
  buildMainserverReadScopeKeys,
  loadProjectionTableSchemaMode,
  withProjectionSchemaModeRetry,
} from './iam-content-list-projection-repository.server.js';
import type { ProjectionReadVisibilityRule } from './iam-content-list-visibility.js';

export const resolveEffectiveTypes = (query: IamContentListQuery): readonly string[] => {
  const visibleTypes =
    query.visibleTypes?.filter(
      (value) => value.trim().length > 0 && value !== EMPTY_VISIBLE_TYPE_SENTINEL
    ) ?? [];
  if (query.type && visibleTypes.length > 0) {
    return visibleTypes.includes(query.type) ? [query.type] : [];
  }
  return query.type ? [query.type] : visibleTypes;
};

export const loadProjectedContentTypes = async (instanceId: string): Promise<readonly string[]> =>
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
    if (rule.allowGlobal) allowClauses.push('TRUE');
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
    if (allowClauses.length === 0) return [];

    params.push(rule.contentType);
    return [`(projection.content_type = $${params.length} AND (${allowClauses.join(' OR ')}))`];
  });
  return perTypeClauses.length > 0 ? `(${perTypeClauses.join(' OR ')})` : 'FALSE';
};

export const loadProjectionPage = async (
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
      if (query.type === 'faq.faq' && query.languageCode) {
        params.push(query.languageCode.trim().toLowerCase());
        conditions.push(
          `LOWER(BTRIM(projection.payload_json ->> 'languageCode')) = $${params.length}`
        );
      }
      if (query.q && query.q.trim().length > 0) {
        params.push(`%${query.q.trim().toLowerCase()}%`);
        const searchParam = `$${params.length}`;
        conditions.push(`(
          LOWER(projection.title) LIKE ${searchParam}
          OR LOWER(projection.content_type) LIKE ${searchParam}
          OR LOWER(projection.author_display_name) LIKE ${searchParam}
          OR LOWER(projection.payload_json::text) LIKE ${searchParam}
        )`);
      }
      if ((await loadProjectionTableSchemaMode(client, instanceId)) === 'scoped') {
        const mainserverScopeKeys = buildMainserverReadScopeKeys({
          instanceId,
          contentTypes: rules.map((rule) => rule.contentType),
          actorAccountId,
          activeOrganizationId,
        });
        params.push([...mainserverScopeKeys]);
        conditions.push(`(
          projection.source_system <> 'mainserver'
          OR projection.projection_scope_key = ANY($${params.length}::text[])
        )`);
      }

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
WHERE ${conditions.join('\n  AND ')};
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
      return {
        items: filteredRows.slice(offset, offset + query.pageSize).map(mapProjectionRow),
        total: filteredRows.length,
      };
    });
  });
