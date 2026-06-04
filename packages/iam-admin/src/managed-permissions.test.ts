import { describe, expect, it } from 'vitest';

import {
  getManagedPermissionMetadata,
  isRootOnlyPermissionKey,
  isTenantVisiblePermissionKey,
  listManagedPermissionMetadata,
} from './managed-permissions.js';

describe('managed-permissions', () => {
  it('publishes the centrally managed waste-management permissions for admin flows', () => {
    expect(listManagedPermissionMetadata()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          permissionKey: 'app.read',
          moduleId: 'app',
        }),
        expect.objectContaining({
          permissionKey: 'cockpit.read',
          moduleId: 'cockpit',
        }),
        expect.objectContaining({
          permissionKey: 'waste-management.read',
          moduleId: 'waste-management',
        }),
        expect.objectContaining({
          permissionKey: 'waste-management.settings.manage',
          moduleId: 'waste-management',
        }),
      ])
    );
  });

  it('resolves managed permission metadata by key', () => {
    expect(getManagedPermissionMetadata('waste-management.tours.manage')).toEqual({
      permissionKey: 'waste-management.tours.manage',
      moduleId: 'waste-management',
      description: 'Touren im Waste-Management verwalten',
    });
    expect(getManagedPermissionMetadata('content.read')).toEqual({
      permissionKey: 'content.read',
      moduleId: 'content',
      isScopeAssignable: true,
      supportedAccessScopes: ['all', 'own', 'organization'],
    });
    expect(getManagedPermissionMetadata('app.read')).toEqual({
      permissionKey: 'app.read',
      moduleId: 'app',
      description: 'App-Link in der Sidebar anzeigen',
    });
  });

  it('distinguishes tenant-visible permissions from root-only permissions', () => {
    expect(isRootOnlyPermissionKey('instance.registry.manage')).toBe(true);
    expect(isTenantVisiblePermissionKey('instance.registry.manage')).toBe(false);
    expect(isTenantVisiblePermissionKey('content.read')).toBe(true);
  });
});
