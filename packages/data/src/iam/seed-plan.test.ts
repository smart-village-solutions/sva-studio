import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { getPersonaSeed, iamSeedPlan } from './seed-plan';

describe('iam seed plan', () => {
  it('contains exactly seven personas', () => {
    assert.equal(iamSeedPlan.personas.length, 7);
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
    assert.deepEqual(editor.permissionKeys, ['content.read', 'content.create', 'content.update']);
  });
});
