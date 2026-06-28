import { describe, expect, it } from 'vitest';

import { getPersonaSeed, iamSeedPlan } from './seed-plan.js';
import { rootOnlySeedPermissionKeys, tenantBootstrapPermissionKeys } from './seed-plan.permissions.js';

describe('iam seed plan', () => {
  it('keeps persona identifiers stable and unique', () => {
    expect(iamSeedPlan.personas).toHaveLength(1);
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
    expect(iamSeedPlan.permissions.find((permission) => permission.key === 'media.read')?.resourceType).toBe('media');
    expect(iamSeedPlan.permissions.find((permission) => permission.key === 'app.read')?.resourceType).toBe('app');
    expect(iamSeedPlan.permissions.find((permission) => permission.key === 'experimental.read')?.resourceType).toBe(
      'experimental'
    );
    expect(iamSeedPlan.permissions.find((permission) => permission.key === 'cockpit.read')?.resourceType).toBe(
      'cockpit'
    );
  });

  it('exposes seeded personas by stable keys and rejects unknown keys', () => {
    expect(getPersonaSeed('system_admin')).toMatchObject({
      roleSlug: 'system_admin',
      roleLevel: 100,
      permissionKeys: expect.arrayContaining([
        'experimental.read',
        'app.read',
        'cockpit.read',
        'content.create',
        'content.updateMetadata',
        'content.updatePayload',
        'content.changeStatus',
        'content.delete',
        'media.create',
        'media.reference.manage',
      ]),
    });
    expect(() => getPersonaSeed('instance_registry_admin' as never)).toThrow(
      'Unknown persona key: instance_registry_admin'
    );
    expect(() => getPersonaSeed('unknown' as never)).toThrow('Unknown persona key: unknown');
  });

  it('keeps instance.registry.manage out of tenant bootstrap personas', () => {
    expect(rootOnlySeedPermissionKeys).toEqual(['instance.registry.manage']);
    expect(tenantBootstrapPermissionKeys).not.toContain('instance.registry.manage');
    expect(getPersonaSeed('system_admin').permissionKeys).toEqual(tenantBootstrapPermissionKeys);
    expect(iamSeedPlan.personas.every((persona) => !persona.permissionKeys.includes('instance.registry.manage'))).toBe(
      true
    );
  });
});
