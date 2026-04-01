import type { EffectivePermission } from '@sva/core';

import { runTimedScenario } from '../src/iam-authorization/benchmark-harness.js';
import * as permissionStoreModule from '../src/iam-authorization/permission-store.js';
import { processSnapshotInvalidationEventWithDeps } from '../src/iam-authorization/snapshot-invalidation.server.js';

const resolveEffectivePermissionsWithDeps =
  'resolveEffectivePermissionsWithDeps' in permissionStoreModule &&
  typeof permissionStoreModule.resolveEffectivePermissionsWithDeps === 'function'
    ? permissionStoreModule.resolveEffectivePermissionsWithDeps
    : 'default' in permissionStoreModule && typeof permissionStoreModule.default === 'function'
      ? permissionStoreModule.default
      : (() => {
          throw new Error('resolveEffectivePermissionsWithDeps export not found');
        });

const PERMISSIONS: readonly EffectivePermission[] = [
  {
    action: 'content.read',
    resourceType: 'content',
    effect: 'allow',
    sourceRoleIds: ['role-1'],
    sourceGroupIds: ['group-1'],
  },
];

const createSnapshot = (permissions: readonly EffectivePermission[]) => ({
  permissions,
  createdAt: new Date(),
  snapshotVersion: 'snapshot-version-1',
});

const baseInput = {
  instanceId: 'de-musterhausen',
  keycloakSubject: 'bench-user',
};

const createDeps = (
  lookup:
    | { status: 'hit'; snapshot: { permissions: readonly EffectivePermission[]; snapshotVersion?: string }; ttlRemainingSeconds: number }
    | { status: 'miss'; snapshot: null; ttlRemainingSeconds: number; ageSeconds: number }
    | { status: 'stale'; snapshot: null; ttlRemainingSeconds: number; ageSeconds: number }
) => ({
  ensureInvalidationListener: async () => undefined,
  cache: {
    get: () => lookup,
    set: (_input: unknown, permissions: readonly EffectivePermission[]) => createSnapshot(permissions),
    size: () => (lookup.status === 'miss' ? 0 : 1),
  },
  getRedisPermissionSnapshot: async () =>
    lookup.status === 'hit'
      ? { hit: true as const, permissions: lookup.snapshot.permissions, version: lookup.snapshot.snapshotVersion ?? 'redis-version' }
      : { hit: false as const, reason: 'miss' as const },
  setRedisPermissionSnapshot: async () => ({ ok: true as const, version: 'redis-version' }),
  loadPermissionsFromDb: async () => PERMISSIONS,
  recordPermissionCacheColdStart: () => undefined,
  recordPermissionCacheRedisLatency: () => undefined,
  recordPermissionCacheRecompute: () => undefined,
  iamCacheLookupCounter: { add: () => undefined },
  cacheLogger: { debug: () => undefined, info: () => undefined, warn: () => undefined, error: () => undefined },
  logger: { debug: () => undefined, info: () => undefined, warn: () => undefined, error: () => undefined },
  cacheMetricsState: { lookups: 0, staleLookups: 0 },
});

const run = async () => {
  const metrics = await Promise.all([
    runTimedScenario({
      scenario: 'cache-hit',
      warmupRuns: 50,
      samples: 500,
      execute: async () => {
        await resolveEffectivePermissionsWithDeps(
          baseInput,
          createDeps({
            status: 'hit',
            snapshot: createSnapshot(PERMISSIONS),
            ttlRemainingSeconds: 300,
          })
        );
      },
    }),
    runTimedScenario({
      scenario: 'cache-miss',
      warmupRuns: 25,
      samples: 250,
      execute: async () => {
        await resolveEffectivePermissionsWithDeps(
          baseInput,
          createDeps({
            status: 'miss',
            snapshot: null,
            ttlRemainingSeconds: 0,
            ageSeconds: 0,
          })
        );
      },
    }),
    runTimedScenario({
      scenario: 'recompute',
      warmupRuns: 25,
      samples: 250,
      execute: async () => {
        await resolveEffectivePermissionsWithDeps(
          baseInput,
          createDeps({
            status: 'stale',
            snapshot: null,
            ttlRemainingSeconds: 0,
            ageSeconds: 301,
          })
        );
      },
    }),
    runTimedScenario({
      scenario: 'invalidation-user-scope',
      warmupRuns: 25,
      samples: 250,
      execute: async () => {
        await processSnapshotInvalidationEventWithDeps(
          {
            type: 'group_membership_changed',
            instanceId: 'de-musterhausen',
            accountId: 'account-1',
            groupId: 'group-1',
            keycloakSubject: 'bench-user',
            eventId: crypto.randomUUID(),
          },
          {
            invalidateSnapshots: async () => 1,
          }
        );
      },
    }),
  ]);

  process.stdout.write(
    `${JSON.stringify(
      {
        measuredAt: new Date().toISOString(),
        scenarios: metrics,
      },
      null,
      2
    )}\n`
  );
};

void run();
