import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  getWorkspaceContext: vi.fn(() => ({ requestId: 'req-1' })),
  resolveUserMutationActor: vi.fn(),
  requireUserId: vi.fn(),
  requireUserMutationIdentityProvider: vi.fn(),
  requireIdempotencyKey: vi.fn(),
  toPayloadHash: vi.fn(() => 'payload-hash'),
  reserveIdempotency: vi.fn(),
  completeIdempotency: vi.fn(async () => undefined),
  withInstanceScopedDb: vi.fn(async (_instanceId: string, work: (client: object) => Promise<unknown>) => work({})),
  resolveUserDetail: vi.fn(),
  resolveActorMaxRoleLevel: vi.fn(async () => 100),
  ensureActorCanManageTarget: vi.fn(() => ({ ok: true })),
  resolveAuthConfigForInstance: vi.fn(),
  trackKeycloakCall: vi.fn(async (_operation: string, execute: () => Promise<unknown>) => execute()),
  emitActivityLog: vi.fn(async () => undefined),
  iamUserOperationsCounter: {
    add: vi.fn(),
  },
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@sva/server-runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@sva/server-runtime')>();
  return {
    ...actual,
    getWorkspaceContext: state.getWorkspaceContext,
    createSdkLogger: () => state.logger,
  };
});

vi.mock('../db.js', () => ({
  jsonResponse: (status: number, payload: unknown) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
}));

vi.mock('../config.js', () => ({
  resolveAuthConfigForInstance: state.resolveAuthConfigForInstance,
}));

vi.mock('./api-helpers.js', () => ({
  createApiError: (status: number, code: string, message: string, requestId?: string) =>
    new Response(
      JSON.stringify({
        error: { code, message },
        ...(requestId ? { requestId } : {}),
      }),
      { status, headers: { 'content-type': 'application/json' } }
    ),
  requireIdempotencyKey: state.requireIdempotencyKey,
  toPayloadHash: state.toPayloadHash,
}));

vi.mock('./shared.js', () => ({
  completeIdempotency: state.completeIdempotency,
  iamUserOperationsCounter: state.iamUserOperationsCounter,
  logger: state.logger,
  reserveIdempotency: state.reserveIdempotency,
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

vi.mock('./user-mutation-request-context.shared.js', () => ({
  requireUserId: state.requireUserId,
  requireUserMutationIdentityProvider: state.requireUserMutationIdentityProvider,
  resolveUserMutationActor: state.resolveUserMutationActor,
}));

vi.mock('./user-detail-query.js', () => ({
  resolveUserDetail: state.resolveUserDetail,
}));

describe('sendPasswordSetupEmailInternal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.resolveUserMutationActor.mockResolvedValue({
      actor: {
        instanceId: 'instance-1',
        actorAccountId: 'actor-1',
        requestId: 'req-1',
        traceId: 'trace-1',
      },
    });
    state.requireUserId.mockReturnValue('user-1');
    state.requireIdempotencyKey.mockReturnValue({ key: 'idem-1' });
    state.reserveIdempotency.mockResolvedValue({ status: 'reserved' });
    state.resolveUserDetail.mockResolvedValue({
      id: 'user-1',
      keycloakSubject: 'kc-user-1',
      displayName: 'Alice Example',
      roles: [],
    });
    state.resolveAuthConfigForInstance.mockResolvedValue({
      clientId: 'sva-studio',
      postLogoutRedirectUri: 'https://tenant.example.test/',
    });
    state.requireUserMutationIdentityProvider.mockResolvedValue({
      provider: {
        executeActionsEmail: vi.fn(async () => undefined),
      },
    });
  });

  it('sends the password setup email and returns sent', async () => {
    const { sendPasswordSetupEmailInternal } = await import('./user-password-setup-email-handler.js');

    const response = await sendPasswordSetupEmailInternal(
      new Request('http://localhost/api/v1/iam/users/user-1/send-password-setup-email', {
        method: 'POST',
        body: '{}',
      }),
      {
        sessionId: 'session-1',
        user: {
          id: 'kc-actor-1',
          instanceId: 'instance-1',
          roles: ['system_admin'],
        },
      }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: { status: 'sent' },
      requestId: 'req-1',
    });
    const identityProvider = await state.requireUserMutationIdentityProvider.mock.results[0]?.value;
    expect(identityProvider.provider.executeActionsEmail).toHaveBeenCalledWith('kc-user-1', {
      actions: ['UPDATE_PASSWORD'],
      clientId: 'sva-studio',
      redirectUri: 'https://tenant.example.test/',
    });
    expect(state.completeIdempotency).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: 'POST:/api/v1/iam/users/$userId/send-password-setup-email',
        responseStatus: 200,
        status: 'COMPLETED',
      })
    );
  });

  it('returns not_found when the target user does not exist', async () => {
    state.resolveUserDetail.mockResolvedValue(null);
    const { sendPasswordSetupEmailInternal } = await import('./user-password-setup-email-handler.js');

    const response = await sendPasswordSetupEmailInternal(
      new Request('http://localhost/api/v1/iam/users/user-1/send-password-setup-email', {
        method: 'POST',
        body: '{}',
      }),
      {
        sessionId: 'session-1',
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
});
