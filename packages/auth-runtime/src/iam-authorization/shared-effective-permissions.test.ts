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
        effect: 'allow',
        scope: { contentType: 'news.article' },
        account_id: 'user-2',
        source_kind: 'direct_user',
      },
      {
        permission_key: 'content.read',
        action: 'content.read',
        resource_type: 'content',
        resource_id: 'content-1',
        organization_id: '22222222-2222-4222-8222-222222222222',
        effect: 'allow',
        scope: { contentType: 'news.article' },
        account_id: 'user-1',
        role_id: 'role-1',
        group_id: 'group-1',
        group_key: 'editors',
        source_kind: 'group_role',
      },
      {
        permission_key: 'content.delete',
        organization_id: null,
        effect: 'deny',
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
        effect: 'allow',
        scope: { contentType: 'news.article' },
        sourceUserIds: ['user-1', 'user-2'],
        sourceRoleIds: ['role-1'],
        sourceGroupIds: ['group-1'],
        groupName: 'editors',
        provenance: { sourceKinds: ['direct_user', 'group_role'] },
      },
      {
        action: 'content.delete',
        resourceType: 'content',
        effect: 'deny',
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
        effect: 'allow',
        provenance: undefined,
      },
    ]);
  });
});
