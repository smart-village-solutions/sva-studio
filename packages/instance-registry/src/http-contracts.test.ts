import { describe, expect, it } from 'vitest';

import {
  assignModuleSchema,
  bootstrapAdminStructureSchema,
  createInstanceSchema,
  revokeModuleSchema,
  readDetailInstanceId,
  readKeycloakRunId,
  seedIamBaselineSchema,
} from './http-contracts.js';

describe('http-contracts', () => {
  it('extracts detail instance ids from nested routes', () => {
    expect(
      readDetailInstanceId(new Request('https://studio.example.org/api/v1/iam/instances/demo/activate'))
    ).toBe('demo');
    expect(readDetailInstanceId(new Request('https://studio.example.org/api/v1/iam/users'))).toBeUndefined();
  });

  it('rejects invalid authIssuerUrl', () => {
    const result = createInstanceSchema.safeParse({
      instanceId: 'de-test',
      displayName: 'Demo',
      parentDomain: 'studio.smart-village.app',
      realmMode: 'new',
      authRealm: 'de-test',
      authClientId: 'sva-studio',
      authIssuerUrl: 'not-a-url',
    });

    expect(result.success).toBe(false);
  });

  it('rejects authRealm values that are not realm identifiers', () => {
    const result = createInstanceSchema.safeParse({
      instanceId: 'de-test',
      displayName: 'Demo',
      parentDomain: 'studio.smart-village.app',
      realmMode: 'new',
      authRealm: 'Bitte ein Tenant-Client-Secret angeben. Bitte ein Tenant-Admin-Client-Secret angeben.',
      authClientId: 'sva-studio',
    });

    expect(result.success).toBe(false);
  });

  it('allows create requests without a tenant admin client contract', () => {
    const result = createInstanceSchema.safeParse({
      instanceId: 'de-test',
      displayName: 'Demo',
      parentDomain: 'studio.smart-village.app',
      realmMode: 'new',
      authRealm: 'de-test',
      authClientId: 'sva-studio',
    });

    expect(result.success).toBe(true);
  });

  it('ignores legacy waste-management settings in create requests', () => {
    const result = createInstanceSchema.safeParse({
      instanceId: 'de-test',
      displayName: 'Demo',
      parentDomain: 'studio.smart-village.app',
      realmMode: 'new',
      authRealm: 'de-test',
      authClientId: 'sva-studio',
      wasteManagementSettings: {
        provider: 'supabase',
        projectUrl: 'https://tenant-a.supabase.co',
        enabled: true,
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty('wasteManagementSettings');
    }
  });

  it('strips legacy waste-management payload fragments even when their nested values are invalid', () => {
    const result = createInstanceSchema.safeParse({
      instanceId: 'de-test',
      displayName: 'Demo',
      parentDomain: 'studio.smart-village.app',
      realmMode: 'new',
      authRealm: 'de-test',
      authClientId: 'sva-studio',
      wasteManagementSettings: {
        provider: 'supabase',
        projectUrl: 'not-a-url',
        enabled: true,
      },
    });

    expect(result.success).toBe(true);
  });

  it('extracts keycloak run ids from nested run routes', () => {
    const request = new Request(
      'https://studio.example.org/api/v1/iam/instances/de-test/keycloak/runs/run-42'
    );

    expect(readKeycloakRunId(request)).toBe('run-42');
  });

  it('returns undefined when keycloak run segment is missing', () => {
    const request = new Request('https://studio.example.org/api/v1/iam/instances/de-test/keycloak');

    expect(readKeycloakRunId(request)).toBeUndefined();
  });

  it('validates assign module payloads', () => {
    const result = assignModuleSchema.safeParse({ moduleId: 'news' });

    expect(result.success).toBe(true);
  });

  it('requires revoke confirmation', () => {
    const result = revokeModuleSchema.safeParse({ moduleId: 'news' });

    expect(result.success).toBe(false);
  });

  it('accepts empty reseed payloads', () => {
    const result = seedIamBaselineSchema.safeParse({});

    expect(result.success).toBe(true);
  });

  it('accepts bootstrap payloads with optional module ids', () => {
    expect(bootstrapAdminStructureSchema.safeParse({}).success).toBe(true);
    expect(bootstrapAdminStructureSchema.safeParse({ moduleIds: ['news', 'events'] }).success).toBe(true);
    expect(bootstrapAdminStructureSchema.safeParse({ moduleIds: [' ', 'news'] }).success).toBe(false);
  });
});
