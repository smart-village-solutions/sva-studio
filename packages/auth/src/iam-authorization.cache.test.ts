import { describe, expect, it } from 'vitest';

import type { EffectivePermission } from '@sva/core';
import { parseInvalidationEvent, PermissionSnapshotCache } from './iam-authorization.cache';

describe('PermissionSnapshotCache', () => {
  const basePermission: EffectivePermission = {
    action: 'content.read',
    resourceType: 'content',
    sourceRoleIds: ['role-1'],
    sourceGroupIds: [],
  };

  it('returns hit for valid snapshot and stale for expired snapshot', () => {
    const cache = new PermissionSnapshotCache(1_000, 5_000);
    cache.set(
      {
        instanceId: 'de-musterhausen',
        keycloakSubject: 'sub-1',
      },
      [basePermission],
      10_000
    );

    const hit = cache.get(
      {
        instanceId: 'de-musterhausen',
        keycloakSubject: 'sub-1',
      },
      10_500
    );
    expect(hit.status).toBe('hit');

    const stale = cache.get(
      {
        instanceId: 'de-musterhausen',
        keycloakSubject: 'sub-1',
      },
      11_500
    );
    expect(stale.status).toBe('stale');
  });

  it('invalidates scoped snapshots by version bump', () => {
    const cache = new PermissionSnapshotCache(1_000, 5_000);
    cache.set(
      {
        instanceId: 'de-musterhausen',
        keycloakSubject: 'sub-1',
      },
      [basePermission],
      10_000
    );

    cache.invalidate({
      instanceId: 'de-musterhausen',
      keycloakSubject: 'sub-1',
    });

    const lookup = cache.get(
      {
        instanceId: 'de-musterhausen',
        keycloakSubject: 'sub-1',
      },
      10_500
    );
    expect(lookup.status).toBe('miss');
  });

  it('separates snapshots by geo context and invalidates instance-wide scopes', () => {
    const cache = new PermissionSnapshotCache(1_000, 5_000);
    cache.set(
      {
        instanceId: 'de-musterhausen',
        keycloakSubject: 'sub-1',
        geoContextHash: 'geo-a',
      },
      [basePermission],
      10_000
    );
    cache.set(
      {
        instanceId: 'de-musterhausen',
        keycloakSubject: 'sub-2',
        geoContextHash: 'geo-b',
      },
      [basePermission],
      10_000
    );

    expect(
      cache.get({
        instanceId: 'de-musterhausen',
        keycloakSubject: 'sub-1',
        geoContextHash: 'geo-b',
      }).status
    ).toBe('miss');
    cache.bumpVersion('de-musterhausen', 'sub-1');
    cache.bumpVersion('de-musterhausen', 'sub-2');
    expect(cache.invalidate({ instanceId: 'de-musterhausen' })).toBe(2);
  });

  it('evicts entries once the stale window is exceeded', () => {
    const cache = new PermissionSnapshotCache(1_000, 500);
    cache.set(
      {
        instanceId: 'de-musterhausen',
        keycloakSubject: 'sub-1',
      },
      [basePermission],
      10_000
    );

    expect(
      cache.get(
        {
          instanceId: 'de-musterhausen',
          keycloakSubject: 'sub-1',
        },
        12_000
      )
    ).toEqual({
      status: 'stale',
      ageSeconds: 2,
    });
    expect(
      cache.get({
        instanceId: 'de-musterhausen',
        keycloakSubject: 'sub-1',
      }).status
    ).toBe('miss');
  });
});

describe('parseInvalidationEvent', () => {
  it('parses valid events', () => {
    const parsed = parseInvalidationEvent(
      JSON.stringify({
        eventId: 'evt-1',
        instanceId: 'de-musterhausen',
        keycloakSubject: 'sub-1',
        trigger: 'pg_notify',
      })
    );
    expect(parsed).toEqual({
      instanceId: 'de-musterhausen',
      keycloakSubject: 'sub-1',
      trigger: 'pg_notify',
      eventId: 'evt-1',
      event: {
        type: 'user_scope_changed',
        instanceId: 'de-musterhausen',
        keycloakSubject: 'sub-1',
        eventId: 'evt-1',
      },
    });
  });

  it('returns null for invalid payloads', () => {
    expect(parseInvalidationEvent('not-json')).toBeNull();
    expect(parseInvalidationEvent(JSON.stringify({ trigger: 'pg_notify' }))).toBeNull();
    expect(parseInvalidationEvent(JSON.stringify({ instanceId: '' }))).toBeNull();
  });

  it('parses specialized role, group membership and group deletion events', () => {
    expect(
      parseInvalidationEvent(
        JSON.stringify({
          event: 'RolePermissionChanged',
          instanceId: 'de-musterhausen',
          roleId: 'role-1',
          trigger: 'ttl',
          eventId: 'evt-role',
        })
      )
    ).toEqual({
      instanceId: 'de-musterhausen',
      trigger: 'ttl',
      eventId: 'evt-role',
      event: {
        type: 'role_permission_changed',
        instanceId: 'de-musterhausen',
        roleId: 'role-1',
        eventId: 'evt-role',
      },
    });

    expect(
      parseInvalidationEvent(
        JSON.stringify({
          event: 'GroupMembershipChanged',
          instanceId: 'de-musterhausen',
          groupId: 'group-1',
          accountId: 'account-1',
          keycloakSubject: 'sub-1',
          eventId: 'evt-group',
        })
      )?.event
    ).toEqual({
      type: 'group_membership_changed',
      instanceId: 'de-musterhausen',
      groupId: 'group-1',
      accountId: 'account-1',
      keycloakSubject: 'sub-1',
      eventId: 'evt-group',
    });

    expect(
      parseInvalidationEvent(
        JSON.stringify({
          event: 'GroupDeleted',
          instanceId: 'de-musterhausen',
          groupId: 'group-2',
          affectedAccountIds: ['account-1'],
          affectedKeycloakSubjects: ['sub-1'],
          trigger: 'recompute',
        })
      )?.event
    ).toEqual({
      type: 'group_deleted',
      instanceId: 'de-musterhausen',
      groupId: 'group-2',
      affectedAccountIds: ['account-1'],
      affectedKeycloakSubjects: ['sub-1'],
      eventId: undefined,
    });
  });
});
