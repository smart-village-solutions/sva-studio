import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  reconcile: vi.fn(),
  mapRoleSyncErrorCode: vi.fn(() => 'IDP_TIMEOUT'),
  parseBody: vi.fn(async () => ({ ok: true, data: { planFingerprint: 'a'.repeat(64) } })),
  detail: vi.fn(async () => ({
    latestKeycloakProvisioningRun: {
      overallStatus: 'succeeded',
      steps: [
        {
          stepKey: 'queued',
          details: {
            confirmedPlanFingerprint: 'a'.repeat(64),
            confirmedRoleCatalogFingerprint: 'c'.repeat(64),
          },
        },
      ],
    },
  })),
  plan: vi.fn(async () => ({
    overallStatus: 'ready',
    fingerprint: 'a'.repeat(64),
    steps: [],
  })),
}));

vi.mock('@sva/instance-registry/http-contracts', () => ({
  readDetailInstanceId: () => 'demo',
  reconcileTenantIamRolesSchema: {},
}));

vi.mock('@sva/server-runtime', () => ({
  getWorkspaceContext: () => ({ requestId: 'req-1' }),
}));

vi.mock('../iam-account-management/api-helpers.js', () => ({
  asApiItem: (value: unknown) => value,
  createApiError: (
    status: number,
    code: string,
    message: string,
    requestId?: string,
    details?: unknown
  ) => new Response(JSON.stringify({ error: { code, message, details }, requestId }), { status }),
  requireIdempotencyKey: () => ({ key: 'idempotency-key' }),
}));

vi.mock('../iam-account-management/csrf.js', () => ({ validateCsrf: () => null }));
vi.mock('../iam-account-management/reconcile-core.js', () => ({
  runRoleCatalogReconciliation: state.reconcile,
}));
vi.mock('../iam-account-management/role-audit.js', () => ({
  mapRoleSyncErrorCode: state.mapRoleSyncErrorCode,
}));
vi.mock('../db.js', () => ({
  jsonResponse: (status: number, payload: unknown) =>
    new Response(JSON.stringify(payload), { status }),
}));
vi.mock('./service-token.js', () => ({ isAuthenticatedRegistryServiceRequest: () => true }));
vi.mock('./http.js', () => ({ ensurePlatformAccess: () => null }));
vi.mock('./request-parsing.js', () => ({ parseRegistryRequestBody: state.parseBody }));
vi.mock('./repository.js', () => ({
  withRegistryService: (
    run: (service: {
      getInstanceDetail: typeof state.detail;
      planKeycloakProvisioning: typeof state.plan;
    }) => unknown
  ) => run({ getInstanceDetail: state.detail, planKeycloakProvisioning: state.plan }),
}));

describe('reconcileInstanceIamRolesInternal', () => {
  beforeEach(() => {
    state.reconcile.mockReset();
    state.detail.mockClear();
    state.plan.mockClear();
    state.parseBody.mockClear();
  });

  it('requires a live mutation-free Keycloak postflight before changing roles', async () => {
    state.plan.mockResolvedValueOnce({
      overallStatus: 'ready',
      fingerprint: 'a'.repeat(64),
      steps: [{ action: 'update' }],
    });
    const { reconcileInstanceIamRolesInternal } = await import('./role-reconcile.js');

    const response = await reconcileInstanceIamRolesInternal(
      new Request('https://studio.example/api/v1/iam/instances/demo/tenant-iam/roles/reconcile', {
        method: 'POST',
      }),
      { user: { id: 'service-account' } } as never
    );

    expect(response.status).toBe(409);
    expect(state.plan).toHaveBeenCalledWith('demo', { forceLive: true });
    expect(state.reconcile).not.toHaveBeenCalled();
  });

  it('returns a structured, redacted synchronization error when reconciliation fails', async () => {
    state.reconcile.mockRejectedValueOnce(new Error('upstream timeout'));
    const { reconcileInstanceIamRolesInternal } = await import('./role-reconcile.js');

    const response = await reconcileInstanceIamRolesInternal(
      new Request('https://studio.example/api/v1/iam/instances/demo/tenant-iam/roles/reconcile', {
        method: 'POST',
      }),
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

  it('rejects role changes when the confirmed Keycloak plan is stale', async () => {
    state.detail.mockResolvedValueOnce({
      latestKeycloakProvisioningRun: {
        overallStatus: 'succeeded',
        steps: [
          {
            stepKey: 'queued',
            details: {
              confirmedPlanFingerprint: 'b'.repeat(64),
              confirmedRoleCatalogFingerprint: 'c'.repeat(64),
            },
          },
        ],
      },
    });
    const { reconcileInstanceIamRolesInternal } = await import('./role-reconcile.js');

    const response = await reconcileInstanceIamRolesInternal(
      new Request('https://studio.example/api/v1/iam/instances/demo/tenant-iam/roles/reconcile', {
        method: 'POST',
      }),
      { user: { id: 'service-account' } } as never
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'conflict',
        details: { reason_code: 'keycloak_plan_fingerprint_stale' },
      },
    });
    expect(state.reconcile).not.toHaveBeenCalled();
  });

  it('rejects role changes when the current Keycloak plan is not ready', async () => {
    state.plan.mockResolvedValueOnce({ overallStatus: 'blocked', fingerprint: 'b'.repeat(64) });
    const { reconcileInstanceIamRolesInternal } = await import('./role-reconcile.js');

    const response = await reconcileInstanceIamRolesInternal(
      new Request('https://studio.example/api/v1/iam/instances/demo/tenant-iam/roles/reconcile', {
        method: 'POST',
      }),
      { user: { id: 'service-account' } } as never
    );

    expect(response.status).toBe(409);
    expect(state.reconcile).not.toHaveBeenCalled();
  });

  it('accepts fresh no-drift postflight evidence with a new plan fingerprint', async () => {
    state.plan.mockResolvedValueOnce({
      overallStatus: 'ready',
      fingerprint: 'b'.repeat(64),
      steps: [],
    });
    state.reconcile.mockResolvedValueOnce({ outcome: 'success' });
    const { reconcileInstanceIamRolesInternal } = await import('./role-reconcile.js');

    const response = await reconcileInstanceIamRolesInternal(
      new Request('https://studio.example/api/v1/iam/instances/demo/tenant-iam/roles/reconcile', {
        method: 'POST',
      }),
      { user: { id: 'service-account' } } as never
    );

    expect(response.status).toBe(200);
    expect(state.reconcile).toHaveBeenCalledWith({
      instanceId: 'demo',
      requestId: 'req-1',
      expectedRoleCatalogFingerprint: 'c'.repeat(64),
    });
  });

  it('binds reconciliation to the role catalog captured with the confirmed plan', async () => {
    state.reconcile.mockRejectedValueOnce(new Error('role_catalog_fingerprint_stale'));
    const { reconcileInstanceIamRolesInternal } = await import('./role-reconcile.js');

    const response = await reconcileInstanceIamRolesInternal(
      new Request('https://studio.example/api/v1/iam/instances/demo/tenant-iam/roles/reconcile', {
        method: 'POST',
      }),
      { user: { id: 'service-account' } } as never
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { details: { reason_code: 'role_catalog_fingerprint_stale' } },
    });
    expect(state.reconcile).toHaveBeenCalledWith({
      instanceId: 'demo',
      requestId: 'req-1',
      expectedRoleCatalogFingerprint: 'c'.repeat(64),
    });
  });
});
