import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createOrganizationMutationHandlers,
  type OrganizationMutationHandlerDeps,
} from './organization-mutation-handlers.js';

const state = {
  actorResolution: {
    actor: {
      instanceId: 'de-musterhausen',
      actorAccountId: 'account-1',
      requestId: 'req-org',
      traceId: 'trace-org',
    },
  } as
    | { actor: { instanceId: string; actorAccountId?: string; requestId?: string; traceId?: string } }
    | { error: Response },
  reserve: { status: 'reserved' as const } as
    | { status: 'reserved' }
    | { status: 'replay'; responseStatus: number; responseBody: unknown }
    | { status: 'conflict'; message: string },
  parseResult: {
    ok: true as const,
    data: {
      organizationKey: 'alpha',
      displayName: 'Alpha',
      organizationType: 'municipality',
      contentAuthorPolicy: 'org_only',
      organizationId: '11111111-1111-1111-8111-111111111111',
    },
    rawBody: '{}',
  } as { ok: true; data: Record<string, unknown>; rawBody: string } | { ok: false },
  contextOptions: [
    {
      organizationId: '11111111-1111-1111-8111-111111111111',
      organizationKey: 'alpha',
      isActive: true,
    },
  ],
  detail: {
    id: '11111111-1111-1111-8111-111111111111',
    organizationKey: 'alpha',
  } as unknown,
};

const completeIdempotency = vi.fn();
const emitActivityLog = vi.fn();
const notifyPermissionInvalidation = vi.fn();
const updateSession = vi.fn();
const loggerInfo = vi.fn();
const loggerError = vi.fn();

const json = async (response: Response) => response.json() as Promise<Record<string, unknown>>;

const buildDeps = (): OrganizationMutationHandlerDeps => ({
  asApiItem: (data, requestId) => ({ data, ...(requestId ? { requestId } : {}) }),
  completeIdempotency,
  consumeRateLimit: vi.fn(() => null),
  createActorResolutionDetails: vi.fn((input) => input),
  createApiError: (status, code, message, requestId, details) =>
    new Response(JSON.stringify({ error: { code, message, ...(details ? { details } : {}) }, ...(requestId ? { requestId } : {}) }), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  emitActivityLog,
  ensureFeature: vi.fn(() => null),
  getFeatureFlags: vi.fn(() => ({})),
  getWorkspaceContext: vi.fn(() => ({ requestId: 'req-org' })),
  isHierarchyError: (value): value is { ok: false; status: number; code: never; message: string } =>
    Boolean(value && typeof value === 'object' && 'ok' in value && value.ok === false),
  isUuid: (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value),
  jsonResponse: (status, payload) =>
    new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } }),
  loadContextOptions: vi.fn(async () => state.contextOptions),
  loadOrganizationById: vi.fn(async () => ({
    id: '11111111-1111-1111-8111-111111111111',
    organization_key: 'alpha',
    is_active: true,
    parent_organization_id: null,
    hierarchy_path: [],
    depth: 0,
    child_count: 0,
    membership_count: 0,
  })),
  loadOrganizationDetail: vi.fn(async () => state.detail),
  logger: {
    info: loggerInfo,
    error: loggerError,
  },
  notifyPermissionInvalidation,
  parseRequestBody: vi.fn(async () => state.parseResult as never),
  randomUUID: vi.fn(() => '11111111-1111-1111-8111-111111111111'),
  readPathSegment: vi.fn(
    (request: Request, index: number) =>
      new URL(request.url).pathname.split('/').filter((segment) => segment.length > 0)[index]
  ),
  rebuildOrganizationSubtree: vi.fn(),
  requireIdempotencyKey: vi.fn(() => ({ key: 'idem-org-1' })),
  requireRoles: vi.fn(() => null),
  reserveIdempotency: vi.fn(async () => state.reserve),
  resolveActorInfo: vi.fn(async () => state.actorResolution),
  resolveHierarchyFields: vi.fn(async () => ({ ok: true, hierarchyPath: [], depth: 0 })),
  toPayloadHash: vi.fn(() => 'hash-org-1'),
  updateSession,
  validateCsrf: vi.fn(() => null),
  withInstanceScopedDb: vi.fn(async (_instanceId, work) => {
    const client = {
      query: vi.fn(async (text: string) => {
        if (text.includes('INSERT INTO iam.organizations')) {
          return { rowCount: 1, rows: [{ id: '11111111-1111-1111-8111-111111111111' }] };
        }
        if (text.includes('SELECT id') || text.includes('SELECT organization_id')) {
          return { rowCount: 0, rows: [] };
        }
        return { rowCount: 1, rows: [{ is_default_context: true }] };
      }),
    };
    return work(client);
  }),
});

const ctx = {
  sessionId: 'session-1',
  user: {
    id: 'kc-1',
    roles: ['system_admin'],
  },
};

describe('organization mutation handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.actorResolution = {
      actor: {
        instanceId: 'de-musterhausen',
        actorAccountId: 'account-1',
        requestId: 'req-org',
        traceId: 'trace-org',
      },
    };
    state.reserve = { status: 'reserved' };
    state.parseResult = {
      ok: true,
      data: {
        organizationKey: 'alpha',
        displayName: 'Alpha',
        organizationType: 'municipality',
        contentAuthorPolicy: 'org_only',
        organizationId: '11111111-1111-1111-8111-111111111111',
      },
      rawBody: '{}',
    };
  });

  it('creates organizations and completes idempotency', async () => {
    const handlers = createOrganizationMutationHandlers(buildDeps());

    const response = await handlers.createOrganizationInternal(
      new Request('http://localhost/api/v1/iam/organizations', { method: 'POST' }),
      ctx
    );

    expect(response.status).toBe(201);
    await expect(json(response)).resolves.toMatchObject({ data: { organizationKey: 'alpha' }, requestId: 'req-org' });
    expect(completeIdempotency).toHaveBeenCalledWith(expect.objectContaining({ status: 'COMPLETED', responseStatus: 201 }));
    expect(emitActivityLog).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ eventType: 'organization.created' }));
  });

  it('creates organizations for text-scoped instance ids without uuid-casting instance_id', async () => {
    const deps = buildDeps();
    const observedQueries: string[] = [];
    deps.withInstanceScopedDb = vi.fn(async (_instanceId, work) => {
      const client = {
        query: vi.fn(async (text: string) => {
          observedQueries.push(text);
          if (text.includes('INSERT INTO iam.organizations')) {
            return { rowCount: 1, rows: [{ id: '11111111-1111-1111-8111-111111111111' }] };
          }
          return { rowCount: 1, rows: [{ is_default_context: true }] };
        }),
      };
      return work(client);
    });
    const handlers = createOrganizationMutationHandlers(deps);

    const response = await handlers.createOrganizationInternal(
      new Request('http://localhost/api/v1/iam/organizations', { method: 'POST' }),
      ctx
    );

    expect(response.status).toBe(201);
    expect(observedQueries.find((query) => query.includes('INSERT INTO iam.organizations'))).not.toContain('$2::uuid');
  });

  it('logs the underlying database error before returning database_unavailable', async () => {
    const deps = buildDeps();
    deps.withInstanceScopedDb = vi.fn(async () => {
      throw new Error('invalid input syntax for type uuid: "de-musterhausen"');
    });
    const handlers = createOrganizationMutationHandlers(deps);

    const response = await handlers.createOrganizationInternal(
      new Request('http://localhost/api/v1/iam/organizations', { method: 'POST' }),
      ctx
    );

    expect(response.status).toBe(503);
    expect(loggerError).toHaveBeenCalledWith(
      'IAM organization creation failed',
      expect.objectContaining({
        workspace_id: 'de-musterhausen',
        context: expect.objectContaining({
          operation: 'create_organization',
          instance_id: 'de-musterhausen',
          request_id: 'req-org',
          trace_id: 'trace-org',
          actor_account_id: 'account-1',
          error: 'invalid input syntax for type uuid: "de-musterhausen"',
        }),
      })
    );
  });

  it('returns forbidden with actor diagnostics when the actor account is missing', async () => {
    state.actorResolution = { actor: { instanceId: 'de-musterhausen', requestId: 'req-org' } };
    const handlers = createOrganizationMutationHandlers(buildDeps());

    const response = await handlers.createOrganizationInternal(
      new Request('http://localhost/api/v1/iam/organizations', { method: 'POST' }),
      ctx
    );

    expect(response.status).toBe(403);
    await expect(json(response)).resolves.toMatchObject({
      error: { code: 'forbidden', details: { actorResolution: 'missing_actor_account' } },
    });
  });

  it('returns the feature-gate response before resolving the actor', async () => {
    const deps = buildDeps();
    deps.ensureFeature = vi.fn(() => new Response('disabled', { status: 451 }));
    const handlers = createOrganizationMutationHandlers(deps);

    const response = await handlers.createOrganizationInternal(
      new Request('http://localhost/api/v1/iam/organizations', { method: 'POST' }),
      ctx
    );

    expect(response.status).toBe(451);
    expect(deps.resolveActorInfo).not.toHaveBeenCalled();
  });

  it('replays an existing idempotent organization create result', async () => {
    const deps = buildDeps();
    deps.reserveIdempotency = vi.fn(async () => ({
      status: 'replay',
      responseStatus: 202,
      responseBody: { data: { organizationKey: 'alpha' }, replayed: true },
    }));
    const handlers = createOrganizationMutationHandlers(deps);

    const response = await handlers.createOrganizationInternal(
      new Request('http://localhost/api/v1/iam/organizations', { method: 'POST' }),
      ctx
    );

    expect(response.status).toBe(202);
    await expect(json(response)).resolves.toMatchObject({ replayed: true });
    expect(deps.withInstanceScopedDb).not.toHaveBeenCalled();
  });

  it('returns a conflict for reused idempotency keys with a different payload', async () => {
    const deps = buildDeps();
    deps.reserveIdempotency = vi.fn(async () => ({
      status: 'conflict',
      message: 'payload mismatch',
    }));
    const handlers = createOrganizationMutationHandlers(deps);

    const response = await handlers.createOrganizationInternal(
      new Request('http://localhost/api/v1/iam/organizations', { method: 'POST' }),
      ctx
    );

    expect(response.status).toBe(409);
    await expect(json(response)).resolves.toMatchObject({
      error: { code: 'idempotency_key_reuse', message: 'payload mismatch' },
    });
  });

  it('switches the active organization context and invalidates permissions', async () => {
    const handlers = createOrganizationMutationHandlers(buildDeps());

    const response = await handlers.updateMyOrganizationContextInternal(
      new Request('http://localhost/api/v1/iam/me/organization-context', { method: 'PATCH' }),
      ctx
    );

    expect(response.status).toBe(200);
    expect(updateSession).toHaveBeenCalledWith('session-1', {
      activeOrganizationId: '11111111-1111-1111-8111-111111111111',
    });
    expect(notifyPermissionInvalidation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ trigger: 'organization_context_switched' })
    );
  });

  it('returns invalid_organization_id when the requested organization is outside the actor context', async () => {
    const deps = buildDeps();
    state.parseResult = {
      ok: true,
      data: { organizationId: '22222222-2222-2222-8222-222222222222' },
      rawBody: '{}',
    };
    const handlers = createOrganizationMutationHandlers(deps);

    const response = await handlers.updateMyOrganizationContextInternal(
      new Request('http://localhost/api/v1/iam/me/organization-context', { method: 'PATCH' }),
      ctx
    );

    expect(response.status).toBe(400);
    await expect(json(response)).resolves.toMatchObject({
      error: { code: 'invalid_organization_id' },
    });
  });
});
