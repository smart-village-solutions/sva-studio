import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { EffectivePermission } from '@sva/core';
import type { AuthenticatedRequestContext } from '../middleware.js';

const {
  accountLogger,
  evaluateAuthorizeDecisionMock,
  getWorkspaceContextMock,
  getSessionMock,
  resolveActorAccountIdWithProvisionMock,
  resolveEffectivePermissionsMock,
} = vi.hoisted(() => ({
    accountLogger: {
      error: vi.fn(),
      warn: vi.fn(),
    },
    evaluateAuthorizeDecisionMock: vi.fn(),
    getWorkspaceContextMock: vi.fn(),
    getSessionMock: vi.fn(),
    resolveActorAccountIdWithProvisionMock: vi.fn(),
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
  getWorkspaceContext: getWorkspaceContextMock,
}));

vi.mock('../iam-authorization/permission-store.js', () => ({
  resolveEffectivePermissions: resolveEffectivePermissionsMock,
}));

vi.mock('../redis-session.js', () => ({
  getSession: getSessionMock,
}));

vi.mock('../iam-account-management/shared-actor-resolution-helpers.js', () => ({
  resolveActorAccountIdWithProvision: resolveActorAccountIdWithProvisionMock,
}));

vi.mock('../iam-account-management/shared.js', () => ({
  logger: accountLogger,
}));

const { authorizeContentPrimitiveForUser } = await import('./server-authorization.js');

const permission: EffectivePermission = {
  action: 'content.read',
  resourceType: 'content',
  };

const scopedPermission: EffectivePermission = {
  action: 'news.read',
  resourceType: 'news',
  organizationId: '11111111-1111-4111-8111-111111111111',
  accessScope: 'organization',
};

const createCtx = (instanceId: string = 'instance-1'): AuthenticatedRequestContext => {
  return {
    sessionId: 'session-1',
    user: {
      id: 'subject-1',
      email: 'editor@example.test',
      name: 'Editor',
      roles: [],
      ...(instanceId ? { instanceId } : {}),
    },
  } as AuthenticatedRequestContext;
};

describe('authorizeContentPrimitiveForUser', () => {
  beforeEach(() => {
    accountLogger.error.mockReset();
    accountLogger.warn.mockReset();
    evaluateAuthorizeDecisionMock.mockReset();
    getWorkspaceContextMock.mockReset();
    getSessionMock.mockReset();
    resolveActorAccountIdWithProvisionMock.mockReset();
    resolveEffectivePermissionsMock.mockReset();

    getWorkspaceContextMock.mockReturnValue({ requestId: 'request-1', traceId: 'trace-1' });
    getSessionMock.mockResolvedValue(undefined);
    resolveActorAccountIdWithProvisionMock.mockResolvedValue('account-1');
    resolveEffectivePermissionsMock.mockResolvedValue({ ok: true, permissions: [permission] });
    evaluateAuthorizeDecisionMock.mockReturnValue({ allowed: true });
  });

  it('denies requests without an instance context before loading permissions', async () => {
    await expect(
      authorizeContentPrimitiveForUser({
        ctx: createCtx(''),
        action: 'content.read',
      })
    ).resolves.toEqual({
      ok: false,
      status: 400,
      error: 'missing_instance',
      message: 'Kein Instanzkontext für diese Inhaltsoperation vorhanden.',
    });

    expect(resolveEffectivePermissionsMock).not.toHaveBeenCalled();
    expect(evaluateAuthorizeDecisionMock).not.toHaveBeenCalled();
  });

  it('rejects malformed actions before permissions are loaded', async () => {
    await expect(
      authorizeContentPrimitiveForUser({
        ctx: createCtx(),
        action: 'invalid-action-without-namespace',
      })
    ).resolves.toEqual({
      ok: false,
      status: 400,
      error: 'invalid_action',
      message: 'Ungültige Action für diese Inhaltsoperation.',
    });

    expect(resolveEffectivePermissionsMock).not.toHaveBeenCalled();
    expect(evaluateAuthorizeDecisionMock).not.toHaveBeenCalled();
  });

  it('normalizes surrounding whitespace for valid action identifiers', async () => {
    await expect(
      authorizeContentPrimitiveForUser({
        ctx: createCtx(),
        action: '  content.read  ',
      })
    ).resolves.toMatchObject({
      ok: true,
      permissions: [permission],
    });

    expect(evaluateAuthorizeDecisionMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'content.read' }),
      [permission]
    );
  });

  it('resolves local permissions and returns the authorized actor', async () => {
    await expect(
      authorizeContentPrimitiveForUser({
        ctx: createCtx(),
        action: 'content.updatePayload',
        resource: {
          contentId: 'news-1',
          contentType: 'news.article',
          organizationId: '11111111-1111-4111-8111-111111111111',
        },
      })
    ).resolves.toEqual({
      ok: true,
      actor: {
        instanceId: 'instance-1',
        keycloakSubject: 'subject-1',
        organizationId: '11111111-1111-4111-8111-111111111111',
      },
      permissions: [permission],
    });

    expect(resolveEffectivePermissionsMock).toHaveBeenCalledWith({
      instanceId: 'instance-1',
      keycloakSubject: 'subject-1',
      organizationId: '11111111-1111-4111-8111-111111111111',
    });
    expect(evaluateAuthorizeDecisionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'instance-1',
        action: 'content.updatePayload',
        resource: expect.objectContaining({
          type: 'content',
          id: 'news-1',
          organizationId: '11111111-1111-4111-8111-111111111111',
          attributes: expect.objectContaining({
            contentType: 'news.article',
          }),
        }),
        context: expect.objectContaining({
          requestId: 'request-1',
          traceId: 'trace-1',
          organizationId: '11111111-1111-4111-8111-111111111111',
          attributes: expect.objectContaining({
            contentType: 'news.article',
          }),
        }),
      }),
      [permission]
    );
  });

  it('uses the active organization from the session when the caller omits organizationId', async () => {
    getSessionMock.mockResolvedValueOnce({
      id: 'session-1',
      userId: 'user-1',
      createdAt: Date.now(),
      activeOrganizationId: '11111111-1111-4111-8111-111111111111',
    });

    await expect(
      authorizeContentPrimitiveForUser({
        ctx: createCtx(),
        action: 'news.read',
        resource: {
          contentType: 'news.article',
        },
      })
    ).resolves.toEqual({
      ok: true,
      actor: {
        instanceId: 'instance-1',
        keycloakSubject: 'subject-1',
        organizationId: '11111111-1111-4111-8111-111111111111',
      },
      permissions: [permission],
    });

    expect(resolveEffectivePermissionsMock).toHaveBeenCalledWith({
      instanceId: 'instance-1',
      keycloakSubject: 'subject-1',
      organizationId: '11111111-1111-4111-8111-111111111111',
    });
    expect(evaluateAuthorizeDecisionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'news.read',
        resource: expect.objectContaining({
          type: 'news',
          organizationId: '11111111-1111-4111-8111-111111111111',
          attributes: expect.objectContaining({
            contentType: 'news.article',
            organizationId: '11111111-1111-4111-8111-111111111111',
          }),
        }),
        context: expect.objectContaining({
          organizationId: '11111111-1111-4111-8111-111111111111',
        }),
      }),
      [permission]
    );
  });

  it('falls back to account-wide authorization when no organization context is available', async () => {
    resolveEffectivePermissionsMock.mockResolvedValueOnce({
      ok: true,
      permissions: [scopedPermission],
    });
    evaluateAuthorizeDecisionMock
      .mockReturnValueOnce({ allowed: false, reason: 'permission_missing' })
      .mockReturnValueOnce({ allowed: true });

    await expect(
      authorizeContentPrimitiveForUser({
        ctx: createCtx(),
        action: 'news.read',
        resource: {
          contentType: 'news.article',
        },
      })
    ).resolves.toEqual({
      ok: true,
      actor: {
        instanceId: 'instance-1',
        keycloakSubject: 'subject-1',
      },
      permissions: [scopedPermission],
    });

    expect(resolveEffectivePermissionsMock).toHaveBeenCalledWith({
      instanceId: 'instance-1',
      keycloakSubject: 'subject-1',
      organizationId: undefined,
    });
    expect(evaluateAuthorizeDecisionMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        action: 'news.read',
        resource: expect.objectContaining({
          type: 'news',
        }),
        context: expect.objectContaining({
          requestId: 'request-1',
          traceId: 'trace-1',
          attributes: expect.objectContaining({
            contentType: 'news.article',
          }),
        }),
      }),
      [scopedPermission]
    );
    expect(evaluateAuthorizeDecisionMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        action: 'news.read',
      }),
      [
        expect.objectContaining({
          action: 'news.read',
          resourceType: 'news',
          organizationId: undefined,
          accessScope: undefined,
        }),
      ]
    );
  });

  it('does not retry the organization-optional fallback when the primary decision already allowed', async () => {
    resolveEffectivePermissionsMock.mockResolvedValueOnce({
      ok: true,
      permissions: [scopedPermission],
    });

    await expect(
      authorizeContentPrimitiveForUser({
        ctx: createCtx(),
        action: 'news.read',
        resource: {
          contentType: 'news.article',
        },
      })
    ).resolves.toMatchObject({
      ok: true,
      permissions: [scopedPermission],
    });

    expect(evaluateAuthorizeDecisionMock).toHaveBeenCalledTimes(1);
  });

  it('does not widen organization-scoped permissions for non-opted-in content types', async () => {
    resolveEffectivePermissionsMock.mockResolvedValueOnce({
      ok: true,
      permissions: [scopedPermission],
    });
    evaluateAuthorizeDecisionMock.mockReturnValueOnce({ allowed: false, reason: 'permission_missing' });

    await expect(
      authorizeContentPrimitiveForUser({
        ctx: createCtx(),
        action: 'content.read',
        resource: {
          contentType: 'custom.secure-record',
        },
      })
    ).resolves.toEqual({
      ok: false,
      status: 403,
      error: 'forbidden',
      message: 'Keine Berechtigung für diese Inhaltsoperation.',
    });

    expect(evaluateAuthorizeDecisionMock).toHaveBeenCalledTimes(1);
  });

  it('does not widen organization-scoped permissions for non-read actions without organization context', async () => {
    resolveEffectivePermissionsMock.mockResolvedValueOnce({
      ok: true,
      permissions: [scopedPermission],
    });
    evaluateAuthorizeDecisionMock.mockReturnValueOnce({ allowed: false, reason: 'permission_missing' });

    await expect(
      authorizeContentPrimitiveForUser({
        ctx: createCtx(),
        action: 'poi.update',
        resource: {
          contentType: 'poi.point-of-interest',
          contentId: 'poi-1',
        },
      })
    ).resolves.toEqual({
      ok: false,
      status: 403,
      error: 'forbidden',
      message: 'Keine Berechtigung für diese Inhaltsoperation.',
    });

    expect(evaluateAuthorizeDecisionMock).toHaveBeenCalledTimes(1);
  });

  it('adds the resolved actorAccountId for ownership-based authorization checks', async () => {
    await expect(
      authorizeContentPrimitiveForUser({
        ctx: createCtx(),
        action: 'content.read',
        resource: {
          contentType: 'news.article',
          ownerUserId: 'account-1',
        },
      })
    ).resolves.toMatchObject({
      ok: true,
      permissions: [permission],
    });

    expect(resolveActorAccountIdWithProvisionMock).toHaveBeenCalledWith({
      instanceId: 'instance-1',
      keycloakSubject: 'subject-1',
      requestId: 'request-1',
      traceId: 'trace-1',
      mayProvisionMissingActorMembership: false,
    });
    expect(evaluateAuthorizeDecisionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: expect.objectContaining({
          attributes: expect.objectContaining({
            ownerUserId: 'account-1',
          }),
        }),
        context: expect.objectContaining({
          attributes: expect.objectContaining({
            actorAccountId: 'account-1',
            contentType: 'news.article',
          }),
        }),
      }),
      [permission]
    );
  });

  it('uses provided permissions without resolving them again', async () => {
    await expect(
      authorizeContentPrimitiveForUser({
        ctx: createCtx(),
        action: 'content.delete',
        permissions: [permission],
      })
    ).resolves.toMatchObject({ ok: true, permissions: [permission] });

    expect(resolveEffectivePermissionsMock).not.toHaveBeenCalled();
  });

  it('maps permission-store failures to database_unavailable', async () => {
    resolveEffectivePermissionsMock.mockResolvedValueOnce({ ok: false, error: 'db down' });

    await expect(
      authorizeContentPrimitiveForUser({
        ctx: createCtx(),
        action: 'content.read',
      })
    ).resolves.toMatchObject({
      ok: false,
      status: 503,
      error: 'database_unavailable',
    });

    expect(accountLogger.error).toHaveBeenCalledWith(
      'Content primitive authorization resolution failed',
      expect.objectContaining({ error: 'db down' })
    );
  });

  it('maps session lookup failures to database_unavailable', async () => {
    getSessionMock.mockRejectedValueOnce(new Error('session unavailable'));

    await expect(
      authorizeContentPrimitiveForUser({
        ctx: createCtx(),
        action: 'content.read',
      })
    ).resolves.toMatchObject({
      ok: false,
      status: 503,
      error: 'database_unavailable',
    });

    expect(resolveEffectivePermissionsMock).not.toHaveBeenCalled();
    expect(accountLogger.error).toHaveBeenCalledWith(
      'Content primitive authorization session lookup failed',
      expect.objectContaining({ error: 'session unavailable' })
    );
  });

  it('maps thrown permission-store errors to database_unavailable', async () => {
    resolveEffectivePermissionsMock.mockRejectedValueOnce(new Error('connection lost'));

    await expect(
      authorizeContentPrimitiveForUser({
        ctx: createCtx(),
        action: 'content.read',
      })
    ).resolves.toMatchObject({
      ok: false,
      status: 503,
      error: 'database_unavailable',
    });

    expect(accountLogger.error).toHaveBeenCalledWith(
      'Content primitive authorization failed',
      expect.objectContaining({ error: 'connection lost' })
    );
  });

  it('maps actor account lookup errors to database_unavailable when ownership context is required', async () => {
    resolveActorAccountIdWithProvisionMock.mockRejectedValueOnce(new Error('lookup failed'));

    await expect(
      authorizeContentPrimitiveForUser({
        ctx: createCtx(),
        action: 'content.read',
        resource: {
          ownerUserId: 'account-1',
        },
      })
    ).resolves.toMatchObject({
      ok: false,
      status: 503,
      error: 'database_unavailable',
    });

    expect(accountLogger.error).toHaveBeenCalledWith(
      'Content primitive authorization actor resolution failed',
      expect.objectContaining({ error: 'lookup failed' })
    );
    expect(evaluateAuthorizeDecisionMock).not.toHaveBeenCalled();
  });

  it('returns forbidden when the core authorization decision denies the action', async () => {
    evaluateAuthorizeDecisionMock.mockReturnValueOnce({ allowed: false, reason: 'missing_permission' });

    await expect(
      authorizeContentPrimitiveForUser({
        ctx: createCtx(),
        action: 'content.create',
        resource: { contentType: 'news.article' },
      })
    ).resolves.toEqual({
      ok: false,
      status: 403,
      error: 'forbidden',
      message: 'Keine Berechtigung für diese Inhaltsoperation.',
    });

    expect(accountLogger.warn).toHaveBeenCalledWith(
      'Content primitive authorization denied',
      expect.objectContaining({
        action: 'content.create',
        content_type: 'news.article',
        reason: 'missing_permission',
      })
    );
  });
});
