import { describe, expect, it } from 'vitest';

import { parseInvalidationEvent, PermissionSnapshotCache } from './iam-authorization-cache.js';

describe('iam authorization cache', () => {
  it('stores snapshots, returns hits, stale entries and evicts expired snapshots', () => {
    const cache = new PermissionSnapshotCache(1_000, 1_000);
    const key = {
      instanceId: 'tenant-a',
      keycloakSubject: 'kc-user-1',
      organizationId: 'org-1',
      geoContextHash: 'geo-1',
    };

    const snapshot = cache.set(key, [{ action: 'content.read', resourceType: 'content', effect: 'allow' }], 10_000, 'snap-1');
    expect(snapshot).toMatchObject({ version: 1, snapshotVersion: 'snap-1' });
    expect(cache.size()).toBe(1);

    expect(cache.get(key, 10_500)).toMatchObject({
      status: 'hit',
      ttlRemainingSeconds: 1,
      snapshot: expect.objectContaining({ version: 1 }),
    });

    expect(cache.get(key, 11_000)).toMatchObject({
      status: 'stale',
      ageSeconds: 1,
      snapshot: expect.objectContaining({ version: 1 }),
    });

    expect(cache.get(key, 12_500)).toMatchObject({
      status: 'stale',
      ageSeconds: 3,
    });
    expect(cache.size()).toBe(0);
    expect(cache.get(key, 12_600)).toEqual({ status: 'miss' });
  });

  it('bumps user versions and invalidates instance-wide scopes', () => {
    const cache = new PermissionSnapshotCache();

    cache.set({ instanceId: 'tenant-a', keycloakSubject: 'user-1' }, [], 1_000);
    cache.set({ instanceId: 'tenant-a', keycloakSubject: 'user-2' }, [], 1_000);
    cache.set({ instanceId: 'tenant-b', keycloakSubject: 'user-3' }, [], 1_000);

    expect(cache.invalidate({ instanceId: 'tenant-a', keycloakSubject: 'user-1' })).toBe(2);
    expect(cache.getVersion('tenant-a', 'user-1')).toBe(2);
    expect(cache.get({ instanceId: 'tenant-a', keycloakSubject: 'user-1' }, 1_100)).toEqual({ status: 'miss' });
    expect(cache.bumpVersion('tenant-a', 'user-2')).toBe(2);

    expect(cache.invalidate({ instanceId: 'tenant-a' })).toBe(2);
    expect(cache.getVersion('tenant-a', 'user-1')).toBe(3);
    expect(cache.getVersion('tenant-a', 'user-2')).toBe(3);
    expect(cache.getVersion('tenant-b', 'user-3')).toBe(1);
  });

  it('parses specialized invalidation events and falls back to scope defaults', () => {
    expect(parseInvalidationEvent('not-json')).toBeNull();
    expect(parseInvalidationEvent(JSON.stringify({ nope: true }))).toBeNull();

    expect(
      parseInvalidationEvent(
        JSON.stringify({
          instanceId: 'tenant-a',
          trigger: 'recompute',
          eventId: 'evt-1',
          event: 'RolePermissionChanged',
          roleId: 'role-1',
        })
      )
    ).toEqual({
      instanceId: 'tenant-a',
      trigger: 'recompute',
      eventId: 'evt-1',
      event: {
        type: 'role_permission_changed',
        instanceId: 'tenant-a',
        roleId: 'role-1',
        eventId: 'evt-1',
      },
    });

    expect(
      parseInvalidationEvent(
        JSON.stringify({
          instanceId: 'tenant-a',
          event: 'GroupMembershipChanged',
          groupId: 'group-1',
          accountId: 'account-1',
          keycloakSubject: 'kc-user-1',
        })
      )
    ).toEqual({
      instanceId: 'tenant-a',
      keycloakSubject: 'kc-user-1',
      trigger: 'pg_notify',
      eventId: undefined,
      event: {
        type: 'group_membership_changed',
        instanceId: 'tenant-a',
        groupId: 'group-1',
        accountId: 'account-1',
        keycloakSubject: 'kc-user-1',
        eventId: undefined,
      },
    });

    expect(
      parseInvalidationEvent(
        JSON.stringify({
          instanceId: 'tenant-a',
          trigger: 'ttl',
          event: 'GroupDeleted',
          groupId: 'group-1',
          affectedAccountIds: ['account-1', 1, 'account-2'],
          affectedKeycloakSubjects: ['kc-user-1', null, 'kc-user-2'],
        })
      )
    ).toEqual({
      instanceId: 'tenant-a',
      trigger: 'ttl',
      eventId: undefined,
      event: {
        type: 'group_deleted',
        instanceId: 'tenant-a',
        groupId: 'group-1',
        affectedAccountIds: ['account-1', 'account-2'],
        affectedKeycloakSubjects: ['kc-user-1', 'kc-user-2'],
        eventId: undefined,
      },
    });

    expect(
      parseInvalidationEvent(
        JSON.stringify({
          instanceId: 'tenant-a',
          keycloakSubject: 'kc-user-1',
          reason: 'delegation_changed',
        })
      )
    ).toEqual({
      instanceId: 'tenant-a',
      keycloakSubject: 'kc-user-1',
      trigger: 'pg_notify',
      eventId: undefined,
      event: {
        type: 'user_scope_changed',
        instanceId: 'tenant-a',
        keycloakSubject: 'kc-user-1',
        eventId: undefined,
        reason: 'delegation_changed',
      },
    });

    expect(
      parseInvalidationEvent(
        JSON.stringify({
          instanceId: 'tenant-a',
          reason: 'role_matrix_changed',
        })
      )
    ).toEqual({
      instanceId: 'tenant-a',
      trigger: 'pg_notify',
      eventId: undefined,
      event: {
        type: 'instance_scope_changed',
        instanceId: 'tenant-a',
        eventId: undefined,
        reason: 'role_matrix_changed',
      },
    });
  });
});
