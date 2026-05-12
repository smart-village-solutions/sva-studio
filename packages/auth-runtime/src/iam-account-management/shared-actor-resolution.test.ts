import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  getWorkspaceContextMock: vi.fn(() => ({ requestId: 'req-1', traceId: 'trace-1' })),
  resolveInstanceIdMock: vi.fn(),
  readInstanceIdFromRequestMock: vi.fn(),
  createApiErrorMock: vi.fn((status, code, message, requestId, details) =>
    new Response(JSON.stringify({ error: { code, message, details }, requestId }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  ),
  annotateActiveSpanMock: vi.fn(),
  addActiveSpanEventMock: vi.fn(),
  createInstanceLookupErrorMock: vi.fn(),
  createMissingActorMembershipErrorMock: vi.fn(),
  resolveActorAccountIdWithProvisionMock: vi.fn(),
  resolveMissingActorDiagnosticReasonMock: vi.fn(),
  loggerWarnMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  getWorkspaceContext: state.getWorkspaceContextMock,
}));

vi.mock('@sva/iam-admin', () => ({
  resolveActorAccountId: vi.fn(),
}));

vi.mock('../shared/instance-id-resolution.js', () => ({
  resolveInstanceId: state.resolveInstanceIdMock,
}));

vi.mock('./api-helpers.js', () => ({
  createApiError: state.createApiErrorMock,
  readInstanceIdFromRequest: state.readInstanceIdFromRequestMock,
}));

vi.mock('./diagnostics.js', () => ({
  annotateActiveSpan: state.annotateActiveSpanMock,
  addActiveSpanEvent: state.addActiveSpanEventMock,
}));

vi.mock('./shared-actor-resolution-helpers.js', () => ({
  createInstanceLookupError: state.createInstanceLookupErrorMock,
  createMissingActorMembershipError: state.createMissingActorMembershipErrorMock,
  resolveActorAccountIdWithProvision: state.resolveActorAccountIdWithProvisionMock,
  resolveMissingActorDiagnosticReason: state.resolveMissingActorDiagnosticReasonMock,
}));

vi.mock('./shared-observability.js', () => ({
  logger: {
    warn: state.loggerWarnMock,
    error: state.loggerErrorMock,
  },
}));

vi.mock('./shared-runtime.js', () => ({
  resolvePool: vi.fn(),
}));

type AuthenticatedRequestContext = {
  user: {
    id: string;
    instanceId?: string;
    roles: string[];
  };
};

const baseCtx: AuthenticatedRequestContext = {
  user: {
    id: 'kc-user-1',
    instanceId: 'tenant-a',
    roles: ['editor'],
  },
};

describe('shared actor resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    state.readInstanceIdFromRequestMock.mockImplementation((_request: Request, fallback?: string) => fallback);
    state.resolveInstanceIdMock.mockResolvedValue({
      ok: true,
      instanceId: 'tenant-a',
      fromInstanceKey: true,
      created: true,
    });
    state.createInstanceLookupErrorMock.mockReturnValue({
      status: 400,
      code: 'invalid_instance_id',
      message: 'Ungültige oder fehlende instanceId.',
    });
    state.resolveActorAccountIdWithProvisionMock.mockResolvedValue('account-1');
    state.resolveMissingActorDiagnosticReasonMock.mockResolvedValue('missing_actor_account');
    state.createMissingActorMembershipErrorMock.mockReturnValue({
      error: new Response(JSON.stringify({ error: 'forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
    });
  });

  it('allows requests when one required role is present', async () => {
    const { requireRoles } = await import('./shared-actor-resolution.js');

    const result = requireRoles(baseCtx as never, new Set(['editor', 'support_admin']), 'req-1');

    expect(result).toBeNull();
    expect(state.createApiErrorMock).not.toHaveBeenCalled();
  });

  it('rejects requests without required roles and records diagnostics', async () => {
    const { requireRoles } = await import('./shared-actor-resolution.js');

    const result = requireRoles(baseCtx as never, new Set(['support_admin']), 'req-1');

    expect(result?.status).toBe(403);
    expect(state.annotateActiveSpanMock).toHaveBeenCalledWith({
      'iam.actor_roles': 'editor',
      'iam.reason_code': 'missing_required_role',
      'iam.required_roles': 'support_admin',
    });
    expect(state.addActiveSpanEventMock).toHaveBeenCalledWith('iam.role_guard_rejected', {
      'iam.reason_code': 'missing_required_role',
    });
    expect(state.loggerWarnMock).toHaveBeenCalledWith(
      'IAM role guard rejected request',
      expect.objectContaining({
        required_roles: ['support_admin'],
        user_roles: ['editor'],
      })
    );
  });

  it('returns the requested instance directly when no instance creation from key is requested', async () => {
    const { resolveActorInfo } = await import('./shared-actor-resolution.js');

    state.readInstanceIdFromRequestMock.mockReturnValue('tenant-requested');

    const result = await resolveActorInfo(
      new Request('http://localhost/path?instanceId=tenant-requested'),
      { user: { ...baseCtx.user, instanceId: 'tenant-session' } } as never
    );

    expect(state.resolveInstanceIdMock).not.toHaveBeenCalled();
    expect(state.resolveActorAccountIdWithProvisionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'tenant-requested',
        mayProvisionMissingActorMembership: false,
      })
    );
    expect(result).toEqual({
      actor: {
        instanceId: 'tenant-requested',
        requestId: 'req-1',
        traceId: 'trace-1',
        actorAccountId: 'account-1',
      },
    });
  });

  it('resolves instance ids via trusted keys when enabled and explicitly requested', async () => {
    const { resolveActorInfo } = await import('./shared-actor-resolution.js');

    state.readInstanceIdFromRequestMock.mockReturnValue('tenant-key');
    state.resolveInstanceIdMock.mockResolvedValueOnce({
      ok: true,
      instanceId: 'tenant-created',
      fromInstanceKey: true,
      created: true,
    });

    const result = await resolveActorInfo(
      new Request('http://localhost/path?instanceId=tenant-key'),
      { user: { ...baseCtx.user, instanceId: 'tenant-session' } } as never,
      { createMissingInstanceFromKey: true }
    );

    expect(state.resolveInstanceIdMock).toHaveBeenCalledWith({
      resolvePool: expect.any(Function),
      candidate: 'tenant-key',
      createIfMissingFromKey: true,
      displayNameForCreate: 'tenant-key',
    });
    expect(result).toEqual({
      actor: {
        instanceId: 'tenant-created',
        requestId: 'req-1',
        traceId: 'trace-1',
        actorAccountId: 'account-1',
      },
    });
  });

  it('maps instance lookup failures to a typed api error response', async () => {
    const { resolveActorInfo } = await import('./shared-actor-resolution.js');

    const lookupFailure = { ok: false as const, reason: 'database_unavailable' as const };
    state.readInstanceIdFromRequestMock.mockReturnValueOnce('tenant-key');
    state.resolveInstanceIdMock.mockResolvedValueOnce(lookupFailure);
    state.createInstanceLookupErrorMock.mockReturnValueOnce({
      status: 503,
      code: 'database_unavailable',
      message: 'IAM-Datenbank ist nicht erreichbar.',
    });

    const result = await resolveActorInfo(
      new Request('http://localhost/path?instanceId=tenant-key'),
      { user: { ...baseCtx.user, instanceId: 'tenant-session' } } as never,
      { createMissingInstanceFromKey: true }
    );

    expect(state.createInstanceLookupErrorMock).toHaveBeenCalledWith(lookupFailure, 'req-1', 'tenant-key');
    expect(state.loggerWarnMock).toHaveBeenCalledWith(
      'IAM actor resolution failed during instance lookup',
      expect.objectContaining({
        requested_instance_id: 'tenant-key',
        reason_code: 'database_unavailable',
      })
    );
    expect((result as { error: Response }).error.status).toBe(503);
  });

  it('maps non-database instance lookup failures without an explicit request instance id', async () => {
    const { resolveActorInfo } = await import('./shared-actor-resolution.js');

    const lookupFailure = { ok: false as const, reason: 'invalid_instance' as const };
    state.readInstanceIdFromRequestMock.mockReturnValue(undefined);
    state.resolveInstanceIdMock.mockResolvedValueOnce(lookupFailure);
    state.createInstanceLookupErrorMock.mockReturnValueOnce({
      status: 400,
      code: 'invalid_instance_id',
      message: 'Ungültige oder fehlende instanceId.',
    });

    const result = await resolveActorInfo(
      new Request('http://localhost/path'),
      { user: { ...baseCtx.user, instanceId: undefined } } as never,
      { createMissingInstanceFromKey: true }
    );

    expect(state.createInstanceLookupErrorMock).toHaveBeenCalledWith(lookupFailure, 'req-1', undefined);
    expect(state.createApiErrorMock).toHaveBeenCalledWith(
      400,
      'invalid_instance_id',
      'Ungültige oder fehlende instanceId.',
      'req-1',
      {
        dependency: undefined,
        reason_code: 'invalid_instance_id',
      }
    );
    expect((result as { error: Response }).error.status).toBe(400);
  });

  it('maps actor account lookup failures to database_unavailable', async () => {
    const { resolveActorInfo } = await import('./shared-actor-resolution.js');

    state.resolveActorAccountIdWithProvisionMock.mockRejectedValueOnce(new Error('db down'));

    const result = await resolveActorInfo(
      new Request('http://localhost/path'),
      { user: { ...baseCtx.user, instanceId: 'tenant-a' } } as never
    );

    expect(state.annotateActiveSpanMock).toHaveBeenCalledWith({
      'dependency.database.status': 'error',
      'iam.actor_resolution': 'database_unavailable',
      'iam.reason_code': 'actor_lookup_failed',
    });
    expect(state.addActiveSpanEventMock).toHaveBeenCalledWith('iam.actor_resolution_failed', {
      'iam.reason_code': 'actor_lookup_failed',
      'iam.instance_id': 'tenant-a',
    });
    expect(state.loggerErrorMock).toHaveBeenCalledWith(
      'IAM actor resolution failed during account lookup',
      expect.objectContaining({
        instance_id: 'tenant-a',
        error: 'db down',
      })
    );
    expect((result as { error: Response }).error.status).toBe(503);
  });

  it('logs non-Error actor account lookup failures as strings', async () => {
    const { resolveActorInfo } = await import('./shared-actor-resolution.js');

    state.resolveActorAccountIdWithProvisionMock.mockRejectedValueOnce('db down');

    await resolveActorInfo(
      new Request('http://localhost/path'),
      { user: { ...baseCtx.user, instanceId: 'tenant-a' } } as never
    );

    expect(state.loggerErrorMock).toHaveBeenCalledWith(
      'IAM actor resolution failed during account lookup',
      expect.objectContaining({
        error: 'db down',
      })
    );
  });

  it('requires actor membership when configured and no actor account can be resolved', async () => {
    const { resolveActorInfo } = await import('./shared-actor-resolution.js');

    state.resolveActorAccountIdWithProvisionMock.mockResolvedValueOnce(undefined);

    const result = await resolveActorInfo(
      new Request('http://localhost/path'),
      { user: { ...baseCtx.user, instanceId: 'tenant-a' } } as never,
      { requireActorMembership: true, provisionMissingActorMembership: true }
    );

    expect(state.resolveMissingActorDiagnosticReasonMock).toHaveBeenCalledWith('tenant-a', 'kc-user-1');
    expect(state.createMissingActorMembershipErrorMock).toHaveBeenCalledWith({
      diagnosticReason: 'missing_actor_account',
      instanceId: 'tenant-a',
      userId: 'kc-user-1',
      sessionInstanceId: 'tenant-a',
      mayProvisionMissingActorMembership: true,
      requestId: 'req-1',
      traceId: 'trace-1',
    });
    expect(result).toEqual({
      error: expect.any(Response),
    });
  });

  it('disables membership auto-provisioning when the requested instance differs from the session scope', async () => {
    const { resolveActorInfo } = await import('./shared-actor-resolution.js');

    state.readInstanceIdFromRequestMock.mockReturnValue('tenant-b');
    state.resolveActorAccountIdWithProvisionMock.mockResolvedValueOnce(undefined);

    const result = await resolveActorInfo(
      new Request('http://localhost/path?instanceId=tenant-b'),
      { user: { ...baseCtx.user, instanceId: 'tenant-a' } } as never,
      { provisionMissingActorMembership: true }
    );

    expect(state.resolveActorAccountIdWithProvisionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'tenant-b',
        mayProvisionMissingActorMembership: false,
      })
    );
    expect(result).toEqual({
      actor: {
        instanceId: 'tenant-b',
        requestId: 'req-1',
        traceId: 'trace-1',
        actorAccountId: undefined,
      },
    });
  });
});
