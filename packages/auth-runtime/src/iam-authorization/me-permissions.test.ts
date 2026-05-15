import { beforeEach, describe, expect, it, vi } from 'vitest';

type SessionUser = {
  id: string;
  instanceId?: string;
  roles: string[];
};

const INSTANCE_ID = '11111111-1111-4111-8111-111111111111';
const ORGANIZATION_ID = '22222222-2222-4222-8222-222222222222';
const GEO_UNIT_ID = '33333333-3333-4333-8333-333333333333';

const state = vi.hoisted(() => ({
  withAuthenticatedUser: vi.fn(),
  withRequestContext: vi.fn(async (_input: unknown, work: () => Promise<Response>) => work()),
  getWorkspaceContext: vi.fn(() => ({ requestId: 'workspace-request', traceId: 'workspace-trace' })),
  resolveImpersonationSubject: vi.fn(async () => ({ ok: true })),
  resolveEffectivePermissions: vi.fn(),
  resolveInstanceIdFromRequest: vi.fn(() => INSTANCE_ID),
  resolveOrganizationIdFromRequest: vi.fn(() => ORGANIZATION_ID),
  resolveActingAsUserIdFromRequest: vi.fn(() => undefined),
  resolveGeoContextFromRequest: vi.fn(() => ({ geoUnitId: GEO_UNIT_ID, geoHierarchy: [GEO_UNIT_ID] })),
  buildMePermissionsResponse: vi.fn(),
  errorResponse: vi.fn((status: number, error: string) =>
    new Response(JSON.stringify({ error }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  ),
  jsonResponse: vi.fn((status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  ),
  buildRequestContext: vi.fn((instanceId?: string) => ({ workspaceId: instanceId })),
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@sva/server-runtime', () => ({
  getWorkspaceContext: state.getWorkspaceContext,
  withRequestContext: state.withRequestContext,
}));

vi.mock('../governance-impersonation.js', () => ({
  resolveImpersonationSubject: state.resolveImpersonationSubject,
}));

vi.mock('../middleware.js', () => ({
  withAuthenticatedUser: state.withAuthenticatedUser,
}));

vi.mock('../db.js', () => ({
  jsonResponse: state.jsonResponse,
}));

vi.mock('./permission-store.js', () => ({
  resolveEffectivePermissions: state.resolveEffectivePermissions,
}));

vi.mock('./shared.js', () => ({
  buildMePermissionsResponse: state.buildMePermissionsResponse,
  buildRequestContext: state.buildRequestContext,
  errorResponse: state.errorResponse,
  logger: state.logger,
  resolveActingAsUserIdFromRequest: state.resolveActingAsUserIdFromRequest,
  resolveGeoContextFromRequest: state.resolveGeoContextFromRequest,
  resolveInstanceIdFromRequest: state.resolveInstanceIdFromRequest,
  resolveOrganizationIdFromRequest: state.resolveOrganizationIdFromRequest,
}));

const baseUser: SessionUser = {
  id: 'actor-1',
  instanceId: INSTANCE_ID,
  roles: ['editor'],
};

describe('me permissions handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    state.withAuthenticatedUser.mockImplementation(
      async (_request: Request, handler: (ctx: { user: SessionUser }) => Promise<Response>) =>
        handler({ user: baseUser })
    );
    state.resolveInstanceIdFromRequest.mockReturnValue(INSTANCE_ID);
    state.resolveOrganizationIdFromRequest.mockReturnValue(ORGANIZATION_ID);
    state.resolveActingAsUserIdFromRequest.mockReturnValue(undefined);
    state.resolveGeoContextFromRequest.mockReturnValue({
      geoUnitId: GEO_UNIT_ID,
      geoHierarchy: [GEO_UNIT_ID],
    });
    state.resolveImpersonationSubject.mockResolvedValue({ ok: true });
    state.resolveEffectivePermissions.mockResolvedValue({
      ok: true,
      permissions: [{ action: 'waste.read', resourceType: 'waste', effect: 'allow' }],
      snapshotVersion: 'snapshot-1',
      cacheStatus: 'hit',
    });
    state.buildMePermissionsResponse.mockReturnValue({
      instanceId: INSTANCE_ID,
      organizationId: ORGANIZATION_ID,
      permissions: [{ action: 'waste.read', resourceType: 'waste', effect: 'allow' }],
      subject: {
        actorUserId: 'actor-1',
        effectiveUserId: 'actor-1',
        isImpersonating: false,
      },
      snapshotVersion: 'snapshot-1',
      cacheStatus: 'hit',
    });
  });

  it('rejects requests without a resolved instance id', async () => {
    const { mePermissionsHandler } = await import('./me-permissions.js');
    state.resolveInstanceIdFromRequest.mockReturnValueOnce(undefined);

    const response = await mePermissionsHandler(new Request('https://example.test/api/v1/iam/me/permissions'));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'invalid_instance_id' });
  });

  it('rejects authenticated users crossing instance boundaries', async () => {
    const { mePermissionsHandler } = await import('./me-permissions.js');
    state.resolveInstanceIdFromRequest.mockReturnValueOnce('44444444-4444-4444-8444-444444444444');

    const response = await mePermissionsHandler(new Request('https://example.test/api/v1/iam/me/permissions'));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'instance_scope_mismatch' });
  });

  it('rejects invalid organization ids and invalid geo request context', async () => {
    const { mePermissionsHandler } = await import('./me-permissions.js');

    state.resolveOrganizationIdFromRequest.mockReturnValueOnce(null);
    const invalidOrganization = await mePermissionsHandler(
      new Request('https://example.test/api/v1/iam/me/permissions')
    );
    expect(invalidOrganization.status).toBe(400);
    await expect(invalidOrganization.json()).resolves.toEqual({ error: 'invalid_organization_id' });

    state.resolveGeoContextFromRequest.mockReturnValueOnce(null);
    const invalidGeo = await mePermissionsHandler(new Request('https://example.test/api/v1/iam/me/permissions'));
    expect(invalidGeo.status).toBe(400);
    await expect(invalidGeo.json()).resolves.toEqual({ error: 'invalid_request' });
  });

  it('maps impersonation denial reason codes to API errors', async () => {
    const { mePermissionsHandler } = await import('./me-permissions.js');
    state.resolveActingAsUserIdFromRequest.mockReturnValue('delegate-1');

    state.resolveImpersonationSubject.mockResolvedValueOnce({
      ok: false,
      reasonCode: 'DENY_TICKET_REQUIRED',
    });
    const inactive = await mePermissionsHandler(new Request('https://example.test/api/v1/iam/me/permissions'));
    expect(inactive.status).toBe(403);
    await expect(inactive.json()).resolves.toEqual({ error: 'impersonation_not_active' });

    state.resolveImpersonationSubject.mockResolvedValueOnce({
      ok: false,
      reasonCode: 'DENY_IMPERSONATION_DURATION_EXCEEDED',
    });
    const expired = await mePermissionsHandler(new Request('https://example.test/api/v1/iam/me/permissions'));
    expect(expired.status).toBe(403);
    await expect(expired.json()).resolves.toEqual({ error: 'impersonation_expired' });

    state.resolveImpersonationSubject.mockResolvedValueOnce({
      ok: false,
      reasonCode: 'database_unavailable',
    });
    const unavailable = await mePermissionsHandler(
      new Request('https://example.test/api/v1/iam/me/permissions')
    );
    expect(unavailable.status).toBe(503);
    await expect(unavailable.json()).resolves.toEqual({ error: 'database_unavailable' });

    state.resolveImpersonationSubject.mockResolvedValueOnce({
      ok: false,
      reasonCode: 'DENY_SCOPE',
    });
    const mismatch = await mePermissionsHandler(new Request('https://example.test/api/v1/iam/me/permissions'));
    expect(mismatch.status).toBe(403);
    await expect(mismatch.json()).resolves.toEqual({ error: 'instance_scope_mismatch' });
  });

  it('returns 503 and logs when effective permissions cannot be resolved', async () => {
    const { mePermissionsHandler } = await import('./me-permissions.js');
    state.resolveEffectivePermissions.mockResolvedValueOnce({
      ok: false,
      error: 'database_unavailable',
    });

    const response = await mePermissionsHandler(new Request('https://example.test/api/v1/iam/me/permissions'));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: 'database_unavailable' });
    expect(state.logger.error).toHaveBeenCalledWith(
      'Failed to resolve permissions from cache/database',
      expect.objectContaining({
        operation: 'me_permissions',
        error: 'database_unavailable',
        workspaceId: INSTANCE_ID,
      })
    );
  });

  it('returns permission snapshots with impersonation context and workspace fallback ids', async () => {
    const { mePermissionsHandler } = await import('./me-permissions.js');
    state.resolveActingAsUserIdFromRequest.mockReturnValueOnce('delegate-1');
    state.buildMePermissionsResponse.mockReturnValueOnce({
      instanceId: INSTANCE_ID,
      organizationId: ORGANIZATION_ID,
      permissions: [{ action: 'waste.read', resourceType: 'waste', effect: 'allow' }],
      subject: {
        actorUserId: 'actor-1',
        effectiveUserId: 'delegate-1',
        isImpersonating: true,
      },
      requestId: undefined,
      traceId: undefined,
      snapshotVersion: 'snapshot-1',
      cacheStatus: 'hit',
    });

    const response = await mePermissionsHandler(new Request('https://example.test/api/v1/iam/me/permissions'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      instanceId: INSTANCE_ID,
      subject: {
        actorUserId: 'actor-1',
        effectiveUserId: 'delegate-1',
        isImpersonating: true,
      },
      requestId: 'workspace-request',
      traceId: 'workspace-trace',
      snapshotVersion: 'snapshot-1',
      cacheStatus: 'hit',
    });
    expect(state.resolveImpersonationSubject).toHaveBeenCalledWith({
      instanceId: INSTANCE_ID,
      actorKeycloakSubject: 'actor-1',
      targetKeycloakSubject: 'delegate-1',
    });
    expect(state.resolveEffectivePermissions).toHaveBeenCalledWith({
      instanceId: INSTANCE_ID,
      keycloakSubject: 'delegate-1',
      organizationId: ORGANIZATION_ID,
      geoUnitId: GEO_UNIT_ID,
      geoHierarchy: [GEO_UNIT_ID],
    });
    expect(state.buildMePermissionsResponse).toHaveBeenCalledWith({
      instanceId: INSTANCE_ID,
      organizationId: ORGANIZATION_ID,
      permissions: [{ action: 'waste.read', resourceType: 'waste', effect: 'allow' }],
      actorUserId: 'actor-1',
      effectiveUserId: 'delegate-1',
      isImpersonating: true,
      snapshotVersion: 'snapshot-1',
      cacheStatus: 'hit',
    });
    expect(state.logger.debug).toHaveBeenCalledWith(
      'Resolved effective permissions for current user',
      expect.objectContaining({
        operation: 'me_permissions',
        permission_count: 1,
        workspaceId: INSTANCE_ID,
      })
    );
  });
});
