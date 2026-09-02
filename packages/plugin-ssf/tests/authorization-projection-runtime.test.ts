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
  it('keeps IAM reading host-owned and passes the unchanged Keycloak subject to the plugin reconcile', async () => {
    const source = {
      readSubjects: vi.fn(async () => [
        {
          keycloakSubject: 'keycloak-subject-1',
          roleNames: ['system_admin'],
          permissionIds: [
            'ssf.configuration.tenant.read',
            'ssf.configuration.tenant.manage',
          ],
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
      markSessionsRevoked: vi.fn(async () => false),
      markBlocked: vi.fn(async () => false),
    } satisfies SsfAuthorizationProjectionLockedStore;
    const store = {
      withTenantLock: vi.fn(async (_instanceId, operation) => operation(lockedStore)),
    } satisfies SsfAuthorizationProjectionStore;
    const target = {
      reconcile: vi.fn(async () => undefined),
      readBack: vi.fn(async () => ({
        contractVersion: SSF_AUTHORIZATION_PROJECTION_VERSION,
        instanceId: 'tenant-a',
        subjects: [],
      })),
      revokeTenantSessions: vi.fn(async () => undefined),
    } satisfies SsfAuthorizationProjectionTarget;
    const runtime = createSsfAuthorizationProjectionRuntime({ source, store, target });

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
          permissions: [
            'ssf.configuration.tenant.manage',
            'ssf.configuration.tenant.read',
          ],
        },
      ],
    });
    expect(target.reconcile).not.toHaveBeenCalled();
  });
});
