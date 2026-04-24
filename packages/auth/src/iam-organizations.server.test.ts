import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  user: {
    id: 'keycloak-admin-1',
    name: 'Admin User',
    roles: ['system_admin'],
    instanceId: 'de-musterhausen',
  },
  featureEnabled: true,
  rateLimitResponse: null as Response | null,
  roleCheckResponse: null as Response | null,
  csrfResponse: null as Response | null,
  actorResolution: {
    actor: {
      instanceId: 'de-musterhausen',
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
  queryResults: [] as unknown[],
  queryCalls: [] as Array<{ text: string; values: readonly unknown[] }>,
  session: undefined as { activeOrganizationId?: string } | undefined,
  updateSessionCalls: [] as Array<{ sessionId: string; updates: Record<string, unknown> }>,
  notifyCalls: [] as Array<Record<string, unknown>>,
  auditCalls: [] as Array<Record<string, unknown>>,
  reserveResponse: { status: 'reserved' as const },
  completeCalls: [] as Array<Record<string, unknown>>,
}));

vi.mock('./middleware.server', () => ({
  withAuthenticatedUser: vi.fn(async (_request: Request, handler: (ctx: unknown) => Promise<Response>) =>
    handler({
      sessionId: 'session-org-test',
      user: state.user,
    })
  ),
}));

vi.mock('@sva/server-runtime', () => ({
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
  toJsonErrorResponse: (status: number, code: string, publicMessage?: string, options?: { requestId?: string }) =>
    new Response(
      JSON.stringify({
        error: code,
        ...(publicMessage ? { message: publicMessage } : {}),
        ...(options?.requestId ? { requestId: options.requestId } : {}),
      }),
      { status, headers: { 'Content-Type': 'application/json' } }
    ),
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

    return work({
      query: vi.fn(async (text: string, values: readonly unknown[] = []) => {
        state.queryCalls.push({ text, values });
        if (state.queryResults.length === 0) {
          return { rowCount: 0, rows: [] };
        }

        const next = state.queryResults.shift();
        if (typeof next === 'object' && next !== null && '__throw' in next) {
          throw (next as { __throw: unknown }).__throw;
        }

        return next;
      }),
    });
  }),
  emitActivityLog: vi.fn(async (_client: unknown, input: Record<string, unknown>) => {
    state.auditCalls.push(input);
  }),
  notifyPermissionInvalidation: vi.fn(async (_client: unknown, input: Record<string, unknown>) => {
    state.notifyCalls.push(input);
  }),
  reserveIdempotency: vi.fn(async () => state.reserveResponse),
  completeIdempotency: vi.fn(async (input: Record<string, unknown>) => {
    state.completeCalls.push(input);
  }),
}));

import {
  assignOrganizationMembershipHandler,
  createOrganizationHandler,
  deactivateOrganizationHandler,
  getOrganizationHandler,
  getMyOrganizationContextHandler,
  listOrganizationsHandler,
  removeOrganizationMembershipHandler,
  updateOrganizationHandler,
  updateMyOrganizationContextHandler,
} from './iam-organizations.server';

describe('iam organizations handlers', () => {
  beforeEach(() => {
    state.user = {
      id: 'keycloak-admin-1',
      name: 'Admin User',
      roles: ['system_admin'],
      instanceId: 'de-musterhausen',
    };
    state.featureEnabled = true;
    state.rateLimitResponse = null;
    state.roleCheckResponse = null;
    state.csrfResponse = null;
    state.actorResolution = {
      actor: {
        instanceId: 'de-musterhausen',
        actorAccountId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        requestId: 'req-org-test',
        traceId: 'trace-org-test',
      },
    };
    state.dbResults = [];
    state.queryResults = [];
    state.queryCalls = [];
    state.session = undefined;
    state.updateSessionCalls = [];
    state.notifyCalls = [];
    state.auditCalls = [];
    state.reserveResponse = { status: 'reserved' };
    state.completeCalls = [];
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

  it('lists inactive organizations via database-backed filters', async () => {
    state.queryResults = [
      { rowCount: 1, rows: [{ total: 1 }] },
      {
        rowCount: 1,
        rows: [
          {
            id: '99999999-9999-4999-8999-999999999999',
            organization_key: 'alt-gemeinde',
            display_name: 'Alt Gemeinde',
            parent_organization_id: null,
            parent_display_name: null,
            organization_type: 'municipality',
            content_author_policy: 'org_only',
            is_active: false,
            depth: 0,
            hierarchy_path: [],
            child_count: 0,
            membership_count: 0,
          },
        ],
      },
    ];

    const response = await listOrganizationsHandler(
      new Request('http://localhost/api/v1/iam/organizations?page=1&pageSize=5&status=inactive')
    );
    const payload = (await response.json()) as {
      data: Array<{ id: string; isActive: boolean }>;
      pagination: { total: number };
    };

    expect(response.status).toBe(200);
    expect(payload.data).toEqual([
      expect.objectContaining({
        id: '99999999-9999-4999-8999-999999999999',
        isActive: false,
      }),
    ]);
    expect(payload.pagination.total).toBe(1);
  });

  it('escapes wildcard search terms before issuing organization list queries', async () => {
    state.queryResults = [
      { rowCount: 1, rows: [{ total: 0 }] },
      { rowCount: 0, rows: [] },
    ];

    const response = await listOrganizationsHandler(
      new Request('http://localhost/api/v1/iam/organizations?page=1&pageSize=5&search=100%_alpha\\\\beta')
    );

    expect(response.status).toBe(200);
    expect(state.queryCalls).toHaveLength(2);
    expect(state.queryCalls[0]?.text).toContain("ILIKE $2 ESCAPE '\\'");
    expect(state.queryCalls[1]?.text).toContain('WITH child_counts AS');
    expect(typeof state.queryCalls[0]?.values[1]).toBe('string');
    expect(state.queryCalls[0]?.values[1]).toEqual(expect.stringContaining('\\%'));
    expect(state.queryCalls[0]?.values[1]).toEqual(expect.stringContaining('\\_'));
    expect(state.queryCalls[0]?.values[1]).toEqual(expect.stringContaining('\\\\beta'));
  });

  it('rejects invalid organization type filters on the organization list', async () => {
    const response = await listOrganizationsHandler(
      new Request('http://localhost/api/v1/iam/organizations?page=1&pageSize=5&organizationType=invalid-type')
    );
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe('invalid_request');
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

  it('falls back to the default active organization context and persists the session update', async () => {
    state.queryResults = [
      {
        rowCount: 2,
        rows: [
          {
            organization_id: 'org-inactive',
            organization_key: 'archiv',
            display_name: 'Archiv',
            organization_type: 'district',
            is_active: false,
            is_default_context: false,
          },
          {
            organization_id: 'org-default',
            organization_key: 'gemeinde-beta',
            display_name: 'Gemeinde Beta',
            organization_type: 'municipality',
            is_active: true,
            is_default_context: true,
          },
        ],
      },
    ];
    state.session = { activeOrganizationId: 'org-inactive' };

    const response = await getMyOrganizationContextHandler(
      new Request('http://localhost/api/v1/iam/me/context')
    );
    const payload = (await response.json()) as {
      data: {
        activeOrganizationId?: string;
      };
    };

    expect(response.status).toBe(200);
    expect(payload.data.activeOrganizationId).toBe('org-default');
    expect(state.updateSessionCalls).toEqual([
      {
        sessionId: 'session-org-test',
        updates: { activeOrganizationId: 'org-default' },
      },
    ]);
  });

  it('returns organization detail with memberships and children', async () => {
    state.queryResults = [
      {
        rowCount: 1,
        rows: [
          {
            id: '22222222-2222-4222-8222-222222222222',
            organization_key: 'gemeinde-beta',
            display_name: 'Gemeinde Beta',
            parent_organization_id: null,
            parent_display_name: null,
            organization_type: 'municipality',
            content_author_policy: 'org_only',
            is_active: true,
            depth: 0,
            hierarchy_path: [],
            metadata: { category: 'kommune' },
            child_count: 1,
            membership_count: 1,
          },
        ],
      },
      {
        rowCount: 1,
        rows: [
          {
            account_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            keycloak_subject: 'subject-member-1',
            display_name_ciphertext: 'Max Muster',
            first_name_ciphertext: 'Max',
            last_name_ciphertext: 'Muster',
            email_ciphertext: 'max@example.com',
            membership_visibility: 'internal',
            is_default_context: true,
            created_at: '2026-03-09T10:00:00.000Z',
          },
        ],
      },
      {
        rowCount: 1,
        rows: [
          {
            id: '33333333-3333-4333-8333-333333333333',
            organization_key: 'ortsteil-gamma',
            display_name: 'Ortsteil Gamma',
            is_active: true,
          },
        ],
      },
    ];

    const response = await getOrganizationHandler(
      new Request('http://localhost/api/v1/iam/organizations/22222222-2222-4222-8222-222222222222')
    );
    const payload = (await response.json()) as {
      data: {
        id: string;
        memberships: Array<{ accountId: string; displayName: string }>;
        children: Array<{ id: string; displayName: string }>;
      };
    };

    expect(response.status).toBe(200);
    expect(payload.data.id).toBe('22222222-2222-4222-8222-222222222222');
    expect(payload.data.memberships[0]).toMatchObject({
      accountId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      displayName: 'Max Muster',
    });
    expect(payload.data.children[0]).toMatchObject({
      id: '33333333-3333-4333-8333-333333333333',
      displayName: 'Ortsteil Gamma',
    });
  });

  it('returns 404 when the requested organization detail does not exist', async () => {
    state.queryResults = [{ rowCount: 0, rows: [] }];

    const response = await getOrganizationHandler(
      new Request('http://localhost/api/v1/iam/organizations/22222222-2222-4222-8222-222222222222')
    );
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(404);
    expect(payload.error.code).toBe('not_found');
  });

  it('applies read rate limiting on organization detail reads', async () => {
    state.rateLimitResponse = new Response(
      JSON.stringify({
        error: {
          code: 'rate_limited',
          message: 'Zu viele Anfragen.',
        },
        requestId: 'req-org-test',
      }),
      {
        status: 429,
        headers: { 'content-type': 'application/json' },
      }
    );

    const response = await getOrganizationHandler(
      new Request('http://localhost/api/v1/iam/organizations/22222222-2222-4222-8222-222222222222')
    );
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(429);
    expect(payload.error.code).toBe('rate_limited');
  });

  it('creates an organization and completes idempotency tracking', async () => {
    state.queryResults = [
      {
        rowCount: 1,
        rows: [{ id: '44444444-4444-4444-8444-444444444444' }],
      },
      {
        rowCount: 1,
        rows: [
          {
            id: '44444444-4444-4444-8444-444444444444',
            organization_key: 'neue-gemeinde',
            display_name: 'Neue Gemeinde',
            parent_organization_id: null,
            parent_display_name: null,
            organization_type: 'municipality',
            content_author_policy: 'org_only',
            is_active: true,
            depth: 0,
            hierarchy_path: [],
            metadata: {},
            child_count: 0,
            membership_count: 0,
          },
        ],
      },
      { rowCount: 0, rows: [] },
      { rowCount: 0, rows: [] },
    ];

    const response = await createOrganizationHandler(
      new Request('http://localhost/api/v1/iam/organizations', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-csrf-token': 'csrf-token',
          'idempotency-key': 'org-create-1',
        },
        body: JSON.stringify({
          organizationKey: 'neue-gemeinde',
          displayName: 'Neue Gemeinde',
          organizationType: 'municipality',
          contentAuthorPolicy: 'org_only',
        }),
      })
    );
    const payload = (await response.json()) as { data: { organizationKey: string; displayName: string } };

    expect(response.status).toBe(201);
    expect(payload.data).toMatchObject({
      organizationKey: 'neue-gemeinde',
      displayName: 'Neue Gemeinde',
    });
    expect(state.completeCalls).toContainEqual(
      expect.objectContaining({
        endpoint: 'POST:/api/v1/iam/organizations',
        status: 'COMPLETED',
        responseStatus: 201,
      })
    );
    const createAuditCall = state.auditCalls.find((entry) => entry.eventType === 'organization.created');
    expect(createAuditCall).toMatchObject({
      eventType: 'organization.created',
      payload: expect.objectContaining({
        organizationId: '44444444-4444-4444-8444-444444444444',
      }),
    });
    expect(createAuditCall).not.toHaveProperty('subjectId');
  });

  it('returns the stored idempotent response for organization creation replays', async () => {
    state.reserveResponse = {
      status: 'replay',
      responseStatus: 201,
      responseBody: {
        data: {
          id: 'replayed-org',
          organizationKey: 'replay',
        },
        requestId: 'req-org-test',
      },
    };

    const response = await createOrganizationHandler(
      new Request('http://localhost/api/v1/iam/organizations', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-csrf-token': 'csrf-token',
          'idempotency-key': 'org-create-replay',
        },
        body: JSON.stringify({
          organizationKey: 'replay',
          displayName: 'Replay',
          organizationType: 'municipality',
          contentAuthorPolicy: 'org_only',
        }),
      })
    );
    const payload = (await response.json()) as { data: { id: string } };

    expect(response.status).toBe(201);
    expect(payload.data.id).toBe('replayed-org');
    expect(state.completeCalls).toHaveLength(0);
  });

  it('maps parent hierarchy validation failures during organization creation', async () => {
    state.queryResults = [
      {
        rowCount: 1,
        rows: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            organization_key: 'landkreis-alpha',
            display_name: 'Landkreis Alpha',
            parent_organization_id: null,
            parent_display_name: null,
            organization_type: 'county',
            content_author_policy: 'org_only',
            is_active: false,
            depth: 0,
            hierarchy_path: [],
            metadata: {},
            child_count: 0,
            membership_count: 0,
          },
        ],
      },
    ];

    const response = await createOrganizationHandler(
      new Request('http://localhost/api/v1/iam/organizations', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-csrf-token': 'csrf-token',
          'idempotency-key': 'org-create-parent',
        },
        body: JSON.stringify({
          organizationKey: 'neue-gemeinde',
          displayName: 'Neue Gemeinde',
          organizationType: 'municipality',
          contentAuthorPolicy: 'org_only',
          parentOrganizationId: '11111111-1111-4111-8111-111111111111',
        }),
      })
    );
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(409);
    expect(payload.error.code).toBe('organization_inactive');
    expect(state.completeCalls).toContainEqual(
      expect.objectContaining({
        endpoint: 'POST:/api/v1/iam/organizations',
        status: 'FAILED',
        responseStatus: 409,
      })
    );
  });

  it('maps duplicate organization keys during creation to a conflict response', async () => {
    state.dbResults = [{ __throw: new Error('organizations_instance_key_uniq') }];

    const response = await createOrganizationHandler(
      new Request('http://localhost/api/v1/iam/organizations', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-csrf-token': 'csrf-token',
          'idempotency-key': 'org-create-conflict',
        },
        body: JSON.stringify({
          organizationKey: 'duplikat',
          displayName: 'Duplikat',
          organizationType: 'municipality',
          contentAuthorPolicy: 'org_only',
        }),
      })
    );
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(409);
    expect(payload.error.code).toBe('conflict');
    expect(state.completeCalls).toContainEqual(
      expect.objectContaining({
        endpoint: 'POST:/api/v1/iam/organizations',
        status: 'FAILED',
        responseStatus: 409,
      })
    );
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

  it('returns 404 when updating an unknown organization', async () => {
    state.queryResults = [{ rowCount: 0, rows: [] }];

    const response = await updateOrganizationHandler(
      new Request('http://localhost/api/v1/iam/organizations/22222222-2222-4222-8222-222222222222', {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          'x-csrf-token': 'csrf-token',
        },
        body: JSON.stringify({
          displayName: 'Nicht da',
        }),
      })
    );
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(404);
    expect(payload.error.code).toBe('not_found');
  });

  it('applies write rate limiting on organization updates', async () => {
    state.rateLimitResponse = new Response(
      JSON.stringify({
        error: {
          code: 'rate_limited',
          message: 'Zu viele Anfragen.',
        },
        requestId: 'req-org-test',
      }),
      {
        status: 429,
        headers: { 'content-type': 'application/json' },
      }
    );

    const response = await updateOrganizationHandler(
      new Request('http://localhost/api/v1/iam/organizations/22222222-2222-4222-8222-222222222222', {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          'x-csrf-token': 'csrf-token',
        },
        body: JSON.stringify({
          displayName: 'Neue Gemeinde',
        }),
      })
    );
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(429);
    expect(payload.error.code).toBe('rate_limited');
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

  it('deactivates an organization without dependents', async () => {
    state.queryResults = [
      {
        rowCount: 1,
        rows: [
          {
            id: '22222222-2222-4222-8222-222222222222',
            organization_key: 'gemeinde-beta',
            display_name: 'Gemeinde Beta',
            parent_organization_id: null,
            parent_display_name: null,
            organization_type: 'municipality',
            content_author_policy: 'org_only',
            is_active: true,
            depth: 0,
            hierarchy_path: [],
            metadata: {},
            child_count: 0,
            membership_count: 0,
          },
        ],
      },
      { rowCount: 1, rows: [] },
    ];

    const response = await deactivateOrganizationHandler(
      new Request('http://localhost/api/v1/iam/organizations/22222222-2222-4222-8222-222222222222', {
        method: 'DELETE',
        headers: {
          'x-csrf-token': 'csrf-token',
        },
      })
    );
    const payload = (await response.json()) as { data: { id: string } };

    expect(response.status).toBe(200);
    expect(payload.data.id).toBe('22222222-2222-4222-8222-222222222222');
    const deactivateAuditCall = state.auditCalls.find((entry) => entry.eventType === 'organization.deactivated');
    expect(deactivateAuditCall).toMatchObject({
      eventType: 'organization.deactivated',
      payload: expect.objectContaining({
        organizationId: '22222222-2222-4222-8222-222222222222',
      }),
    });
    expect(deactivateAuditCall).not.toHaveProperty('subjectId');
  });

  it('applies write rate limiting on organization deactivation', async () => {
    state.rateLimitResponse = new Response(
      JSON.stringify({
        error: {
          code: 'rate_limited',
          message: 'Zu viele Anfragen.',
        },
        requestId: 'req-org-test',
      }),
      {
        status: 429,
        headers: { 'content-type': 'application/json' },
      }
    );

    const response = await deactivateOrganizationHandler(
      new Request('http://localhost/api/v1/iam/organizations/22222222-2222-4222-8222-222222222222', {
        method: 'DELETE',
        headers: {
          'x-csrf-token': 'csrf-token',
        },
      })
    );
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(429);
    expect(payload.error.code).toBe('rate_limited');
  });

  it('assigns an organization membership and returns the refreshed detail', async () => {
    state.queryResults = [
      {
        rowCount: 1,
        rows: [
          {
            id: '22222222-2222-4222-8222-222222222222',
            organization_key: 'gemeinde-beta',
            display_name: 'Gemeinde Beta',
            parent_organization_id: null,
            parent_display_name: null,
            organization_type: 'municipality',
            content_author_policy: 'org_only',
            is_active: true,
            depth: 0,
            hierarchy_path: [],
            metadata: {},
            child_count: 0,
            membership_count: 0,
          },
        ],
      },
      { rowCount: 1, rows: [{ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }] },
      { rowCount: 0, rows: [] },
      { rowCount: 1, rows: [] },
      {
        rowCount: 1,
        rows: [
          {
            id: '22222222-2222-4222-8222-222222222222',
            organization_key: 'gemeinde-beta',
            display_name: 'Gemeinde Beta',
            parent_organization_id: null,
            parent_display_name: null,
            organization_type: 'municipality',
            content_author_policy: 'org_only',
            is_active: true,
            depth: 0,
            hierarchy_path: [],
            metadata: {},
            child_count: 0,
            membership_count: 1,
          },
        ],
      },
      {
        rowCount: 1,
        rows: [
          {
            account_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            keycloak_subject: 'subject-member-1',
            display_name_ciphertext: 'Max Muster',
            first_name_ciphertext: 'Max',
            last_name_ciphertext: 'Muster',
            email_ciphertext: 'max@example.com',
            membership_visibility: 'internal',
            is_default_context: true,
            created_at: '2026-03-09T10:00:00.000Z',
          },
        ],
      },
      { rowCount: 0, rows: [] },
    ];

    const response = await assignOrganizationMembershipHandler(
      new Request('http://localhost/api/v1/iam/organizations/22222222-2222-4222-8222-222222222222/memberships', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-csrf-token': 'csrf-token',
          'idempotency-key': 'org-membership-1',
        },
        body: JSON.stringify({
          accountId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          visibility: 'internal',
        }),
      })
    );
    const payload = (await response.json()) as { data: { memberships: Array<{ accountId: string }> } };

    expect(response.status).toBe(200);
    expect(payload.data.memberships).toHaveLength(1);
    expect(state.notifyCalls).toContainEqual(
      expect.objectContaining({
        trigger: 'organization_membership_assigned',
      })
    );
    expect(state.completeCalls).toContainEqual(
      expect.objectContaining({
        endpoint: 'POST:/api/v1/iam/organizations/$organizationId/memberships',
        status: 'COMPLETED',
      })
    );
  });

  it('rejects assigning memberships for accounts outside the instance', async () => {
    state.queryResults = [
      {
        rowCount: 1,
        rows: [
          {
            id: '22222222-2222-4222-8222-222222222222',
            organization_key: 'gemeinde-beta',
            display_name: 'Gemeinde Beta',
            parent_organization_id: null,
            parent_display_name: null,
            organization_type: 'municipality',
            content_author_policy: 'org_only',
            is_active: true,
            depth: 0,
            hierarchy_path: [],
            metadata: {},
            child_count: 0,
            membership_count: 0,
          },
        ],
      },
      { rowCount: 0, rows: [] },
    ];

    const response = await assignOrganizationMembershipHandler(
      new Request('http://localhost/api/v1/iam/organizations/22222222-2222-4222-8222-222222222222/memberships', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-csrf-token': 'csrf-token',
          'idempotency-key': 'org-membership-invalid-account',
        },
        body: JSON.stringify({
          accountId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          visibility: 'internal',
        }),
      })
    );
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe('invalid_request');
  });

  it('returns the replayed membership response for idempotent assignment requests', async () => {
    state.reserveResponse = {
      status: 'replay',
      responseStatus: 200,
      responseBody: {
        data: {
          id: '22222222-2222-4222-8222-222222222222',
          memberships: [],
        },
        requestId: 'req-org-test',
      },
    };

    const response = await assignOrganizationMembershipHandler(
      new Request('http://localhost/api/v1/iam/organizations/22222222-2222-4222-8222-222222222222/memberships', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-csrf-token': 'csrf-token',
          'idempotency-key': 'org-membership-replay',
        },
        body: JSON.stringify({
          accountId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          visibility: 'internal',
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(state.completeCalls).toHaveLength(0);
  });

  it('removes an organization membership and assigns a fallback default context', async () => {
    state.queryResults = [
      { rowCount: 1, rows: [{ is_default_context: true }] },
      { rowCount: 1, rows: [] },
      { rowCount: 1, rows: [] },
      {
        rowCount: 1,
        rows: [
          {
            id: '22222222-2222-4222-8222-222222222222',
            organization_key: 'gemeinde-beta',
            display_name: 'Gemeinde Beta',
            parent_organization_id: null,
            parent_display_name: null,
            organization_type: 'municipality',
            content_author_policy: 'org_only',
            is_active: true,
            depth: 0,
            hierarchy_path: [],
            metadata: {},
            child_count: 0,
            membership_count: 0,
          },
        ],
      },
      { rowCount: 0, rows: [] },
      { rowCount: 0, rows: [] },
    ];

    const response = await removeOrganizationMembershipHandler(
      new Request(
        'http://localhost/api/v1/iam/organizations/22222222-2222-4222-8222-222222222222/memberships/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        {
          method: 'DELETE',
          headers: {
            'x-csrf-token': 'csrf-token',
          },
        }
      )
    );
    const payload = (await response.json()) as { data: { id: string } };

    expect(response.status).toBe(200);
    expect(payload.data.id).toBe('22222222-2222-4222-8222-222222222222');
    expect(state.notifyCalls).toContainEqual(
      expect.objectContaining({
        trigger: 'organization_membership_removed',
      })
    );
    expect(state.auditCalls).toContainEqual(
      expect.objectContaining({
        eventType: 'organization.membership_removed',
      })
    );
  });

  it('returns 404 when removing a missing organization membership', async () => {
    state.queryResults = [{ rowCount: 0, rows: [] }];

    const response = await removeOrganizationMembershipHandler(
      new Request(
        'http://localhost/api/v1/iam/organizations/22222222-2222-4222-8222-222222222222/memberships/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        {
          method: 'DELETE',
          headers: {
            'x-csrf-token': 'csrf-token',
          },
        }
      )
    );
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(404);
    expect(payload.error.code).toBe('not_found');
  });

  it('applies write rate limiting on membership removals', async () => {
    state.rateLimitResponse = new Response(
      JSON.stringify({
        error: {
          code: 'rate_limited',
          message: 'Zu viele Anfragen.',
        },
        requestId: 'req-org-test',
      }),
      {
        status: 429,
        headers: { 'content-type': 'application/json' },
      }
    );

    const response = await removeOrganizationMembershipHandler(
      new Request(
        'http://localhost/api/v1/iam/organizations/22222222-2222-4222-8222-222222222222/memberships/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        {
          method: 'DELETE',
          headers: {
            'x-csrf-token': 'csrf-token',
          },
        }
      )
    );
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(429);
    expect(payload.error.code).toBe('rate_limited');
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
      instanceId: 'de-musterhausen',
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
