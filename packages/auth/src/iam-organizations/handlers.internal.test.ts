import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
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
  reserve: { status: 'reserved' as 'reserved' | 'replay' | 'conflict' } as
    | { status: 'reserved' }
    | { status: 'replay'; responseStatus: number; responseBody: unknown }
    | { status: 'conflict'; message: string },
  contextOptions: [
    {
      organization_id: 'org-1',
      organization_key: 'alpha',
      display_name: 'Alpha',
      organization_type: 'municipality',
      is_active: true,
      is_default_context: true,
    },
  ],
  session: undefined as undefined | { activeOrganizationId?: string },
  updateSession: vi.fn(),
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => ({ info: vi.fn() }),
  getWorkspaceContext: () => ({ requestId: 'req-org' }),
}));

vi.mock('../shared/db-helpers.js', () => ({
  jsonResponse: (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
}));

vi.mock('../redis-session.server.js', () => ({
  getSession: vi.fn(async () => state.session),
  updateSession: state.updateSession,
}));

vi.mock('../iam-account-management/api-helpers.js', () => ({
  asApiItem: (data: unknown, requestId?: string) => ({ data, ...(requestId ? { requestId } : {}) }),
  asApiList: (data: unknown, pagination: unknown, requestId?: string) => ({ data, pagination, ...(requestId ? { requestId } : {}) }),
  createApiError: (
    status: number,
    code: string,
    message: string,
    requestId?: string,
    details?: Record<string, unknown>
  ) =>
    new Response(
      JSON.stringify({ error: { code, message, ...(details ? { details } : {}) }, ...(requestId ? { requestId } : {}) }),
      { status, headers: { 'content-type': 'application/json' } }
    ),
  parseRequestBody: vi.fn(async (_request: Request, schema: unknown) => {
    if (schema && typeof schema === 'object') {
      return { ok: true, data: { organizationId: 'org-1' }, rawBody: '{}' };
    }
    return { ok: false };
  }),
  readPage: vi.fn(() => ({ page: 1, pageSize: 20 })),
  readPathSegment: vi.fn(
    (request: Request, index: number) =>
      new URL(request.url).pathname.split('/').filter((segment) => segment.length > 0)[index]
  ),
  requireIdempotencyKey: vi.fn(() => ({ key: 'idem-1' })),
  toPayloadHash: vi.fn(() => 'hash-1'),
}));

vi.mock('../iam-account-management/diagnostics.js', () => ({
  createActorResolutionDetails: vi.fn(({ actorResolution, instanceId }) => ({
    actor_resolution: actorResolution,
    instance_id: instanceId,
    reason_code: actorResolution,
  })),
}));

vi.mock('../iam-account-management/rate-limit.js', () => ({
  consumeRateLimit: vi.fn(() => null),
}));

vi.mock('../iam-account-management/shared.js', () => ({
  completeIdempotency: vi.fn(),
  emitActivityLog: vi.fn(),
  logger: { info: vi.fn() },
  notifyPermissionInvalidation: vi.fn(),
  requireRoles: vi.fn(() => null),
  reserveIdempotency: vi.fn(async () => state.reserve),
  resolveActorInfo: vi.fn(async () => state.actorResolution),
  withInstanceScopedDb: vi.fn(async (_instanceId: string, fn: (client: unknown) => Promise<unknown>) => {
    const client = {
      query: vi.fn(async (text: string) => {
        if (text.includes('FROM iam.account_organizations membership')) {
          return { rowCount: state.contextOptions.length, rows: state.contextOptions };
        }
        return { rowCount: 0, rows: [] };
      }),
    };
    return fn(client);
  }),
}));

vi.mock('../iam-account-management/feature-flags.js', () => ({
  getFeatureFlags: vi.fn(() => ({})),
  ensureFeature: vi.fn(() => null),
}));

vi.mock('../iam-account-management/csrf.js', () => ({
  validateCsrf: vi.fn(() => null),
}));

import {
  createOrganizationInternal,
  getMyOrganizationContextInternal,
  getOrganizationInternal,
  listOrganizationsInternal,
  updateMyOrganizationContextInternal,
} from './handlers';

const ctx = {
  user: {
    id: 'kc-1',
    roles: ['system_admin'],
  },
  sessionId: 'session-1',
} as never;

describe('iam-organizations handler internals', () => {
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
    state.session = undefined;
    state.contextOptions = [
      {
        organization_id: 'org-1',
        organization_key: 'alpha',
        display_name: 'Alpha',
        organization_type: 'municipality',
        is_active: true,
        is_default_context: true,
      },
    ];
  });

  it('rejects invalid organization filters and path ids', async () => {
    const listResponse = await listOrganizationsInternal(
      new Request('http://localhost/api/v1/iam/organizations?organizationType=invalid'),
      ctx
    );
    const getResponse = await getOrganizationInternal(
      new Request('http://localhost/api/v1/iam/organizations/not-a-uuid'),
      ctx
    );

    expect(listResponse.status).toBe(400);
    expect(getResponse.status).toBe(400);
  });

  it('returns forbidden when the actor account is missing during organization creation', async () => {
    state.actorResolution = {
      actor: {
        instanceId: 'de-musterhausen',
        requestId: 'req-org',
      },
    };

    const response = await createOrganizationInternal(
      new Request('http://localhost/api/v1/iam/organizations', { method: 'POST' }),
      ctx
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'forbidden',
        message: 'Akteur-Account nicht gefunden.',
        details: {
          actor_resolution: 'missing_actor_account',
          instance_id: 'de-musterhausen',
          reason_code: 'missing_actor_account',
        },
      },
      requestId: 'req-org',
    });
  });

  it('handles organization create idempotency replay and conflict', async () => {
    state.reserve = {
      status: 'replay',
      responseStatus: 202,
      responseBody: { data: { id: 'org-1' } },
    };

    const replay = await createOrganizationInternal(
      new Request('http://localhost/api/v1/iam/organizations', { method: 'POST' }),
      ctx
    );
    expect(replay.status).toBe(202);

    state.reserve = { status: 'conflict', message: 'payload mismatch' };
    const conflict = await createOrganizationInternal(
      new Request('http://localhost/api/v1/iam/organizations', { method: 'POST' }),
      ctx
    );
    expect(conflict.status).toBe(409);
  });

  it('updates the active organization context only when the target is valid and active', async () => {
    state.session = { activeOrganizationId: 'org-2' };

    const getResponse = await getMyOrganizationContextInternal(
      new Request('http://localhost/api/v1/iam/me/context'),
      ctx
    );
    expect(getResponse.status).toBe(200);
    expect(state.updateSession).toHaveBeenCalledWith('session-1', { activeOrganizationId: 'org-1' });
    state.updateSession.mockClear();

    const updateResponse = await updateMyOrganizationContextInternal(
      new Request('http://localhost/api/v1/iam/me/context', { method: 'PUT' }),
      ctx
    );
    expect(updateResponse.status).toBe(200);
    expect(state.updateSession).toHaveBeenCalledWith('session-1', { activeOrganizationId: 'org-1' });
  });
});
