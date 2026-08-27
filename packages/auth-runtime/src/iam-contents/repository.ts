import type {
  IamContentDetail,
  IamContentHistoryEntry,
  IamContentListItem,
  IamContentOwnerPrincipal,
  IamContentOwnershipTransferResult,
  IamContentOwnershipTargetList,
  IamContentPrimitiveAction,
} from '@sva/core';
import { loadOrganizationList, resolveUsersWithPagination } from '@sva/iam-admin';

import { withInstanceScopedDb } from '../iam-account-management/shared.js';
import {
  insertContentHistory,
  isContentMutationFinalized,
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
  type TransferContentOwnershipInput,
} from './repository-types.js';
import {
  emitContentCreatedActivity,
  emitContentDeletedActivity,
  emitContentUpdatedActivity,
  emitContentOwnershipTransferredActivity,
  insertContentRow,
  resolveUpdateAuthorDisplay,
  updateContentRevisionRefs,
  updateContentRow,
  validatePublicationWindow,
} from './repository-write-helpers.js';

export type ContentOwnershipTransferErrorCode =
  | 'content_not_found'
  | 'ownership_target_inactive'
  | 'ownership_target_not_found'
  | 'ownership_target_unchanged';

export class ContentOwnershipTransferError extends Error {
  constructor(readonly code: ContentOwnershipTransferErrorCode) {
    super(code);
    this.name = 'ContentOwnershipTransferError';
  }
}

const resolveCurrentOwnerPrincipal = (row: ContentRow): IamContentOwnerPrincipal | undefined => {
  if (row.owner_user_id && !row.owner_organization_id) {
    return { type: 'account', id: row.owner_user_id };
  }
  if (row.owner_organization_id && !row.owner_user_id) {
    return { type: 'organization', id: row.owner_organization_id };
  }
  return undefined;
};

const assertActiveOwnershipTarget = async (
  client: Parameters<Parameters<typeof withInstanceScopedDb>[1]>[0],
  instanceId: string,
  target: IamContentOwnerPrincipal
): Promise<void> => {
  const result =
    target.type === 'account'
      ? await client.query<{ is_active: boolean }>(
          `SELECT (
             status = 'active'
             AND is_blocked = FALSE
             AND soft_deleted_at IS NULL
             AND permanently_deleted_at IS NULL
             AND deletion_lifecycle_state = 'active'
           ) AS is_active
           FROM iam.accounts
           WHERE instance_id = $1
             AND id = $2::uuid
           LIMIT 1;`,
          [instanceId, target.id]
        )
      : await client.query<{ is_active: boolean }>(
          `SELECT is_active
           FROM iam.organizations
           WHERE instance_id = $1
             AND id = $2::uuid
           LIMIT 1;`,
          [instanceId, target.id]
        );

  const row = result.rows[0];
  if (!row) {
    throw new ContentOwnershipTransferError('ownership_target_not_found');
  }
  if (!row.is_active) {
    throw new ContentOwnershipTransferError('ownership_target_inactive');
  }
};

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
  return input.changedFields.includes('payload')
    ? 'content.updatePayload'
    : 'content.updateMetadata';
};

const hasAuthorDisplayAffectingChange = (current: ContentRow, input: UpdateContentInput): boolean =>
  input.authorDisplayMode !== undefined ||
  input.authorDisplayName !== undefined ||
  (input.organizationId !== undefined && input.organizationId !== current.organization_id);

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
  return { ...item, history };
};

export const loadContentOwnershipTargets = async (
  instanceId: string,
  input: {
    readonly type: 'account' | 'organization';
    readonly page: number;
    readonly pageSize: number;
    readonly search?: string;
    readonly currentOwner?: IamContentOwnerPrincipal;
  }
): Promise<IamContentOwnershipTargetList> =>
  withInstanceScopedDb(instanceId, async (client) => {
    if (input.type === 'account') {
      const result = await resolveUsersWithPagination(client, {
        instanceId,
        page: input.page,
        pageSize: input.pageSize,
        status: 'active',
        search: input.search,
        includeTechnicalAccounts: false,
      });
      const items = result.users
        .filter(
          (user) => !(input.currentOwner?.type === 'account' && input.currentOwner.id === user.id)
        )
        .map((user) => ({
          principal: { type: 'account' as const, id: user.id },
          displayName: user.displayName,
        }));
      return {
        items,
        page: input.page,
        pageSize: input.pageSize,
        total: Math.max(
          0,
          result.total -
            (input.currentOwner?.type === 'account' &&
            result.users.some((user) => user.id === input.currentOwner?.id)
              ? 1
              : 0)
        ),
      };
    }

    const result = await loadOrganizationList(client, {
      instanceId,
      page: input.page,
      pageSize: input.pageSize,
      search: input.search,
      isActive: true,
      sortBy: 'displayName',
      sortDirection: 'asc',
    });
    const items = result.items
      .filter(
        (organization) =>
          !(
            input.currentOwner?.type === 'organization' && input.currentOwner.id === organization.id
          )
      )
      .map((organization) => ({
        principal: { type: 'organization' as const, id: organization.id },
        displayName: organization.displayName,
      }));
    return {
      items,
      page: input.page,
      pageSize: input.pageSize,
      total: Math.max(
        0,
        result.total -
          (input.currentOwner?.type === 'organization' &&
          result.items.some((organization) => organization.id === input.currentOwner?.id)
            ? 1
            : 0)
      ),
    };
  });

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
      changedFields: [
        'contentType',
        'title',
        'payload',
        'status',
        ...(input.publishedAt ? ['publishedAt'] : []),
      ],
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
    if (
      input.mutationRef &&
      (await isContentMutationFinalized(client, {
        instanceId: input.instanceId,
        contentId: input.contentId,
        mutationRef: input.mutationRef,
      }))
    ) {
      return input.contentId;
    }
    const current = await loadCurrentContentRow(client, input.instanceId, input.contentId);
    if (!current) {
      return undefined;
    }
    const stateInput = hasAuthorDisplayAffectingChange(current, input)
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
      mutationRef: input.mutationRef,
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

export const transferContentOwnership = async (
  input: TransferContentOwnershipInput
): Promise<IamContentOwnershipTransferResult> =>
  withInstanceScopedDb(input.instanceId, async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2));', [
      input.instanceId,
      input.contentId,
    ]);

    const current = await loadCurrentContentRow(client, input.instanceId, input.contentId);
    if (!current) {
      throw new ContentOwnershipTransferError('content_not_found');
    }

    const sourcePrincipal = resolveCurrentOwnerPrincipal(current);
    if (
      sourcePrincipal?.type === input.targetPrincipal.type &&
      sourcePrincipal.id === input.targetPrincipal.id
    ) {
      throw new ContentOwnershipTransferError('ownership_target_unchanged');
    }

    await assertActiveOwnershipTarget(client, input.instanceId, input.targetPrincipal);

    const targetOwnerUserId =
      input.targetPrincipal.type === 'account' ? input.targetPrincipal.id : null;
    const targetOwnerOrganizationId =
      input.targetPrincipal.type === 'organization' ? input.targetPrincipal.id : null;
    const targetOrganizationId = targetOwnerOrganizationId;

    await client.query(
      `UPDATE iam.contents
       SET organization_id = $3::uuid,
           owner_user_id = $4::uuid,
           owner_organization_id = $5::uuid,
           updater_account_id = $6::uuid,
           updated_at = NOW()
       WHERE instance_id = $1
         AND id = $2::uuid;`,
      [
        input.instanceId,
        input.contentId,
        targetOrganizationId,
        targetOwnerUserId,
        targetOwnerOrganizationId,
        input.actorAccountId,
      ]
    );

    const historyId = await insertContentHistory(client, {
      instanceId: input.instanceId,
      contentId: input.contentId,
      actorAccountId: input.actorAccountId,
      actorDisplayName: input.actorDisplayName,
      action: 'updated',
      changedFields: ['ownerUserId', 'ownerOrganizationId', 'organizationId'],
      previousStatus: current.status,
      nextStatus: current.status,
      summary: 'Inhaber übertragen',
      snapshot: current.payload_json,
    });
    await updateContentRevisionRefs(client, input.instanceId, input.contentId, historyId);
    await emitContentOwnershipTransferredActivity(client, {
      instanceId: input.instanceId,
      actorAccountId: input.actorAccountId,
      requestId: input.requestId,
      traceId: input.traceId,
      contentId: input.contentId,
      contentType: current.content_type,
      sourcePrincipal,
      targetPrincipal: input.targetPrincipal,
    });

    return {
      contentId: input.contentId,
      sourcePrincipal,
      targetPrincipal: input.targetPrincipal,
      authorDisplayName: current.author_display_name,
    };
  });

export const deleteContent = async (input: DeleteContentInput): Promise<string | undefined> =>
  withInstanceScopedDb(input.instanceId, async (client) => {
    const current =
      input.currentContent ??
      (await loadCurrentContentRow(client, input.instanceId, input.contentId));
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
