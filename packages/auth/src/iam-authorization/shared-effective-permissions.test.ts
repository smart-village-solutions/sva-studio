import { describe, expect, it } from 'vitest';

import { readResourceType, toEffectivePermissions } from './shared-effective-permissions.js';

describe('shared-effective-permissions', () => {
  it('reads the resource type from permission keys', () => {
    expect(readResourceType('iam.user.read')).toBe('iam');
    expect(readResourceType('content.publish')).toBe('content');
  });

  it('normalizes rows and merges duplicate permission buckets deterministically', () => {
    const permissions = toEffectivePermissions([
      {
        permission_key: 'iam.user.read',
        action: ' iam.user.read ',
        resource_type: ' user ',
        resource_id: ' user-1 ',
        effect: 'allow',
        scope: { org: 'root' },
        account_id: 'user-2',
        role_id: 'role-2',
        organization_id: 'org-1',
        group_id: 'group-2',
        group_key: 'Editors',
        source_kind: 'group_role',
      },
      {
        permission_key: 'iam.user.read',
        action: 'iam.user.read',
        resource_type: 'user',
        resource_id: 'user-1',
        effect: 'allow',
        scope: { org: 'root' },
        account_id: 'user-1',
        role_id: 'role-1',
        organization_id: 'org-1',
        group_id: 'group-1',
        group_key: 'Editors',
        source_kind: 'direct_user',
      },
      {
        permission_key: 'content.publish',
        organization_id: null,
        source_kind: null,
      },
    ]);

    expect(permissions).toEqual([
      {
        action: 'iam.user.read',
        resourceType: 'user',
        resourceId: 'user-1',
        organizationId: 'org-1',
        effect: 'allow',
        scope: { org: 'root' },
        sourceUserIds: ['user-1', 'user-2'],
        sourceRoleIds: ['role-1', 'role-2'],
        sourceGroupIds: ['group-1', 'group-2'],
        groupName: 'Editors',
        provenance: { sourceKinds: ['direct_user', 'group_role'] },
      },
      {
        action: 'content.publish',
        resourceType: 'content',
        effect: 'allow',
      },
    ]);
  });
});
