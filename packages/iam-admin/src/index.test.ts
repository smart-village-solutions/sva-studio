import { describe, expect, it } from 'vitest';

import { getManagedPermissionMetadata, iamAdminPackageRoles, iamAdminVersion } from './index.js';

describe('@sva/iam-admin package scaffold', () => {
  it('declares the target package role', () => {
    expect(iamAdminVersion).toBe('0.0.1');
    expect(iamAdminPackageRoles).toContain('users');
  });

  it('exports centrally managed permission metadata for waste-management', () => {
    expect(getManagedPermissionMetadata('waste-management.read')).toMatchObject({
      moduleId: 'waste-management',
    });
  });
});
