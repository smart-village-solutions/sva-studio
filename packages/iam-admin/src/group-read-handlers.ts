import type { ApiErrorCode } from '@sva/core';

import {
  GroupQueryExecutionError,
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
  readonly info: (message: string, meta: Readonly<Record<string, unknown>>) => void;
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

const isSchemaDriftLikeGroupQueryError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return /column .* does not exist|relation .* does not exist|syntax error|42P0\d|42703/i.test(message);
};

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

const buildGroupReadLogMeta = (
  actor: GroupReadActor,
  details: Readonly<Record<string, unknown>> = {}
): Readonly<Record<string, unknown>> => ({
  workspace_id: actor.instanceId,
  request_id: actor.requestId,
  trace_id: actor.traceId,
  ...details,
});

const buildGroupListResultPreview = (
  groups: readonly { readonly id: string; readonly groupKey: string }[],
  paginated: readonly { readonly id: string; readonly groupKey: string }[]
) => ({
  returned_group_ids: paginated.map((group) => group.id),
  returned_group_keys: paginated.map((group) => group.groupKey),
  total_group_count: groups.length,
});

const resolveSchemaObjectForGroupDetailStage = (
  stage: 'group_detail' | 'group_memberships' | 'group_roles'
): 'iam.groups' | 'iam.accounts' | 'iam.group_roles' => {
  switch (stage) {
    case 'group_detail':
      return 'iam.groups';
    case 'group_memberships':
      return 'iam.accounts';
    case 'group_roles':
      return 'iam.group_roles';
  }
};

const createGroupNotFoundResponse = (
  deps: GroupReadHandlerDeps,
  actor: GroupReadActor,
  groupId: string
): Response => {
  deps.logger.info(
    'Group detail not found',
    buildGroupReadLogMeta(actor, {
      operation: 'group_detail',
      group_id: groupId,
    })
  );
  return deps.createApiError(404, 'invalid_request', 'Gruppe nicht gefunden', actor.requestId);
};

const handleGroupDetailQueryError = (
  deps: GroupReadHandlerDeps,
  actor: GroupReadActor,
  groupId: string,
  error: unknown
): Response => {
  const cause = error instanceof GroupQueryExecutionError ? error.cause : error;
  const queryStage = error instanceof GroupQueryExecutionError ? error.stage : 'group_detail';

  deps.logger.error(
    'Group detail query failed',
    buildGroupReadLogMeta(actor, {
      operation: 'group_detail',
      group_id: groupId,
      query_stage: queryStage,
      error: error instanceof Error ? error.message : String(error),
      error_cause: cause instanceof Error ? cause.message : String(cause),
    })
  );

  if (isSchemaDriftLikeGroupQueryError(cause)) {
    return deps.createApiError(
      503,
      'database_unavailable',
      'Gruppendetails konnten wegen einer Server- oder Migrationsinkonsistenz nicht vollständig geladen werden.',
      actor.requestId,
      {
        dependency: 'database',
        reason_code: 'schema_drift',
        schema_object: resolveSchemaObjectForGroupDetailStage(queryStage),
        query_stage: queryStage,
      }
    );
  }

  return deps.createApiError(
    503,
    'database_unavailable',
    'Gruppe konnte nicht geladen werden.',
    actor.requestId
  );
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
      deps.logger.info(
        'Group list loaded',
        buildGroupReadLogMeta(actor, {
          operation: 'group_list',
          page,
          page_size: pageSize,
          ...buildGroupListResultPreview(groups, paginated),
        })
      );
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
        return createGroupNotFoundResponse(deps, actor, groupId);
      }
      return deps.jsonResponse(200, deps.asApiItem(group, actor.requestId));
    } catch (error) {
      return handleGroupDetailQueryError(deps, actor, groupId, error);
    }
  };

  return {
    getGroupInternal,
    listGroupsInternal,
  };
};
