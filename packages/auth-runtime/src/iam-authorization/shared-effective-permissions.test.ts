import { describe, expect, it } from 'vitest';

import { readResourceType, toEffectivePermissions, type PermissionRow } from './shared-effective-permissions.js';

describe('shared effective permission mapping', () => {
  it('derives resource types and merges permission rows deterministically', () => {
    const rows: readonly PermissionRow[] = [
      {
        permission_key: 'content.read',
        action: ' content.read ',
        resource_type: ' content ',
        resource_id: ' content-1 ',
        organization_id: '22222222-2222-4222-8222-222222222222',
        scope: { contentType: 'news.article' },
        role_id: 'role-2',
        source_kind: 'direct_role',
      },
      {
        permission_key: 'content.read',
        action: 'content.read',
        resource_type: 'content',
        resource_id: 'content-1',
        organization_id: '22222222-2222-4222-8222-222222222222',
        scope: { contentType: 'news.article' },
        role_id: 'role-1',
        group_id: 'group-1',
        group_key: 'editors',
        source_kind: 'group_role',
      },
      {
        permission_key: 'content.delete',
        organization_id: null,
        source_kind: 'direct_role',
      },
    ];

    expect(readResourceType('content.read')).toBe('content');
    expect(toEffectivePermissions(rows)).toEqual([
      {
        action: 'content.read',
        resourceType: 'content',
        resourceId: 'content-1',
        organizationId: '22222222-2222-4222-8222-222222222222',
        scope: { contentType: 'news.article' },
        sourceRoleIds: ['role-1', 'role-2'],
        sourceGroupIds: ['group-1'],
        groupName: 'editors',
        provenance: { sourceKinds: ['direct_role', 'group_role'] },
      },
      {
        action: 'content.delete',
        resourceType: 'content',
        provenance: { sourceKinds: ['direct_role'] },
      },
    ]);
  });

  it('preserves defaults when optional row fields are absent', () => {
    expect(
      toEffectivePermissions([
        {
          permission_key: 'system',
          organization_id: null,
        },
      ])
    ).toEqual([
      {
        action: 'system',
        resourceType: 'system',
      },
    ]);
  });

  it('strips blanket organization projections from instance-scoped permissions', () => {
    expect(
      toEffectivePermissions([
        {
          permission_key: 'media.read',
          organization_id: '22222222-2222-4222-8222-222222222222',
        },
        {
          permission_key: 'content.read',
          organization_id: '22222222-2222-4222-8222-222222222222',
          access_scope: 'all',
        },
        {
          permission_key: 'iam.role.read',
          organization_id: '22222222-2222-4222-8222-222222222222',
          access_scope: 'all',
        },
      ])
    ).toEqual([
      {
        action: 'media.read',
        resourceType: 'media',
      },
        {
          action: 'content.read',
          resourceType: 'content',
          accessScope: 'all',
        },
        {
          action: 'iam.role.read',
          resourceType: 'iam',
          accessScope: 'all',
        },
      ]);
  });

  it('normalizes identical permission keys to the widest access scope while preserving provenance', () => {
    expect(
      toEffectivePermissions([
        {
          permission_key: 'content.update',
          action: 'content.update',
          resource_type: 'content',
          organization_id: '22222222-2222-4222-8222-222222222222',
          access_scope: 'own',
          role_id: 'role-own',
          source_kind: 'direct_role',
        },
        {
          permission_key: 'content.update',
          action: 'content.update',
          resource_type: 'content',
          organization_id: '22222222-2222-4222-8222-222222222222',
          access_scope: 'organization',
          role_id: 'role-org',
          group_id: 'group-editors',
          source_kind: 'group_role',
        },
      ])
    ).toEqual([
      {
        action: 'content.update',
        resourceType: 'content',
        organizationId: '22222222-2222-4222-8222-222222222222',
        accessScope: 'organization',
        sourceRoleIds: ['role-org', 'role-own'],
        sourceGroupIds: ['group-editors'],
        provenance: { sourceKinds: ['direct_role', 'group_role'] },
      },
    ]);
  });
});
