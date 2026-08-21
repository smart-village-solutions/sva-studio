import type { IamContentListItem, IamContentListQuery } from '@sva/core';
import type { AuthenticatedRequestContext } from '@sva/auth-runtime/server';
import { getWorkspaceContext } from '@sva/server-runtime';

import {
  createListErrorResponse,
  isMainserverContentType,
  normalizeApiErrorCode,
  type MainserverContentType,
} from './iam-content-list-api.shared.js';
import {
  authorizeRequestedTypes,
  enrichProjectionItemsWithAccess,
  resolveProjectionActorAccountId,
} from './iam-content-list-projection-authorization.server.js';
import type { ContentProjectionSyncState } from './iam-content-list-projection-model.server.js';
import {
  loadProjectedContentTypes,
  loadProjectionPage,
  resolveEffectiveTypes,
} from './iam-content-list-projection-read.server.js';
import {
  buildProjectionTargets,
  computeProjectionSyncStates,
  maybeStartBackgroundProjectionRefresh,
} from './iam-content-list-projection-sync.server.js';
import { buildProjectionReadVisibilityRules } from './iam-content-list-visibility.js';

const createEmptyProjectionListResponse = (query: IamContentListQuery): Response =>
  new Response(
    JSON.stringify({
      data: [],
      pagination: { page: query.page, pageSize: query.pageSize, total: 0 },
      ...(getWorkspaceContext().requestId ? { requestId: getWorkspaceContext().requestId } : {}),
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );

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
  if (query.type && effectiveTypes.length === 0) return createEmptyProjectionListResponse(query);

  const typeAuthorization = await authorizeRequestedTypes(ctx, effectiveTypes);
  if (typeAuthorization instanceof Response) return typeAuthorization;

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

  const projectionTargets = buildProjectionTargets(ctx, mainserverTypes, actorAccountResult);
  const syncStates = await computeProjectionSyncStates(projectionTargets);
  await maybeStartBackgroundProjectionRefresh(projectionTargets, syncStates);
  const responseSyncStates =
    projectionTargets.length > 0
      ? await computeProjectionSyncStates(projectionTargets)
      : syncStates;

  const shouldBlockOnMissingSnapshot = Boolean(query.type) || (query.visibleTypes?.length ?? 0) > 0;
  const blockingSyncGap = shouldBlockOnMissingSnapshot
    ? responseSyncStates.find((syncState) => !syncState.hasSnapshot)
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
      .filter((syncState) => !syncState.hasSnapshot)
      .map((syncState) => syncState.contentType)
  );
  const loadableAllowedTypes = typeAuthorization.allowedTypes.filter(
    (contentType) =>
      !isMainserverContentType(contentType) || !unavailableMainserverTypes.has(contentType)
  );
  const visibilityRules = buildProjectionReadVisibilityRules(
    loadableAllowedTypes,
    typeAuthorization.permissions
  );
  const { items, total } = await loadProjectionPage(
    instanceId,
    query,
    visibilityRules,
    actorAccountResult,
    ctx.activeOrganizationId
  );
  return createProjectionListResponse({
    query,
    items: enrichProjectionItemsWithAccess(
      instanceId,
      ctx.activeOrganizationId,
      items,
      typeAuthorization.permissions,
      actorAccountResult
    ),
    total,
    syncStates: responseSyncStates,
  });
};
