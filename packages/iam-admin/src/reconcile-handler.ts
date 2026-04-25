import type { ReconcileReport } from './reconcile-core.js';

export type ReconcileAuthenticatedRequestContext = {
  readonly sessionId: string;
  readonly user: {
    readonly id: string;
    readonly instanceId?: string;
    readonly roles: string[];
  };
};

type ActorResolution =
  | {
      readonly actor: {
        readonly instanceId: string;
        readonly actorAccountId?: string;
        readonly requestId?: string;
        readonly traceId?: string;
      };
    }
  | {
      readonly error: Response;
    };

export type ReconcileHandlerDeps = {
  readonly asApiItem: (data: ReconcileReport, requestId?: string) => unknown;
  readonly consumeRateLimit: (input: {
    instanceId: string;
    actorKeycloakSubject: string;
    scope: 'write';
    requestId?: string;
  }) => Response | null;
  readonly createApiError: (
    status: number,
    code: 'keycloak_unavailable',
    message: string,
    requestId?: string,
    details?: Readonly<Record<string, unknown>>
  ) => Response;
  readonly ensureIamAdminFeature: (requestId?: string) => Response | null;
  readonly getRequestContext: () => { readonly requestId?: string; readonly traceId?: string };
  readonly jsonResponse: (status: number, payload: unknown) => Response;
  readonly logger: {
    error(message: string, context: Readonly<Record<string, unknown>>): void;
  };
  readonly mapRoleSyncErrorCode: (error: unknown) => string;
  readonly reconcilePlatformRoles: (
    request: Request,
    ctx: ReconcileAuthenticatedRequestContext,
    requestId?: string,
    traceId?: string
  ) => Promise<Response>;
  readonly requireSystemAdminRole: (
    ctx: ReconcileAuthenticatedRequestContext,
    requestId?: string
  ) => Response | null;
  readonly resolveActorInfo: (
    request: Request,
    ctx: ReconcileAuthenticatedRequestContext,
    options: { requireActorMembership: true }
  ) => Promise<ActorResolution>;
  readonly runRoleCatalogReconciliation: (input: {
    instanceId: string;
    actorAccountId?: string;
    requestId?: string;
    traceId?: string;
    includeDiagnostics?: boolean;
  }) => Promise<ReconcileReport>;
  readonly sanitizeRoleErrorMessage: (error: unknown) => string;
  readonly validateCsrf: (request: Request, requestId?: string) => Response | null;
};

export const createReconcileHandlerInternal =
  (deps: ReconcileHandlerDeps) =>
  async (request: Request, ctx: ReconcileAuthenticatedRequestContext): Promise<Response> => {
    const requestContext = deps.getRequestContext();
    const featureCheck = deps.ensureIamAdminFeature(requestContext.requestId);
    if (featureCheck) {
      return featureCheck;
    }

    const roleCheck = deps.requireSystemAdminRole(ctx, requestContext.requestId);
    if (roleCheck) {
      return roleCheck;
    }

    if (!ctx.user.instanceId) {
      return deps.reconcilePlatformRoles(request, ctx, requestContext.requestId, requestContext.traceId);
    }

    const actorResolution = await deps.resolveActorInfo(request, ctx, { requireActorMembership: true });
    if ('error' in actorResolution) {
      return actorResolution.error;
    }

    const csrfError = deps.validateCsrf(request, actorResolution.actor.requestId);
    if (csrfError) {
      return csrfError;
    }

    const rateLimit = deps.consumeRateLimit({
      instanceId: actorResolution.actor.instanceId,
      actorKeycloakSubject: ctx.user.id,
      scope: 'write',
      requestId: actorResolution.actor.requestId,
    });
    if (rateLimit) {
      return rateLimit;
    }

    try {
      const report = await deps.runRoleCatalogReconciliation({
        instanceId: actorResolution.actor.instanceId,
        actorAccountId: actorResolution.actor.actorAccountId,
        requestId: actorResolution.actor.requestId,
        traceId: actorResolution.actor.traceId,
        includeDiagnostics:
          process.env.IAM_DEBUG_PROFILE_ERRORS === 'true' || request.headers.get('x-debug-reconcile') === '1',
      });
      return deps.jsonResponse(200, deps.asApiItem(report, actorResolution.actor.requestId));
    } catch (error) {
      deps.logger.error('Role reconciliation failed', {
        operation: 'reconcile_roles',
        instance_id: actorResolution.actor.instanceId,
        request_id: actorResolution.actor.requestId,
        trace_id: actorResolution.actor.traceId,
        error: deps.sanitizeRoleErrorMessage(error),
      });
      return deps.createApiError(
        503,
        'keycloak_unavailable',
        'Rollen-Reconciliation konnte nicht ausgeführt werden.',
        actorResolution.actor.requestId,
        {
          syncState: 'failed',
          syncError: { code: deps.mapRoleSyncErrorCode(error) },
        }
      );
    }
  };
