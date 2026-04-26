export type LegalTextHttpActor = {
  instanceId: string;
  actorAccountId?: string;
  requestId?: string;
  traceId?: string;
};

export type LegalTextPendingUser = {
  id: string;
  instanceId?: string;
};

export type LegalTextHttpHandlerDeps<TContext> = {
  readonly resolveAdminActor: (
    request: Request,
    ctx: TContext,
    options?: { requireActorAccountId?: boolean }
  ) => Promise<{ actor: LegalTextHttpActor } | { error: Response }>;
  readonly getRequestId: () => string | undefined;
  readonly asApiList: <T>(
    items: readonly T[],
    pagination: { page: number; pageSize: number; total: number },
    requestId?: string
  ) => unknown;
  readonly createApiError: (
    status: number,
    code: string,
    message: string,
    requestId?: string
  ) => Response;
  readonly jsonResponse: (status: number, body: unknown) => Response;
  readonly loadLegalTextListItems: (instanceId: string) => Promise<readonly unknown[]>;
  readonly loadPendingLegalTexts: (instanceId: string, keycloakSubject: string) => Promise<readonly unknown[]>;
  readonly createLegalTextResponse: (request: Request, actor: LegalTextHttpActor) => Promise<Response>;
  readonly updateLegalTextResponse: (request: Request, actor: LegalTextHttpActor) => Promise<Response>;
  readonly deleteLegalTextResponse: (request: Request, actor: LegalTextHttpActor) => Promise<Response>;
  readonly logError: (message: string, fields: Record<string, unknown>) => void;
};

const toListResponse = <T>(
  deps: Pick<LegalTextHttpHandlerDeps<unknown>, 'asApiList' | 'jsonResponse'>,
  items: readonly T[],
  requestId?: string
): Response => {
  const pageSize = Math.max(1, items.length);
  return deps.jsonResponse(200, deps.asApiList(items, { page: 1, pageSize, total: items.length }, requestId));
};

export const createLegalTextHttpHandlers = <TContext>(
  deps: LegalTextHttpHandlerDeps<TContext>
) => ({
  listLegalTexts: async (request: Request, ctx: TContext): Promise<Response> => {
    const actorResolution = await deps.resolveAdminActor(request, ctx);
    if ('error' in actorResolution) {
      return actorResolution.error;
    }

    try {
      const items = await deps.loadLegalTextListItems(actorResolution.actor.instanceId);
      return toListResponse(deps, items, actorResolution.actor.requestId);
    } catch (error) {
      deps.logError('Legal text list query failed', {
        operation: 'legal_texts_list',
        instance_id: actorResolution.actor.instanceId,
        request_id: actorResolution.actor.requestId,
        trace_id: actorResolution.actor.traceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return deps.createApiError(
        503,
        'database_unavailable',
        'Rechtstexte konnten nicht geladen werden.',
        actorResolution.actor.requestId
      );
    }
  },

  createLegalText: async (request: Request, ctx: TContext): Promise<Response> => {
    const actorResolution = await deps.resolveAdminActor(request, ctx, { requireActorAccountId: true });
    return 'error' in actorResolution
      ? actorResolution.error
      : deps.createLegalTextResponse(request, actorResolution.actor);
  },

  updateLegalText: async (request: Request, ctx: TContext): Promise<Response> => {
    const actorResolution = await deps.resolveAdminActor(request, ctx, { requireActorAccountId: true });
    return 'error' in actorResolution
      ? actorResolution.error
      : deps.updateLegalTextResponse(request, actorResolution.actor);
  },

  deleteLegalText: async (request: Request, ctx: TContext): Promise<Response> => {
    const actorResolution = await deps.resolveAdminActor(request, ctx, { requireActorAccountId: true });
    return 'error' in actorResolution
      ? actorResolution.error
      : deps.deleteLegalTextResponse(request, actorResolution.actor);
  },

  listPendingLegalTexts: async (user: LegalTextPendingUser): Promise<Response> => {
    const requestId = deps.getRequestId();

    if (!user.instanceId) {
      return deps.createApiError(401, 'unauthorized', 'Instanzkontext fehlt.', requestId);
    }

    try {
      const items = await deps.loadPendingLegalTexts(user.instanceId, user.id);
      return toListResponse(deps, items, requestId);
    } catch (error) {
      deps.logError('Pending legal text query failed', {
        operation: 'legal_texts_pending',
        instance_id: user.instanceId,
        user_id: user.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return deps.createApiError(503, 'database_unavailable', 'Offene Rechtstexte konnten nicht geladen werden.', requestId);
    }
  },
});
