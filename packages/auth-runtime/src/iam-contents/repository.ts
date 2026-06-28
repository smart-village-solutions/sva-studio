import type { IamContentDetail, IamContentHistoryEntry, IamContentListItem, IamContentPrimitiveAction } from '@sva/core';

import { withInstanceScopedDb } from '../iam-account-management/shared.js';
import {
  insertContentHistory,
  loadCurrentContentRow,
  resolveContentMutationMetadata,
} from './repository-shared.js';
import { mapContentHistoryItem, mapContentListItem } from './repository-mappers.js';
import { resolveNextContentState } from './repository-state.js';
import {
  CONTENT_SELECT,
  type ContentHistoryRow,
  type LoadContentListAuthorizationInput,
  type ContentRow,
  type CreateContentInput,
  type DeleteContentInput,
  type LoadContentListItemsInput,
  type UpdateContentInput,
} from './repository-types.js';
import {
  emitContentCreatedActivity,
  emitContentDeletedActivity,
  emitContentUpdatedActivity,
  insertContentRow,
  resolveUpdateAuthorDisplay,
  updateContentRevisionRefs,
  updateContentRow,
  validatePublicationWindow,
} from './repository-write-helpers.js';

const resolveAuditAction = (input: {
  readonly changedFields: readonly string[];
  readonly previousStatus: string;
  readonly nextStatus: string;
}): IamContentPrimitiveAction => {
  if (input.previousStatus !== input.nextStatus) {
    if (input.nextStatus === 'published') {
      return 'content.publish';
    }
    if (input.nextStatus === 'archived') {
      return 'content.archive';
    }
    if (input.previousStatus === 'archived') {
      return 'content.restore';
    }
    return 'content.changeStatus';
  }
  return input.changedFields.includes('payload') ? 'content.updatePayload' : 'content.updateMetadata';
};

const hasExplicitAuthorDisplayChange = (input: UpdateContentInput): boolean =>
  input.authorDisplayMode !== undefined || input.authorDisplayName !== undefined;

const listSortColumnByField = {
  title: 'content.title',
  contentType: 'content.content_type',
  status: 'content.status',
  updatedAt: 'content.updated_at',
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
    orderByClause: `ORDER BY ${sortColumn} ${sortDirection}, content.updated_at DESC, content.created_at DESC`,
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
  loadContentRowById(instanceId, contentId).then((row) => (row ? mapContentListItem(row) : undefined));

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
  history.summary
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
  return { ...item, history };
};

export const createContent = async (input: CreateContentInput): Promise<string> =>
  withInstanceScopedDb(input.instanceId, async (client) => {
    validatePublicationWindow(input);
    const contentId = await insertContentRow(client, input);
    const historyId = await insertContentHistory(client, {
      instanceId: input.instanceId,
      contentId,
      actorAccountId: input.actorAccountId,
      actorDisplayName: input.actorDisplayName,
      action: 'created',
      changedFields: ['contentType', 'title', 'payload', 'status', ...(input.publishedAt ? ['publishedAt'] : [])],
      nextStatus: input.status,
      summary: 'Inhalt erstellt',
      snapshot: input.payload,
    });
    await updateContentRevisionRefs(client, input.instanceId, contentId, historyId);
    await emitContentCreatedActivity(client, input, contentId);
    return contentId;
  });

export const updateContent = async (input: UpdateContentInput): Promise<string | undefined> =>
  withInstanceScopedDb(input.instanceId, async (client) => {
    const current = await loadCurrentContentRow(client, input.instanceId, input.contentId);
    if (!current) {
      return undefined;
    }
    const stateInput = hasExplicitAuthorDisplayChange(input)
      ? {
          ...input,
          ...(await resolveUpdateAuthorDisplay(client, current, input)),
        }
      : input;
    const {
      changedFields,
      nextOrganizationId,
      nextOwnerUserId,
      nextOwnerOrganizationId,
      nextAuthorDisplayMode,
      nextAuthorDisplayName,
      nextPayload,
      nextPublishedAt,
      nextPublishFrom,
      nextPublishUntil,
      nextStatus,
      nextTitle,
      nextValidationState,
    } = resolveNextContentState(current, stateInput);
    await updateContentRow(client, input, {
      organizationId: nextOrganizationId,
      ownerUserId: nextOwnerUserId,
      ownerOrganizationId: nextOwnerOrganizationId,
      authorDisplayMode: nextAuthorDisplayMode,
      authorDisplayName: nextAuthorDisplayName,
      title: nextTitle,
      payloadJson: JSON.stringify(nextPayload),
      status: nextStatus,
      validationState: nextValidationState,
      publishedAt: nextPublishedAt,
      publishFrom: nextPublishFrom,
      publishUntil: nextPublishUntil,
    });
    const { activityEventType, historyAction, historySummary } = resolveContentMutationMetadata(
      current.status,
      nextStatus
    );
    const historyId = await insertContentHistory(client, {
      instanceId: input.instanceId,
      contentId: input.contentId,
      actorAccountId: input.actorAccountId,
      actorDisplayName: input.actorDisplayName,
      action: historyAction,
      changedFields,
      previousStatus: current.status,
      nextStatus,
      summary: historySummary,
      snapshot: nextPayload,
    });
    await updateContentRevisionRefs(client, input.instanceId, input.contentId, historyId);
    await emitContentUpdatedActivity(client, stateInput, current, {
      eventType: activityEventType,
      action: resolveAuditAction({ changedFields, previousStatus: current.status, nextStatus }),
      changedFields,
      nextStatus,
      nextTitle,
      nextOwnerUserId,
      nextOwnerOrganizationId,
      nextAuthorDisplayMode,
      nextAuthorDisplayName,
    });
    return input.contentId;
  });

export const deleteContent = async (input: DeleteContentInput): Promise<string | undefined> =>
  withInstanceScopedDb(input.instanceId, async (client) => {
    const current = input.currentContent ?? (await loadCurrentContentRow(client, input.instanceId, input.contentId));
    if (!current) {
      return undefined;
    }
    await emitContentDeletedActivity(client, input, current);
    await client.query(
      `
DELETE FROM iam.contents
WHERE instance_id = $1
  AND id = $2::uuid;
      `,
      [input.instanceId, input.contentId]
    );
    return input.contentId;
  });
