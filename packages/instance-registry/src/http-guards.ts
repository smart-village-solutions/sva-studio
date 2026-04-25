export const INSTANCE_REGISTRY_HTTP_ADMIN_ROLE = 'instance_registry_admin';

type CreateApiError = (
  status: number,
  code: string,
  message: string,
  requestId?: string,
  details?: Record<string, unknown>
) => Response;

export type InstanceRegistryHttpGuardDeps<TContext> = {
  readonly getRequestId: () => string | undefined;
  readonly createApiError: CreateApiError;
  readonly isRootHostRequest: (request: Request) => boolean;
  readonly requireRoles: (
    ctx: TContext,
    roles: ReadonlySet<string>,
    requestId?: string
  ) => Response | null;
};

export const createInstanceRegistryHttpGuards = <TContext>(
  deps: InstanceRegistryHttpGuardDeps<TContext>
) => {
  const adminRoles = new Set([INSTANCE_REGISTRY_HTTP_ADMIN_ROLE]);

  return {
    ensurePlatformAccess: (request: Request, ctx: TContext): Response | null => {
      if (!deps.isRootHostRequest(request)) {
        return deps.createApiError(
          403,
          'forbidden',
          'Globale Instanzverwaltung ist nur auf dem Root-Host erlaubt.',
          deps.getRequestId()
        );
      }

      return deps.requireRoles(ctx, adminRoles, deps.getRequestId());
    },

    requireFreshReauth: (request: Request): Response | null => {
      const header = request.headers.get('x-sva-reauth-confirmed');
      if (header?.toLowerCase() === 'true') {
        return null;
      }

      return deps.createApiError(
        403,
        'reauth_required',
        'Frische Re-Authentisierung ist für diese Mutation erforderlich.',
        deps.getRequestId()
      );
    },
  };
};
