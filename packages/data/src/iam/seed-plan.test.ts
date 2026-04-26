import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { getPersonaSeed, iamSeedPlan } from './seed-plan';

describe('iam seed plan', () => {
  it('contains exactly eight personas', () => {
    assert.equal(iamSeedPlan.personas.length, 8);
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
    const editor = getPersonaSeed('editor');

    assert.equal(editor.roleSlug, 'editor');
    assert.equal(editor.roleLevel, 30);
    assert.deepEqual(editor.permissionKeys, [
      'content.read',
      'content.readHistory',
      'content.create',
      'content.updateMetadata',
      'content.updatePayload',
      'content.changeStatus',
      'content.delete',
    ]);
  });

  it('includes the global instance registry administrator persona', () => {
    const registryAdmin = getPersonaSeed('instance_registry_admin');

    assert.equal(registryAdmin.roleSlug, 'instance_registry_admin');
    assert.ok(registryAdmin.permissionKeys.includes('instance.registry.manage'));
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
  });

  it('throws for unknown persona keys', () => {
    assert.throws(() => getPersonaSeed('unknown' as never), /Unknown persona key: unknown/);
  });
});
