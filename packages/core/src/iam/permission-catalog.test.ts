import { describe, expect, it } from 'vitest';

import {
  composePermissionCatalog,
  corePermissionCatalog,
  resolvesSystemAdminGrant,
  tenantCoreSystemAdminPermissionKeys,
  validatePermissionCatalog,
} from './permission-catalog.js';

describe('permission catalog', () => {
  it('grants active tenant permissions to system_admin by default', () => {
    expect(tenantCoreSystemAdminPermissionKeys).toContain('iam.accounts.delete');
    expect(
      resolvesSystemAdminGrant({
        key: 'iam.example.read',
        description: 'Example',
        resourceType: 'iam',
        availability: { kind: 'tenant' },
      })
    ).toBe(true);
  });

  it('honors explicit opt-outs and never grants root permissions to system_admin', () => {
    expect(
      resolvesSystemAdminGrant({
        key: 'iam.example.write',
        description: 'Example',
        resourceType: 'iam',
        availability: { kind: 'tenant' },
        systemAdminGrant: false,
      })
    ).toBe(false);
    expect(
      corePermissionCatalog.find((entry) => entry.key === 'instance.registry.manage')
    ).toMatchObject({
      availability: { kind: 'root' },
      systemAdminGrant: false,
    });
  });

  it('composes module permissions and applies the tenant default grant', () => {
    const catalog = composePermissionCatalog(corePermissionCatalog, [
      {
        moduleId: 'surveys',
        permissionIds: ['surveys.read', 'surveys.export'],
        systemAdminPermissionExclusions: ['surveys.export'],
      },
    ]);
    expect(catalog.find((entry) => entry.key === 'surveys.export')).toMatchObject({
      availability: { kind: 'module', moduleId: 'surveys' },
    });
    expect(resolvesSystemAdminGrant(catalog.find((entry) => entry.key === 'surveys.read')!)).toBe(
      true
    );
    expect(resolvesSystemAdminGrant(catalog.find((entry) => entry.key === 'surveys.export')!)).toBe(
      false
    );
  });

  it('rejects duplicate keys, root grants and module namespace drift', () => {
    expect(() =>
      validatePermissionCatalog([corePermissionCatalog[0], corePermissionCatalog[0]])
    ).toThrow('duplicate_permission_catalog_key:iam.user.read');
    expect(() =>
      validatePermissionCatalog([
        {
          key: 'instance.example',
          description: 'Example',
          resourceType: 'instance',
          availability: { kind: 'root' },
          systemAdminGrant: true,
        },
      ])
    ).toThrow('root_permission_system_admin_grant:instance.example');
    expect(() =>
      composePermissionCatalog([], [{ moduleId: 'news', permissionIds: ['events.read'] }])
    ).toThrow('module_permission_namespace_mismatch:events.read');
  });

  it('rejects incomplete definitions and unknown module grant exclusions', () => {
    const tenantDefinition = {
      key: 'iam.example.read',
      description: 'Example',
      resourceType: 'iam',
      availability: { kind: 'tenant' as const },
    };

    expect(() =>
      validatePermissionCatalog([{ ...tenantDefinition, description: ' ' }])
    ).toThrow('invalid_permission_catalog_description:iam.example.read');
    expect(() =>
      validatePermissionCatalog([{ ...tenantDefinition, resourceType: '' }])
    ).toThrow('invalid_permission_catalog_resource_type:iam.example.read');
    expect(() =>
      validatePermissionCatalog([
        {
          ...tenantDefinition,
          availability: { kind: 'module', moduleId: '' },
        },
      ])
    ).toThrow('invalid_permission_catalog_module_id:iam.example.read');
    expect(() =>
      composePermissionCatalog([], [
        {
          moduleId: 'news',
          permissionIds: ['news.read'],
          systemAdminPermissionExclusions: ['news.delete'],
        },
      ])
    ).toThrow('unknown_system_admin_permission_exclusion:news:news.delete');
  });
});
