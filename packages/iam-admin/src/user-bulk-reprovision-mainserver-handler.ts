export type BulkReprovisionMainserverAuthenticatedRequestContext = {
  readonly sessionId: string;
  readonly user: {
    readonly id: string;
    readonly instanceId?: string;
    readonly roles: string[];
  };
};

export type BulkReprovisionMainserverActor = {
  readonly instanceId: string;
  readonly actorAccountId: string;
  readonly requestId?: string;
  readonly traceId?: string;
};

export type BulkReprovisionMainserverFailure = Readonly<{
  id: string;
  code: string;
  message: string;
}>;

export type BulkReprovisionMainserverResult = Readonly<{
  successes: readonly { id: string }[];
  failures: readonly BulkReprovisionMainserverFailure[];
}>;

export type BulkReprovisionMainserverResolvedContext =
  | Response
  | {
      readonly actor: BulkReprovisionMainserverActor;
      readonly identityProvider: {
        readonly provider: unknown;
      };
      readonly payload: {
        readonly userIds: readonly string[];
      };
      readonly idempotencyKey: string;
    };

export type BulkReprovisionMainserverHandlerDeps = {
  readonly resolveBulkReprovisionMainserverContext: (
    request: Request,
    ctx: BulkReprovisionMainserverAuthenticatedRequestContext
  ) => Promise<BulkReprovisionMainserverResolvedContext>;
  readonly executeBulkReprovisionMainserver: (input: {
    actor: BulkReprovisionMainserverActor;
    ctx: BulkReprovisionMainserverAuthenticatedRequestContext;
    userIds: readonly string[];
    identityProvider: {
      readonly provider: unknown;
    };
  }) => Promise<BulkReprovisionMainserverResult>;
  readonly completeBulkReprovisionMainserverSuccess?: (input: {
    actor: BulkReprovisionMainserverActor;
    idempotencyKey: string;
    result: BulkReprovisionMainserverResult;
  }) => Promise<Response>;
  readonly completeBulkReprovisionMainserverFailure?: (input: {
    actor: BulkReprovisionMainserverActor;
    idempotencyKey: string;
    error: unknown;
  }) => Promise<Response>;
};

const jsonResponse = (status: number, payload: unknown): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });

export const createBulkReprovisionMainserverHandlerInternal =
  (deps: BulkReprovisionMainserverHandlerDeps) =>
  async (
    request: Request,
    ctx: BulkReprovisionMainserverAuthenticatedRequestContext
  ): Promise<Response> => {
    const resolved = await deps.resolveBulkReprovisionMainserverContext(request, ctx);
    if (resolved instanceof Response) {
      return resolved;
    }

    try {
      const uniqueUserIds = [...new Set(resolved.payload.userIds)];
      const result = await deps.executeBulkReprovisionMainserver({
        actor: resolved.actor,
        ctx,
        userIds: uniqueUserIds,
        identityProvider: resolved.identityProvider,
      });

      if (deps.completeBulkReprovisionMainserverSuccess) {
        return await deps.completeBulkReprovisionMainserverSuccess({
          actor: resolved.actor,
          idempotencyKey: resolved.idempotencyKey,
          result,
        });
      }

      return jsonResponse(200, {
        data: {
          ...result,
          successCount: result.successes.length,
          failureCount: result.failures.length,
        },
        ...(resolved.actor.requestId ? { requestId: resolved.actor.requestId } : {}),
      });
    } catch (error) {
      if (deps.completeBulkReprovisionMainserverFailure) {
        return await deps.completeBulkReprovisionMainserverFailure({
          actor: resolved.actor,
          idempotencyKey: resolved.idempotencyKey,
          error,
        });
      }

      return jsonResponse(500, {
        error: {
          code: 'internal_error',
          message: 'Bulk-Reprovision der Mainserver-Daten fehlgeschlagen.',
        },
        ...(resolved.actor.requestId ? { requestId: resolved.actor.requestId } : {}),
      });
    }
  };
