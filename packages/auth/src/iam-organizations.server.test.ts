import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  user: {
    id: 'keycloak-admin-1',
    name: 'Admin User',
    roles: ['system_admin'],
    instanceId: '11111111-1111-1111-8111-111111111111',
  },
  featureEnabled: true,
  rateLimitResponse: null as Response | null,
  roleCheckResponse: null as Response | null,
  csrfResponse: null as Response | null,
  actorResolution: {
    actor: {
      instanceId: '11111111-1111-1111-8111-111111111111',
      actorAccountId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      requestId: 'req-org-test',
      traceId: 'trace-org-test',
    },
  } as
    | {
        actor: {
          instanceId: string;
          actorAccountId: string;
          requestId: string;
          traceId: string;
        };
      }
    | { error: Response },
  dbResults: [] as unknown[],
  session: undefined as { activeOrganizationId?: string } | undefined,
  updateSessionCalls: [] as Array<{ sessionId: string; updates: Record<string, unknown> }>,
  notifyCalls: [] as Array<Record<string, unknown>>,
  auditCalls: [] as Array<Record<string, unknown>>,
}));

vi.mock('./middleware.server', () => ({
  withAuthenticatedUser: vi.fn(async (_request: Request, handler: (ctx: unknown) => Promise<Response>) =>
    handler({
      sessionId: 'session-org-test',
      user: state.user,
    })
  ),
}));

vi.mock('@sva/sdk/server', () => ({
  createSdkLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
  getWorkspaceContext: () => ({
    workspaceId: state.user.instanceId,
    requestId: 'req-org-test',
    traceId: 'trace-org-test',
  }),
  withRequestContext: async (_options: unknown, handler: () => Promise<Response> | Response) => handler(),
}));

vi.mock('./iam-account-management/feature-flags', () => ({
  getFeatureFlags: () => ({
    iam_admin: state.featureEnabled,
    iam_ui: state.featureEnabled,
  }),
  ensureFeature: (_flags: Record<string, boolean>, feature: 'iam_admin' | 'iam_ui', requestId?: string) => {
    if (state.featureEnabled) {
      return null;
    }

    return new Response(
      JSON.stringify({
        error: {
          code: 'feature_disabled',
          message: `${feature} disabled`,
        },
        ...(requestId ? { requestId } : {}),
      }),
      {
        status: 403,
        headers: { 'content-type': 'application/json' },
      }
    );
  },
}));

vi.mock('./iam-account-management/rate-limit', () => ({
  consumeRateLimit: () => state.rateLimitResponse,
}));

vi.mock('./iam-account-management/csrf', () => ({
  validateCsrf: () => state.csrfResponse,
}));

vi.mock('./redis-session.server', () => ({
  getSession: vi.fn(async () => state.session),
  updateSession: vi.fn(async (sessionId: string, updates: Record<string, unknown>) => {
    state.updateSessionCalls.push({ sessionId, updates });
  }),
}));

vi.mock('./iam-account-management/encryption', () => ({
  revealField: (value: string | null) => value,
}));

vi.mock('./iam-account-management/user-mapping', () => ({
  resolveUserDisplayName: (input: {
    decryptedDisplayName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    keycloakSubject: string;
  }) =>
    input.decryptedDisplayName ??
    [input.firstName, input.lastName].filter(Boolean).join(' ').trim() ??
    input.keycloakSubject,
}));

vi.mock('./iam-account-management/shared', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  requireRoles: () => state.roleCheckResponse,
  resolveActorInfo: vi.fn(async () => state.actorResolution),
  withInstanceScopedDb: vi.fn(async (_instanceId: string, work: (client: unknown) => Promise<unknown>) => {
    if (state.dbResults.length > 0) {
      const next = state.dbResults.shift();
      if (
        typeof next === 'object' &&
        next !== null &&
        '__throw' in next &&
        Object.prototype.hasOwnProperty.call(next, '__throw')
      ) {
        throw (next as { __throw: unknown }).__throw;
      }
      return next;
    }

    return work({});
  }),
  emitActivityLog: vi.fn(async (_client: unknown, input: Record<string, unknown>) => {
    state.auditCalls.push(input);
  }),
  notifyPermissionInvalidation: vi.fn(async (_client: unknown, input: Record<string, unknown>) => {
    state.notifyCalls.push(input);
  }),
  reserveIdempotency: vi.fn(),
  completeIdempotency: vi.fn(),
}));

import {
  deactivateOrganizationHandler,
  getMyOrganizationContextHandler,
  listOrganizationsHandler,
  updateOrganizationHandler,
  updateMyOrganizationContextHandler,
} from './iam-organizations.server';

describe('iam organizations handlers', () => {
  beforeEach(() => {
    state.user = {
      id: 'keycloak-admin-1',
      name: 'Admin User',
      roles: ['system_admin'],
      instanceId: '11111111-1111-1111-8111-111111111111',
    };
    state.featureEnabled = true;
    state.rateLimitResponse = null;
    state.roleCheckResponse = null;
    state.csrfResponse = null;
    state.actorResolution = {
      actor: {
        instanceId: '11111111-1111-1111-8111-111111111111',
        actorAccountId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        requestId: 'req-org-test',
        traceId: 'trace-org-test',
      },
    };
    state.dbResults = [];
    state.session = undefined;
    state.updateSessionCalls = [];
    state.notifyCalls = [];
    state.auditCalls = [];
  });

  it('lists organizations with pagination metadata', async () => {
    state.dbResults = [
      {
        items: [
          {
            id: 'org-1',
            organizationKey: 'musterstadt',
            displayName: 'Musterstadt',
            parentOrganizationId: undefined,
            parentDisplayName: undefined,
            organizationType: 'municipality',
            contentAuthorPolicy: 'org_only',
            isActive: true,
            depth: 0,
            hierarchyPath: [],
            childCount: 1,
            membershipCount: 3,
          },
        ],
        total: 1,
      },
    ];

    const response = await listOrganizationsHandler(
      new Request(
        'http://localhost/api/v1/iam/organizations?page=2&pageSize=10&search=Muster&organizationType=municipality&status=active'
      )
    );
    const payload = (await response.json()) as {
      data: Array<{ id: string; displayName: string }>;
      pagination: { page: number; pageSize: number; total: number };
      requestId: string;
    };

    expect(response.status).toBe(200);
    expect(payload.data).toHaveLength(1);
    expect(payload.data[0]?.displayName).toBe('Musterstadt');
    expect(payload.pagination).toEqual({ page: 2, pageSize: 10, total: 1 });
    expect(payload.requestId).toBe('req-org-test');
  });

  it('returns active organization context from session membership', async () => {
    state.dbResults = [
      [
        {
          organizationId: 'org-1',
          organizationKey: 'landkreis-alpha',
          displayName: 'Landkreis Alpha',
          organizationType: 'county',
          isActive: true,
          isDefaultContext: false,
        },
        {
          organizationId: 'org-2',
          organizationKey: 'gemeinde-beta',
          displayName: 'Gemeinde Beta',
          organizationType: 'municipality',
          isActive: true,
          isDefaultContext: true,
        },
      ],
    ];
    state.session = { activeOrganizationId: 'org-1' };

    const response = await getMyOrganizationContextHandler(
      new Request('http://localhost/api/v1/iam/me/context')
    );
    const payload = (await response.json()) as {
      data: {
        activeOrganizationId: string;
        organizations: Array<{ organizationId: string }>;
      };
    };

    expect(response.status).toBe(200);
    expect(payload.data.activeOrganizationId).toBe('org-1');
    expect(payload.data.organizations).toHaveLength(2);
    expect(state.updateSessionCalls).toHaveLength(0);
  });

  it('rejects switching to an inactive organization context', async () => {
    state.dbResults = [
      [
        {
          organizationId: '33333333-3333-4333-8333-333333333333',
          organizationKey: 'ortsteil-gamma',
          displayName: 'Ortsteil Gamma',
          organizationType: 'district',
          isActive: false,
          isDefaultContext: false,
        },
      ],
    ];

    const response = await updateMyOrganizationContextHandler(
      new Request('http://localhost/api/v1/iam/me/context', {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          'x-csrf-token': 'csrf-token',
        },
        body: JSON.stringify({ organizationId: '33333333-3333-4333-8333-333333333333' }),
      })
    );
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(409);
    expect(payload.error.code).toBe('organization_inactive');
    expect(state.updateSessionCalls).toHaveLength(0);
    expect(state.notifyCalls).toHaveLength(0);
  });

  it('rejects switching organization context without valid csrf contract', async () => {
    state.csrfResponse = new Response(
      JSON.stringify({
        error: {
          code: 'csrf_validation_failed',
          message: 'csrf failed',
        },
        requestId: 'req-org-test',
      }),
      {
        status: 403,
        headers: { 'content-type': 'application/json' },
      }
    );

    const response = await updateMyOrganizationContextHandler(
      new Request('http://localhost/api/v1/iam/me/context', {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ organizationId: '33333333-3333-4333-8333-333333333333' }),
      })
    );
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(403);
    expect(payload.error.code).toBe('csrf_validation_failed');
    expect(state.updateSessionCalls).toHaveLength(0);
  });

  it('rejects switching to an organization outside the allowed membership context', async () => {
    state.dbResults = [
      [
        {
          organizationId: '22222222-2222-4222-8222-222222222222',
          organizationKey: 'gemeinde-beta',
          displayName: 'Gemeinde Beta',
          organizationType: 'municipality',
          isActive: true,
          isDefaultContext: true,
        },
      ],
    ];

    const response = await updateMyOrganizationContextHandler(
      new Request('http://localhost/api/v1/iam/me/context', {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          'x-csrf-token': 'csrf-token',
        },
        body: JSON.stringify({ organizationId: '44444444-4444-4444-8444-444444444444' }),
      })
    );
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe('invalid_organization_id');
    expect(state.updateSessionCalls).toHaveLength(0);
  });

  it('rejects organization updates that would create a cycle in the hierarchy', async () => {
    state.dbResults = [
      {
        __throw: {
          ok: false,
          status: 409,
          code: 'conflict',
          message: 'Zyklische Organisationshierarchie ist unzulässig.',
        },
      },
    ];

    const response = await updateOrganizationHandler(
      new Request('http://localhost/api/v1/iam/organizations/22222222-2222-4222-8222-222222222222', {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          'x-csrf-token': 'csrf-token',
        },
        body: JSON.stringify({
          parentOrganizationId: '33333333-3333-4333-8333-333333333333',
        }),
      })
    );
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(409);
    expect(payload.error.code).toBe('conflict');
  });

  it('rejects deactivation when organization still has children or memberships', async () => {
    state.dbResults = [{ status: 'conflict' }];

    const response = await deactivateOrganizationHandler(
      new Request('http://localhost/api/v1/iam/organizations/22222222-2222-4222-8222-222222222222', {
        method: 'DELETE',
        headers: {
          'x-csrf-token': 'csrf-token',
        },
      })
    );
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(409);
    expect(payload.error.code).toBe('conflict');
  });

  it('switches the organization context, updates the session and emits invalidation', async () => {
    state.dbResults = [
      [
        {
          organizationId: '22222222-2222-4222-8222-222222222222',
          organizationKey: 'gemeinde-beta',
          displayName: 'Gemeinde Beta',
          organizationType: 'municipality',
          isActive: true,
          isDefaultContext: true,
        },
      ],
    ];

    const response = await updateMyOrganizationContextHandler(
      new Request('http://localhost/api/v1/iam/me/context', {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          'x-csrf-token': 'csrf-token',
        },
        body: JSON.stringify({ organizationId: '22222222-2222-4222-8222-222222222222' }),
      })
    );
    const payload = (await response.json()) as {
      data: {
        activeOrganizationId: string;
      };
    };

    expect(response.status).toBe(200);
    expect(payload.data.activeOrganizationId).toBe('22222222-2222-4222-8222-222222222222');
    expect(state.updateSessionCalls).toEqual([
      {
        sessionId: 'session-org-test',
        updates: { activeOrganizationId: '22222222-2222-4222-8222-222222222222' },
      },
    ]);
    expect(state.notifyCalls).toHaveLength(1);
    expect(state.notifyCalls[0]).toMatchObject({
      instanceId: '11111111-1111-1111-8111-111111111111',
      keycloakSubject: 'keycloak-admin-1',
      trigger: 'organization_context_switched',
    });
    expect(state.auditCalls).toHaveLength(1);
    expect(state.auditCalls[0]).toMatchObject({
      eventType: 'organization.context_switched',
      subjectId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    });
  });
});
