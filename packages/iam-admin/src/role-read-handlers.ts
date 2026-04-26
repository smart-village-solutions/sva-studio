import type { ApiErrorCode } from '@sva/core';

export type RoleReadAuthenticatedRequestContext = {
  readonly sessionId: string;
  readonly user: {
    readonly id: string;
    readonly instanceId?: string;
    readonly roles: string[];
  };
};

export type RoleReadActor = {
  readonly instanceId: string;
  readonly requestId?: string;
};

export type RoleReadHandlerDeps<TRole = unknown, TPermission = unknown, TFeatureFlags = unknown> = {
  readonly asApiList: (
    data: readonly unknown[],
    pagination: { readonly page: number; readonly pageSize: number; readonly total: number },
    requestId?: string
  ) => unknown;
  readonly classifyIamDiagnosticError: (
    error: unknown,
    fallbackMessage: string,
    requestId?: string
  ) => {
    readonly status: number;
    readonly code: RoleReadApiErrorCode;
    readonly message: string;
    readonly details?: Readonly<Record<string, unknown>>;
  };
  readonly consumeRateLimit: (input: {
    readonly instanceId: string;
    readonly actorKeycloakSubject: string;
    readonly scope: 'read';
    readonly requestId?: string;
  }) => Response | null;
  readonly createApiError: (
    status: number,
    code: RoleReadApiErrorCode,
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
  readonly getWorkspaceContext: () => { readonly requestId?: string; readonly traceId?: string };
  readonly jsonResponse: (status: number, payload: unknown) => Response;
  readonly listPlatformRolesInternal: (
    ctx: RoleReadAuthenticatedRequestContext,
    requestId?: string,
    traceId?: string
  ) => Promise<Response>;
  readonly loadPermissions: (instanceId: string) => Promise<readonly TPermission[]>;
  readonly loadRoleListItems: (instanceId: string) => Promise<readonly TRole[]>;
  readonly requireRoles: (
    ctx: RoleReadAuthenticatedRequestContext,
    roles: ReadonlySet<string>,
    requestId?: string
  ) => Response | null;
  readonly resolveActorInfo: (
    request: Request,
    ctx: RoleReadAuthenticatedRequestContext,
    options: { readonly requireActorMembership: true }
  ) => Promise<{ readonly actor: RoleReadActor } | { readonly error: Response }>;
};

export type RoleReadApiErrorCode = ApiErrorCode;

const ADMIN_ROLES = new Set(['system_admin', 'instance_admin']);

const resolveRoleReadActor = async <TRole, TPermission, TFeatureFlags>(
  deps: RoleReadHandlerDeps<TRole, TPermission, TFeatureFlags>,
  request: Request,
  ctx: RoleReadAuthenticatedRequestContext,
  options: { readonly allowPlatformRoles: boolean }
): Promise<{ actor: RoleReadActor; requestId?: string; traceId?: string } | Response> => {
  const requestContext = deps.getWorkspaceContext();
  const featureCheck = deps.ensureFeature(deps.getFeatureFlags(), 'iam_admin', requestContext.requestId);
  if (featureCheck) {
    return featureCheck;
  }
  const roleCheck = deps.requireRoles(ctx, ADMIN_ROLES, requestContext.requestId);
  if (roleCheck) {
    return roleCheck;
  }
  if (!ctx.user.instanceId && options.allowPlatformRoles) {
    return deps.listPlatformRolesInternal(ctx, requestContext.requestId, requestContext.traceId);
  }
  const actorResolution = await deps.resolveActorInfo(request, ctx, { requireActorMembership: true });
  if ('error' in actorResolution) {
    return actorResolution.error;
  }

  const rateLimit = deps.consumeRateLimit({
    instanceId: actorResolution.actor.instanceId,
    actorKeycloakSubject: ctx.user.id,
    scope: 'read',
    requestId: actorResolution.actor.requestId,
  });
  if (rateLimit) {
    return rateLimit;
  }

  return { actor: actorResolution.actor, requestId: requestContext.requestId, traceId: requestContext.traceId };
};

const mapRoleReadError = <TRole, TPermission, TFeatureFlags>(
  deps: RoleReadHandlerDeps<TRole, TPermission, TFeatureFlags>,
  error: unknown,
  requestId?: string
): Response => {
  const classified = deps.classifyIamDiagnosticError(error, 'IAM-Datenbank ist nicht erreichbar.', requestId);
  return deps.createApiError(
    classified.status,
    classified.code,
    classified.message,
    requestId,
    classified.details
  );
};

export const createRoleReadHandlers =
  <TRole, TPermission, TFeatureFlags>(deps: RoleReadHandlerDeps<TRole, TPermission, TFeatureFlags>) => {
    const listRolesInternal = async (
      request: Request,
      ctx: RoleReadAuthenticatedRequestContext
    ): Promise<Response> => {
      const resolved = await resolveRoleReadActor(deps, request, ctx, { allowPlatformRoles: true });
      if (resolved instanceof Response) {
        return resolved;
      }

      try {
        const roles = await deps.loadRoleListItems(resolved.actor.instanceId);
        return deps.jsonResponse(
          200,
          deps.asApiList(roles, { page: 1, pageSize: roles.length, total: roles.length }, resolved.actor.requestId)
        );
      } catch (error) {
        return mapRoleReadError(deps, error, resolved.actor.requestId);
      }
    };

    const listPermissionsInternal = async (
      request: Request,
      ctx: RoleReadAuthenticatedRequestContext
    ): Promise<Response> => {
      const resolved = await resolveRoleReadActor(deps, request, ctx, { allowPlatformRoles: false });
      if (resolved instanceof Response) {
        return resolved;
      }

      try {
        const permissions = await deps.loadPermissions(resolved.actor.instanceId);
        return deps.jsonResponse(
          200,
          deps.asApiList(
            permissions,
            { page: 1, pageSize: Math.max(1, permissions.length), total: permissions.length },
            resolved.actor.requestId
          )
        );
      } catch (error) {
        return mapRoleReadError(deps, error, resolved.actor.requestId);
      }
    };

    return {
      listPermissionsInternal,
      listRolesInternal,
    };
  };
