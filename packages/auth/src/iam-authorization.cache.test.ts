import { describe, expect, it } from 'vitest';

import type { EffectivePermission } from '@sva/core';
import { parseInvalidationEvent, PermissionSnapshotCache } from './iam-authorization.cache';

describe('PermissionSnapshotCache', () => {
  const basePermission: EffectivePermission = {
    action: 'content.read',
    resourceType: 'content',
    sourceRoleIds: ['role-1'],
  };

  it('returns hit for valid snapshot and stale for expired snapshot', () => {
    const cache = new PermissionSnapshotCache(1_000, 5_000);
    cache.set(
      {
        instanceId: '11111111-1111-1111-8111-111111111111',
        keycloakSubject: 'sub-1',
      },
      [basePermission],
      10_000
    );

    const hit = cache.get(
      {
        instanceId: '11111111-1111-1111-8111-111111111111',
        keycloakSubject: 'sub-1',
      },
      10_500
    );
    expect(hit.status).toBe('hit');

    const stale = cache.get(
      {
        instanceId: '11111111-1111-1111-8111-111111111111',
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
        instanceId: '11111111-1111-1111-8111-111111111111',
        keycloakSubject: 'sub-1',
      },
      [basePermission],
      10_000
    );

    cache.invalidate({
      instanceId: '11111111-1111-1111-8111-111111111111',
      keycloakSubject: 'sub-1',
    });

    const lookup = cache.get(
      {
        instanceId: '11111111-1111-1111-8111-111111111111',
        keycloakSubject: 'sub-1',
      },
      10_500
    );
    expect(lookup.status).toBe('miss');
  });
});

describe('parseInvalidationEvent', () => {
  it('parses valid events', () => {
    const parsed = parseInvalidationEvent(
      JSON.stringify({
        instanceId: '11111111-1111-1111-8111-111111111111',
        keycloakSubject: 'sub-1',
        trigger: 'pg_notify',
      })
    );
    expect(parsed).toEqual({
      instanceId: '11111111-1111-1111-8111-111111111111',
      keycloakSubject: 'sub-1',
      trigger: 'pg_notify',
    });
  });

  it('returns null for invalid payloads', () => {
    expect(parseInvalidationEvent('not-json')).toBeNull();
    expect(parseInvalidationEvent(JSON.stringify({ trigger: 'pg_notify' }))).toBeNull();
    expect(
      parseInvalidationEvent(
        JSON.stringify({
          instanceId: '11111111-1111-1111-8111-111111111111',
          trigger: 'invalid',
        })
      )
    ).toBeNull();
  });
});
