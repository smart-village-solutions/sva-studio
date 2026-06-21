import assert from 'node:assert/strict';
import { describe, it } from 'vitest';

import { getPersonaSeed, iamSeedPlan, rootOnlySeedPermissionKeys, tenantBootstrapPermissionKeys } from './seed-plan';

describe('iam seed plan', () => {
  it('contains exactly one tenant bootstrap persona', () => {
    assert.equal(iamSeedPlan.personas.length, 1);
  });

  it('keeps the canonical permission catalog in sync with the seed integration expectations', () => {
    assert.equal(iamSeedPlan.permissions.length, 57);
  });

  it('uses unique role slugs and keycloak subjects', () => {
    const roleSlugs = new Set(iamSeedPlan.personas.map((persona) => persona.roleSlug));
    const subjects = new Set(iamSeedPlan.personas.map((persona) => persona.keycloakSubject));

    assert.equal(roleSlugs.size, iamSeedPlan.personas.length);
    assert.equal(subjects.size, iamSeedPlan.personas.length);
  });

  it('defines role levels within range', () => {
    for (const persona of iamSeedPlan.personas) {
      assert.ok(persona.roleLevel >= 0);
      assert.ok(persona.roleLevel <= 100);
    }
  });

  it('resolves persona by stable key', () => {
    const systemAdmin = getPersonaSeed('system_admin');

    assert.equal(systemAdmin.roleSlug, 'system_admin');
    assert.equal(systemAdmin.roleLevel, 100);
    assert.deepEqual(systemAdmin.permissionKeys, tenantBootstrapPermissionKeys);
  });

  it('does not expose a tenant-side instance_registry_admin persona anymore', () => {
    assert.throws(() => getPersonaSeed('instance_registry_admin' as never), /Unknown persona key: instance_registry_admin/);
  });

  it('keeps instance.registry.manage out of tenant bootstrap personas', () => {
    assert.deepEqual(rootOnlySeedPermissionKeys, ['instance.registry.manage']);
    assert.equal(tenantBootstrapPermissionKeys.includes('instance.registry.manage'), false);
    assert.deepEqual(getPersonaSeed('system_admin').permissionKeys, tenantBootstrapPermissionKeys);
    for (const persona of iamSeedPlan.personas) {
      assert.equal(persona.permissionKeys.includes('instance.registry.manage'), false);
    }
  });

  it('contains hierarchical organizations for context-switch scenarios', () => {
    assert.equal(iamSeedPlan.organizations.length, 3);
    assert.deepEqual(iamSeedPlan.organizations[0].hierarchyPath, []);
    assert.equal(iamSeedPlan.organizations[1].parentOrganizationId, iamSeedPlan.organizations[0].id);
    assert.equal(iamSeedPlan.organizations[2].depth, 2);
  });

  it('derives stable resource types from permission keys', () => {
    assert.equal(
      iamSeedPlan.permissions.find((permission) => permission.key === 'instance.registry.manage')?.resourceType,
      'instance'
    );
    assert.equal(
      iamSeedPlan.permissions.find((permission) => permission.key === 'content.publish')?.resourceType,
      'content'
    );
    assert.equal(iamSeedPlan.permissions.find((permission) => permission.key === 'media.read')?.resourceType, 'media');
    assert.equal(iamSeedPlan.permissions.find((permission) => permission.key === 'news.update')?.resourceType, 'news');
    assert.equal(
      iamSeedPlan.permissions.find((permission) => permission.key === 'categories.read')?.resourceType,
      'categories'
    );
    assert.equal(iamSeedPlan.permissions.find((permission) => permission.key === 'app.read')?.resourceType, 'app');
    assert.equal(iamSeedPlan.permissions.find((permission) => permission.key === 'cockpit.read')?.resourceType, 'cockpit');
    assert.equal(
      iamSeedPlan.permissions.find((permission) => permission.key === 'experimental.read')?.resourceType,
      'experimental'
    );
    assert.equal(
      iamSeedPlan.permissions.find((permission) => permission.key === 'iam.governance.export')?.resourceType,
      'iam'
    );
  });

  it('throws for unknown persona keys', () => {
    assert.throws(() => getPersonaSeed('unknown' as never), /Unknown persona key: unknown/);
  });
});
