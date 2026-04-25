import type { ApiErrorCode } from '@sva/core';

import {
  loadGroupDetail,
  loadGroupListItems,
  type GroupQueryClient,
} from './group-query.js';

export type GroupReadAuthenticatedRequestContext = {
  readonly sessionId: string;
  readonly user: {
    readonly id: string;
    readonly instanceId?: string;
    readonly roles: string[];
  };
};

export type GroupReadActor = {
  readonly instanceId: string;
  readonly requestId?: string;
  readonly traceId?: string;
};

export type GroupReadLogger = {
  readonly error: (message: string, meta: Readonly<Record<string, unknown>>) => void;
};

export type GroupReadHandlerDeps = {
  readonly asApiItem: (data: unknown, requestId?: string) => unknown;
  readonly asApiList: (
    data: readonly unknown[],
    pagination: { readonly page: number; readonly pageSize: number; readonly total: number },
    requestId?: string
  ) => unknown;
  readonly createApiError: (
    status: number,
    code: GroupReadApiErrorCode,
    message: string,
    requestId?: string,
    details?: Readonly<Record<string, unknown>>
  ) => Response;
  readonly getWorkspaceContext: () => { readonly requestId?: string; readonly traceId?: string };
  readonly isUuid: (value: string) => boolean;
  readonly jsonResponse: (status: number, payload: unknown) => Response;
  readonly logger: GroupReadLogger;
  readonly readPage: (request: Request) => { readonly page: number; readonly pageSize: number };
  readonly readPathSegment: (request: Request, index: number) => string | null | undefined;
  readonly requireRoles: (
    ctx: GroupReadAuthenticatedRequestContext,
    roles: ReadonlySet<string>,
    requestId?: string
  ) => Response | null;
  readonly resolveActorInfo: (
    request: Request,
    ctx: GroupReadAuthenticatedRequestContext,
    options: { readonly requireActorMembership: true }
  ) => Promise<{ readonly actor: GroupReadActor } | { readonly error: Response }>;
  readonly withInstanceScopedDb: <T>(
    instanceId: string,
    work: (client: GroupQueryClient) => Promise<T>
  ) => Promise<T>;
};

export type GroupReadApiErrorCode = ApiErrorCode;

const ADMIN_ROLES = new Set(['system_admin', 'app_manager']);

const resolveGroupReadActor = async (
  deps: GroupReadHandlerDeps,
  request: Request,
  ctx: GroupReadAuthenticatedRequestContext
): Promise<{ readonly actor: GroupReadActor } | Response> => {
  const requestContext = deps.getWorkspaceContext();
  const roleCheck = deps.requireRoles(ctx, ADMIN_ROLES, requestContext.requestId);
  if (roleCheck) {
    return roleCheck;
  }

  const actorResolution = await deps.resolveActorInfo(request, ctx, { requireActorMembership: true });
  if ('error' in actorResolution) {
    return actorResolution.error;
  }

  return { actor: actorResolution.actor };
};

const readGroupIdOrError = (
  deps: GroupReadHandlerDeps,
  request: Request,
  requestId?: string
): string | Response => {
  const groupId = deps.readPathSegment(request, 4);
  if (!groupId || !deps.isUuid(groupId)) {
    return deps.createApiError(400, 'invalid_request', 'Ungültige Gruppen-ID', requestId);
  }
  return groupId;
};

export const createGroupReadHandlers = (deps: GroupReadHandlerDeps) => {
  const listGroupsInternal = async (
    request: Request,
    ctx: GroupReadAuthenticatedRequestContext
  ): Promise<Response> => {
    const resolved = await resolveGroupReadActor(deps, request, ctx);
    if (resolved instanceof Response) {
      return resolved;
    }

    const { actor } = resolved;
    const { page, pageSize } = deps.readPage(request);

    try {
      const groups = await deps.withInstanceScopedDb(actor.instanceId, (client) =>
        loadGroupListItems(client, actor.instanceId)
      );
      const paginated = groups.slice((page - 1) * pageSize, page * pageSize);
      return deps.jsonResponse(
        200,
        deps.asApiList(paginated, { page, pageSize, total: groups.length }, actor.requestId)
      );
    } catch (error) {
      deps.logger.error('Group list query failed', {
        operation: 'group_list',
        workspace_id: actor.instanceId,
        error: error instanceof Error ? error.message : String(error),
        request_id: actor.requestId,
        trace_id: actor.traceId,
      });
      return deps.createApiError(
        503,
        'database_unavailable',
        'Gruppen konnten nicht geladen werden.',
        actor.requestId
      );
    }
  };

  const getGroupInternal = async (
    request: Request,
    ctx: GroupReadAuthenticatedRequestContext
  ): Promise<Response> => {
    const resolved = await resolveGroupReadActor(deps, request, ctx);
    if (resolved instanceof Response) {
      return resolved;
    }

    const { actor } = resolved;
    const groupId = readGroupIdOrError(deps, request, actor.requestId);
    if (groupId instanceof Response) {
      return groupId;
    }

    try {
      const group = await deps.withInstanceScopedDb(actor.instanceId, (client) =>
        loadGroupDetail(client, { instanceId: actor.instanceId, groupId })
      );
      if (!group) {
        return deps.createApiError(404, 'invalid_request', 'Gruppe nicht gefunden', actor.requestId);
      }
      return deps.jsonResponse(200, deps.asApiItem(group, actor.requestId));
    } catch (error) {
      deps.logger.error('Group detail query failed', {
        operation: 'group_detail',
        workspace_id: actor.instanceId,
        group_id: groupId,
        error: error instanceof Error ? error.message : String(error),
        request_id: actor.requestId,
        trace_id: actor.traceId,
      });
      return deps.createApiError(
        503,
        'database_unavailable',
        'Gruppe konnte nicht geladen werden.',
        actor.requestId
      );
    }
  };

  return {
    getGroupInternal,
    listGroupsInternal,
  };
};
