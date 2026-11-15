import { describe, expect, it } from 'vitest';

import {
  resolveStandardEditorPermissionScope,
  standardEditorContentModules,
  standardEditorPermissionKeys,
  composePermissionCatalog,
  corePermissionCatalog,
  resolvesSystemAdminGrant,
  tenantCoreSystemAdminPermissionKeys,
  validatePermissionCatalog,
} from './permission-catalog.js';

describe('permission catalog', () => {
  it('grants active tenant permissions to system_admin by default', () => {
    expect(tenantCoreSystemAdminPermissionKeys).toContain('iam.authenticationPolicy.manage');
    expect(tenantCoreSystemAdminPermissionKeys).toContain('iam.accounts.delete');
    expect(tenantCoreSystemAdminPermissionKeys).toContain('modules.read');
    expect(
      resolvesSystemAdminGrant({
        key: 'iam.example.read',
        description: 'Example',
        resourceType: 'iam',
        availability: { kind: 'tenant' },
      })
    ).toBe(true);
  });

  it('grants every tenant permission while never granting root permissions to system_admin', () => {
    expect(
      resolvesSystemAdminGrant({
        key: 'iam.example.write',
        description: 'Example',
        resourceType: 'iam',
        availability: { kind: 'tenant' },
        systemAdminGrant: false,
      })
    ).toBe(true);
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
      true
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

describe('standard editor grants', () => {
  it.each(standardEditorContentModules)(
    'scopes %s records without granting administration',
    (moduleId) => {
      for (const action of ['read', 'update', 'delete']) {
        expect(resolveStandardEditorPermissionScope(`${moduleId}.${action}`)).toBe('organization');
      }
      expect(resolveStandardEditorPermissionScope(`${moduleId}.create`)).toBe('all');
      expect(resolveStandardEditorPermissionScope(`${moduleId}.manage`)).toBeUndefined();
      expect(resolveStandardEditorPermissionScope(`${moduleId}.export`)).toBeUndefined();
    }
  );
  it('includes history, publish and push, and keeps shared resources tenant wide', () => {
    for (const key of ['content.readHistory', 'content.publish', 'news.pushNotification'])
      expect(resolveStandardEditorPermissionScope(key)).toBe('organization');
    for (const key of ['media.read', 'media.reference.manage', 'categories.delete', 'modules.read'])
      expect(resolveStandardEditorPermissionScope(key)).toBe('all');
    for (const key of [
      'iam.user.write',
      'iam.role.write',
      'content.transferOwnership',
      'content.manageRevisions',
      'media.deliver.protected',
      'waste-management.settings.manage',
    ])
      expect(resolveStandardEditorPermissionScope(key)).toBeUndefined();
    expect(new Set(standardEditorPermissionKeys).size).toBe(standardEditorPermissionKeys.length);
  });
});
