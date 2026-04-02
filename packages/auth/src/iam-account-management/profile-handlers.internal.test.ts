import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  actorResolution: {
    actor: {
      instanceId: 'de-musterhausen',
      actorAccountId: 'account-1',
      requestId: 'req-profile',
      traceId: 'trace-profile',
    },
  } as
    | { actor: { instanceId: string; actorAccountId?: string; requestId?: string; traceId?: string } }
    | { error: Response },
  identityProvider: null as
    | null
    | {
        provider: {
          updateUser: ReturnType<typeof vi.fn>;
        };
      },
  loadProfileResult: {
    id: 'user-1',
    keycloakSubject: 'kc-1',
    username: 'alice',
    email: 'alice@example.com',
    firstName: 'Alice',
    lastName: 'Example',
    displayName: 'Alice Example',
  } as Record<string, unknown> | null,
  loadProfileError: null as unknown,
  updateProfileResult: {
    id: 'user-1',
    keycloakSubject: 'kc-1',
    username: 'alice',
    email: 'alice@example.com',
  } as Record<string, unknown> | null,
  updateProfileError: null as unknown,
  parseResult: {
    ok: true as const,
    data: {},
  } as { ok: true; data: Record<string, unknown> } | { ok: false },
  schemaChecks: [] as Array<{ ok: boolean; expectedMigration: string; schemaObject: string }>,
}));

vi.mock('@sva/sdk/server', () => ({
  createSdkLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
  getWorkspaceContext: () => ({ requestId: 'req-profile', traceId: 'trace-profile' }),
}));

vi.mock('../shared/db-helpers.js', () => ({
  jsonResponse: (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
}));

vi.mock('./api-helpers.js', () => ({
  asApiItem: (data: unknown, requestId?: string) => ({ data, ...(requestId ? { requestId } : {}) }),
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
  parseRequestBody: vi.fn(async () => state.parseResult),
}));

vi.mock('./diagnostics.js', () => ({
  classifyIamDiagnosticError: vi.fn((error: unknown, fallbackMessage: string) => {
    if (error instanceof Error && error.message === 'pii') {
      return {
        status: 503,
        code: 'internal_error',
        message: fallbackMessage,
        details: { reason_code: 'pii_encryption_missing' },
      };
    }
    return {
      status: 500,
      code: 'internal_error',
      message: fallbackMessage,
      details: { reason_code: 'unexpected_internal_error' },
    };
  }),
}));

vi.mock('./feature-flags.js', () => ({
  getFeatureFlags: vi.fn(() => ({})),
  ensureFeature: vi.fn(() => null),
}));

vi.mock('./profile-commands.js', () => ({
  loadMyProfileDetail: vi.fn(async () => {
    if (state.loadProfileError) {
      throw state.loadProfileError;
    }
    return state.loadProfileResult;
  }),
  updateMyProfileDetail: vi.fn(async () => {
    if (state.updateProfileError) {
      throw state.updateProfileError;
    }
    return state.updateProfileResult;
  }),
}));

vi.mock('./rate-limit.js', () => ({
  consumeRateLimit: vi.fn(() => null),
}));

vi.mock('./shared.js', () => ({
  iamUserOperationsCounter: { add: vi.fn() },
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  resolveActorInfo: vi.fn(async () => state.actorResolution),
  resolveIdentityProvider: vi.fn(() => state.identityProvider),
  trackKeycloakCall: vi.fn(async (_operation: string, fn: () => Promise<unknown>) => fn()),
  withInstanceScopedDb: vi.fn(async (_instanceId: string, fn: (client: unknown) => Promise<unknown>) =>
    fn({ query: vi.fn() })
  ),
}));

vi.mock('./schema-guard.js', () => ({
  runCriticalIamSchemaGuard: vi.fn(async () => ({ checks: state.schemaChecks })),
}));

vi.mock('./csrf.js', () => ({
  validateCsrf: vi.fn(() => null),
}));

vi.mock('./schemas.js', () => ({
  updateMyProfileSchema: {},
}));

import { getMyProfileInternal, updateMyProfileInternal } from './profile-handlers';

const ctx = {
  user: {
    id: 'kc-session',
    roles: ['editor'],
    instanceId: 'de-musterhausen',
  },
} as never;

describe('iam-account-management/profile-handlers internals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.actorResolution = {
      actor: {
        instanceId: 'de-musterhausen',
        actorAccountId: 'account-1',
        requestId: 'req-profile',
        traceId: 'trace-profile',
      },
    };
    state.identityProvider = null;
    state.loadProfileResult = {
      id: 'user-1',
      keycloakSubject: 'kc-1',
      username: 'alice',
      email: 'alice@example.com',
      firstName: 'Alice',
      lastName: 'Example',
      displayName: 'Alice Example',
    };
    state.loadProfileError = null;
    state.updateProfileResult = {
      id: 'user-1',
      keycloakSubject: 'kc-1',
      username: 'alice',
      email: 'alice@example.com',
    };
    state.updateProfileError = null;
    state.parseResult = { ok: true, data: {} };
    state.schemaChecks = [];
  });

  it('returns not_found when the profile detail cannot be resolved', async () => {
    state.loadProfileResult = null;

    const response = await getMyProfileInternal(new Request('http://localhost/api/v1/iam/users/me/profile'), ctx);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'not_found',
        message: 'Nutzerprofil nicht gefunden.',
      },
      requestId: 'req-profile',
    });
  });

  it('returns keycloak_unavailable for write requests without an identity provider', async () => {
    state.parseResult = { ok: true, data: { email: 'new@example.com' } };

    const response = await updateMyProfileInternal(
      new Request('http://localhost/api/v1/iam/users/me/profile', { method: 'PATCH' }),
      ctx
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'keycloak_unavailable',
        message: 'Keycloak Admin API ist nicht konfiguriert.',
      },
      requestId: 'req-profile',
    });
  });

  it('restores the previous identity profile when the local update fails after keycloak sync', async () => {
    const updateUser = vi.fn(async () => undefined);
    state.identityProvider = { provider: { updateUser } };
    state.parseResult = { ok: true, data: { email: 'new@example.com', displayName: 'Alice New' } };
    state.updateProfileError = new Error('boom');

    const response = await updateMyProfileInternal(
      new Request('http://localhost/api/v1/iam/users/me/profile', { method: 'PATCH' }),
      ctx
    );

    expect(response.status).toBe(500);
    expect(updateUser).toHaveBeenCalledTimes(2);
    expect(updateUser).toHaveBeenNthCalledWith(
      1,
      'kc-1',
      expect.objectContaining({
        email: 'new@example.com',
        attributes: { displayName: 'Alice New' },
      })
    );
    expect(updateUser).toHaveBeenNthCalledWith(
      2,
      'kc-1',
      expect.objectContaining({
        username: 'alice',
        email: 'alice@example.com',
        firstName: 'Alice',
        lastName: 'Example',
        attributes: { displayName: 'Alice Example' },
      })
    );
  });

  it('falls back to schema drift diagnostics when loading the profile fails unexpectedly', async () => {
    state.loadProfileError = new Error('db exploded');
    state.schemaChecks = [
      {
        ok: false,
        expectedMigration: '0019_iam_account_groups_origin_compat.sql',
        schemaObject: 'iam.account_groups.origin',
      },
    ];

    const response = await getMyProfileInternal(new Request('http://localhost/api/v1/iam/users/me/profile'), ctx);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'database_unavailable',
        message: 'Profil konnte nicht geladen werden.',
        details: {
          dependency: 'database',
          expected_migration: '0019_iam_account_groups_origin_compat.sql',
          instance_id: 'de-musterhausen',
          reason_code: 'schema_drift',
          schema_object: 'iam.account_groups.origin',
        },
      },
      requestId: 'req-profile',
    });
  });
});
