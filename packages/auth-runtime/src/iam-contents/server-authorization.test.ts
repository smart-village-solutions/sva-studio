import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { EffectivePermission } from '@sva/core';
import type { AuthenticatedRequestContext } from '../middleware.js';

const { accountLogger, evaluateAuthorizeDecisionMock, getWorkspaceContextMock, resolveEffectivePermissionsMock } =
  vi.hoisted(() => ({
    accountLogger: {
      error: vi.fn(),
      warn: vi.fn(),
    },
    evaluateAuthorizeDecisionMock: vi.fn(),
    getWorkspaceContextMock: vi.fn(),
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

vi.mock('../iam-account-management/shared.js', () => ({
  logger: accountLogger,
}));

const { authorizeContentPrimitiveForUser } = await import('./server-authorization.js');

const permission: EffectivePermission = {
  action: 'content.read',
  resourceType: 'content',
  effect: 'allow',
};

const createCtx = (instanceId?: string): AuthenticatedRequestContext =>
  ({
    user: {
      id: 'subject-1',
      email: 'editor@example.test',
      name: 'Editor',
      roles: [],
      ...(instanceId === undefined ? { instanceId: 'instance-1' } : instanceId ? { instanceId } : {}),
    },
  }) as AuthenticatedRequestContext;

describe('authorizeContentPrimitiveForUser', () => {
  beforeEach(() => {
    accountLogger.error.mockReset();
    accountLogger.warn.mockReset();
    evaluateAuthorizeDecisionMock.mockReset();
    getWorkspaceContextMock.mockReset();
    resolveEffectivePermissionsMock.mockReset();

    getWorkspaceContextMock.mockReturnValue({ requestId: 'request-1', traceId: 'trace-1' });
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
          attributes: { contentType: 'news.article' },
        }),
        context: expect.objectContaining({
          requestId: 'request-1',
          traceId: 'trace-1',
          organizationId: '11111111-1111-4111-8111-111111111111',
          attributes: { contentType: 'news.article' },
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
