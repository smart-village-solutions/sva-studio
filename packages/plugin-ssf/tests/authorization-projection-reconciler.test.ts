import { describe, expect, it, vi } from 'vitest';

import {
  createSsfAuthorizationProjectionReconciler,
  createSsfAuthorizationRevision,
  SSF_AUTHORIZATION_PROJECTION_VERSION,
  type SsfAuthorizationProjection,
  type SsfAuthorizationProjectionLockedStore,
  type SsfAuthorizationProjectionState,
  type SsfAuthorizationProjectionStore,
  type SsfAuthorizationProjectionTarget,
} from '../src/runtime.js';

const projection = (instanceId = 'tenant-a'): SsfAuthorizationProjection => ({
  contractVersion: SSF_AUTHORIZATION_PROJECTION_VERSION,
  instanceId,
  subjects: [
    {
      subject: `${instanceId}-user`,
      roles: ['user'],
      permissions: ['ssf.configuration.tenant.read'],
    },
  ],
});

const state = (
  desired = projection(),
  overrides: Partial<SsfAuthorizationProjectionState> = {}
): SsfAuthorizationProjectionState => ({
  instanceId: desired.instanceId,
  generation: 1,
  status: 'pending',
  desiredRevision: createSsfAuthorizationRevision(desired),
  desiredProjection: desired,
  confirmedRevision: null,
  confirmedProjection: null,
  sessionsRevokedRevision: null,
  lastErrorCode: null,
  ...overrides,
});

const fixtures = (desired = projection()) => {
  const lockedStore = {
    stage: vi.fn(async () => state(desired)),
    claim: vi.fn(async () => true),
    confirmReadBack: vi.fn(async () => true),
    markReady: vi.fn(async () => true),
    markBlocked: vi.fn(async () => true),
  } satisfies SsfAuthorizationProjectionLockedStore;
  const store = {
    withTenantLock: vi.fn(async (_instanceId, operation) => operation(lockedStore)),
  } satisfies SsfAuthorizationProjectionStore;
  const target = {
    prepareLoginClients: vi.fn(async () => undefined),
    prepareRuntimeBaseline: vi.fn(async () => undefined),
    isReady: vi.fn(async () => true),
    suspendTokenIssuance: vi.fn(async () => undefined),
    reconcile: vi.fn(async () => undefined),
    readBack: vi.fn(async () => desired),
    revokeTenantSessions: vi.fn(async () => undefined),
    resumeTokenIssuance: vi.fn(async () => undefined),
  } satisfies SsfAuthorizationProjectionTarget;
  return {
    store,
    lockedStore,
    target,
    reconcile: createSsfAuthorizationProjectionReconciler({ store, target }),
  };
};

describe('SSF authorization projection reconciler', () => {
  it('publishes readiness after write, read-back and client reactivation', async () => {
    const desired = projection();
    const { lockedStore, target, reconcile } = fixtures(desired);
    const revision = createSsfAuthorizationRevision(desired);

    await expect(reconcile(desired)).resolves.toEqual({
      status: 'ready',
      authorizationRevision: revision,
      generation: 1,
      changed: true,
    });
    expect(target.reconcile).toHaveBeenCalledWith(desired, revision);
    expect(target.suspendTokenIssuance).toHaveBeenCalledWith('tenant-a');
    expect(target.readBack).toHaveBeenCalledWith('tenant-a');
    expect(lockedStore.confirmReadBack).toHaveBeenCalledWith({
      desired,
      readBack: desired,
      generation: 1,
    });
    expect(target.prepareRuntimeBaseline).toHaveBeenCalledWith('tenant-a');
    expect(lockedStore.confirmReadBack.mock.invocationCallOrder[0]).toBeLessThan(
      target.prepareRuntimeBaseline.mock.invocationCallOrder[0]
    );
    expect(target.revokeTenantSessions).not.toHaveBeenCalled();
    expect(target.resumeTokenIssuance).toHaveBeenCalledWith('tenant-a');
    expect(lockedStore.markReady).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      generation: 1,
      authorizationRevision: revision,
    });
    expect(lockedStore.markBlocked).not.toHaveBeenCalled();
  });

  it('normalizes the tenant identifier before acquiring the tenant lock', async () => {
    const normalized = projection('tenant-a');
    const desired = { ...normalized, instanceId: ' tenant-a ' };
    const { store, lockedStore, target, reconcile } = fixtures(normalized);

    await expect(reconcile(desired)).resolves.toMatchObject({ status: 'ready' });

    expect(store.withTenantLock).toHaveBeenCalledWith('tenant-a', expect.any(Function));
    expect(lockedStore.stage).toHaveBeenCalledWith(normalized);
    expect(target.reconcile).toHaveBeenCalledWith(
      normalized,
      createSsfAuthorizationRevision(normalized)
    );
  });

  it('does not touch Keycloak for an already converged projection', async () => {
    const desired = projection();
    const revision = createSsfAuthorizationRevision(desired);
    const { lockedStore, target, reconcile } = fixtures(desired);
    lockedStore.stage.mockResolvedValue(
      state(desired, {
        status: 'ready',
        confirmedRevision: revision,
        confirmedProjection: desired,
        sessionsRevokedRevision: null,
      })
    );

    await expect(reconcile(desired)).resolves.toMatchObject({
      status: 'ready',
      changed: false,
    });
    expect(lockedStore.claim).not.toHaveBeenCalled();
    expect(target.reconcile).not.toHaveBeenCalled();
    expect(target.suspendTokenIssuance).not.toHaveBeenCalled();
  });

  it('lets only one concurrent generation own the external write', async () => {
    const desired = projection();
    const { lockedStore, target, reconcile } = fixtures(desired);
    lockedStore.claim.mockResolvedValue(false);

    await expect(reconcile(desired)).resolves.toEqual({ status: 'busy', generation: 1 });
    expect(target.reconcile).not.toHaveBeenCalled();
    expect(target.readBack).not.toHaveBeenCalled();
  });

  it.each([
    ['login_client_preparation_failed', 'prepareLoginClients'],
    ['runtime_baseline_preparation_failed', 'prepareRuntimeBaseline'],
    ['token_issuance_suspend_failed', 'suspendTokenIssuance'],
    ['target_write_failed', 'reconcile'],
    ['target_readback_failed', 'readBack'],
    ['token_issuance_resume_failed', 'resumeTokenIssuance'],
  ] as const)('blocks the exact generation after %s', async (reason, method) => {
    const desired = projection();
    const { lockedStore, target, reconcile } = fixtures(desired);
    target[method].mockRejectedValue(new Error('sensitive upstream detail'));

    await expect(reconcile(desired)).resolves.toEqual({
      status: 'blocked',
      generation: 1,
      reason,
    });
    expect(lockedStore.markBlocked).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      generation: 1,
      desiredRevision: createSsfAuthorizationRevision(desired),
      errorCode: reason,
    });
    expect(JSON.stringify(lockedStore.markBlocked.mock.calls)).not.toContain(
      'sensitive upstream detail'
    );
  });

  it('keeps two tenant projections isolated without requiring session revocation', async () => {
    const tenantA = fixtures(projection('tenant-a'));
    const tenantB = fixtures(projection('tenant-b'));

    await tenantA.reconcile(projection('tenant-a'));
    await tenantB.reconcile(projection('tenant-b'));

    expect(tenantA.target.revokeTenantSessions).not.toHaveBeenCalled();
    expect(tenantB.target.revokeTenantSessions).not.toHaveBeenCalled();
    expect(createSsfAuthorizationRevision(projection('tenant-a'))).not.toBe(
      createSsfAuthorizationRevision(projection('tenant-b'))
    );
  });
});

it('repairs a stale ready state before publishing it again', async () => {
  const desired = projection();
  const revision = createSsfAuthorizationRevision(desired);
  const { lockedStore, target, reconcile } = fixtures(desired);
  lockedStore.stage.mockResolvedValue(
    state(desired, { status: 'ready', confirmedRevision: revision })
  );
  target.isReady.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  await expect(reconcile(desired)).resolves.toMatchObject({ status: 'ready', changed: true });
  expect(lockedStore.claim).toHaveBeenCalledOnce();
  expect(target.prepareLoginClients.mock.invocationCallOrder[0]).toBeLessThan(
    target.reconcile.mock.invocationCallOrder[0]
  );
  expect(target.isReady.mock.invocationCallOrder[1]).toBeLessThan(
    lockedStore.markReady.mock.invocationCallOrder[0]
  );
});

it('keeps the tenant blocked and disables login when the final baseline or client read-back fails', async () => {
  const { target, lockedStore, reconcile } = fixtures();
  target.isReady.mockResolvedValue(false);
  await expect(reconcile(projection())).resolves.toMatchObject({
    status: 'blocked',
    reason: 'tenant_readiness_failed',
  });
  expect(lockedStore.markReady).not.toHaveBeenCalled();
  expect(target.suspendTokenIssuance.mock.invocationCallOrder.at(-1)).toBeGreaterThan(
    target.resumeTokenIssuance.mock.invocationCallOrder[0]
  );
});
