import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withAuthenticatedUser: vi.fn(),
  handlers: {
    assignOrganizationMembershipInternal: vi.fn(),
    createOrganizationInternal: vi.fn(),
    deleteOrganizationInternal: vi.fn(),
    getMyOrganizationContextInternal: vi.fn(),
    getOrganizationInternal: vi.fn(),
    listOrganizationsInternal: vi.fn(),
    provisionOrganizationMainserverInternal: vi.fn(),
    removeOrganizationMembershipInternal: vi.fn(),
    updateMyOrganizationContextInternal: vi.fn(),
    updateOrganizationInternal: vi.fn(),
    updateOrganizationMembershipInternal: vi.fn(),
  },
}));

vi.mock('@sva/server-runtime', () => ({ withRequestContext: (_context: unknown, work: () => Promise<unknown>) => work() }));
vi.mock('../middleware.js', () => ({ withAuthenticatedUser: mocks.withAuthenticatedUser }));
vi.mock('./handlers.js', () => mocks.handlers);

describe('organization personal API route opt-ins', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.withAuthenticatedUser.mockImplementation(async () => new Response(null, { status: 200 }));
  });

  it('opts only the existing organization administration handlers into personal bearer auth', async () => {
    const routes = await import('./core.js');
    const request = new Request('https://tenant.example/api/v1/iam/organizations');
    await routes.listOrganizationsHandler(request);
    await routes.getOrganizationHandler(request);
    await routes.createOrganizationHandler(request);
    await routes.updateOrganizationHandler(request);
    await routes.deleteOrganizationHandler(request);
    await routes.assignOrganizationMembershipHandler(request);
    await routes.updateOrganizationMembershipHandler(request);
    await routes.removeOrganizationMembershipHandler(request);
    await routes.provisionOrganizationMainserverHandler(request);
    await routes.getMyOrganizationContextHandler(request);
    await routes.updateMyOrganizationContextHandler(request);

    expect(mocks.withAuthenticatedUser.mock.calls.map((call) => call[2])).toEqual([
      { personalBearerRoute: { method: 'GET', path: '/api/v1/iam/organizations' } },
      { personalBearerRoute: { method: 'GET', path: '/api/v1/iam/organizations/$organizationId' } },
      { personalBearerRoute: { method: 'POST', path: '/api/v1/iam/organizations' } },
      { personalBearerRoute: { method: 'PATCH', path: '/api/v1/iam/organizations/$organizationId' } },
      { personalBearerRoute: { method: 'DELETE', path: '/api/v1/iam/organizations/$organizationId' } },
      { personalBearerRoute: { method: 'POST', path: '/api/v1/iam/organizations/$organizationId/memberships' } },
      { personalBearerRoute: { method: 'PATCH', path: '/api/v1/iam/organizations/$organizationId/memberships/$accountId' } },
      { personalBearerRoute: { method: 'DELETE', path: '/api/v1/iam/organizations/$organizationId/memberships/$accountId' } },
      {},
      {},
      {},
    ]);
  });
});
