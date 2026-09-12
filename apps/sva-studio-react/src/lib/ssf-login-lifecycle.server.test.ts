import { expect, it, vi } from 'vitest';
import type { InstanceRegistryRecord } from '@sva/core';
import { dispatchSsfAdminLoginDirectoryRequest } from '@sva/auth-runtime/server';
import {
  createSsfAuthorizationProjectionReconciler,
  createSsfAuthorizationRevision,
  type SsfAuthorizationProjection,
  type SsfAuthorizationProjectionState,
  type SsfAuthorizationProjectionStore,
  type SsfAuthorizationProjectionTarget,
} from '@sva/plugin-ssf/runtime';

it('keeps two clean tenants unpublished through partial provisioning and recovers the failed tenant independently', async () => {
  const ids = ['tenant-a', 'tenant-b'];
  const instances = ids.map(
    (instanceId) =>
      ({
        instanceId,
        displayName: instanceId,
        authRealm: `${instanceId}-realm`,
        status: 'active',
      }) as InstanceRegistryRecord
  );
  const states = new Map<string, SsfAuthorizationProjectionState>();
  const clients = new Set<string>();
  const baselines = new Set<string>();
  const enabled = new Set<string>();
  const lifecycleReady = new Set<string>();
  const projected = new Map<string, SsfAuthorizationProjection>();
  let failBaselineForB = true;
  const desired = (instanceId: string): SsfAuthorizationProjection => ({
    contractVersion: '1.0',
    instanceId,
    subjects: [
      {
        subject: `${instanceId}-admin`,
        roles: ['tenant_admin'],
        permissions: ['ssf.configuration.tenant.manage'],
      },
    ],
  });
  const directory = async (): Promise<string[]> => {
    const response = await dispatchSsfAdminLoginDirectoryRequest(
      new Request('http://studio/internal/plugins/ssf/v1/admin-login-tenants', {
        headers: { Authorization: 'Bearer service-token' },
      }),
      {
        authenticateToken: async () => ({ kind: 'authenticated', subject: 'ssf-service' }),
        readInstances: async () => instances,
        readTenantReadiness: async (id) =>
          lifecycleReady.has(id) &&
          states.get(id)?.status === 'ready' &&
          (await target.isReady(id, states.get(id)!.confirmedRevision!)),
      }
    );
    expect(response?.status).toBe(200);
    const body = (await response!.json()) as { tenants: { id: string }[] };
    return body.tenants.map(({ id }) => id);
  };
  const assertUnpublished = async (id: string) => expect(await directory()).not.toContain(id);
  const store: SsfAuthorizationProjectionStore = {
    withTenantLock: async (id, work) =>
      work({
        stage: async (projection) => {
          const previous = states.get(id);
          const revision = createSsfAuthorizationRevision(projection);
          const state: SsfAuthorizationProjectionState = previous ?? {
            instanceId: id,
            generation: 1,
            status: 'pending',
            desiredRevision: revision,
            desiredProjection: projection,
            confirmedRevision: null,
            confirmedProjection: null,
            sessionsRevokedRevision: null,
            lastErrorCode: null,
          };
          states.set(id, state);
          return state;
        },
        claim: async () => {
          states.set(id, { ...states.get(id)!, status: 'projecting' });
          return true;
        },
        confirmReadBack: async ({ desired: projection, readBack }) => {
          expect(readBack).toEqual(projection);
          states.set(id, {
            ...states.get(id)!,
            status: 'activation_pending',
            confirmedRevision: createSsfAuthorizationRevision(readBack),
            confirmedProjection: readBack,
          });
          return true;
        },
        markReady: async () => {
          await assertUnpublished(id);
          states.set(id, { ...states.get(id)!, status: 'ready' });
          return true;
        },
        markBlocked: async ({ errorCode }) => {
          states.set(id, { ...states.get(id)!, status: 'blocked', lastErrorCode: errorCode });
          return true;
        },
      }),
  };
  const target: SsfAuthorizationProjectionTarget = {
    prepareLoginClients: async (id) => {
      clients.add(id);
      enabled.delete(id);
      await assertUnpublished(id);
    },
    prepareRuntimeBaseline: async (id) => {
      expect(projected.has(id)).toBe(true);
      await assertUnpublished(id);
      if (id === 'tenant-b' && failBaselineForB) throw new Error('database unavailable');
      baselines.add(id);
      await assertUnpublished(id);
    },
    suspendTokenIssuance: async (id) => {
      enabled.delete(id);
    },
    reconcile: async (projection) => {
      projected.set(projection.instanceId, projection);
      await assertUnpublished(projection.instanceId);
    },
    readBack: async (id) => projected.get(id)!,
    resumeTokenIssuance: async (id) => {
      enabled.add(id);
      await assertUnpublished(id);
    },
    revokeTenantSessions: vi.fn(),
    isReady: async (id, revision) =>
      clients.has(id) &&
      baselines.has(id) &&
      enabled.has(id) &&
      createSsfAuthorizationRevision(projected.get(id)!) === revision,
  };
  const reconcile = createSsfAuthorizationProjectionReconciler({ store, target });
  expect(await directory()).toEqual([]);
  expect(await reconcile(desired('tenant-a'))).toMatchObject({ status: 'ready' });
  expect(await directory()).toEqual([]); // generic lifecycle has not completed yet
  lifecycleReady.add('tenant-a');
  expect(await directory()).toEqual(['tenant-a']);
  expect(await reconcile(desired('tenant-b'))).toMatchObject({
    status: 'blocked',
    reason: 'runtime_baseline_preparation_failed',
  });
  expect(enabled.has('tenant-b')).toBe(false);
  expect(await directory()).toEqual(['tenant-a']);
  failBaselineForB = false;
  expect(await reconcile(desired('tenant-b'))).toMatchObject({ status: 'ready' });
  lifecycleReady.add('tenant-b');
  expect(await directory()).toEqual(ids);
  baselines.delete('tenant-b');
  expect(await directory()).toEqual(['tenant-a']);
  expect(await reconcile(desired('tenant-b'))).toMatchObject({ status: 'ready', changed: true });
  expect(await directory()).toEqual(ids);
});
