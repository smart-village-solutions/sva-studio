import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  ensureFeature: vi.fn(),
  getFeatureFlags: vi.fn(),
  withAuthenticatedUser: vi.fn(),
  authorizeInstancePermissionForUser: vi.fn(),
  loadMainserverAuthoringDiagnostics: vi.fn(),
  listProjectedContents: vi.fn(),
  refreshProjectedContents: vi.fn(),
  getWorkspaceContext: vi.fn(),
  logger: {
    error: vi.fn(),
  },
}));

vi.mock('@sva/auth-runtime/server', () => ({
  ensureFeature: state.ensureFeature,
  getFeatureFlags: state.getFeatureFlags,
  withAuthenticatedUser: state.withAuthenticatedUser,
  authorizeInstancePermissionForUser: state.authorizeInstancePermissionForUser,
  loadMainserverAuthoringDiagnostics: state.loadMainserverAuthoringDiagnostics,
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => state.logger,
  getWorkspaceContext: state.getWorkspaceContext,
}));

vi.mock('./iam-content-list-projection.server', () => ({
  listProjectedContents: state.listProjectedContents,
  refreshProjectedContents: state.refreshProjectedContents,
}));

import { dispatchAggregatedContentListRequest } from './iam-content-list-api.server';

describe('content list api dispatch', () => {
  beforeEach(() => {
    state.ensureFeature.mockReset();
    state.getFeatureFlags.mockReset();
    state.withAuthenticatedUser.mockReset();
    state.authorizeInstancePermissionForUser.mockReset();
    state.loadMainserverAuthoringDiagnostics.mockReset();
    state.listProjectedContents.mockReset();
    state.refreshProjectedContents.mockReset();
    state.getWorkspaceContext.mockReset();
    state.logger.error.mockReset();
    state.ensureFeature.mockReturnValue(null);
    state.getFeatureFlags.mockReturnValue({ iamAdminEnabled: true });
    state.getWorkspaceContext.mockReturnValue({ requestId: 'req-1' });
    state.authorizeInstancePermissionForUser.mockResolvedValue({
      ok: true,
      actor: {
        instanceId: 'de-musterhausen',
        keycloakSubject: 'kc-user-1',
      },
      permissions: [],
    });
    state.withAuthenticatedUser.mockImplementation(async (_request, handler) =>
      handler({
        sessionId: 'session-1',
        activeOrganizationId: 'org-1',
        user: {
          id: 'kc-user-1',
          instanceId: 'de-musterhausen',
        },
      })
    );
  });

  it('ignores unrelated requests', async () => {
    await expect(
      dispatchAggregatedContentListRequest(
        new Request('https://studio.test/api/v1/iam/contents', { method: 'POST' })
      )
    ).resolves.toBeNull();
    await expect(
      dispatchAggregatedContentListRequest(
        new Request('https://studio.test/api/v1/iam/contents/content-1')
      )
    ).resolves.toBeNull();

    expect(state.withAuthenticatedUser).not.toHaveBeenCalled();
    expect(state.listProjectedContents).not.toHaveBeenCalled();
    expect(state.refreshProjectedContents).not.toHaveBeenCalled();
  });

  it('delegates GET /api/v1/iam/contents to the projected list handler with a normalized query', async () => {
    state.listProjectedContents.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [],
          pagination: {
            page: 1,
            pageSize: 100,
            total: 0,
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );

    const response = await dispatchAggregatedContentListRequest(
      new Request(
        'https://studio.test/api/v1/iam/contents?page=1&pageSize=999&sortBy=updatedAt&sortDirection=desc&visibleType=news.article'
      )
    );

    expect(response?.status).toBe(200);
    expect(state.withAuthenticatedUser).toHaveBeenCalledTimes(1);
    expect(state.listProjectedContents).toHaveBeenCalledWith(
      expect.objectContaining({
        activeOrganizationId: 'org-1',
        user: expect.objectContaining({
          id: 'kc-user-1',
          instanceId: 'de-musterhausen',
        }),
      }),
      {
        page: 1,
        pageSize: 100,
        sortBy: 'updatedAt',
        sortDirection: 'desc',
        visibleTypes: ['news.article'],
      }
    );
  });

  it('delegates POST /api/v1/iam/contents/refresh to the projected refresh handler', async () => {
    state.refreshProjectedContents.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            status: 'completed',
            syncStates: [],
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );

    const response = await dispatchAggregatedContentListRequest(
      new Request('https://studio.test/api/v1/iam/contents/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visibleTypes: ['news.article'],
          force: true,
        }),
      })
    );

    expect(response?.status).toBe(200);
    expect(state.refreshProjectedContents).toHaveBeenCalledWith(
      expect.objectContaining({
        activeOrganizationId: 'org-1',
      }),
      {
        visibleTypes: ['news.article'],
        force: true,
      }
    );
  });

  it('accepts POST /api/v1/iam/contents/refresh without a request body', async () => {
    state.refreshProjectedContents.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            status: 'completed',
            syncStates: [],
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );

    const response = await dispatchAggregatedContentListRequest(
      new Request('https://studio.test/api/v1/iam/contents/refresh', {
        method: 'POST',
      })
    );

    expect(response?.status).toBe(200);
    expect(state.refreshProjectedContents).toHaveBeenCalledWith(
      expect.objectContaining({
        activeOrganizationId: 'org-1',
      }),
      {}
    );
  });

  it('returns a deterministic list error when the projected list handler throws', async () => {
    state.listProjectedContents.mockRejectedValue(new Error('projection failed'));

    const response = await dispatchAggregatedContentListRequest(
      new Request(
        'https://studio.test/api/v1/iam/contents?page=1&pageSize=25&visibleType=news.article'
      )
    );

    expect(response?.status).toBe(503);
    await expect(response?.json()).resolves.toEqual({
      error: {
        code: 'database_unavailable',
        message: 'Inhalte konnten nicht geladen werden.',
      },
      requestId: 'req-1',
    });
    expect(state.logger.error).toHaveBeenCalledWith(
      'Failed to load aggregated content list',
      expect.objectContaining({
        request_id: 'req-1',
        instance_id: 'de-musterhausen',
        error_message: 'projection failed',
      })
    );
  });

  it('returns the iam admin feature gate response before dispatching the projected handlers', async () => {
    state.ensureFeature.mockReturnValueOnce(
      Response.json(
        {
          error: {
            code: 'feature_disabled',
            message: 'Feature iam-admin-enabled ist deaktiviert.',
          },
        },
        { status: 503 }
      )
    );

    const response = await dispatchAggregatedContentListRequest(
      new Request(
        'https://studio.test/api/v1/iam/contents?page=1&pageSize=25&visibleType=news.article'
      )
    );

    expect(response?.status).toBe(503);
    expect(state.listProjectedContents).not.toHaveBeenCalled();
    await expect(response?.json()).resolves.toMatchObject({
      error: {
        code: 'feature_disabled',
      },
    });
  });

  it('returns read-only Mainserver authoring diagnostics after monitoring authorization', async () => {
    state.loadMainserverAuthoringDiagnostics.mockResolvedValue({
      bindings: {
        byStatus: { verified: 2 },
        byPrincipalType: { user: 2 },
        rotationPrincipalCount: 0,
        recent: [],
      },
      mutations: {
        byAuthorizationMode: { exact: 1 },
        byReconciliationStatus: { not_required: 1 },
        automaticModeSwitchCount: 0,
        recent: [],
      },
    });

    const response = await dispatchAggregatedContentListRequest(
      new Request('https://studio.test/api/v1/iam/contents/mainserver-diagnostics')
    );

    expect(response?.status).toBe(200);
    expect(state.authorizeInstancePermissionForUser).toHaveBeenCalledWith({
      ctx: expect.objectContaining({
        user: expect.objectContaining({ id: 'kc-user-1' }),
      }),
      action: 'iam.monitoring.read',
    });
    expect(state.loadMainserverAuthoringDiagnostics).toHaveBeenCalledWith('de-musterhausen');
    await expect(response?.json()).resolves.toMatchObject({
      data: {
        bindings: { byStatus: { verified: 2 } },
        mutations: { byAuthorizationMode: { exact: 1 } },
      },
    });
  });

  it('rejects Mainserver diagnostics without monitoring permission', async () => {
    state.authorizeInstancePermissionForUser.mockResolvedValueOnce({
      ok: false,
      status: 403,
      error: 'forbidden',
      message: 'Nicht erlaubt.',
    });

    const response = await dispatchAggregatedContentListRequest(
      new Request('https://studio.test/api/v1/iam/contents/mainserver-diagnostics')
    );

    expect(response?.status).toBe(403);
    expect(state.loadMainserverAuthoringDiagnostics).not.toHaveBeenCalled();
    await expect(response?.json()).resolves.toMatchObject({
      error: { code: 'forbidden' },
    });
  });

  it('does not expose a write method for Mainserver binding diagnostics', async () => {
    const response = await dispatchAggregatedContentListRequest(
      new Request('https://studio.test/api/v1/iam/contents/mainserver-diagnostics', {
        method: 'POST',
        body: JSON.stringify({ dataProviderId: 'manual-provider' }),
      })
    );

    expect(response).toBeNull();
    expect(state.withAuthenticatedUser).not.toHaveBeenCalled();
    expect(state.loadMainserverAuthoringDiagnostics).not.toHaveBeenCalled();
  });
});
