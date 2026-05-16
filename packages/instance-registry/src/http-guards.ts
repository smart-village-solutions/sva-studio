export const INSTANCE_REGISTRY_HTTP_ADMIN_ROLE = 'instance_registry_admin';
const DEFAULT_FRESH_REAUTH_WINDOW_MS = 10 * 60 * 1000;

const readFreshReauthWindowMs = (): number => {
  const raw = process.env.SVA_AUTH_FRESH_REAUTH_WINDOW_MS;
  if (!raw) {
    return DEFAULT_FRESH_REAUTH_WINDOW_MS;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_FRESH_REAUTH_WINDOW_MS;
};

export type FreshReauthContext = {
  readonly freshReauthAt?: number;
  readonly isLocalDevelopmentAuth?: boolean;
};

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

export const createInstanceRegistryHttpGuards = <TContext extends FreshReauthContext>(
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

    requireFreshReauth: (_request: Request, ctx: TContext): Response | null => {
      if (ctx.isLocalDevelopmentAuth) {
        return null;
      }

      if (
        typeof ctx.freshReauthAt === 'number' &&
        ctx.freshReauthAt >= Date.now() - readFreshReauthWindowMs()
      ) {
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
