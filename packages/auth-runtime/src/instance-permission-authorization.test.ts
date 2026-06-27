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

const { authorizeInstancePermissionForUser, toInstancePermissionApiErrorCode } = await import(
  './instance-permission-authorization.js'
);

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
          type: 'integration',
          id: 'de-musterhausen',
        }),
      }),
      []
    );
  });

  it('accepts multi-segment iam actions and maps them to the iam resource family', async () => {
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
        action: 'iam.user.read',
      })
    ).resolves.toMatchObject({
      ok: true,
    });

    expect(evaluateAuthorizeDecisionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'iam.user.read',
        resource: expect.objectContaining({
          type: 'iam',
          id: 'de-musterhausen',
        }),
      }),
      []
    );
  });

  it('accepts camelCase action families used by tenant iam modules', async () => {
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
        action: 'iam.legalText.read',
      })
    ).resolves.toMatchObject({
      ok: true,
    });

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
        action: 'iam.deletionRules.read',
      })
    ).resolves.toMatchObject({
      ok: true,
    });

    expect(evaluateAuthorizeDecisionMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        action: 'iam.legalText.read',
        resource: expect.objectContaining({
          type: 'iam',
          id: 'de-musterhausen',
        }),
      }),
      []
    );
    expect(evaluateAuthorizeDecisionMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        action: 'iam.deletionRules.read',
        resource: expect.objectContaining({
          type: 'iam',
          id: 'de-musterhausen',
        }),
      }),
      []
    );
  });

  it('rejects malformed action ids', async () => {
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
        action: 'invalid action',
      })
    ).resolves.toMatchObject({
      ok: false,
      status: 400,
      error: 'invalid_action',
    });

    expect(evaluateAuthorizeDecisionMock).not.toHaveBeenCalled();
  });

  it('maps internal authorization errors to stable API error codes', () => {
    expect(toInstancePermissionApiErrorCode('missing_instance')).toBe('invalid_instance_id');
    expect(toInstancePermissionApiErrorCode('invalid_action')).toBe('invalid_request');
    expect(toInstancePermissionApiErrorCode('database_unavailable')).toBe('database_unavailable');
    expect(toInstancePermissionApiErrorCode('forbidden')).toBe('forbidden');
  });

  it('uses injected permissions and trims valid action ids before authorization', async () => {
    const permissions = [
      {
        action: 'integration.manage',
      },
    ] as never;

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
        action: '  integration.manage  ',
        permissions,
      })
    ).resolves.toMatchObject({
      ok: true,
      actor: {
        instanceId: 'de-musterhausen',
        keycloakSubject: 'subject-1',
      },
    });

    expect(resolveEffectivePermissionsMock).not.toHaveBeenCalled();
    expect(evaluateAuthorizeDecisionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'integration.manage',
        resource: expect.objectContaining({
          type: 'integration',
          id: 'de-musterhausen',
        }),
      }),
      permissions
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
            roles: ['custom_operator'],
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

  it('fails closed when effective permission resolution throws unexpectedly', async () => {
    resolveEffectivePermissionsMock.mockRejectedValueOnce(new Error('boom'));

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
