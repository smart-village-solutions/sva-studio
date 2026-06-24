import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  ensureFeature: vi.fn(),
  getFeatureFlags: vi.fn(),
  withAuthenticatedUser: vi.fn(),
  listProjectedContents: vi.fn(),
  refreshProjectedContents: vi.fn(),
  getWorkspaceContext: vi.fn(),
}));

vi.mock('@sva/auth-runtime/server', () => ({
  ensureFeature: state.ensureFeature,
  getFeatureFlags: state.getFeatureFlags,
  withAuthenticatedUser: state.withAuthenticatedUser,
}));

vi.mock('@sva/server-runtime', () => ({
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
    state.listProjectedContents.mockReset();
    state.refreshProjectedContents.mockReset();
    state.getWorkspaceContext.mockReset();
    state.ensureFeature.mockReturnValue(null);
    state.getFeatureFlags.mockReturnValue({ iamAdminEnabled: true });
    state.getWorkspaceContext.mockReturnValue({ requestId: 'req-1' });
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
      dispatchAggregatedContentListRequest(new Request('https://studio.test/api/v1/iam/contents', { method: 'POST' }))
    ).resolves.toBeNull();
    await expect(
      dispatchAggregatedContentListRequest(new Request('https://studio.test/api/v1/iam/contents/content-1'))
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

  it('returns a deterministic list error when the projected list handler throws', async () => {
    state.listProjectedContents.mockRejectedValue(new Error('projection failed'));

    const response = await dispatchAggregatedContentListRequest(
      new Request('https://studio.test/api/v1/iam/contents?page=1&pageSize=25&visibleType=news.article')
    );

    expect(response?.status).toBe(503);
    await expect(response?.json()).resolves.toEqual({
      error: {
        code: 'database_unavailable',
        message: 'Inhalte konnten nicht geladen werden.',
      },
      requestId: 'req-1',
    });
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
      new Request('https://studio.test/api/v1/iam/contents?page=1&pageSize=25&visibleType=news.article')
    );

    expect(response?.status).toBe(503);
    expect(state.listProjectedContents).not.toHaveBeenCalled();
    await expect(response?.json()).resolves.toMatchObject({
      error: {
        code: 'feature_disabled',
      },
    });
  });
});
