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
  readMainserverScopeResolverMode,
  resolveActorAccountId,
  resolveEffectivePermissions,
  withInstanceScopedDb,
} from '@sva/auth-runtime/server';
import { getWorkspaceContext } from '@sva/server-runtime';

import {
  createListErrorResponse,
  EMPTY_VISIBLE_TYPE_SENTINEL,
  isMainserverContentType,
  type MainserverContentType,
  normalizeApiErrorCode,
} from './iam-content-list-api.shared.js';
import {
  buildProjectionReadVisibilityRules,
  type ProjectionReadVisibilityRule,
} from './iam-content-list-visibility.js';
import {
  buildProjectionDeduplicationKey,
  comparePreferredProjectionRows,
  compareProjectionRows,
  mapProjectionRow,
  type ContentProjectionSyncState,
  type ContentProjectionSyncTarget,
  type MainserverProjectionMutationOperation,
  type ProjectionRow,
} from './iam-content-list-projection-model.server.js';
import {
  buildMainserverReadScopeKeys,
  loadProjectionTableSchemaMode,
  withProjectionSchemaModeRetry,
} from './iam-content-list-projection-repository.server.js';
import {
  GENERIC_ITEMS_CONTENT_TYPE,
  mainserverMutationProjectionLoaders,
  registeredGenericItemContentTypes,
} from './iam-content-list-projection-source.server.js';
import {
  buildProjectionTargets,
  computeProjectionSyncStates,
  maybeStartBackgroundProjectionRefresh,
  triggerMainserverProjectionRefresh,
  triggerMainserverProjectionRefreshBatch,
} from './iam-content-list-projection-sync.server.js';
import {
  refreshGenericItemSiblingProjections,
  refreshMainserverProjectionForMutation,
} from './iam-content-list-projection-mutation.server.js';

export { resetContentProjectionRuntimeStateForTests } from './iam-content-list-projection-sync.server.js';

export { compareProjectionRows } from './iam-content-list-projection-model.server.js';
export type { ProjectionRow } from './iam-content-list-projection-model.server.js';

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

const optionalAuthorizeField = <TKey extends string, TValue>(
  key: TKey,
  value: TValue | undefined
): Partial<Record<TKey, TValue>> =>
  (value === undefined ? {} : { [key]: value }) as Partial<Record<TKey, TValue>>;

type ListAccessAuthorizeInput = Readonly<{
  instanceId: string;
  action: string;
  item: IamContentListItem;
  organizationId?: string;
  actorAccountId?: string;
}>;

const buildAuthorizeResource = (
  input: ListAccessAuthorizeInput,
  includeCreatedBy: boolean
): AuthorizeRequest['resource'] => ({
  type: input.action.split('.')[0] || 'content',
  ...optionalAuthorizeField('id', includeCreatedBy ? input.item.id : undefined),
  ...optionalAuthorizeField('organizationId', input.organizationId),
  attributes: {
    contentType: input.item.contentType,
    ...optionalAuthorizeField('organizationId', input.organizationId),
    ...optionalAuthorizeField('ownerUserId', includeCreatedBy ? input.item.ownerUserId : undefined),
    ...optionalAuthorizeField(
      'ownerOrganizationId',
      includeCreatedBy ? input.item.ownerOrganizationId : undefined
    ),
  },
});

const buildListAccessAuthorizeRequest = (input: ListAccessAuthorizeInput): AuthorizeRequest => {
  const workspaceContext = getWorkspaceContext();
  const includeCreatedBy = input.action === buildUpdateAction(input.item.contentType);

  return {
    instanceId: input.instanceId,
    action: input.action,
    resource: buildAuthorizeResource(input, includeCreatedBy),
    context: {
      ...optionalAuthorizeField('organizationId', input.organizationId),
      ...optionalAuthorizeField('requestId', workspaceContext.requestId),
      ...optionalAuthorizeField('traceId', workspaceContext.traceId),
      attributes: {
        contentType: input.item.contentType,
        ...optionalAuthorizeField('actorAccountId', input.actorAccountId),
      },
    },
  };
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
${whereClause};
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

const createEmptyProjectionListResponse = (query: IamContentListQuery): Response =>
  new Response(
    JSON.stringify({
      data: [],
      pagination: { page: query.page, pageSize: query.pageSize, total: 0 },
      ...(getWorkspaceContext().requestId ? { requestId: getWorkspaceContext().requestId } : {}),
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );

const resolveProjectionActorAccountId = async (input: {
  readonly ctx: AuthenticatedRequestContext;
  readonly instanceId: string;
  readonly mainserverTypes: readonly MainserverContentType[];
  readonly visibilityRules: readonly ProjectionReadVisibilityRule[];
  readonly permissions: readonly EffectivePermission[];
}): Promise<string | undefined | Response> => {
  const requiresActorAccountId =
    input.mainserverTypes.length > 0 ||
    input.visibilityRules.some((rule) => rule.allowOwn) ||
    input.permissions.some(
      (permission) => permission.accessScope === 'own' || permission.accessScope === 'organization'
    );
  if (!requiresActorAccountId) return undefined;

  let actorAccountId: string | undefined;
  try {
    actorAccountId = await withInstanceScopedDb(input.instanceId, async (client) =>
      resolveActorAccountId(client, {
        instanceId: input.instanceId,
        keycloakSubject: input.ctx.user.id,
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

  return !actorAccountId && input.mainserverTypes.length > 0
    ? createListErrorResponse(
        503,
        'database_unavailable',
        'Der Akteurkontext fuer Mainserver-Inhalte konnte nicht geladen werden.',
        getWorkspaceContext().requestId
      )
    : actorAccountId;
};

const createProjectionListResponse = (input: {
  readonly query: IamContentListQuery;
  readonly items: readonly IamContentListItem[];
  readonly total: number;
  readonly syncStates: readonly ContentProjectionSyncState[];
}): Response => {
  const isTotalFinal = input.syncStates.every((syncState) => syncState.isTotalFinal);
  const metadata =
    input.syncStates.length === 0
      ? {}
      : {
          metadata: {
            mainserverSyncStates: input.syncStates,
            hasStaleMainserverContent: input.syncStates.some((state) => state.isStale),
            hasBlockingSyncGap: input.syncStates.some((state) => !state.hasSnapshot),
            hasRunningMainserverSync: input.syncStates.some((state) => state.isSyncRunning),
            availableCount: input.total,
            ...(isTotalFinal ? { totalCount: input.total } : {}),
            isTotalFinal,
          },
        };

  return new Response(
    JSON.stringify({
      data: input.items,
      pagination: { page: input.query.page, pageSize: input.query.pageSize, total: input.total },
      ...metadata,
      ...(getWorkspaceContext().requestId ? { requestId: getWorkspaceContext().requestId } : {}),
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
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
    return createEmptyProjectionListResponse(query);
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
  const actorAccountResult = await resolveProjectionActorAccountId({
    ctx,
    instanceId,
    mainserverTypes,
    visibilityRules: initialVisibilityRules,
    permissions: typeAuthorization.permissions,
  });
  if (actorAccountResult instanceof Response) return actorAccountResult;
  const actorAccountId = actorAccountResult;

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
  return createProjectionListResponse({
    query,
    items: authorizedItems,
    total,
    syncStates: responseSyncStates,
  });
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
      input.contentType === GENERIC_ITEMS_CONTENT_TYPE ||
      registeredGenericItemContentTypes.has(input.contentType)
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
