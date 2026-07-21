import { describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  reconcile: vi.fn(),
  mapRoleSyncErrorCode: vi.fn(() => 'IDP_TIMEOUT'),
}));

vi.mock('@sva/instance-registry/http-contracts', () => ({
  readDetailInstanceId: () => 'demo',
}));

vi.mock('@sva/server-runtime', () => ({
  getWorkspaceContext: () => ({ requestId: 'req-1' }),
}));

vi.mock('../iam-account-management/api-helpers.js', () => ({
  asApiItem: (value: unknown) => value,
  createApiError: (status: number, code: string, message: string, requestId?: string, details?: unknown) =>
    new Response(JSON.stringify({ error: { code, message, details }, requestId }), { status }),
  requireIdempotencyKey: () => ({ key: 'idempotency-key' }),
}));

vi.mock('../iam-account-management/csrf.js', () => ({ validateCsrf: () => null }));
vi.mock('../iam-account-management/reconcile-core.js', () => ({ runRoleCatalogReconciliation: state.reconcile }));
vi.mock('../iam-account-management/role-audit.js', () => ({ mapRoleSyncErrorCode: state.mapRoleSyncErrorCode }));
vi.mock('../db.js', () => ({ jsonResponse: (status: number, payload: unknown) => new Response(JSON.stringify(payload), { status }) }));
vi.mock('./service-token.js', () => ({ isAuthenticatedRegistryServiceRequest: () => true }));
vi.mock('./http.js', () => ({ ensurePlatformAccess: () => null }));

describe('reconcileInstanceIamRolesInternal', () => {
  it('returns a structured, redacted synchronization error when reconciliation fails', async () => {
    state.reconcile.mockRejectedValueOnce(new Error('upstream timeout'));
    const { reconcileInstanceIamRolesInternal } = await import('./role-reconcile.js');

    const response = await reconcileInstanceIamRolesInternal(
      new Request('https://studio.example/api/v1/iam/instances/demo/tenant-iam/roles/reconcile', { method: 'POST' }),
      { user: { id: 'service-account' } } as never
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'keycloak_unavailable',
        details: {
          syncState: 'failed',
          syncError: { code: 'IDP_TIMEOUT' },
          scope_kind: 'instance',
          instanceId: 'demo',
        },
      },
      requestId: 'req-1',
    });
  });
});
