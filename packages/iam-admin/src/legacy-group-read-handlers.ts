import type { ApiErrorCode } from '@sva/core';

import { loadLegacyGroupById, loadLegacyGroups } from './legacy-group-query.js';
import type { QueryClient } from './query-client.js';

export type LegacyGroupReadAuthenticatedRequestContext = {
  readonly sessionId: string;
  readonly user: {
    readonly id: string;
    readonly instanceId?: string;
    readonly roles: string[];
  };
};

export type LegacyGroupReadActor = {
  readonly instanceId: string;
  readonly requestId?: string;
};

export type LegacyGroupReadLogger = {
  readonly error: (message: string, meta: Readonly<Record<string, unknown>>) => void;
};

export type LegacyGroupReadHandlerDeps<TFeatureFlags = unknown> = {
  readonly asApiItem: (data: unknown, requestId?: string) => unknown;
  readonly asApiList: (
    data: readonly unknown[],
    pagination: { readonly page: number; readonly pageSize: number; readonly total: number },
    requestId?: string
  ) => unknown;
  readonly consumeRateLimit: (input: {
    readonly instanceId: string;
    readonly actorKeycloakSubject: string;
    readonly scope: 'read';
    readonly requestId?: string;
  }) => Response | null;
  readonly createApiError: (
    status: number,
    code: ApiErrorCode,
    message: string,
    requestId?: string,
    details?: Readonly<Record<string, unknown>>
  ) => Response;
  readonly ensureFeature: (
    featureFlags: TFeatureFlags,
    feature: 'iam_admin',
    requestId?: string
  ) => Response | null;
  readonly getFeatureFlags: () => TFeatureFlags;
  readonly getWorkspaceContext: () => { readonly requestId?: string };
  readonly isUuid: (value: string) => boolean;
  readonly jsonResponse: (status: number, payload: unknown) => Response;
  readonly logger: LegacyGroupReadLogger;
  readonly readPathSegment: (request: Request, index: number) => string | null | undefined;
  readonly requireRoles: (
    ctx: LegacyGroupReadAuthenticatedRequestContext,
    roles: ReadonlySet<string>,
    requestId?: string
  ) => Response | null;
  readonly resolveActorInfo: (
    request: Request,
    ctx: LegacyGroupReadAuthenticatedRequestContext,
    options: { readonly requireActorMembership: true }
  ) => Promise<{ readonly actor: LegacyGroupReadActor } | { readonly error: Response }>;
  readonly withInstanceScopedDb: <T>(
    instanceId: string,
    work: (client: QueryClient) => Promise<T>
  ) => Promise<T>;
};

const ADMIN_ROLES = new Set(['system_admin', 'app_manager']);

const createDatabaseUnavailableError = (
  deps: Pick<LegacyGroupReadHandlerDeps, 'createApiError'>,
  requestId?: string
): Response => deps.createApiError(503, 'database_unavailable', 'IAM-Datenbank ist nicht erreichbar.', requestId);

const readGroupIdOrError = (
  deps: Pick<LegacyGroupReadHandlerDeps, 'createApiError' | 'isUuid' | 'readPathSegment'>,
  request: Request,
  requestId?: string
): { readonly groupId: string } | { readonly error: Response } => {
  const groupId = deps.readPathSegment(request, 4);
  if (!groupId || !deps.isUuid(groupId)) {
    return {
      error: deps.createApiError(400, 'invalid_request', 'Ungültige groupId.', requestId),
    };
  }

  return { groupId };
};

const prepareLegacyGroupReadRequest = async <TFeatureFlags>(
  deps: LegacyGroupReadHandlerDeps<TFeatureFlags>,
  request: Request,
  ctx: LegacyGroupReadAuthenticatedRequestContext
): Promise<{ readonly actor: LegacyGroupReadActor } | { readonly error: Response }> => {
  const requestContext = deps.getWorkspaceContext();
  const featureCheck = deps.ensureFeature(deps.getFeatureFlags(), 'iam_admin', requestContext.requestId);
  if (featureCheck) {
    return { error: featureCheck };
  }

  const roleCheck = deps.requireRoles(ctx, ADMIN_ROLES, requestContext.requestId);
  if (roleCheck) {
    return { error: roleCheck };
  }

  const actorResolution = await deps.resolveActorInfo(request, ctx, { requireActorMembership: true });
  if ('error' in actorResolution) {
    return actorResolution;
  }

  const rateLimit = deps.consumeRateLimit({
    instanceId: actorResolution.actor.instanceId,
    actorKeycloakSubject: ctx.user.id,
    scope: 'read',
    requestId: actorResolution.actor.requestId,
  });
  if (rateLimit) {
    return { error: rateLimit };
  }

  return actorResolution;
};

export const createLegacyGroupReadHandlers = <TFeatureFlags>(
  deps: LegacyGroupReadHandlerDeps<TFeatureFlags>
) => {
  const listGroupsInternal = async (
    request: Request,
    ctx: LegacyGroupReadAuthenticatedRequestContext
  ): Promise<Response> => {
    const actorResolution = await prepareLegacyGroupReadRequest(deps, request, ctx);
    if ('error' in actorResolution) {
      return actorResolution.error;
    }

    try {
      const groups = await deps.withInstanceScopedDb(actorResolution.actor.instanceId, (client) =>
        loadLegacyGroups(client, actorResolution.actor.instanceId)
      );
      return deps.jsonResponse(
        200,
        deps.asApiList(groups, { page: 1, pageSize: groups.length, total: groups.length }, actorResolution.actor.requestId)
      );
    } catch (error) {
      deps.logger.error('Legacy group list query failed', {
        operation: 'legacy_group_list',
        workspace_id: actorResolution.actor.instanceId,
        request_id: actorResolution.actor.requestId,
        error: error instanceof Error ? error.message : String(error),
      });
      return createDatabaseUnavailableError(deps, actorResolution.actor.requestId);
    }
  };

  const getGroupInternal = async (
    request: Request,
    ctx: LegacyGroupReadAuthenticatedRequestContext
  ): Promise<Response> => {
    const actorResolution = await prepareLegacyGroupReadRequest(deps, request, ctx);
    if ('error' in actorResolution) {
      return actorResolution.error;
    }

    const groupId = readGroupIdOrError(deps, request, actorResolution.actor.requestId);
    if ('error' in groupId) {
      return groupId.error;
    }

    try {
      const group = await deps.withInstanceScopedDb(actorResolution.actor.instanceId, (client) =>
        loadLegacyGroupById(client, { instanceId: actorResolution.actor.instanceId, groupId: groupId.groupId })
      );
      if (!group) {
        return deps.createApiError(404, 'not_found', 'Gruppe nicht gefunden.', actorResolution.actor.requestId);
      }
      return deps.jsonResponse(200, deps.asApiItem(group, actorResolution.actor.requestId));
    } catch (error) {
      deps.logger.error('Legacy group detail query failed', {
        operation: 'legacy_group_detail',
        workspace_id: actorResolution.actor.instanceId,
        group_id: groupId.groupId,
        request_id: actorResolution.actor.requestId,
        error: error instanceof Error ? error.message : String(error),
      });
      return createDatabaseUnavailableError(deps, actorResolution.actor.requestId);
    }
  };

  return {
    getGroupInternal,
    listGroupsInternal,
  };
};
