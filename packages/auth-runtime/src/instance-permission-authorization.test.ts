import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  evaluateAuthorizeDecisionMock,
  resolveEffectivePermissionsMock,
} = vi.hoisted(() => ({
  evaluateAuthorizeDecisionMock: vi.fn(),
  resolveEffectivePermissionsMock: vi.fn(),
}));

vi.mock('@sva/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@sva/core')>();
  return {
    ...actual,
    evaluateAuthorizeDecision: evaluateAuthorizeDecisionMock,
  };
});

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  }),
  getWorkspaceContext: () => ({ requestId: 'req-1', traceId: 'trace-1' }),
}));

vi.mock('./iam-authorization/permission-store.js', () => ({
  resolveEffectivePermissions: resolveEffectivePermissionsMock,
}));

const { authorizeInstancePermissionForUser } = await import('./instance-permission-authorization.js');

describe('instance permission authorization', () => {
  beforeEach(() => {
    evaluateAuthorizeDecisionMock.mockReset();
    resolveEffectivePermissionsMock.mockReset();
    evaluateAuthorizeDecisionMock.mockReturnValue({ allowed: true });
    resolveEffectivePermissionsMock.mockResolvedValue({ ok: true, permissions: [] });
  });

  it('authorizes instance-scoped actions for custom-role users through permissions', async () => {
    await expect(
      authorizeInstancePermissionForUser({
        ctx: {
          sessionId: 'session-1',
          user: {
            id: 'subject-1',
            instanceId: 'de-musterhausen',
            roles: ['custom_operator'],
          },
        } as never,
        action: 'integration.manage',
      })
    ).resolves.toMatchObject({
      ok: true,
      actor: {
        instanceId: 'de-musterhausen',
        keycloakSubject: 'subject-1',
      },
    });

    expect(resolveEffectivePermissionsMock).toHaveBeenCalledWith({
      instanceId: 'de-musterhausen',
      keycloakSubject: 'subject-1',
    });
    expect(evaluateAuthorizeDecisionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'de-musterhausen',
        action: 'integration.manage',
        resource: expect.objectContaining({
          type: 'instance',
          id: 'de-musterhausen',
        }),
      }),
      []
    );
  });

  it('fails closed for denied, missing-instance and unavailable permission resolution states', async () => {
    evaluateAuthorizeDecisionMock.mockReturnValueOnce({ allowed: false, reason: 'permission_missing' });
    await expect(
      authorizeInstancePermissionForUser({
        ctx: {
          sessionId: 'session-1',
          user: {
            id: 'subject-1',
            instanceId: 'de-musterhausen',
            roles: ['app_manager'],
          },
        } as never,
        action: 'integration.manage',
      })
    ).resolves.toMatchObject({
      ok: false,
      status: 403,
      error: 'forbidden',
    });

    await expect(
      authorizeInstancePermissionForUser({
        ctx: {
          sessionId: 'session-1',
          user: {
            id: 'subject-1',
            roles: ['custom_operator'],
          },
        } as never,
        action: 'integration.manage',
      })
    ).resolves.toMatchObject({
      ok: false,
      status: 400,
      error: 'missing_instance',
    });

    resolveEffectivePermissionsMock.mockResolvedValueOnce({ ok: false, error: 'db' });
    await expect(
      authorizeInstancePermissionForUser({
        ctx: {
          sessionId: 'session-1',
          user: {
            id: 'subject-1',
            instanceId: 'de-musterhausen',
            roles: ['custom_operator'],
          },
        } as never,
        action: 'integration.manage',
      })
    ).resolves.toMatchObject({
      ok: false,
      status: 503,
      error: 'database_unavailable',
    });
  });
});
