import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  getWorkspaceContext: vi.fn(() => ({ requestId: 'req-1', traceId: 'trace-1' })),
  ensureFeature: vi.fn(),
  getFeatureFlags: vi.fn(() => ({})),
  requireRoles: vi.fn(),
  resolveActorInfo: vi.fn(),
  readPathSegment: vi.fn(),
  createApiError: vi.fn(
    (
      status: number,
      code: string,
      message: string,
      requestId?: string,
      details?: Readonly<Record<string, unknown>>
    ) =>
      new Response(
        JSON.stringify({
          error: {
            code,
            message,
            ...(details ? { details } : {}),
          },
          ...(requestId ? { requestId } : {}),
        }),
        {
          status,
          headers: { 'Content-Type': 'application/json' },
        }
      )
  ),
  classifyIamDiagnosticError: vi.fn(),
  isUuid: vi.fn(),
}));

vi.mock('@sva/server-runtime', () => ({
  getWorkspaceContext: state.getWorkspaceContext,
}));

vi.mock('./feature-flags.js', () => ({
  ensureFeature: state.ensureFeature,
  getFeatureFlags: state.getFeatureFlags,
}));

vi.mock('./shared.js', () => ({
  requireRoles: state.requireRoles,
  resolveActorInfo: state.resolveActorInfo,
}));

vi.mock('./api-helpers.js', () => ({
  createApiError: state.createApiError,
  readPathSegment: state.readPathSegment,
}));

vi.mock('./diagnostics.js', () => ({
  classifyIamDiagnosticError: state.classifyIamDiagnosticError,
}));

vi.mock('../shared/input-readers.js', () => ({
  isUuid: state.isUuid,
}));

describe('user-read-shared', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.ensureFeature.mockReturnValue(undefined);
    state.requireRoles.mockReturnValue(undefined);
    state.resolveActorInfo.mockResolvedValue({
      actor: {
        instanceId: 'instance-1',
        actorAccountId: 'actor-1',
        requestId: 'req-actor',
        traceId: 'trace-actor',
      },
    });
    state.readPathSegment.mockReturnValue('7a91b1eb-8bb0-43f8-9306-9728cf606f5d');
    state.isUuid.mockReturnValue(true);
    state.classifyIamDiagnosticError.mockReturnValue({
      status: 503,
      code: 'database_unavailable',
      message: 'IAM-Datenbank ist nicht erreichbar.',
      details: { reason_code: 'db_unavailable' },
    });
  });

  it('returns the feature gate response before checking roles or actor membership', async () => {
    const featureGate = new Response('feature-gate', { status: 403 });
    state.ensureFeature.mockReturnValue(featureGate);

    const { resolveUserReadAccess } = await import('./user-read-shared.js');
    const result = await resolveUserReadAccess(new Request('https://example.test/api/v1/iam/users/user-1'), {
      user: {
        id: 'kc-user-1',
        instanceId: 'instance-1',
        roles: ['system_admin'],
      },
    } as never);

    expect(result).toEqual({ response: featureGate });
    expect(state.requireRoles).not.toHaveBeenCalled();
    expect(state.resolveActorInfo).not.toHaveBeenCalled();
  });

  it('returns the resolved actor and maps actor resolution failures to responses', async () => {
    const { resolveUserReadAccess } = await import('./user-read-shared.js');
    const request = new Request('https://example.test/api/v1/iam/users/user-1');
    const ctx = {
      user: {
        id: 'kc-user-1',
        instanceId: 'instance-1',
        roles: ['system_admin'],
      },
    } as never;

    await expect(resolveUserReadAccess(request, ctx)).resolves.toEqual({
      actor: {
        instanceId: 'instance-1',
        actorAccountId: 'actor-1',
        requestId: 'req-actor',
        traceId: 'trace-actor',
      },
    });
    expect(state.resolveActorInfo).toHaveBeenCalledWith(request, ctx, {
      requireActorMembership: true,
      provisionMissingActorMembership: true,
    });

    const actorError = new Response('actor-error', { status: 401 });
    state.resolveActorInfo.mockResolvedValueOnce({ error: actorError });
    await expect(resolveUserReadAccess(request, ctx)).resolves.toEqual({ response: actorError });
  });

  it('validates the user id path segment and maps database diagnostics into API errors', async () => {
    const { createDatabaseApiError, readValidatedUserId } = await import('./user-read-shared.js');
    const request = new Request('https://example.test/api/v1/iam/users/user-1');

    expect(readValidatedUserId(request, 'req-1')).toEqual({
      userId: '7a91b1eb-8bb0-43f8-9306-9728cf606f5d',
    });

    state.isUuid.mockReturnValueOnce(false);
    const invalid = readValidatedUserId(request, 'req-1');
    expect(invalid.response).toBeInstanceOf(Response);
    await expect((invalid.response as Response).json()).resolves.toEqual({
      error: {
        code: 'invalid_request',
        message: 'Ungültige userId.',
      },
      requestId: 'req-1',
    });

    const databaseError = createDatabaseApiError(new Error('db down'), 'req-db');
    await expect(databaseError.json()).resolves.toEqual({
      error: {
        code: 'database_unavailable',
        message: 'IAM-Datenbank ist nicht erreichbar.',
        details: { reason_code: 'db_unavailable' },
      },
      requestId: 'req-db',
    });
  });

  it('logs degraded projection details only when an external lookup failed', async () => {
    const logger = {
      warn: vi.fn(),
    };
    const { logUserProjectionDegraded } = await import('./user-read-shared.js');

    logUserProjectionDegraded({
      actor: {
        instanceId: 'instance-1',
        requestId: 'req-1',
        traceId: 'trace-1',
      },
      userId: 'user-1',
      keycloakRoleNamesResult: {
        status: 'fulfilled',
        value: ['system_admin'],
      },
      mainserverCredentialStateResult: {
        status: 'fulfilled',
        value: {
          mainserverUserApplicationId: 'app-1',
          mainserverUserApplicationSecretSet: true,
        },
      },
      logger,
    });
    expect(logger.warn).not.toHaveBeenCalled();

    logUserProjectionDegraded({
      actor: {
        instanceId: 'instance-1',
        requestId: 'req-1',
        traceId: 'trace-1',
      },
      userId: 'user-1',
      keycloakRoleNamesResult: {
        status: 'rejected',
        reason: new Error('keycloak down'),
      },
      mainserverCredentialStateResult: {
        status: 'rejected',
        reason: 'secret lookup failed',
      },
      logger,
    });

    expect(logger.warn).toHaveBeenCalledWith(
      'IAM user detail projection degraded because external data could not be loaded',
      {
        operation: 'get_user',
        instance_id: 'instance-1',
        user_id: 'user-1',
        request_id: 'req-1',
        trace_id: 'trace-1',
        keycloak_roles_error: 'keycloak down',
        mainserver_credentials_error: 'secret lookup failed',
      }
    );
  });
});
