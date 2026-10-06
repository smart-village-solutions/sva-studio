import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withAuthenticatedUser: vi.fn(),
  handlers: {
    assignGroupMembershipInternal: vi.fn(),
    assignGroupRoleInternal: vi.fn(),
    createGroupInternal: vi.fn(),
    deleteGroupInternal: vi.fn(),
    getGroupInternal: vi.fn(),
    listGroupsInternal: vi.fn(),
    removeGroupMembershipInternal: vi.fn(),
    removeGroupRoleInternal: vi.fn(),
    updateGroupInternal: vi.fn(),
  },
}));

vi.mock('@sva/server-runtime', () => ({ withRequestContext: (_context: unknown, work: () => Promise<unknown>) => work() }));
vi.mock('../middleware.js', () => ({ withAuthenticatedUser: mocks.withAuthenticatedUser }));
vi.mock('./handlers.js', () => mocks.handlers);

describe('group personal API route opt-ins', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.withAuthenticatedUser.mockImplementation(async () => new Response(null, { status: 200 }));
  });

  it('opts only the existing group administration handlers into personal bearer auth', async () => {
    const routes = await import('./core.js');
    const request = new Request('https://tenant.example/api/v1/iam/groups');
    await routes.listGroupsHandler(request);
    await routes.getGroupHandler(request);
    await routes.createGroupHandler(request);
    await routes.updateGroupHandler(request);
    await routes.deleteGroupHandler(request);
    await routes.assignGroupRoleHandler(request);
    await routes.removeGroupRoleHandler(request);
    await routes.assignGroupMembershipHandler(request);
    await routes.removeGroupMembershipHandler(request);

    expect(mocks.withAuthenticatedUser.mock.calls.map((call) => call[2])).toEqual([
      { personalBearerRoute: { method: 'GET', path: '/api/v1/iam/groups' } },
      { personalBearerRoute: { method: 'GET', path: '/api/v1/iam/groups/$groupId' } },
      { personalBearerRoute: { method: 'POST', path: '/api/v1/iam/groups' } },
      { personalBearerRoute: { method: 'PATCH', path: '/api/v1/iam/groups/$groupId' } },
      { personalBearerRoute: { method: 'DELETE', path: '/api/v1/iam/groups/$groupId' } },
      { personalBearerRoute: { method: 'POST', path: '/api/v1/iam/groups/$groupId/roles' } },
      { personalBearerRoute: { method: 'DELETE', path: '/api/v1/iam/groups/$groupId/roles/$roleId' } },
      { personalBearerRoute: { method: 'POST', path: '/api/v1/iam/groups/$groupId/memberships' } },
      { personalBearerRoute: { method: 'DELETE', path: '/api/v1/iam/groups/$groupId/memberships' } },
    ]);
  });
});
