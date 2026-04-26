import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createOrganizationReadHandlers, type OrganizationReadHandlerDeps } from './organization-read-handlers.js';

const state = {
  actorResolution: {
    actor: {
      instanceId: 'de-musterhausen',
      actorAccountId: 'account-1',
      requestId: 'req-org',
    },
  } as
    | { actor: { instanceId: string; actorAccountId?: string; requestId?: string } }
    | { error: Response },
  organizations: {
    items: [
      {
        id: 'org-1',
        organizationKey: 'alpha',
        displayName: 'Alpha',
        organizationType: 'municipality',
        contentAuthorPolicy: 'org_only',
        isActive: true,
        depth: 0,
        hierarchyPath: [],
        childCount: 0,
        membershipCount: 0,
      },
    ],
    total: 1,
  },
  detail: {
    id: '11111111-1111-1111-8111-111111111111',
    organizationKey: 'alpha',
    displayName: 'Alpha',
    organizationType: 'municipality',
    contentAuthorPolicy: 'org_only',
    isActive: true,
    depth: 0,
    hierarchyPath: [],
    childCount: 0,
    membershipCount: 0,
    metadata: {},
    memberships: [],
    children: [],
  },
  contextOptions: [
    {
      organizationId: '11111111-1111-1111-8111-111111111111',
      organizationKey: 'alpha',
      displayName: 'Alpha',
      organizationType: 'municipality',
      isActive: true,
      isDefaultContext: true,
    },
  ],
  session: { activeOrganizationId: undefined as string | undefined } as { activeOrganizationId?: string } | undefined,
};

const updateSession = vi.fn();

const json = async (response: Response) => response.json() as Promise<Record<string, unknown>>;

const buildDeps = (): OrganizationReadHandlerDeps => ({
  asApiItem: (data, requestId) => ({ data, ...(requestId ? { requestId } : {}) }),
  asApiList: (data, pagination, requestId) => ({ data, pagination, ...(requestId ? { requestId } : {}) }),
  chooseActiveOrganizationId: ({ storedActiveOrganizationId, organizations }) =>
    storedActiveOrganizationId ?? organizations[0]?.organizationId,
  consumeRateLimit: vi.fn(() => null),
  createApiError: (status, code, message, requestId) =>
    new Response(JSON.stringify({ error: { code, message }, ...(requestId ? { requestId } : {}) }), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  ensureFeature: vi.fn(() => null),
  getFeatureFlags: vi.fn(() => ({})),
  getSession: vi.fn(async () => state.session),
  getWorkspaceContext: vi.fn(() => ({ requestId: 'req-org' })),
  isUuid: (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value),
  jsonResponse: (status, payload) =>
    new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } }),
  loadContextOptions: vi.fn(async () => state.contextOptions),
  loadOrganizationDetail: vi.fn(async () => state.detail),
  loadOrganizationList: vi.fn(async () => state.organizations),
  readOrganizationTypeFilter: vi.fn(() => undefined),
  readPage: vi.fn(() => ({ page: 1, pageSize: 20 })),
  readPathSegment: vi.fn(
    (request: Request, index: number) =>
      new URL(request.url).pathname.split('/').filter((segment) => segment.length > 0)[index]
  ),
  readStatusFilter: vi.fn(() => undefined),
  readString: (value) => (typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined),
  requireRoles: vi.fn(() => null),
  resolveActorInfo: vi.fn(async () => state.actorResolution),
  updateSession,
  withInstanceScopedDb: vi.fn(async (_instanceId, work) => work({ query: vi.fn() })),
});

const ctx = {
  sessionId: 'session-1',
  user: {
    id: 'kc-1',
    roles: ['system_admin'],
  },
};

describe('organization read handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.actorResolution = {
      actor: {
        instanceId: 'de-musterhausen',
        actorAccountId: 'account-1',
        requestId: 'req-org',
      },
    };
    state.detail = {
      id: '11111111-1111-1111-8111-111111111111',
      organizationKey: 'alpha',
      displayName: 'Alpha',
      organizationType: 'municipality',
      contentAuthorPolicy: 'org_only',
      isActive: true,
      depth: 0,
      hierarchyPath: [],
      childCount: 0,
      membershipCount: 0,
      metadata: {},
      memberships: [],
      children: [],
    };
    state.session = { activeOrganizationId: undefined };
  });

  it('lists organizations with pagination and filters', async () => {
    const deps = buildDeps();
    const handlers = createOrganizationReadHandlers(deps);

    const response = await handlers.listOrganizationsInternal(
      new Request('http://localhost/api/v1/iam/organizations?search= Alpha '),
      ctx
    );

    expect(response.status).toBe(200);
    expect(deps.loadOrganizationList).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ search: 'Alpha', page: 1, pageSize: 20 })
    );
    await expect(json(response)).resolves.toMatchObject({ pagination: { total: 1 }, requestId: 'req-org' });
  });

  it('rejects invalid organization type filters before querying', async () => {
    const deps = { ...buildDeps(), readOrganizationTypeFilter: vi.fn(() => 'invalid' as const) };
    const handlers = createOrganizationReadHandlers(deps);

    const response = await handlers.listOrganizationsInternal(
      new Request('http://localhost/api/v1/iam/organizations?organizationType=invalid'),
      ctx
    );

    expect(response.status).toBe(400);
    expect(deps.loadOrganizationList).not.toHaveBeenCalled();
  });

  it('returns organization details and validates ids', async () => {
    const deps = buildDeps();
    const handlers = createOrganizationReadHandlers(deps);

    const invalid = await handlers.getOrganizationInternal(
      new Request('http://localhost/api/v1/iam/organizations/not-a-uuid'),
      ctx
    );
    const valid = await handlers.getOrganizationInternal(
      new Request('http://localhost/api/v1/iam/organizations/11111111-1111-1111-8111-111111111111'),
      ctx
    );

    expect(invalid.status).toBe(400);
    expect(valid.status).toBe(200);
    await expect(json(valid)).resolves.toMatchObject({ data: { organizationKey: 'alpha' } });
  });

  it('updates the stored session context when the active organization changes', async () => {
    const handlers = createOrganizationReadHandlers(buildDeps());

    const response = await handlers.getMyOrganizationContextInternal(
      new Request('http://localhost/api/v1/iam/me/organization-context'),
      ctx
    );

    expect(response.status).toBe(200);
    expect(updateSession).toHaveBeenCalledWith('session-1', {
      activeOrganizationId: '11111111-1111-1111-8111-111111111111',
    });
  });
});
