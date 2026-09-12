import { describe, expect, it, vi } from 'vitest';

import {
  createSsfAuthorizationProjectionRuntime,
  createSsfAuthorizationRevision,
  SSF_AUTHORIZATION_PROJECTION_VERSION,
  SSF_TENANT_PERMISSION_IDS,
  type SsfAuthorizationProjectionLockedStore,
  type SsfAuthorizationProjectionStore,
  type SsfAuthorizationProjectionTarget,
} from '../src/runtime.js';

describe('SSF authorization projection runtime', () => {
  it.each([
    { revisions: [null], targetReady: true, expected: null },
    { revisions: ['revision-a'], targetReady: false, expected: null },
    { revisions: ['revision-a', 'revision-b'], targetReady: true, expected: null },
    { revisions: ['revision-a', 'revision-a'], targetReady: true, expected: 'revision-a' },
  ])(
    'reads readiness without mutations and rejects revision drift: %j',
    async ({ revisions, targetReady, expected }) => {
      const source = { readSubjects: vi.fn() };
      const store = { withTenantLock: vi.fn() };
      const target = {
        prepareLoginClients: vi.fn(),
        prepareRuntimeBaseline: vi.fn(),
        isReady: vi.fn(async () => targetReady),
        suspendTokenIssuance: vi.fn(),
        resumeTokenIssuance: vi.fn(),
        reconcile: vi.fn(),
        readBack: vi.fn(),
        revokeTenantSessions: vi.fn(),
      } satisfies SsfAuthorizationProjectionTarget;
      let readIndex = 0;
      const readReadyRevision = vi.fn(async () => revisions[readIndex++] ?? null);
      const runtime = createSsfAuthorizationProjectionRuntime({
        source,
        store,
        target,
        readReadyRevision,
      });

      await expect(runtime.readiness('tenant-a')).resolves.toBe(expected);

      expect(source.readSubjects).not.toHaveBeenCalled();
      expect(store.withTenantLock).not.toHaveBeenCalled();
      for (const [name, method] of Object.entries(target)) {
        if (name !== 'isReady') expect(method).not.toHaveBeenCalled();
      }
      if (revisions[0])
        expect(target.isReady).toHaveBeenCalledExactlyOnceWith('tenant-a', revisions[0]);
      else expect(target.isReady).not.toHaveBeenCalled();
    }
  );

  it('keeps IAM reading host-owned and passes the unchanged Keycloak subject to the plugin reconcile', async () => {
    const source = {
      readSubjects: vi.fn(async () => [
        {
          keycloakSubject: 'keycloak-subject-1',
          roleNames: ['system_admin'],
          permissionIds: ['ssf.configuration.tenant.read', 'ssf.configuration.tenant.manage'],
        },
      ]),
    };
    const lockedStore = {
      stage: vi.fn(async (desired) => {
        const revision = createSsfAuthorizationRevision(desired);
        return {
          instanceId: desired.instanceId,
          generation: 1,
          status: 'ready' as const,
          desiredRevision: revision,
          desiredProjection: desired,
          confirmedRevision: revision,
          confirmedProjection: desired,
          sessionsRevokedRevision: revision,
          lastErrorCode: null,
        };
      }),
      claim: vi.fn(async () => false),
      confirmReadBack: vi.fn(async () => false),
      markReady: vi.fn(async () => false),
      markBlocked: vi.fn(async () => false),
    } satisfies SsfAuthorizationProjectionLockedStore;
    const store = {
      withTenantLock: vi.fn(async (_instanceId, operation) => operation(lockedStore)),
    } satisfies SsfAuthorizationProjectionStore;
    const target = {
      prepareLoginClients: vi.fn(async () => undefined),
      prepareRuntimeBaseline: vi.fn(async () => undefined),
      isReady: vi.fn(async () => true),
      suspendTokenIssuance: vi.fn(async () => undefined),
      resumeTokenIssuance: vi.fn(async () => undefined),
      reconcile: vi.fn(async () => undefined),
      readBack: vi.fn(async () => ({
        contractVersion: SSF_AUTHORIZATION_PROJECTION_VERSION,
        instanceId: 'tenant-a',
        subjects: [],
      })),
      revokeTenantSessions: vi.fn(async () => undefined),
    } satisfies SsfAuthorizationProjectionTarget;
    const runtime = createSsfAuthorizationProjectionRuntime({
      source,
      store,
      target,
      readReadyRevision: async () => null,
    });

    await runtime.reconcile('tenant-a');

    expect(source.readSubjects).toHaveBeenCalledExactlyOnceWith({
      instanceId: 'tenant-a',
      permissionIds: SSF_TENANT_PERMISSION_IDS,
    });
    expect(lockedStore.stage).toHaveBeenCalledWith({
      contractVersion: SSF_AUTHORIZATION_PROJECTION_VERSION,
      instanceId: 'tenant-a',
      subjects: [
        {
          subject: 'keycloak-subject-1',
          roles: ['tenant_admin'],
          permissions: ['ssf.configuration.tenant.manage', 'ssf.configuration.tenant.read'],
        },
      ],
    });
    expect(target.reconcile).not.toHaveBeenCalled();
  });
});
