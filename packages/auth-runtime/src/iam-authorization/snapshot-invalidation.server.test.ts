import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
  invalidateRedisPermissionSnapshots: vi.fn(async () => 1),
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: vi.fn(() => mocks.logger),
}));

vi.mock('./redis-permission-snapshot.server.js', () => ({
  invalidateRedisPermissionSnapshots: mocks.invalidateRedisPermissionSnapshots,
}));

describe('snapshot invalidation processing', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('dispatches user and instance scoped events to the correct dependency target', async () => {
    const { processSnapshotInvalidationEventWithDeps } = await import('./snapshot-invalidation.server.js');
    const invalidateSnapshots = vi.fn(async () => 1);

    await processSnapshotInvalidationEventWithDeps(
      {
        type: 'user_scope_changed',
        instanceId: 'tenant-a',
        keycloakSubject: 'kc-user-1',
      },
      { invalidateSnapshots }
    );
    await processSnapshotInvalidationEventWithDeps(
      {
        type: 'instance_scope_changed',
        instanceId: 'tenant-a',
      },
      { invalidateSnapshots }
    );
    await processSnapshotInvalidationEventWithDeps(
      {
        type: 'delegation_changed',
        instanceId: 'tenant-a',
        delegateeKeycloakSubject: 'kc-user-2',
      },
      { invalidateSnapshots }
    );
    await processSnapshotInvalidationEventWithDeps(
      {
        type: 'organization_membership_changed',
        instanceId: 'tenant-a',
        keycloakSubject: 'kc-user-3',
      },
      { invalidateSnapshots }
    );
    await processSnapshotInvalidationEventWithDeps(
      {
        type: 'account_role_assignment_changed',
        instanceId: 'tenant-a',
        roleId: 'role-1',
      },
      { invalidateSnapshots }
    );
    await processSnapshotInvalidationEventWithDeps(
      {
        type: 'geo_assignment_changed',
        instanceId: 'tenant-a',
        affectedGeoIds: ['geo-1'],
      },
      { invalidateSnapshots }
    );

    expect(invalidateSnapshots.mock.calls).toEqual([
      ['tenant-a', 'kc-user-1'],
      ['tenant-a'],
      ['tenant-a', 'kc-user-2'],
      ['tenant-a', 'kc-user-3'],
      ['tenant-a', undefined],
      ['tenant-a'],
    ]);
    expect(mocks.logger.info).toHaveBeenCalled();
  });

  it('handles group and role driven invalidations with deduplication by event id', async () => {
    const { processSnapshotInvalidationEventWithDeps } = await import('./snapshot-invalidation.server.js');
    const invalidateSnapshots = vi.fn(async () => 1);

    await processSnapshotInvalidationEventWithDeps(
      {
        type: 'role_permission_changed',
        instanceId: 'tenant-a',
        roleId: 'role-1',
        eventId: 'evt-1',
      },
      { invalidateSnapshots }
    );
    await processSnapshotInvalidationEventWithDeps(
      {
        type: 'role_permission_changed',
        instanceId: 'tenant-a',
        roleId: 'role-1',
        eventId: 'evt-1',
      },
      { invalidateSnapshots }
    );
    await processSnapshotInvalidationEventWithDeps(
      {
        type: 'group_membership_changed',
        instanceId: 'tenant-a',
        groupId: 'group-1',
        accountId: 'account-1',
        keycloakSubject: 'kc-user-1',
        eventId: 'evt-2',
      },
      { invalidateSnapshots }
    );
    await processSnapshotInvalidationEventWithDeps(
      {
        type: 'group_deleted',
        instanceId: 'tenant-a',
        groupId: 'group-1',
        affectedAccountIds: ['account-1'],
        affectedKeycloakSubjects: ['kc-user-1', 'kc-user-2'],
        eventId: 'evt-3',
      },
      { invalidateSnapshots }
    );

    expect(invalidateSnapshots.mock.calls).toEqual([
      ['tenant-a'],
      ['tenant-a', 'kc-user-1'],
      ['tenant-a', 'kc-user-1'],
      ['tenant-a', 'kc-user-2'],
    ]);
    expect(mocks.logger.debug).toHaveBeenCalledWith(
      'Skipping duplicate snapshot invalidation event',
      expect.objectContaining({ event_id: 'evt-1' })
    );
  });

  it('prunes expired dedupe entries and falls back to instance invalidation when group subjects are absent', async () => {
    const { processSnapshotInvalidationEventWithDeps } = await import('./snapshot-invalidation.server.js');
    const invalidateSnapshots = vi.fn(async () => 1);
    const dateNow = vi
      .spyOn(Date, 'now')
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(1_000 + 15 * 60 * 1000 + 1);

    await processSnapshotInvalidationEventWithDeps(
      {
        type: 'instance_settings_changed',
        instanceId: 'tenant-a',
        eventId: 'evt-ttl',
      },
      { invalidateSnapshots }
    );

    await processSnapshotInvalidationEventWithDeps(
      {
        type: 'group_deleted',
        instanceId: 'tenant-a',
        groupId: 'group-1',
        affectedAccountIds: ['account-1'],
        eventId: 'evt-ttl',
      },
      { invalidateSnapshots }
    );
    await processSnapshotInvalidationEventWithDeps(
      {
        type: 'org_hierarchy_changed',
        instanceId: 'tenant-a',
        affectedOrgIds: ['org-1'],
      },
      { invalidateSnapshots }
    );

    expect(invalidateSnapshots.mock.calls).toEqual([['tenant-a'], ['tenant-a'], ['tenant-a']]);
    dateNow.mockRestore();
  });

  it('uses the default redis invalidation dependency in the top-level helper', async () => {
    const { processSnapshotInvalidationEvent } = await import('./snapshot-invalidation.server.js');

    await processSnapshotInvalidationEvent({
      type: 'user_scope_changed',
      instanceId: 'tenant-a',
      keycloakSubject: 'kc-user-1',
    });

    expect(mocks.invalidateRedisPermissionSnapshots).toHaveBeenCalledWith('tenant-a', 'kc-user-1');
  });
});
