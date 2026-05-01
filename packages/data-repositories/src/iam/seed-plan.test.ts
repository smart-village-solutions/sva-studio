import { describe, expect, it } from 'vitest';

import { getPersonaSeed, iamSeedPlan } from './seed-plan.js';

describe('iam seed plan', () => {
  it('keeps persona identifiers stable and unique', () => {
    expect(iamSeedPlan.personas).toHaveLength(8);
    expect(new Set(iamSeedPlan.personas.map((persona) => persona.roleSlug)).size).toBe(iamSeedPlan.personas.length);
    expect(new Set(iamSeedPlan.personas.map((persona) => persona.keycloakSubject)).size).toBe(iamSeedPlan.personas.length);
  });

  it('derives resource types from permission namespaces', () => {
    expect(
      iamSeedPlan.permissions.find((permission) => permission.key === 'instance.registry.manage')?.resourceType
    ).toBe('instance');
    expect(iamSeedPlan.permissions.find((permission) => permission.key === 'content.publish')?.resourceType).toBe(
      'content'
    );
    expect(iamSeedPlan.permissions.find((permission) => permission.key === 'content.delete')?.effect).toBe('allow');
  });

  it('exposes seeded personas by stable keys and rejects unknown keys', () => {
    expect(getPersonaSeed('editor')).toMatchObject({
      roleSlug: 'editor',
      roleLevel: 30,
      permissionKeys: expect.arrayContaining([
        'content.create',
        'content.updateMetadata',
        'content.updatePayload',
        'content.changeStatus',
        'content.delete',
      ]),
    });
    expect(getPersonaSeed('instance_registry_admin').permissionKeys).toEqual(
      expect.arrayContaining(['instance.registry.manage', 'feature.toggle', 'integration.manage'])
    );
    expect(() => getPersonaSeed('unknown' as never)).toThrow('Unknown persona key: unknown');
  });
});
