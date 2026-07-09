import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  getWorkspaceContext: vi.fn(() => ({ requestId: 'req-1' })),
  requireIdempotencyKey: vi.fn(),
  toPayloadHash: vi.fn(() => 'hash-1'),
  reserveIdempotency: vi.fn(),
  completeIdempotency: vi.fn(async () => undefined),
  resolveUserMutationTargetContext: vi.fn(),
  withInstanceScopedDb: vi.fn(async (_instanceId: string, work: (client: object) => Promise<unknown>) => work({})),
  resolveUserDetail: vi.fn(),
  resolveActorMaxRoleLevel: vi.fn(async () => 100),
  ensureActorCanManageTarget: vi.fn(() => ({ ok: true })),
  provisionMainserverUserCredentials: vi.fn(),
  trackKeycloakCall: vi.fn(async (_operation: string, execute: () => Promise<unknown>) => execute()),
  emitActivityLog: vi.fn(async () => undefined),
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
  getWorkspaceContext: state.getWorkspaceContext,
}));

vi.mock('../db.js', () => ({
  jsonResponse: (status: number, payload: unknown) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
}));

vi.mock('./api-helpers.js', () => ({
  createApiError: (
    status: number,
    code: string,
    message: string,
    requestId?: string,
    details?: Record<string, unknown>
  ) =>
    new Response(
      JSON.stringify({
        error: { code, message, ...(details ? { details } : {}) },
        ...(requestId ? { requestId } : {}),
      }),
      {
        status,
        headers: { 'content-type': 'application/json' },
      }
    ),
  requireIdempotencyKey: state.requireIdempotencyKey,
  toPayloadHash: state.toPayloadHash,
}));

vi.mock('./shared-idempotency.js', () => ({
  reserveIdempotency: state.reserveIdempotency,
  completeIdempotency: state.completeIdempotency,
}));

vi.mock('./user-mutation-request-context.shared.js', () => ({
  resolveUserMutationTargetContext: state.resolveUserMutationTargetContext,
}));

vi.mock('./shared.js', () => ({
  trackKeycloakCall: state.trackKeycloakCall,
  withInstanceScopedDb: state.withInstanceScopedDb,
}));

vi.mock('./shared-actor-authorization.js', () => ({
  ensureActorCanManageTarget: state.ensureActorCanManageTarget,
  resolveActorMaxRoleLevel: state.resolveActorMaxRoleLevel,
}));

vi.mock('./shared-activity.js', () => ({
  emitActivityLog: state.emitActivityLog,
}));

vi.mock('./user-detail-query.js', () => ({
  resolveUserDetail: state.resolveUserDetail,
}));

vi.mock('./mainserver-user-provisioning.js', () => ({
  provisionMainserverUserCredentials: state.provisionMainserverUserCredentials,
}));

describe('reprovisionMainserverUserInternal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.requireIdempotencyKey.mockReturnValue({ key: 'idem-1' });
    state.reserveIdempotency.mockResolvedValue({ status: 'reserved' });
    state.resolveUserMutationTargetContext.mockResolvedValue({
      actor: {
        instanceId: 'instance-1',
        actorAccountId: 'actor-1',
        activeOrganizationId: 'org-1',
        requestId: 'req-1',
        traceId: 'trace-1',
      },
      identityProvider: {
        provider: {
          getUserAttributes: vi.fn(async () => ({ locale: ['de'] })),
          updateUser: vi.fn(async () => undefined),
        },
      },
      userId: 'user-1',
    });
    state.resolveUserDetail.mockResolvedValue({
      id: 'user-1',
      keycloakSubject: 'kc-user-1',
      displayName: 'Alice Example',
      email: 'alice@example.com',
      firstName: 'Alice',
      lastName: 'Example',
      roles: [],
      mainserverUserApplicationSecretSet: false,
    });
    state.provisionMainserverUserCredentials.mockResolvedValue({
      mainserverUserApplicationId: 'mainserver-app-1',
      mainserverUserApplicationSecret: 'mainserver-secret-1',
    });
  });

  it('reprovisions mainserver credentials for an existing user and stores them in keycloak', async () => {
    const { reprovisionMainserverUserInternal } = await import('./user-reprovision-mainserver-handler.js');

    const response = await reprovisionMainserverUserInternal(
      new Request('http://localhost/api/v1/iam/users/user-1/reprovision-mainserver', {
        method: 'POST',
        body: '{}',
      }),
      {
        sessionId: 'session-1',
        activeOrganizationId: 'org-1',
        user: {
          id: 'kc-actor-1',
          instanceId: 'instance-1',
          roles: ['system_admin'],
        },
      }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: { status: 'updated' },
      requestId: 'req-1',
    });
    expect(state.provisionMainserverUserCredentials).toHaveBeenCalledWith({
      actor: {
          instanceId: 'instance-1',
          actorAccountId: 'actor-1',
          activeOrganizationId: 'org-1',
          requestId: 'req-1',
          traceId: 'trace-1',
        },
      actorSubject: 'kc-actor-1',
      keycloakSubject: 'kc-user-1',
      payload: {
        email: 'alice@example.com',
        firstName: 'Alice',
        groupIds: [],
        lastName: 'Example',
        roleIds: [],
      },
    });
    const targetContext = await state.resolveUserMutationTargetContext.mock.results[0]?.value;
    expect(targetContext.identityProvider.provider.updateUser).toHaveBeenCalledWith('kc-user-1', {
      attributes: {
        locale: ['de'],
        mainserverUserApplicationId: ['mainserver-app-1'],
        mainserverUserApplicationSecret: ['mainserver-secret-1'],
      },
    });
    expect(state.emitActivityLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        subjectId: 'user-1',
        eventType: 'user.mainserver_credentials_reprovisioned',
        result: 'success',
      })
    );
    expect(state.completeIdempotency).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: 'POST:/api/v1/iam/users/$userId/reprovision-mainserver',
        idempotencyKey: 'idem-1',
        responseStatus: 200,
        status: 'COMPLETED',
      })
    );
  });

  it('returns not_found when the target user does not exist', async () => {
    state.resolveUserDetail.mockResolvedValue(null);
    const { reprovisionMainserverUserInternal } = await import('./user-reprovision-mainserver-handler.js');

    const response = await reprovisionMainserverUserInternal(
      new Request('http://localhost/api/v1/iam/users/user-1/reprovision-mainserver', {
        method: 'POST',
        body: '{}',
      }),
      {
        sessionId: 'session-1',
        activeOrganizationId: 'org-1',
        user: {
          id: 'kc-actor-1',
          instanceId: 'instance-1',
          roles: ['system_admin'],
        },
      }
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'not_found', message: 'Nutzer nicht gefunden.' },
      requestId: 'req-1',
    });
  });

  it('maps mainserver upstream failures to provisioning diagnostics instead of keycloak errors', async () => {
    const provisioningError = new Error('Zeitüberschreitung beim Provisionieren des Mainserver-Benutzers.') as Error & {
      code: string;
      statusCode: number;
    };
    provisioningError.name = 'MainserverUserProvisioningError';
    provisioningError.code = 'upstream_timeout';
    provisioningError.statusCode = 504;
    state.provisionMainserverUserCredentials.mockRejectedValueOnce(provisioningError);

    const { reprovisionMainserverUserInternal } = await import('./user-reprovision-mainserver-handler.js');

    const response = await reprovisionMainserverUserInternal(
      new Request('http://localhost/api/v1/iam/users/user-1/reprovision-mainserver', {
        method: 'POST',
        body: '{}',
      }),
      {
        sessionId: 'session-1',
        activeOrganizationId: 'org-1',
        user: {
          id: 'kc-actor-1',
          instanceId: 'instance-1',
          roles: ['system_admin'],
        },
      }
    );

    expect(response.status).toBe(504);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'mainserver_provisioning_failed',
        details: {
          dependency: 'sva_mainserver',
          reason_code: 'mainserver_upstream_failure',
          upstream_error_code: 'upstream_timeout',
        },
        message: 'Zeitüberschreitung beim Provisionieren des Mainserver-Benutzers.',
      },
      requestId: 'req-1',
    });
  });

  it('replays stored idempotent responses before reprovisioning again', async () => {
    state.reserveIdempotency.mockResolvedValueOnce({
      status: 'replay',
      responseStatus: 200,
      responseBody: {
        data: { status: 'updated' },
        requestId: 'req-1',
      },
    });

    const { reprovisionMainserverUserInternal } = await import('./user-reprovision-mainserver-handler.js');

    const response = await reprovisionMainserverUserInternal(
      new Request('http://localhost/api/v1/iam/users/user-1/reprovision-mainserver', {
        method: 'POST',
        body: '{}',
      }),
      {
        sessionId: 'session-1',
        activeOrganizationId: 'org-1',
        user: {
          id: 'kc-actor-1',
          instanceId: 'instance-1',
          roles: ['system_admin'],
        },
      }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: { status: 'updated' },
      requestId: 'req-1',
    });
    expect(state.provisionMainserverUserCredentials).not.toHaveBeenCalled();
  });

  it('maps unauthorized mainserver credentials to a non-auth conflict response', async () => {
    const provisioningError = new Error('Mainserver-Zugangsdaten sind ungültig.') as Error & {
      code: string;
      statusCode: number;
    };
    provisioningError.name = 'MainserverUserProvisioningError';
    provisioningError.code = 'unauthorized';
    provisioningError.statusCode = 401;
    state.provisionMainserverUserCredentials.mockRejectedValueOnce(provisioningError);

    const { reprovisionMainserverUserInternal } = await import('./user-reprovision-mainserver-handler.js');

    const response = await reprovisionMainserverUserInternal(
      new Request('http://localhost/api/v1/iam/users/user-1/reprovision-mainserver', {
        method: 'POST',
        body: '{}',
      }),
      {
        sessionId: 'session-1',
        activeOrganizationId: 'org-1',
        user: {
          id: 'kc-actor-1',
          instanceId: 'instance-1',
          roles: ['system_admin'],
        },
      }
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'mainserver_credentials_invalid',
        details: {
          dependency: 'sva_mainserver',
          reason_code: 'mainserver_token_unauthorized',
        },
        message: 'Mainserver-Zugangsdaten sind ungültig.',
      },
      requestId: 'req-1',
    });
  });

  it('marks reserved idempotency keys as failed when target resolution throws before provisioning', async () => {
    state.resolveUserDetail.mockRejectedValueOnce(new Error('db exploded'));
    const { reprovisionMainserverUserInternal } = await import('./user-reprovision-mainserver-handler.js');

    const response = await reprovisionMainserverUserInternal(
      new Request('http://localhost/api/v1/iam/users/user-1/reprovision-mainserver', {
        method: 'POST',
        body: '{}',
      }),
      {
        sessionId: 'session-1',
        activeOrganizationId: 'org-1',
        user: {
          id: 'kc-actor-1',
          instanceId: 'instance-1',
          roles: ['system_admin'],
        },
      }
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'internal_error', message: 'Mainserver-Daten konnten nicht aktualisiert werden.' },
      requestId: 'req-1',
    });
    expect(state.completeIdempotency).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: 'POST:/api/v1/iam/users/$userId/reprovision-mainserver',
        idempotencyKey: 'idem-1',
        responseStatus: 500,
        status: 'FAILED',
      })
    );
    expect(state.provisionMainserverUserCredentials).not.toHaveBeenCalled();
  });
});
