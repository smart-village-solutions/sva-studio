import { describe, expect, it } from 'vitest';

import { getPersonaSeed, iamSeedPlan, rootOnlySeedPermissionKeys, tenantBootstrapPermissionKeys } from './seed-plan';

describe('iam seed plan', () => {
  it('contains exactly one tenant bootstrap persona', () => {
    expect(iamSeedPlan.personas.length).toBe(1);
  });

  it('keeps the canonical permission catalog in sync with the seed integration expectations', () => {
    expect(iamSeedPlan.permissions.length).toBe(58);
  });

  it('uses unique role slugs and keycloak subjects', () => {
    const roleSlugs = new Set(iamSeedPlan.personas.map((persona) => persona.roleSlug));
    const subjects = new Set(iamSeedPlan.personas.map((persona) => persona.keycloakSubject));

    expect(roleSlugs.size).toBe(iamSeedPlan.personas.length);
    expect(subjects.size).toBe(iamSeedPlan.personas.length);
  });

  it('defines role levels within range', () => {
    for (const persona of iamSeedPlan.personas) {
      expect(persona.roleLevel).toBeGreaterThanOrEqual(0);
      expect(persona.roleLevel).toBeLessThanOrEqual(100);
    }
  });

  it('resolves persona by stable key', () => {
    const systemAdmin = getPersonaSeed('system_admin');

    expect(systemAdmin.roleSlug).toBe('system_admin');
    expect(systemAdmin.roleLevel).toBe(100);
    expect(systemAdmin.permissionKeys).toEqual(tenantBootstrapPermissionKeys);
  });

  it('does not expose a tenant-side instance_registry_admin persona anymore', () => {
    expect(() => getPersonaSeed('instance_registry_admin' as never)).toThrowError(
      /Unknown persona key: instance_registry_admin/
    );
  });

  it('keeps instance.registry.manage out of tenant bootstrap personas', () => {
    expect(rootOnlySeedPermissionKeys).toEqual(['instance.registry.manage']);
    expect(tenantBootstrapPermissionKeys.includes('instance.registry.manage')).toBe(false);
    expect(getPersonaSeed('system_admin').permissionKeys).toEqual(tenantBootstrapPermissionKeys);
    for (const persona of iamSeedPlan.personas) {
      expect(persona.permissionKeys.includes('instance.registry.manage')).toBe(false);
    }
  });

  it('contains hierarchical organizations for context-switch scenarios', () => {
    expect(iamSeedPlan.organizations.length).toBe(3);
    expect(iamSeedPlan.organizations[0].hierarchyPath).toEqual([]);
    expect(iamSeedPlan.organizations[1].parentOrganizationId).toBe(iamSeedPlan.organizations[0].id);
    expect(iamSeedPlan.organizations[2].depth).toBe(2);
  });

  it('derives stable resource types from permission keys', () => {
    expect(iamSeedPlan.permissions.find((permission) => permission.key === 'instance.registry.manage')?.resourceType).toBe(
      'instance'
    );
    expect(iamSeedPlan.permissions.find((permission) => permission.key === 'content.publish')?.resourceType).toBe('content');
    expect(iamSeedPlan.permissions.find((permission) => permission.key === 'media.read')?.resourceType).toBe('media');
    expect(iamSeedPlan.permissions.find((permission) => permission.key === 'news.update')?.resourceType).toBe('news');
    expect(iamSeedPlan.permissions.find((permission) => permission.key === 'categories.read')?.resourceType).toBe('categories');
    expect(iamSeedPlan.permissions.find((permission) => permission.key === 'app.read')?.resourceType).toBe('app');
    expect(iamSeedPlan.permissions.find((permission) => permission.key === 'cockpit.read')?.resourceType).toBe('cockpit');
    expect(iamSeedPlan.permissions.find((permission) => permission.key === 'experimental.read')?.resourceType).toBe(
      'experimental'
    );
    expect(iamSeedPlan.permissions.find((permission) => permission.key === 'iam.governance.export')?.resourceType).toBe(
      'iam'
    );
    expect(iamSeedPlan.permissions.find((permission) => permission.key === 'iam.accounts.delete')?.resourceType).toBe(
      'iam'
    );
  });

  it('throws for unknown persona keys', () => {
    expect(() => getPersonaSeed('unknown' as never)).toThrowError(/Unknown persona key: unknown/);
  });
});
