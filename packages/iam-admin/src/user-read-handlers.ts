import { listTenantUsersWithCanonicalProjection, projectUserDetail, type UserReadActor, type UserReadAuthenticatedRequestContext, type UserReadHandlerDeps } from './user-read-projection.js';
import { USER_STATUS, type UserStatus } from './types.js';

export type { UserReadActor, UserReadAuthenticatedRequestContext, UserReadHandlerDeps } from './user-read-projection.js';

const createTenantAdminClientNotConfiguredResponse = (
  deps: UserReadHandlerDeps,
  actor: UserReadActor
): Response =>
  deps.createApiError(
    409,
    'tenant_admin_client_not_configured',
    'Tenant-lokale Keycloak-Administration ist nicht konfiguriert.',
    actor.requestId,
    {
      dependency: 'keycloak',
      execution_mode: 'tenant_admin',
      instance_id: actor.instanceId,
      reason_code: 'tenant_admin_client_not_configured',
    }
  );

export const createUserReadHandlers = (deps: UserReadHandlerDeps) => {
  const listUsersInternal = async (
    request: Request,
    ctx: UserReadAuthenticatedRequestContext
  ): Promise<Response> => {
    if (!ctx.user.instanceId) {
      return deps.listPlatformUsersInternal(request, ctx);
    }

    const { page, pageSize } = deps.readPage(request);
    const url = new URL(request.url);
    const status = deps.readString(url.searchParams.get('status')) as UserStatus | undefined;
    const role = deps.readString(url.searchParams.get('role'));
    const search = deps.readString(url.searchParams.get('search'));
    const includeTechnicalAccounts = url.searchParams.get('includeTechnicalAccounts') === 'true';

    const access = await deps.resolveUserReadAccess(request, ctx);
    if ('response' in access) {
      return access.response;
    }
    const rateLimit = deps.consumeRateLimit({
      instanceId: access.actor.instanceId,
      actorKeycloakSubject: ctx.user.id,
      scope: 'read',
      requestId: access.actor.requestId,
    });
    if (rateLimit) {
      return rateLimit;
    }

    if (status && !USER_STATUS.includes(status)) {
      return deps.createApiError(
        400,
        'invalid_request',
        'Ungültiger Status-Filter.',
        access.actor.requestId
      );
    }

    try {
      const resolved = await listTenantUsersWithCanonicalProjection(deps, {
        instanceId: access.actor.instanceId,
        page,
        pageSize,
        status,
        role: role ?? undefined,
        search: search ?? undefined,
        includeTechnicalAccounts,
        requestId: access.actor.requestId,
        traceId: access.actor.traceId,
      });

      return deps.jsonResponse(
        200,
        deps.asApiList(
          resolved.users,
          { page, pageSize, total: resolved.total },
          access.actor.requestId
        )
      );
    } catch (error) {
      deps.logger.error('IAM user list failed', {
        operation: 'list_users',
        instance_id: access.actor.instanceId,
        request_id: access.actor.requestId,
        trace_id: access.actor.traceId,
        error: error instanceof Error ? error.message : String(error),
      });
      if (error instanceof Error && error.message === 'tenant_admin_client_not_configured') {
        return createTenantAdminClientNotConfiguredResponse(deps, access.actor);
      }
      return deps.createDatabaseApiError(error, access.actor.requestId);
    }
  };

  const getUserInternal = async (
    request: Request,
    ctx: UserReadAuthenticatedRequestContext
  ): Promise<Response> => {
    const access = await deps.resolveUserReadAccess(request, ctx);
    if ('response' in access) {
      return access.response;
    }
    const userIdResult = deps.readValidatedUserId(request, access.actor.requestId);
    if ('response' in userIdResult) {
      return userIdResult.response;
    }
    const { userId } = userIdResult;

    const rateLimit = deps.consumeRateLimit({
      instanceId: access.actor.instanceId,
      actorKeycloakSubject: ctx.user.id,
      scope: 'read',
      requestId: access.actor.requestId,
    });
    if (rateLimit) {
      return rateLimit;
    }

    try {
      const user = await deps.withInstanceScopedDb(access.actor.instanceId, (client) =>
        deps.resolveUserDetail(client, {
          instanceId: access.actor.instanceId,
          userId,
        })
      );
      if (!user) {
        return deps.createApiError(
          404,
          'not_found',
          'Nutzer nicht gefunden.',
          access.actor.requestId
        );
      }

      const projectedUser = await projectUserDetail(deps, access.actor, userId, user);

      return deps.jsonResponse(200, deps.asApiItem(projectedUser, access.actor.requestId));
    } catch (error) {
      return deps.createDatabaseApiError(error, access.actor.requestId);
    }
  };

  const getUserTimelineInternal = async (
    request: Request,
    ctx: UserReadAuthenticatedRequestContext
  ): Promise<Response> => {
    const access = await deps.resolveUserReadAccess(request, ctx);
    if ('response' in access) {
      return access.response;
    }
    const userIdResult = deps.readValidatedUserId(request, access.actor.requestId);
    if ('response' in userIdResult) {
      return userIdResult.response;
    }
    const { userId } = userIdResult;

    try {
      const events = await deps.withInstanceScopedDb(access.actor.instanceId, (client) =>
        deps.resolveUserTimeline(client, {
          instanceId: access.actor.instanceId,
          userId,
        })
      );
      return deps.jsonResponse(
        200,
        deps.asApiList(
          events,
          { page: 1, pageSize: events.length || 1, total: events.length },
          access.actor.requestId
        )
      );
    } catch (error) {
      deps.logger.error('IAM user timeline failed', {
        operation: 'get_user_timeline',
        instance_id: access.actor.instanceId,
        request_id: access.actor.requestId,
        trace_id: access.actor.traceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return deps.createApiError(
        503,
        'database_unavailable',
        'IAM-Historie ist nicht erreichbar.',
        access.actor.requestId
      );
    }
  };

  return {
    getUserInternal,
    getUserTimelineInternal,
    listUsersInternal,
  };
};
