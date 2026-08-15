import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IdentityListedUser } from '../identity-provider-port.js';

type LocalProfileSeed = {
  readonly username?: string;
  readonly email?: string;
  readonly firstName?: string;
  readonly lastName?: string;
};

type ImportReport = {
  readonly outcome: 'success' | 'partial_failure' | 'failed';
  readonly checkedCount: number;
  readonly correctedCount: number;
  readonly manualReviewCount: number;
  readonly importedCount: number;
  readonly updatedCount: number;
  readonly repairedProfileCount?: number;
};

type RunImportSync = (input: {
  readonly instanceId: string;
  readonly actorAccountId?: string;
  readonly requestId?: string;
  readonly traceId?: string;
}) => Promise<{ readonly report: ImportReport }>;

const state = vi.hoisted(() => ({
  createSyncUsersFromKeycloakHandlerInternal: vi.fn(),
  createApiError: vi.fn(
    (
      status: number,
      code: string,
      _message: string,
      requestId?: string,
      details?: Record<string, unknown>
    ) => new Response(JSON.stringify({ code, requestId, details }), { status })
  ),
  emitActivityLog: vi.fn(),
  events: [] as string[],
  identityProvider: undefined as
    | {
        readonly realm: string;
        readonly source: 'instance';
        readonly executionMode: 'tenant_admin';
        readonly provider: {
          readonly listUsers: ReturnType<typeof vi.fn>;
          readonly updateUser: ReturnType<typeof vi.fn>;
        };
      }
    | null
    | undefined,
  loadLocalProfileSeed: vi.fn(),
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
  mapSyncErrorResponse: undefined as
    ((error: unknown, requestId?: string) => Response | undefined) | undefined,
  query: vi.fn(),
  runImportSync: undefined as RunImportSync | undefined,
  upsertIdentityUser: vi.fn(),
}));

vi.mock('@sva/iam-admin', () => ({
  createSyncUsersFromKeycloakHandlerInternal: state.createSyncUsersFromKeycloakHandlerInternal,
  createUserImportPersistence: vi.fn(() => ({
    loadLocalProfileSeed: state.loadLocalProfileSeed,
    upsertIdentityUser: state.upsertIdentityUser,
  })),
  IamSchemaDriftError: class IamSchemaDriftError extends Error {
    expectedMigration = 'test-migration';
    schemaObject = 'test-schema-object';
  },
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: vi.fn(() => state.logger),
  getWorkspaceContext: vi.fn(() => ({})),
}));

vi.mock('../db.js', () => ({
  jsonResponse: vi.fn(),
}));

vi.mock('../log-context.js', () => ({
  buildLogContext: vi.fn(() => ({})),
}));

vi.mock('./api-helpers.js', () => ({
  asApiItem: vi.fn(),
  createApiError: state.createApiError,
}));

vi.mock('./csrf.js', () => ({
  validateCsrf: vi.fn(),
}));

vi.mock('./feature-flags.js', () => ({
  ensureFeature: vi.fn(),
  getFeatureFlags: vi.fn(),
}));

vi.mock('./platform-iam-sync.js', () => ({
  runPlatformKeycloakUserSync: vi.fn(),
}));

vi.mock('./rate-limit.js', () => ({
  consumeRateLimit: vi.fn(),
}));

vi.mock('./mutation-request-context.shared.js', () => ({
  resolveMutationActorWithAccount: vi.fn(),
}));

vi.mock('./shared.js', () => ({
  emitActivityLog: state.emitActivityLog,
  iamUserOperationsCounter: { add: vi.fn() },
  logger: state.logger,
  requireRoles: vi.fn(),
  resolveIdentityProviderForInstance: vi.fn(async () => state.identityProvider),
  trackKeycloakCall: vi.fn(async (operation: string, run: () => Promise<unknown>) => {
    state.events.push(`track:${operation}:start`);
    const result = await run();
    state.events.push(`track:${operation}:end`);
    return result;
  }),
  withInstanceScopedDb: vi.fn(
    async (
      _instanceId: string,
      run: (client: { query: typeof state.query }) => Promise<unknown>
    ) => {
      state.events.push('db:start');
      const result = await run({ query: state.query });
      state.events.push('db:end');
      return result;
    }
  ),
}));

const createUser = (overrides: Partial<IdentityListedUser> = {}): IdentityListedUser => ({
  externalId: 'subject-1',
  username: 'source-user',
  email: 'source@example.test',
  firstName: 'Source',
  lastName: 'User',
  enabled: true,
  ...overrides,
});

const runSync = async (input: {
  readonly user: IdentityListedUser;
  readonly seed?: LocalProfileSeed | null;
  readonly instanceId?: string;
}) => {
  state.loadLocalProfileSeed.mockImplementationOnce(async () => {
    state.events.push('seed:load');
    return input.seed ?? null;
  });
  state.upsertIdentityUser.mockImplementationOnce(async () => {
    state.events.push('iam:upsert');
    return { accountId: 'account-1', created: true };
  });
  state.identityProvider = {
    realm: 'tenant-realm',
    source: 'instance',
    executionMode: 'tenant_admin',
    provider: {
      listUsers: vi.fn(async () => {
        state.events.push('keycloak:list');
        return [input.user];
      }),
      updateUser: vi.fn(async () => {
        state.events.push('keycloak:update');
      }),
    },
  };

  const runImportSync = state.runImportSync;
  if (!runImportSync) {
    throw new Error('run_import_sync_not_captured');
  }
  const result = await runImportSync({
    instanceId: input.instanceId ?? 'instance-1',
    actorAccountId: 'actor-1',
    requestId: 'request-1',
    traceId: 'trace-1',
  });

  return {
    ...result,
    provider: state.identityProvider.provider,
  };
};

describe('user-import-sync-handler profile repair characterization', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    state.emitActivityLog.mockReset();
    state.loadLocalProfileSeed.mockReset();
    state.upsertIdentityUser.mockReset();
    state.events.length = 0;
    state.identityProvider = undefined;
    state.mapSyncErrorResponse = undefined;
    state.runImportSync = undefined;
    state.query.mockImplementation(async (query: string) => {
      state.events.push(query.split(' ')[0] ?? 'query');
      return { rows: [] };
    });
    state.createSyncUsersFromKeycloakHandlerInternal.mockImplementation(
      (deps: {
        mapSyncErrorResponse: (error: unknown, requestId?: string) => Response | undefined;
        runKeycloakUserImportSync: RunImportSync;
      }) => {
        state.mapSyncErrorResponse = deps.mapSyncErrorResponse;
        state.runImportSync = deps.runKeycloakUserImportSync;
        return vi.fn();
      }
    );
    vi.resetModules();
    await import('./user-import-sync-handler.js');
  });

  it('keeps a complete source profile unchanged even when every local value conflicts', async () => {
    const user = createUser();
    const result = await runSync({
      user,
      seed: {
        username: 'seed-user',
        email: 'seed@example.test',
        firstName: 'Seed',
        lastName: 'Conflict',
      },
    });

    expect(result.provider.updateUser).not.toHaveBeenCalled();
    expect(state.upsertIdentityUser).toHaveBeenCalledWith(expect.anything(), {
      instanceId: 'instance-1',
      user,
    });
    expect(result.report).toMatchObject({
      outcome: 'success',
      checkedCount: 1,
      correctedCount: 1,
      manualReviewCount: 0,
      importedCount: 1,
      updatedCount: 0,
    });
  });

  it.each([
    {
      name: 'fills every blank source field from the local seed',
      user: createUser({ username: ' ', email: ' ', firstName: '', lastName: '   ' }),
      seed: {
        username: 'seed-user',
        email: 'seed@example.test',
        firstName: 'Seed',
        lastName: 'User',
      },
      expected: {
        username: 'seed-user',
        email: 'seed@example.test',
        firstName: 'Seed',
        lastName: 'User',
      },
    },
    {
      name: 'keeps a source email while filling both missing names from a conflicting seed',
      user: createUser({ email: 'source@example.test', firstName: undefined, lastName: undefined }),
      seed: { email: 'seed@example.test', firstName: 'Seed', lastName: 'User' },
      expected: { email: 'source@example.test', firstName: 'Seed', lastName: 'User' },
    },
    {
      name: 'keeps a source first name while filling email and last name from the seed',
      user: createUser({ email: undefined, firstName: 'Source', lastName: undefined }),
      seed: { email: 'seed@example.test', firstName: 'Seed', lastName: 'User' },
      expected: { email: 'seed@example.test', firstName: 'Source', lastName: 'User' },
    },
    {
      name: 'keeps a source last name while filling email and first name from the seed',
      user: createUser({ email: undefined, firstName: undefined, lastName: 'Source' }),
      seed: { email: 'seed@example.test', firstName: 'Seed', lastName: 'User' },
      expected: { email: 'seed@example.test', firstName: 'Seed', lastName: 'Source' },
    },
    {
      name: 'uses the source username as the final email fallback',
      user: createUser({ username: 'username@example.test', email: undefined }),
      seed: { firstName: 'Seed', lastName: 'User' },
      expected: { username: 'username@example.test', email: 'username@example.test' },
    },
    {
      name: 'uses the local username as the final email fallback',
      user: createUser({ username: undefined, email: undefined }),
      seed: { username: 'seed@example.test', firstName: 'Seed', lastName: 'User' },
      expected: { username: 'seed@example.test', email: 'seed@example.test' },
    },
  ])('$name', async ({ user, seed, expected }) => {
    const result = await runSync({ user, seed });

    expect(result.provider.updateUser).toHaveBeenCalledOnce();
    expect(result.provider.updateUser).toHaveBeenCalledWith(
      'subject-1',
      expect.objectContaining(expected)
    );
    expect(state.upsertIdentityUser).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        instanceId: 'instance-1',
        user: expect.objectContaining(expected),
      })
    );
    expect(result.report).toMatchObject({
      outcome: 'success',
      correctedCount: 1,
      manualReviewCount: 0,
      repairedProfileCount: 1,
    });
  });

  it.each([
    {
      name: 'does not invent an email from a non-email username',
      user: createUser({ username: 'not-an-email', email: undefined }),
      seed: { firstName: 'Seed', lastName: 'User' },
    },
    {
      name: 'does not invent missing names from the username-as-email fallback',
      user: createUser({
        username: 'username@example.test',
        email: undefined,
        firstName: undefined,
        lastName: undefined,
      }),
      seed: null,
    },
  ])('$name and reports manual review without persisting the identity', async ({ user, seed }) => {
    const result = await runSync({ user, seed });

    expect(state.upsertIdentityUser).not.toHaveBeenCalled();
    expect(result.report).toMatchObject({
      outcome: 'failed',
      correctedCount: 0,
      manualReviewCount: 1,
      importedCount: 0,
      updatedCount: 0,
    });
  });

  it('preserves the current blank local-seed contract and sends it to manual review', async () => {
    const result = await runSync({
      user: createUser({ email: undefined }),
      seed: { email: '   ', firstName: 'Seed', lastName: 'User' },
    });

    expect(result.provider.updateUser).toHaveBeenCalledWith(
      'subject-1',
      expect.objectContaining({ email: '   ' })
    );
    expect(state.upsertIdentityUser).not.toHaveBeenCalled();
    expect(result.report).toMatchObject({ outcome: 'failed', manualReviewCount: 1 });
  });

  it('binds lookup, update and persistence to the requested instance and exact subject in order', async () => {
    const result = await runSync({
      instanceId: 'instance-boundary',
      user: createUser({ externalId: 'subject-boundary', email: undefined }),
      seed: { email: 'seed@example.test' },
    });

    expect(state.loadLocalProfileSeed).toHaveBeenCalledWith(expect.anything(), {
      instanceId: 'instance-boundary',
      keycloakSubject: 'subject-boundary',
    });
    expect(result.provider.updateUser).toHaveBeenCalledWith('subject-boundary', expect.anything());
    expect(state.upsertIdentityUser).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ instanceId: 'instance-boundary' })
    );
    expect(state.events).toEqual([
      'track:list_users_for_import:start',
      'keycloak:list',
      'track:list_users_for_import:end',
      'db:start',
      'SAVEPOINT',
      'seed:load',
      'track:repair_imported_user_profile:start',
      'keycloak:update',
      'track:repair_imported_user_profile:end',
      'iam:upsert',
      'RELEASE',
      'db:end',
    ]);
  });

  it('fails closed before database access when the tenant identity provider is unavailable', async () => {
    state.identityProvider = null;
    const runImportSync = state.runImportSync;
    if (!runImportSync) {
      throw new Error('run_import_sync_not_captured');
    }

    await expect(runImportSync({ instanceId: 'instance-1' })).rejects.toMatchObject({
      reason: 'tenant_admin_client_not_configured',
    });
    expect(state.loadLocalProfileSeed).not.toHaveBeenCalled();
    expect(state.query).not.toHaveBeenCalled();
  });

  it('rolls back and propagates an identity-provider update failure without reporting success', async () => {
    const updateError = new Error('provider update failed');
    const user = createUser({ email: undefined });
    state.loadLocalProfileSeed.mockResolvedValueOnce({ email: 'seed@example.test' });
    state.identityProvider = {
      realm: 'tenant-realm',
      source: 'instance',
      executionMode: 'tenant_admin',
      provider: {
        listUsers: vi.fn(async () => [user]),
        updateUser: vi.fn(async () => {
          throw updateError;
        }),
      },
    };
    const runImportSync = state.runImportSync;
    if (!runImportSync) {
      throw new Error('run_import_sync_not_captured');
    }

    await expect(runImportSync({ instanceId: 'instance-1' })).rejects.toBe(updateError);
    expect(state.query.mock.calls.map(([query]) => String(query).split(' ')[0])).toEqual([
      'SAVEPOINT',
      'ROLLBACK',
      'RELEASE',
    ]);
    expect(state.upsertIdentityUser).not.toHaveBeenCalled();
    expect(state.logger.info).not.toHaveBeenCalledWith(
      'sync_keycloak_users_completed',
      expect.anything()
    );
  });

  it('logs only a subject hash and repair flags, never raw identity profile values', async () => {
    const rawValues = ['subject-sensitive', 'sensitive@example.test', 'Sensitive', 'Person'];
    await runSync({
      user: createUser({
        externalId: rawValues[0],
        email: undefined,
        firstName: undefined,
        lastName: undefined,
      }),
      seed: { email: rawValues[1], firstName: rawValues[2], lastName: rawValues[3] },
    });

    const repairLog = state.logger.info.mock.calls.find(
      ([message]) => message === 'Keycloak user profile repaired during IAM sync'
    );
    expect(repairLog?.[1]).toMatchObject({
      subject_ref: expect.stringMatching(/^[a-f0-9]{12}$/),
      repaired_email: true,
      repaired_first_name: true,
      repaired_last_name: true,
    });
    expect(JSON.stringify(state.logger.info.mock.calls)).not.toContain(rawValues[0]);
    expect(JSON.stringify(state.logger.info.mock.calls)).not.toContain(rawValues[1]);
    expect(JSON.stringify(state.logger.info.mock.calls)).not.toContain(rawValues[2]);
    expect(JSON.stringify(state.logger.info.mock.calls)).not.toContain(rawValues[3]);
  });

  it('maps sync dependency failures to the existing fail-closed response contract', async () => {
    const { KeycloakAdminUnavailableError } = await import('../keycloak-admin-client.js');
    const { IamSchemaDriftError } = await import('@sva/iam-admin');
    const mapSyncErrorResponse = state.mapSyncErrorResponse;
    if (!mapSyncErrorResponse) {
      throw new Error('map_sync_error_response_not_captured');
    }

    const unavailable = mapSyncErrorResponse(
      new KeycloakAdminUnavailableError('provider unavailable'),
      'request-1'
    );
    expect(unavailable?.status).toBe(503);
    await expect(unavailable?.json()).resolves.toMatchObject({
      code: 'keycloak_unavailable',
      requestId: 'request-1',
    });

    const encryption = mapSyncErrorResponse(
      new Error('pii_encryption_required:missing_key'),
      'request-2'
    );
    expect(encryption?.status).toBe(503);
    await expect(encryption?.json()).resolves.toMatchObject({
      code: 'internal_error',
      requestId: 'request-2',
    });

    const schema = mapSyncErrorResponse(
      new IamSchemaDriftError({
        message: 'schema drift',
        operation: 'sync_keycloak_users',
        schemaObject: 'test-schema-object',
        expectedMigration: 'test-migration',
      }),
      'request-3'
    );
    expect(schema?.status).toBe(503);
    await expect(schema?.json()).resolves.toMatchObject({
      code: 'database_unavailable',
      requestId: 'request-3',
      details: {
        expected_migration: 'test-migration',
        reason_code: 'schema_drift',
        schema_object: 'test-schema-object',
      },
    });

    expect(mapSyncErrorResponse(new Error('unclassified'), 'request-4')).toBeUndefined();
  });

  it('reports mixed imported identities as a partial failure with stable counters', async () => {
    const completeUser = createUser({ externalId: 'subject-complete' });
    const incompleteUser = createUser({
      externalId: 'subject-incomplete',
      username: 'not-an-email',
      email: undefined,
    });
    state.identityProvider = {
      realm: 'tenant-realm',
      source: 'instance',
      executionMode: 'tenant_admin',
      provider: {
        listUsers: vi.fn(async () => [completeUser, incompleteUser]),
        updateUser: vi.fn(),
      },
    };
    state.loadLocalProfileSeed.mockResolvedValue(null);
    state.upsertIdentityUser.mockResolvedValue({ accountId: 'account-1', created: false });
    const runImportSync = state.runImportSync;
    if (!runImportSync) {
      throw new Error('run_import_sync_not_captured');
    }

    const result = await runImportSync({ instanceId: 'instance-1' });

    expect(result.report).toMatchObject({
      outcome: 'partial_failure',
      checkedCount: 2,
      correctedCount: 1,
      manualReviewCount: 1,
      importedCount: 0,
      updatedCount: 1,
    });
    expect(state.upsertIdentityUser).toHaveBeenCalledOnce();
  });

  it('keeps a successful import report when the activity-log sink fails', async () => {
    state.emitActivityLog.mockRejectedValueOnce(new Error('audit sink unavailable'));

    const result = await runSync({ user: createUser() });

    expect(result.report.outcome).toBe('success');
    expect(state.logger.warn).toHaveBeenCalledWith(
      'Skipped audit log for Keycloak user sync after successful import',
      expect.objectContaining({
        operation: 'sync_keycloak_users',
        instance_id: 'instance-1',
        error: 'audit sink unavailable',
      })
    );
  });
});
