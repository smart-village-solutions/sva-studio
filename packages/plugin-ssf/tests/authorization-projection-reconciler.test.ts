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
    markSessionsRevoked: vi.fn(async () => true),
    markBlocked: vi.fn(async () => true),
  } satisfies SsfAuthorizationProjectionLockedStore;
  const store = {
    withTenantLock: vi.fn(async (_instanceId, operation) => operation(lockedStore)),
  } satisfies SsfAuthorizationProjectionStore;
  const target = {
    reconcile: vi.fn(async () => undefined),
    readBack: vi.fn(async () => desired),
    revokeTenantSessions: vi.fn(async () => undefined),
  } satisfies SsfAuthorizationProjectionTarget;
  return {
    store,
    lockedStore,
    target,
    reconcile: createSsfAuthorizationProjectionReconciler({ store, target }),
  };
};

describe('SSF authorization projection reconciler', () => {
  it('writes, reads back and revokes sessions before publishing readiness', async () => {
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
    expect(target.readBack).toHaveBeenCalledWith('tenant-a');
    expect(lockedStore.confirmReadBack).toHaveBeenCalledWith({
      desired,
      readBack: desired,
      generation: 1,
    });
    expect(target.revokeTenantSessions).toHaveBeenCalledWith('tenant-a');
    expect(lockedStore.markSessionsRevoked).toHaveBeenCalledWith({
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
        sessionsRevokedRevision: revision,
      })
    );

    await expect(reconcile(desired)).resolves.toMatchObject({
      status: 'ready',
      changed: false,
    });
    expect(lockedStore.claim).not.toHaveBeenCalled();
    expect(target.reconcile).not.toHaveBeenCalled();
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
    ['target_write_failed', 'reconcile'],
    ['target_readback_failed', 'readBack'],
    ['session_revocation_failed', 'revokeTenantSessions'],
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

  it('keeps two tenant projections and revocations isolated', async () => {
    const tenantA = fixtures(projection('tenant-a'));
    const tenantB = fixtures(projection('tenant-b'));

    await tenantA.reconcile(projection('tenant-a'));
    await tenantB.reconcile(projection('tenant-b'));

    expect(tenantA.target.revokeTenantSessions).toHaveBeenCalledWith('tenant-a');
    expect(tenantA.target.revokeTenantSessions).not.toHaveBeenCalledWith('tenant-b');
    expect(tenantB.target.revokeTenantSessions).toHaveBeenCalledWith('tenant-b');
    expect(createSsfAuthorizationRevision(projection('tenant-a'))).not.toBe(
      createSsfAuthorizationRevision(projection('tenant-b'))
    );
  });
});
