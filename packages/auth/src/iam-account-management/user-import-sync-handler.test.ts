import { describe, expect, it, vi } from 'vitest';

vi.mock('@sva/sdk/server', () => ({
  createSdkLogger: () => ({
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
  getWorkspaceContext: () => ({ requestId: 'req-platform-sync', traceId: 'trace-platform-sync' }),
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
      JSON.stringify({
        error: { code, message, ...(details ? { details } : {}) },
        ...(requestId ? { requestId } : {}),
      }),
      { status, headers: { 'content-type': 'application/json' } }
    ),
}));

vi.mock('./csrf.js', () => ({
  validateCsrf: vi.fn(() => null),
}));

vi.mock('./feature-flags.js', () => ({
  ensureFeature: vi.fn(() => null),
  getFeatureFlags: vi.fn(() => ({})),
}));

vi.mock('./platform-iam.js', () => ({
  runPlatformKeycloakUserSync: vi.fn(async () => {
    throw new Error('platform_identity_provider_not_configured');
  }),
}));

vi.mock('./rate-limit.js', () => ({
  consumeRateLimit: vi.fn(() => null),
}));

vi.mock('./shared.js', () => ({
  emitActivityLog: vi.fn(),
  iamUserOperationsCounter: { add: vi.fn() },
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
  requireRoles: vi.fn(() => null),
  resolveActorInfo: vi.fn(),
  resolveIdentityProviderForInstance: vi.fn(),
  trackKeycloakCall: vi.fn(async (_operation: string, execute: () => Promise<unknown>) => execute()),
  withInstanceScopedDb: vi.fn(),
}));

import { syncUsersFromKeycloakInternal } from './user-import-sync-handler';

describe('user import sync handler', () => {
  it('maps missing platform admin identity provider to a setup diagnostic', async () => {
    const response = await syncUsersFromKeycloakInternal(
      new Request('http://localhost/api/v1/iam/users/sync-keycloak', { method: 'POST' }),
      {
        user: {
          id: 'keycloak-platform-admin',
          roles: ['system_admin'],
        },
      } as never
    );

    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'keycloak_unavailable',
        message: 'Plattform-IAM ist nicht konfiguriert.',
        details: {
          dependency: 'keycloak',
          reason_code: 'platform_identity_provider_not_configured',
          scope_kind: 'platform',
        },
      },
      requestId: 'req-platform-sync',
    });
    expect(response.status).toBe(503);
  });
});
