import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  evaluateAuthorizeDecisionMock,
  summarizeContentAccessMock,
  resolveEffectivePermissionsMock,
  ensureFeatureMock,
  requireRolesMock,
  resolveActorInfoMock,
  withAuthenticatedUserMock,
  getSessionMock,
  toJsonErrorResponseMock,
} = vi.hoisted(() => ({
  evaluateAuthorizeDecisionMock: vi.fn(),
  summarizeContentAccessMock: vi.fn(),
  resolveEffectivePermissionsMock: vi.fn(),
  ensureFeatureMock: vi.fn(),
  requireRolesMock: vi.fn(),
  resolveActorInfoMock: vi.fn(),
  withAuthenticatedUserMock: vi.fn(),
  getSessionMock: vi.fn(),
  toJsonErrorResponseMock: vi.fn((status, code, message, options) =>
    new Response(JSON.stringify({ error: { code, message }, requestId: options?.requestId }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  ),
}));

vi.mock('@sva/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@sva/core')>();
  return {
    ...actual,
    evaluateAuthorizeDecision: evaluateAuthorizeDecisionMock,
    summarizeContentAccess: summarizeContentAccessMock,
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
  toJsonErrorResponse: toJsonErrorResponseMock,
  withRequestContext: async (_input: unknown, work: () => Promise<unknown>) => work(),
}));

vi.mock('../iam-authorization/permission-store.js', () => ({
  resolveEffectivePermissions: resolveEffectivePermissionsMock,
}));

vi.mock('../iam-account-management/feature-flags.js', () => ({
  ensureFeature: ensureFeatureMock,
  getFeatureFlags: () => ({}),
}));

vi.mock('../iam-account-management/shared.js', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
  requireRoles: requireRolesMock,
  resolveActorInfo: resolveActorInfoMock,
}));

vi.mock('../middleware.js', () => ({
  withAuthenticatedUser: withAuthenticatedUserMock,
}));

vi.mock('../redis-session.js', () => ({
  getSession: getSessionMock,
}));

const {
  authorizeContentAction,
  resolveContentAccess,
  resolveContentActor,
  resolveContentAuthorizationPermissions,
  withAuthenticatedContentHandler,
} = await import('./request-context.js');

describe('content request authorization context', () => {
  beforeEach(() => {
    evaluateAuthorizeDecisionMock.mockReset();
    summarizeContentAccessMock.mockReset();
    resolveEffectivePermissionsMock.mockReset();
    ensureFeatureMock.mockReset();
    requireRolesMock.mockReset();
    resolveActorInfoMock.mockReset();
    withAuthenticatedUserMock.mockReset();
    getSessionMock.mockReset();
    toJsonErrorResponseMock.mockClear();
    resolveEffectivePermissionsMock.mockResolvedValue({ ok: true, permissions: [] });
    evaluateAuthorizeDecisionMock.mockReturnValue({ allowed: true });
    summarizeContentAccessMock.mockReturnValue({
      state: 'granted',
      canRead: true,
      canCreate: true,
      canUpdate: true,
      reasonCode: 'granted',
      organizationIds: ['org-1'],
      sourceKinds: ['role'],
    });
    ensureFeatureMock.mockReturnValue(null);
    requireRolesMock.mockReturnValue(null);
    resolveActorInfoMock.mockResolvedValue({
      actor: {
        instanceId: 'instance-1',
        actorAccountId: 'account-1',
        requestId: 'req-1',
        traceId: 'trace-1',
      },
    });
    withAuthenticatedUserMock.mockImplementation(async (_request, handler) =>
      handler({ sessionId: 'session-1', user: { id: 'subject-1', roles: ['editor'], instanceId: 'instance-1' } })
    );
    getSessionMock.mockResolvedValue({ activeOrganizationId: 'org-1' });
  });

  it('preserves the active organization scope when resource context is omitted', async () => {
    await expect(
      authorizeContentAction(
        {
          instanceId: 'instance-1',
          keycloakSubject: 'subject-1',
          actorDisplayName: 'Actor',
          activeOrganizationId: '11111111-1111-1111-8111-111111111111',
        },
        'content.read'
      )
    ).resolves.toBeNull();

    expect(resolveEffectivePermissionsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: '11111111-1111-1111-8111-111111111111',
      })
    );
    expect(evaluateAuthorizeDecisionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: expect.objectContaining({
          organizationId: '11111111-1111-1111-8111-111111111111',
        }),
        context: expect.objectContaining({
          organizationId: '11111111-1111-1111-8111-111111111111',
        }),
      }),
      []
    );
  });

  it('prefers explicit resource organization over active organization scope', async () => {
    await expect(
      authorizeContentAction(
        {
          instanceId: 'instance-1',
          keycloakSubject: 'subject-1',
          actorDisplayName: 'Actor',
          activeOrganizationId: '11111111-1111-1111-8111-111111111111',
        },
        'content.updateMetadata',
        { organizationId: '22222222-2222-4222-8222-222222222222' }
      )
    ).resolves.toBeNull();

    expect(resolveEffectivePermissionsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: '22222222-2222-4222-8222-222222222222',
      })
    );
  });

  it('uses the plugin resource type for plugin-scoped read actions', async () => {
    await expect(
      authorizeContentAction(
        {
          instanceId: 'instance-1',
          keycloakSubject: 'subject-1',
          actorDisplayName: 'Actor',
          activeOrganizationId: '11111111-1111-1111-8111-111111111111',
        },
        'news.read',
        {
          contentId: 'content-1',
          contentType: 'news.article',
        }
      )
    ).resolves.toBeNull();

    expect(evaluateAuthorizeDecisionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'news.read',
        resource: expect.objectContaining({
          type: 'news',
          id: 'content-1',
        }),
      }),
      []
    );
  });

  it('returns forbidden and database_unavailable responses for denied or failing authorization checks', async () => {
    evaluateAuthorizeDecisionMock.mockReturnValueOnce({ allowed: false, reason: 'denied' });
    const denied = await authorizeContentAction(
      {
        instanceId: 'instance-1',
        keycloakSubject: 'subject-1',
        actorDisplayName: 'Actor',
      },
      'content.read',
      { contentId: 'content-1', domainCapability: 'content.read' }
    );
    expect(denied?.status).toBe(403);

    resolveEffectivePermissionsMock.mockResolvedValueOnce({ ok: false, error: 'db' });
    const unavailable = await resolveContentAuthorizationPermissions({
      instanceId: 'instance-1',
      keycloakSubject: 'subject-1',
      actorDisplayName: 'Actor',
      requestId: 'req-1',
    });
    expect('error' in unavailable && unavailable.error.status).toBe(503);

    resolveEffectivePermissionsMock.mockRejectedValueOnce(new Error('db down'));
    const thrown = await authorizeContentAction(
      {
        instanceId: 'instance-1',
        keycloakSubject: 'subject-1',
        actorDisplayName: 'Actor',
        requestId: 'req-1',
      },
      'content.read'
    );
    expect(thrown?.status).toBe(503);
  });

  it('summarizes content access and fail-closes on permission lookup failures', async () => {
    await expect(
      resolveContentAccess({
        instanceId: 'instance-1',
        keycloakSubject: 'subject-1',
        actorDisplayName: 'Actor',
        activeOrganizationId: 'org-1',
      })
    ).resolves.toMatchObject({ state: 'granted', canRead: true });

    resolveEffectivePermissionsMock.mockResolvedValueOnce({ ok: false, error: 'db' });
    await expect(
      resolveContentAccess({
        instanceId: 'instance-1',
        keycloakSubject: 'subject-1',
        actorDisplayName: 'Actor',
      })
    ).resolves.toMatchObject({ state: 'blocked', reasonCode: 'context_restricted' });
  });

  it('wraps authenticated content handlers and converts unexpected failures to stable json errors', async () => {
    const success = await withAuthenticatedContentHandler(new Request('https://example.test/content'), async () =>
      new Response('ok', { status: 200 })
    );
    expect(success.status).toBe(200);

    withAuthenticatedUserMock.mockImplementationOnce(async () => {
      throw new Error('boom');
    });
    const failure = await withAuthenticatedContentHandler(new Request('https://example.test/content'), async () =>
      new Response('ok', { status: 200 })
    );
    expect(failure.status).toBe(500);
    await expect(failure.json()).resolves.toMatchObject({
      error: { code: 'internal_error', message: 'Unbehandelter Inhaltsfehler.' },
      requestId: 'req-1',
    });
  });

  it('resolves content actors and enforces feature and actor-account requirements without legacy role gates', async () => {
    await expect(
      resolveContentActor(new Request('https://example.test/content'), {
        sessionId: 'session-1',
        user: { id: 'subject-1', roles: ['viewer'], instanceId: 'instance-1' },
      } as never)
    ).resolves.toMatchObject({
      actor: {
        instanceId: 'instance-1',
        actorAccountId: 'account-1',
        activeOrganizationId: 'org-1',
      },
    });
    expect(requireRolesMock).not.toHaveBeenCalled();

    ensureFeatureMock.mockReturnValueOnce(new Response('disabled', { status: 451 }));
    await expect(
      resolveContentActor(new Request('https://example.test/content'), {
        sessionId: 'session-1',
        user: { id: 'subject-1', roles: ['editor'], instanceId: 'instance-1' },
      } as never)
    ).resolves.toMatchObject({ error: expect.objectContaining({ status: 451 }) });

    resolveActorInfoMock.mockResolvedValueOnce({ error: new Response('db', { status: 503 }) });
    await expect(
      resolveContentActor(new Request('https://example.test/content'), {
        sessionId: 'session-1',
        user: { id: 'subject-1', roles: ['editor'], instanceId: 'instance-1' },
      } as never)
    ).resolves.toMatchObject({ error: expect.objectContaining({ status: 503 }) });

    resolveActorInfoMock.mockResolvedValueOnce({
      actor: {
        instanceId: 'instance-1',
        actorAccountId: undefined,
        requestId: 'req-1',
      },
    });
    const missingAccount = await resolveContentActor(
      new Request('https://example.test/content'),
      {
        sessionId: 'session-1',
        user: { id: 'subject-1', roles: ['editor'], instanceId: 'instance-1' },
      } as never,
      { requireActorAccountId: true }
    );
    expect('error' in missingAccount && missingAccount.error.status).toBe(403);
  });
});
