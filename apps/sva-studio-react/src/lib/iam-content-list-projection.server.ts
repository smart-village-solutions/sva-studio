import type { AuthenticatedRequestContext } from '@sva/auth-runtime/server';
import { getWorkspaceContext } from '@sva/server-runtime';

import {
  createListErrorResponse,
  EMPTY_VISIBLE_TYPE_SENTINEL,
  isMainserverContentType,
  type MainserverContentType,
} from './iam-content-list-api.shared.js';
import {
  authorizeRequestedTypes,
  resolveProjectionActorAccountId,
} from './iam-content-list-projection-authorization.server.js';
import type {
  ContentProjectionSyncTarget,
  MainserverProjectionMutationOperation,
} from './iam-content-list-projection-model.server.js';
import {
  refreshGenericItemSiblingProjections,
  refreshMainserverProjectionForMutation,
} from './iam-content-list-projection-mutation.server.js';
import {
  GENERIC_ITEMS_CONTENT_TYPE,
  mainserverMutationProjectionLoaders,
  registeredGenericItemContentTypes,
} from './iam-content-list-projection-source.server.js';
import {
  buildProjectionTargets,
  triggerMainserverProjectionRefresh,
  triggerMainserverProjectionRefreshBatch,
} from './iam-content-list-projection-sync.server.js';

export { listProjectedContents } from './iam-content-list-projection-list.server.js';
export type { ProjectionRow } from './iam-content-list-projection-model.server.js';
export { resetContentProjectionRuntimeStateForTests } from './iam-content-list-projection-sync.server.js';

export const refreshProjectedContents = async (
  ctx: AuthenticatedRequestContext,
  input: { readonly visibleTypes?: readonly string[]; readonly force?: boolean }
): Promise<Response> => {
  const normalizedVisibleTypes =
    input.visibleTypes?.filter(
      (value) => value.trim().length > 0 && value !== EMPTY_VISIBLE_TYPE_SENTINEL
    ) ?? [];
  const typeAuthorization = await authorizeRequestedTypes(ctx, normalizedVisibleTypes);
  if (typeAuthorization instanceof Response) return typeAuthorization;

  const mainserverTypes = typeAuthorization.allowedTypes.filter(isMainserverContentType);
  const instanceId = ctx.user.instanceId;
  if (!instanceId) {
    return createListErrorResponse(
      400,
      'invalid_instance_id',
      'Kein Instanzkontext für diese Inhalte vorhanden.',
      getWorkspaceContext().requestId
    );
  }
  const actorAccountResult = await resolveProjectionActorAccountId({
    ctx,
    instanceId,
    mainserverTypes,
    visibilityRules: [],
    permissions: typeAuthorization.permissions,
  });
  if (actorAccountResult instanceof Response) return actorAccountResult;

  const refreshResult = await triggerMainserverProjectionRefreshBatch(
    buildProjectionTargets(ctx, mainserverTypes, actorAccountResult),
    { force: input.force === true, awaitCompletion: true, trigger: 'manual' }
  );
  return new Response(
    JSON.stringify({
      data: { status: refreshResult.status, syncStates: refreshResult.syncStates },
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
  readonly ownershipPrincipal?: Readonly<{
    type: 'account' | 'organization';
    id: string;
  }>;
  readonly mutationRef?: string;
  readonly contentType: MainserverContentType;
  readonly organizationId?: string;
  readonly actingPrincipalType: 'organization' | 'user';
  readonly credentialFingerprint: string;
  readonly authorizationMode: 'credential_visible_compatibility' | 'exact';
  readonly operation?: MainserverProjectionMutationOperation;
  readonly entityId?: string;
}): Promise<void> => {
  if (!input.actorAccountId) return;

  const target = {
    instanceId: input.instanceId,
    keycloakSubject: input.keycloakSubject,
    actorAccountId: input.actorAccountId,
    ...(input.actorDisplayName ? { actorDisplayName: input.actorDisplayName } : {}),
    ...(input.ownershipPrincipal ? { ownershipPrincipal: input.ownershipPrincipal } : {}),
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
