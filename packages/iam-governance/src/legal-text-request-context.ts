import { getWorkspaceContext, toJsonErrorResponse, withRequestContext } from '@sva/server-runtime';

export type LegalTextsActorInfo = {
  instanceId: string;
  actorAccountId?: string;
  requestId?: string;
  traceId?: string;
};

export type ResolvedLegalTextsActor = {
  actor: LegalTextsActorInfo;
};

export type LegalTextsRequestContextDeps<TContext> = {
  readonly withAuthenticatedUser: (
    request: Request,
    handler: (ctx: TContext) => Promise<Response>
  ) => Promise<Response>;
  readonly logError: (message: string, fields: Record<string, unknown>) => void;
};

export type LegalTextsAdminActorResolverDeps<TContext> = {
  readonly ensureFeature: (requestId?: string) => Response | null | undefined;
  readonly requireAdminRoles: (ctx: TContext, requestId?: string) => Response | null | undefined;
  readonly resolveActorInfo: (
    request: Request,
    ctx: TContext
  ) => Promise<{ actor: LegalTextsActorInfo } | { error: Response }>;
  readonly createApiError: (
    status: number,
    code: string,
    message: string,
    requestId?: string
  ) => Response;
};

export const withLegalTextsRequestContext = <T>(request: Request, work: () => Promise<T>): Promise<T> =>
  withRequestContext({ request, fallbackWorkspaceId: 'default' }, work);

export const createLegalTextsRequestContextHandlers = <TContext>(
  deps: LegalTextsRequestContextDeps<TContext>
) => ({
  withAuthenticatedLegalTextsHandler: (
    request: Request,
    handler: (request: Request, ctx: TContext) => Promise<Response>
  ): Promise<Response> =>
    withLegalTextsRequestContext(request, async () => {
      try {
        return await deps.withAuthenticatedUser(request, (ctx) => handler(request, ctx));
      } catch (error) {
        const requestContext = getWorkspaceContext();
        deps.logError('IAM legal texts request failed unexpectedly', {
          operation: 'iam_legal_texts_request',
          endpoint: request.url,
          request_id: requestContext.requestId,
          trace_id: requestContext.traceId,
          error_type: error instanceof Error ? error.constructor.name : typeof error,
          error_message: error instanceof Error ? error.message : String(error),
        });

        return toJsonErrorResponse(500, 'internal_error', 'Unbehandelter IAM-Fehler.', {
          requestId: requestContext.requestId,
        });
      }
    }),
});

export const createLegalTextsAdminActorResolver =
  <TContext>(deps: LegalTextsAdminActorResolverDeps<TContext>) =>
  async (
    request: Request,
    ctx: TContext,
    options: { requireActorAccountId?: boolean } = {}
  ): Promise<ResolvedLegalTextsActor | { error: Response }> => {
    const requestContext = getWorkspaceContext();
    const featureCheck = deps.ensureFeature(requestContext.requestId);
    if (featureCheck) {
      return { error: featureCheck };
    }

    const roleCheck = deps.requireAdminRoles(ctx, requestContext.requestId);
    if (roleCheck) {
      return { error: roleCheck };
    }

    const actorResolution = await deps.resolveActorInfo(request, ctx);
    if ('error' in actorResolution) {
      return { error: actorResolution.error };
    }

    if (options.requireActorAccountId && !actorResolution.actor.actorAccountId) {
      return {
        error: deps.createApiError(403, 'forbidden', 'Akteur-Account nicht gefunden.', actorResolution.actor.requestId),
      };
    }

    return {
      actor: {
        instanceId: actorResolution.actor.instanceId,
        actorAccountId: actorResolution.actor.actorAccountId ?? undefined,
        requestId: actorResolution.actor.requestId,
        traceId: actorResolution.actor.traceId,
      },
    };
  };
