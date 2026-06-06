import { describe, expect, it } from 'vitest';

import {
  isScopeSensitivePermission,
  listScopeSensitivePermissionKeys,
  projectOrganizationIdForPermission,
  resolvePermissionRuntimeScope,
} from './permission-scope-semantics.js';

describe('permission scope semantics', () => {
  it('classifies managed permission runtime scopes explicitly', () => {
    expect(resolvePermissionRuntimeScope({ permissionKey: 'media.read' })).toBe(
      'instance'
    );
    expect(
      resolvePermissionRuntimeScope({
        permissionKey: 'content.read',
        accessScope: 'organization',
      })
    ).toBe('record');
  });

  it('treats scope-assignable permissions as scope-sensitive and keeps instance rights org-agnostic', () => {
    expect(listScopeSensitivePermissionKeys()).toEqual(
      expect.arrayContaining(['content.read', 'news.read', 'events.read', 'poi.read'])
    );
    expect(
      isScopeSensitivePermission({
        permissionKey: 'content.read',
        accessScope: 'all',
      })
    ).toBe(true);
    expect(isScopeSensitivePermission({ permissionKey: 'media.read' })).toBe(
      false
    );
    expect(
      projectOrganizationIdForPermission({
        permissionKey: 'content.read',
        accessScope: 'all',
        organizationId: 'org-1',
      })
    ).toBe('org-1');
    expect(
      projectOrganizationIdForPermission({
        permissionKey: 'media.read',
        organizationId: 'org-1',
      })
    ).toBeUndefined();
  });

  it('does not project organization scope for instance-style permissions normalized with accessScope all', () => {
    expect(
      resolvePermissionRuntimeScope({
        permissionKey: 'iam.role.read',
        accessScope: 'all',
      })
    ).toBe('instance');
    expect(
      projectOrganizationIdForPermission({
        permissionKey: 'iam.role.read',
        accessScope: 'all',
        organizationId: 'org-1',
      })
    ).toBeUndefined();
  });

  it('keeps restrictive legacy fallback for unknown non-all access scopes', () => {
    expect(
      resolvePermissionRuntimeScope({
        permissionKey: 'custom.unknown',
        accessScope: 'organization',
      })
    ).toBe('record');
  });
});
