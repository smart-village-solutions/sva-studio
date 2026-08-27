import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  authorize: vi.fn(),
  loadContent: vi.fn(),
  loadTargets: vi.fn(),
  readPathSegment: vi.fn(),
  resolveActor: vi.fn(),
}));

vi.mock('../iam-account-management/api-helpers.js', () => ({
  asApiList: (data: unknown, pagination: unknown, requestId?: string) => ({
    data,
    pagination,
    requestId,
  }),
  createApiError: (status: number, code: string, message: string, requestId?: string) =>
    new Response(JSON.stringify({ error: { code, message }, requestId }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  readPage: () => ({ page: 2, pageSize: 10 }),
  readPathSegment: (...args: unknown[]) => state.readPathSegment(...args),
}));

vi.mock('./repository.js', () => ({
  loadContentById: (...args: unknown[]) => state.loadContent(...args),
  loadContentOwnershipTargets: (...args: unknown[]) => state.loadTargets(...args),
}));

vi.mock('./request-context.js', () => ({
  authorizeContentAction: (...args: unknown[]) => state.authorize(...args),
  resolveContentActor: (...args: unknown[]) => state.resolveActor(...args),
}));

const { listContentOwnershipTargetsInternal } = await import('./ownership-targets-route.js');

const actor = {
  instanceId: 'instance-1',
  actorAccountId: 'account-1',
  actorDisplayName: 'Actor',
  requestId: 'request-1',
  traceId: 'trace-1',
};

const request = (search = '') =>
  new Request(`https://studio.test/api/v1/iam/contents/content-1/ownership-targets${search}`);

describe('content ownership target route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.resolveActor.mockResolvedValue({ actor });
    state.readPathSegment.mockReturnValue('content-1');
    state.loadContent.mockResolvedValue({
      id: 'content-1',
      contentType: 'generic',
      organizationId: 'organization-1',
      ownerUserId: 'account-owner',
    });
    state.authorize.mockResolvedValue(null);
    state.loadTargets.mockResolvedValue({
      items: [
        {
          principal: { type: 'account', id: 'account-target' },
          displayName: 'Account Target',
        },
      ],
      page: 2,
      pageSize: 10,
      total: 1,
    });
  });

  it('returns actor, path, lookup and authorization errors unchanged', async () => {
    const actorError = new Response('actor', { status: 401 });
    state.resolveActor.mockResolvedValueOnce({ error: actorError });
    expect(await listContentOwnershipTargetsInternal(request(), {} as never)).toBe(actorError);

    state.readPathSegment.mockReturnValueOnce('');
    expect((await listContentOwnershipTargetsInternal(request(), {} as never)).status).toBe(400);

    state.loadContent.mockResolvedValueOnce(undefined);
    expect((await listContentOwnershipTargetsInternal(request(), {} as never)).status).toBe(404);

    const denied = new Response('denied', { status: 403 });
    state.authorize.mockResolvedValueOnce(denied);
    expect(await listContentOwnershipTargetsInternal(request(), {} as never)).toBe(denied);
  });

  it('validates target type before querying the repository', async () => {
    const response = await listContentOwnershipTargetsInternal(
      request('?type=service-account'),
      {} as never
    );

    expect(response.status).toBe(400);
    expect(state.loadTargets).not.toHaveBeenCalled();
  });

  it('lists searched account targets and excludes the current account owner', async () => {
    const response = await listContentOwnershipTargetsInternal(
      request('?type=account&q=%20Target%20'),
      {} as never
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: [{ displayName: 'Account Target' }],
      pagination: { page: 2, pageSize: 10, total: 1 },
      requestId: 'request-1',
    });
    expect(state.authorize).toHaveBeenCalledWith(
      actor,
      'content.transferOwnership',
      expect.objectContaining({ ownerUserId: 'account-owner' })
    );
    expect(state.loadTargets).toHaveBeenCalledWith('instance-1', {
      type: 'account',
      page: 2,
      pageSize: 10,
      search: 'Target',
      currentOwner: { type: 'account', id: 'account-owner' },
    });
  });

  it('lists organization targets and prefers the organization for legacy dual ownership', async () => {
    state.loadContent.mockResolvedValueOnce({
      id: 'content-1',
      contentType: 'generic',
      ownerUserId: 'account-owner',
      ownerOrganizationId: 'organization-owner',
    });
    state.loadTargets.mockResolvedValueOnce({ items: [], page: 2, pageSize: 10, total: 0 });

    const response = await listContentOwnershipTargetsInternal(
      request('?type=organization'),
      {} as never
    );

    expect(response.status).toBe(200);
    expect(state.loadTargets).toHaveBeenCalledWith('instance-1', {
      type: 'organization',
      page: 2,
      pageSize: 10,
      currentOwner: { type: 'organization', id: 'organization-owner' },
    });
  });

  it('maps repository failures to a stable unavailable response', async () => {
    state.loadContent.mockResolvedValueOnce({
      id: 'content-1',
      contentType: 'generic',
      ownerOrganizationId: 'organization-owner',
    });
    state.loadTargets.mockRejectedValueOnce('database down');

    const response = await listContentOwnershipTargetsInternal(
      request('?type=organization'),
      {} as never
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'database_unavailable' },
    });
  });
});
