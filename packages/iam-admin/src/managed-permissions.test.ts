import { describe, expect, it } from 'vitest';

import { getManagedPermissionMetadata, listManagedPermissionMetadata } from './managed-permissions.js';

describe('managed-permissions', () => {
  it('publishes the centrally managed waste-management permissions for admin flows', () => {
    expect(listManagedPermissionMetadata()).toEqual(
      expect.arrayContaining([
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
    expect(getManagedPermissionMetadata('content.read')).toBeUndefined();
  });
});
