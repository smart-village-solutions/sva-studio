import type { IamContentDetail, IamContentHistoryEntry, IamContentListItem } from '@sva/core';
import { loadOrganizationById, resolveUserDetail } from '@sva/iam-admin';
import { withInstanceScopedDb } from '../iam-account-management/shared.js';
import { resolveContentItemOwnerPrincipal } from './repository-ownership.js';
import { loadCurrentContentRow } from './repository-shared.js';
import { mapContentHistoryItem, mapContentListItem } from './repository-mappers.js';
import {
  CONTENT_SELECT,
  type ContentHistoryRow,
  type ContentRow,
  type LoadContentListAuthorizationInput,
  type LoadContentListItemsInput,
} from './repository-types.js';

const listSortColumnByField = {
  title: `LOWER(REGEXP_REPLACE(content.title COLLATE "unicode", '^[^[:alnum:]]+', '')) COLLATE "C"`,
  createdAt: 'content.created_at',
  updatedAt: 'content.updated_at',
  publishedAt: 'content.published_at',
} as const satisfies Record<LoadContentListItemsInput['sortBy'], string>;

const buildBaseListQuery = (
  instanceId: string,
  input: LoadContentListItemsInput
): { readonly params: unknown[]; readonly whereClause: string; readonly orderByClause: string } => {
  const conditions = ['content.instance_id = $1'];
  const params: unknown[] = [instanceId];

  if (input.visibleTypes && input.visibleTypes.length > 0) {
    params.push(input.visibleTypes);
    conditions.push(`content.content_type = ANY($${params.length}::text[])`);
  }

  if (input.type) {
    params.push(input.type);
    conditions.push(`content.content_type = $${params.length}`);
  }

  if (input.status) {
    params.push(input.status);
    conditions.push(`content.status = $${params.length}`);
  }

  if (input.q && input.q.trim().length > 0) {
    params.push(`%${input.q.trim().toLowerCase()}%`);
    const searchParam = `$${params.length}`;
    conditions.push(
      `(LOWER(content.title) LIKE ${searchParam} OR LOWER(content.content_type) LIKE ${searchParam} OR LOWER(content.author_display_name) LIKE ${searchParam} OR LOWER(content.payload_json::text) LIKE ${searchParam})`
    );
  }

  const sortColumn = listSortColumnByField[input.sortBy];
  const sortDirection = input.sortDirection === 'asc' ? 'ASC' : 'DESC';

  return {
    whereClause: `WHERE ${conditions.join('\n  AND ')}`,
    orderByClause: `ORDER BY (${sortColumn} IS NULL) ASC, ${sortColumn} ${sortDirection}, content.id ASC`,
    params,
  };
};

const appendAuthorizationScopeCondition = (
  conditions: string[],
  params: unknown[],
  authorization: LoadContentListAuthorizationInput
) => {
  if (authorization.allowGlobal) {
    return;
  }

  const allowClauses: string[] = [];

  if (authorization.allowedOrganizationIds.length > 0) {
    params.push(authorization.allowedOrganizationIds);
    allowClauses.push(`content.owner_organization_id = ANY($${params.length}::uuid[])`);
  }

  if (authorization.allowOwn && authorization.actorAccountId) {
    params.push(authorization.actorAccountId);
    allowClauses.push(`content.owner_user_id = $${params.length}::uuid`);
  }

  if (allowClauses.length > 0) {
    conditions.push(`(${allowClauses.join(' OR ')})`);
    return;
  }

  conditions.push('FALSE');
};

export const loadContentListScopes = async (
  instanceId: string,
  input: LoadContentListItemsInput
): Promise<readonly (string | null)[]> =>
  withInstanceScopedDb(instanceId, async (client) => {
    const query = buildBaseListQuery(instanceId, input);
    const result = await client.query<{ organization_id: string | null }>(
      `
SELECT DISTINCT content.organization_id::text AS organization_id
FROM iam.contents content
${query.whereClause}
ORDER BY organization_id ASC NULLS FIRST;
      `,
      query.params
    );
    return result.rows.map((row) => row.organization_id);
  });

export const loadContentListItems = async (
  instanceId: string,
  input: LoadContentListItemsInput,
  authorization: LoadContentListAuthorizationInput
): Promise<{ readonly items: readonly IamContentListItem[]; readonly total: number }> =>
  withInstanceScopedDb(instanceId, async (client) => {
    const query = buildBaseListQuery(instanceId, input);
    const conditions = [query.whereClause.replace(/^WHERE\s+/u, '')];
    const params = [...query.params];
    appendAuthorizationScopeCondition(conditions, params, authorization);
    const whereClause = `WHERE ${conditions.join('\n  AND ')}`;

    const countResult = await client.query<{ total: string | number }>(
      `
SELECT COUNT(*)::int AS total
FROM iam.contents content
${whereClause};
      `,
      [...params]
    );
    const total = Number(countResult.rows[0]?.total ?? 0);

    params.push(input.pageSize);
    const limitParam = `$${params.length}`;
    params.push(Math.max(0, (input.page - 1) * input.pageSize));
    const offsetParam = `$${params.length}`;

    const result = await client.query<ContentRow>(
      `
${CONTENT_SELECT}
${whereClause}
${query.orderByClause}
LIMIT ${limitParam}
OFFSET ${offsetParam};
      `,
      params
    );

    return {
      items: result.rows.map(mapContentListItem),
      total,
    };
  });

export const loadContentById = async (
  instanceId: string,
  contentId: string
): Promise<IamContentListItem | undefined> =>
  loadContentRowById(instanceId, contentId).then((row) =>
    row ? mapContentListItem(row) : undefined
  );

export const loadContentRowById = async (
  instanceId: string,
  contentId: string
): Promise<ContentRow | undefined> =>
  withInstanceScopedDb(instanceId, async (client) => {
    return loadCurrentContentRow(client, instanceId, contentId);
  });

export const loadContentHistory = async (
  instanceId: string,
  contentId: string
): Promise<readonly IamContentHistoryEntry[]> =>
  withInstanceScopedDb(instanceId, async (client) => {
    const result = await client.query<ContentHistoryRow>(
      `
SELECT
  history.id,
  history.content_id,
  history.action,
  history.actor_display_name,
  history.changed_fields,
  history.previous_status,
  history.next_status,
  history.created_at::text,
  history.summary,
  history.origin,
  history.coverage
FROM iam.content_history history
WHERE history.instance_id = $1
  AND history.content_id = $2::uuid
ORDER BY history.created_at DESC, history.id DESC;
      `,
      [instanceId, contentId]
    );
    return result.rows.map(mapContentHistoryItem);
  });

export const loadContentDetail = async (
  instanceId: string,
  contentId: string
): Promise<IamContentDetail | undefined> => {
  const item = await loadContentById(instanceId, contentId);
  if (!item) {
    return undefined;
  }

  const history = await loadContentHistory(instanceId, contentId);
  const owner = resolveContentItemOwnerPrincipal(item);
  let ownerDisplayName: string | undefined;
  if (owner?.type === 'account') {
    ownerDisplayName = (
      await withInstanceScopedDb(instanceId, (client) =>
        resolveUserDetail(client, { instanceId, userId: owner.id })
      )
    )?.displayName;
  } else if (owner?.type === 'organization') {
    ownerDisplayName = (
      await withInstanceScopedDb(instanceId, (client) =>
        loadOrganizationById(client, { instanceId, organizationId: owner.id })
      )
    )?.display_name;
  }
  return { ...item, history, ...(ownerDisplayName ? { ownerDisplayName } : {}) };
};
