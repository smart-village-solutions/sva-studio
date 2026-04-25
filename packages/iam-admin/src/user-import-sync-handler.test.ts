import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createSyncUsersFromKeycloakHandlerInternal,
  type SyncUsersHandlerDeps,
} from './user-import-sync-handler.js';

const tenantCtx = {
  sessionId: 'session-1',
  user: {
    id: 'kc-actor-1',
    instanceId: 'de-musterhausen',
    roles: ['system_admin'],
  },
};

const platformCtx = {
  sessionId: 'session-1',
  user: {
    id: 'kc-platform-admin',
    roles: ['system_admin'],
  },
};

const actor = {
  instanceId: 'de-musterhausen',
  actorAccountId: 'actor-account-1',
  requestId: 'req-sync',
  traceId: 'trace-sync',
};

const report = {
  outcome: 'success',
  checkedCount: 1,
  correctedCount: 1,
};

const createJsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const createDeps = (overrides: Partial<SyncUsersHandlerDeps<typeof report>> = {}): SyncUsersHandlerDeps<typeof report> => ({
  asApiItem: vi.fn((data, requestId) => ({ data, ...(requestId ? { requestId } : {}) })),
  buildLogContext: vi.fn(() => ({ instance_id: 'de-musterhausen', trace_id: 'trace-sync' })),
  consumeRateLimit: vi.fn(() => null),
  createApiError: vi.fn((status, code, message, requestId, details) =>
    createJsonResponse(status, {
      error: { code, message, ...(details ? { details } : {}) },
      ...(requestId ? { requestId } : {}),
    })
  ),
  ensureFeature: vi.fn(() => null),
  getFeatureFlags: vi.fn(() => ({})),
  getWorkspaceContext: vi.fn(() => ({ requestId: 'req-platform-sync', traceId: 'trace-platform-sync' })),
  iamUserOperationsCounter: {
    add: vi.fn(),
  },
  isPlatformIdentityProviderConfigurationError: vi.fn(
    (error) => error instanceof Error && error.message === 'platform_identity_provider_not_configured'
  ),
  jsonResponse: vi.fn(createJsonResponse),
  logger: {
    error: vi.fn(),
    info: vi.fn(),
  },
  mapSyncErrorResponse: vi.fn(() => undefined),
  platformRateLimitInstanceId: '__platform__',
  requireRoles: vi.fn(() => null),
  resolveSyncActor: vi.fn(async () => ({ actor })),
  runKeycloakUserImportSync: vi.fn(async () => ({
    report,
    skippedCount: 0,
    skippedInstanceIds: new Set<string>(),
  })),
  runPlatformKeycloakUserSync: vi.fn(async () => report),
  validateCsrf: vi.fn(() => null),
  ...overrides,
});

describe('createSyncUsersFromKeycloakHandlerInternal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs tenant import sync and returns the report', async () => {
    const deps = createDeps();
    const handler = createSyncUsersFromKeycloakHandlerInternal(deps);

    const response = await handler(new Request('http://localhost/api/v1/iam/users/sync-keycloak'), tenantCtx);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: report,
      requestId: 'req-sync',
    });
    expect(deps.runKeycloakUserImportSync).toHaveBeenCalledWith({
      instanceId: 'de-musterhausen',
      actorAccountId: 'actor-account-1',
      requestId: 'req-sync',
      traceId: 'trace-sync',
    });
    expect(deps.iamUserOperationsCounter.add).toHaveBeenCalledWith(1, {
      action: 'sync_keycloak_users',
      result: 'success',
    });
  });

  it('logs skipped tenant users without failing the successful response', async () => {
    const deps = createDeps({
      runKeycloakUserImportSync: vi.fn(async () => ({
        report,
        skippedCount: 2,
        skippedInstanceIds: new Set(['foreign-a', 'foreign-b']),
      })),
    });
    const handler = createSyncUsersFromKeycloakHandlerInternal(deps);

    const response = await handler(new Request('http://localhost/api/v1/iam/users/sync-keycloak'), tenantCtx);

    expect(response.status).toBe(200);
    expect(deps.logger.info).toHaveBeenCalledWith(
      'Keycloak user sync skipped users because instance ids did not match',
      expect.objectContaining({
        skipped_count: 2,
        sample_instance_ids: 'foreign-a,foreign-b',
      })
    );
  });

  it('maps known tenant sync errors through the injected mapper', async () => {
    const mappedResponse = createJsonResponse(503, { error: { code: 'database_unavailable' } });
    const syncError = new Error('schema drift');
    const deps = createDeps({
      mapSyncErrorResponse: vi.fn(() => mappedResponse),
      runKeycloakUserImportSync: vi.fn(async () => {
        throw syncError;
      }),
    });
    const handler = createSyncUsersFromKeycloakHandlerInternal(deps);

    const response = await handler(new Request('http://localhost/api/v1/iam/users/sync-keycloak'), tenantCtx);

    expect(response).toBe(mappedResponse);
    expect(deps.mapSyncErrorResponse).toHaveBeenCalledWith(syncError, 'req-sync');
    expect(deps.logger.error).not.toHaveBeenCalled();
  });

  it('runs platform sync when the session has no instance scope', async () => {
    const deps = createDeps();
    const handler = createSyncUsersFromKeycloakHandlerInternal(deps);

    const response = await handler(new Request('http://localhost/api/v1/iam/users/sync-keycloak'), platformCtx);

    expect(response.status).toBe(200);
    expect(deps.runPlatformKeycloakUserSync).toHaveBeenCalledWith({
      requestId: 'req-platform-sync',
      traceId: 'trace-platform-sync',
    });
    expect(deps.runKeycloakUserImportSync).not.toHaveBeenCalled();
    expect(deps.iamUserOperationsCounter.add).toHaveBeenCalledWith(1, {
      action: 'sync_platform_keycloak_users',
      result: 'success',
    });
  });

  it('maps missing platform identity provider to setup diagnostics', async () => {
    const deps = createDeps({
      runPlatformKeycloakUserSync: vi.fn(async () => {
        throw new Error('platform_identity_provider_not_configured');
      }),
    });
    const handler = createSyncUsersFromKeycloakHandlerInternal(deps);

    const response = await handler(new Request('http://localhost/api/v1/iam/users/sync-keycloak'), platformCtx);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'keycloak_unavailable',
        details: {
          reason_code: 'platform_identity_provider_not_configured',
          scope_kind: 'platform',
        },
      },
      requestId: 'req-platform-sync',
    });
  });
});
