export type SyncUsersAuthenticatedRequestContext = {
  readonly sessionId: string;
  readonly user: {
    readonly id: string;
    readonly instanceId?: string;
    readonly roles: string[];
  };
};

export type SyncUsersActor = {
  readonly instanceId: string;
  readonly actorAccountId?: string;
  readonly requestId?: string;
  readonly traceId?: string;
};

export type SyncUsersRequestContext = {
  readonly requestId?: string;
  readonly traceId?: string;
};

export type SyncUsersImportResult<TReport = unknown> = {
  readonly report: TReport;
  readonly skippedCount: number;
  readonly skippedInstanceIds: ReadonlySet<string>;
};

export type SyncUsersHandlerDeps<TReport = unknown, TFeatureFlags = unknown> = {
  readonly asApiItem: (data: unknown, requestId?: string) => unknown;
  readonly buildLogContext: (
    workspaceId?: string,
    options?: { readonly includeTraceId?: boolean }
  ) => Readonly<Record<string, unknown>>;
  readonly consumeRateLimit: (input: {
    readonly instanceId: string;
    readonly actorKeycloakSubject: string;
    readonly scope: 'write';
    readonly requestId?: string;
  }) => Response | null;
  readonly createApiError: (
    status: number,
    code: SyncUsersApiErrorCode,
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
  readonly getWorkspaceContext: () => SyncUsersRequestContext;
  readonly iamUserOperationsCounter: {
    readonly add: (value: number, attributes: Readonly<Record<string, string>>) => void;
  };
  readonly isPlatformIdentityProviderConfigurationError: (error: unknown) => boolean;
  readonly jsonResponse: (status: number, payload: unknown) => Response;
  readonly logger: {
    readonly error: (message: string, meta: Readonly<Record<string, unknown>>) => void;
    readonly info: (message: string, meta: Readonly<Record<string, unknown>>) => void;
  };
  readonly mapSyncErrorResponse: (error: unknown, requestId?: string) => Response | undefined;
  readonly platformRateLimitInstanceId: string;
  readonly requireRoles: (
    ctx: SyncUsersAuthenticatedRequestContext,
    roles: ReadonlySet<string>,
    requestId?: string
  ) => Response | null;
  readonly resolveSyncActor: (
    request: Request,
    ctx: SyncUsersAuthenticatedRequestContext
  ) => Promise<{ readonly actor: SyncUsersActor } | { readonly error: Response }>;
  readonly runKeycloakUserImportSync: (input: {
    readonly instanceId: string;
    readonly actorAccountId?: string;
    readonly requestId?: string;
    readonly traceId?: string;
  }) => Promise<SyncUsersImportResult<TReport>>;
  readonly runPlatformKeycloakUserSync: (input: {
    readonly requestId?: string;
    readonly traceId?: string;
  }) => Promise<TReport>;
  readonly validateCsrf: (request: Request, requestId?: string) => Response | null;
};

export type SyncUsersApiErrorCode =
  | 'internal_error'
  | 'keycloak_unavailable'
  | 'tenant_admin_client_not_configured'
  | 'database_unavailable';

const ADMIN_ROLES = new Set(['system_admin', 'instance_admin']);

const handlePlatformSync = async <TReport, TFeatureFlags>(
  deps: SyncUsersHandlerDeps<TReport, TFeatureFlags>,
  request: Request,
  ctx: SyncUsersAuthenticatedRequestContext
): Promise<Response> => {
  const requestContext = deps.getWorkspaceContext();
  const featureCheck = deps.ensureFeature(deps.getFeatureFlags(), 'iam_admin', requestContext.requestId);
  if (featureCheck) {
    return featureCheck;
  }
  const roleCheck = deps.requireRoles(ctx, ADMIN_ROLES, requestContext.requestId);
  if (roleCheck) {
    return roleCheck;
  }
  const csrfError = deps.validateCsrf(request, requestContext.requestId);
  if (csrfError) {
    return csrfError;
  }
  const rateLimit = deps.consumeRateLimit({
    instanceId: deps.platformRateLimitInstanceId,
    actorKeycloakSubject: ctx.user.id,
    scope: 'write',
    requestId: requestContext.requestId,
  });
  if (rateLimit) {
    return rateLimit;
  }

  try {
    const report = await deps.runPlatformKeycloakUserSync({
      requestId: requestContext.requestId,
      traceId: requestContext.traceId,
    });
    deps.iamUserOperationsCounter.add(1, { action: 'sync_platform_keycloak_users', result: 'success' });
    return deps.jsonResponse(200, deps.asApiItem(report, requestContext.requestId));
  } catch (error) {
    deps.logger.error('Platform keycloak user sync failed', {
      operation: 'sync_platform_keycloak_users',
      scope_kind: 'platform',
      request_id: requestContext.requestId,
      trace_id: requestContext.traceId,
      error: error instanceof Error ? error.message : String(error),
    });
    deps.iamUserOperationsCounter.add(1, { action: 'sync_platform_keycloak_users', result: 'failure' });
    if (deps.isPlatformIdentityProviderConfigurationError(error)) {
      return deps.createApiError(
        503,
        'keycloak_unavailable',
        'Plattform-IAM ist nicht konfiguriert.',
        requestContext.requestId,
        {
          dependency: 'keycloak',
          reason_code: 'platform_identity_provider_not_configured',
          scope_kind: 'platform',
        }
      );
    }
    return deps.createApiError(
      503,
      'keycloak_unavailable',
      'Plattform-Benutzer konnten nicht aus Keycloak synchronisiert werden.',
      requestContext.requestId,
      {
        dependency: 'keycloak',
        reason_code: 'platform_keycloak_unavailable',
        scope_kind: 'platform',
      }
    );
  }
};

export const createSyncUsersFromKeycloakHandlerInternal =
  <TReport, TFeatureFlags>(deps: SyncUsersHandlerDeps<TReport, TFeatureFlags>) =>
  async (request: Request, ctx: SyncUsersAuthenticatedRequestContext): Promise<Response> => {
    if (!ctx.user.instanceId) {
      return handlePlatformSync(deps, request, ctx);
    }

    const actorResolution = await deps.resolveSyncActor(request, ctx);
    if ('error' in actorResolution) {
      return actorResolution.error;
    }
    const { actor } = actorResolution;

    try {
      const { report, skippedCount, skippedInstanceIds } = await deps.runKeycloakUserImportSync({
        instanceId: actor.instanceId,
        actorAccountId: actor.actorAccountId,
        requestId: actor.requestId,
        traceId: actor.traceId,
      });

      if (skippedCount > 0) {
        deps.logger.info('Keycloak user sync skipped users because instance ids did not match', {
          operation: 'sync_keycloak_users',
          skipped_count: skippedCount,
          sample_instance_ids: Array.from(skippedInstanceIds).join(','),
          ...deps.buildLogContext(actor.instanceId, { includeTraceId: true }),
        });
      }

      deps.iamUserOperationsCounter.add(1, { action: 'sync_keycloak_users', result: 'success' });
      return deps.jsonResponse(200, deps.asApiItem(report, actor.requestId));
    } catch (error) {
      const mappedError = deps.mapSyncErrorResponse(error, actor.requestId);
      if (mappedError) {
        deps.iamUserOperationsCounter.add(1, { action: 'sync_keycloak_users', result: 'failure' });
        return mappedError;
      }

      deps.logger.error('IAM keycloak user import failed', {
        operation: 'sync_keycloak_users',
        instance_id: actor.instanceId,
        request_id: actor.requestId,
        trace_id: actor.traceId,
        error: error instanceof Error ? error.message : String(error),
      });
      deps.iamUserOperationsCounter.add(1, { action: 'sync_keycloak_users', result: 'failure' });
      return deps.createApiError(
        500,
        'internal_error',
        'Keycloak-Benutzer konnten nicht in IAM synchronisiert werden.',
        actor.requestId
      );
    }
  };
