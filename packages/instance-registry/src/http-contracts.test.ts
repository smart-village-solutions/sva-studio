import { describe, expect, it } from 'vitest';

import {
  assignModuleSchema,
  bootstrapAdminStructureSchema,
  createInstanceSchema,
  resolveCreateInstanceDefaults,
  revokeModuleSchema,
  reconcileKeycloakSchema,
  readDetailInstanceId,
  readKeycloakRunId,
  seedIamBaselineSchema,
  updateInstanceSchema,
} from './http-contracts.js';

const tenantAdminBootstrap = {
  username: 'demo-admin',
  email: 'demo-admin@example.invalid',
  firstName: 'Demo',
  lastName: 'Admin',
};

describe('http-contracts', () => {
  it('extracts detail instance ids from nested routes', () => {
    expect(
      readDetailInstanceId(
        new Request('https://studio.example.org/api/v1/iam/instances/demo/activate')
      )
    ).toBe('demo');
    expect(
      readDetailInstanceId(new Request('https://studio.example.org/api/v1/iam/users'))
    ).toBeUndefined();
  });

  it.each(['studio', 'auth', 'STUDIO', 'Auth'])(
    'rejects reserved tenant hostname %s',
    (instanceId) => {
      expect(
        createInstanceSchema.safeParse({
          instanceId,
          displayName: 'Demo',
          parentDomain: 'dialog.kassel.de',
          realmMode: 'existing',
          authRealm: 'sva-studio',
          authClientId: 'tenant-client',
        }).success
      ).toBe(false);
    }
  );

  it('rejects invalid authIssuerUrl', () => {
    const result = createInstanceSchema.safeParse({
      instanceId: 'de-test',
      displayName: 'Demo',
      parentDomain: 'studio.smart-village.app',
      realmMode: 'new',
      authRealm: 'de-test',
      authClientId: 'sva-studio-login',
      tenantAdminBootstrap,
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
      tenantAdminBootstrap,
      authRealm:
        'Bitte ein Tenant-Client-Secret angeben. Bitte ein Tenant-Admin-Client-Secret angeben.',
      authClientId: 'sva-studio',
    });

    expect(result.success).toBe(false);
  });

  it('rejects an invalid instance id when it would become the new realm name', () => {
    expect(
      createInstanceSchema.safeParse({
        instanceId: 'tenant/foo',
        displayName: 'Demo',
        parentDomain: 'studio.smart-village.app',
        realmMode: 'new',
      }).success
    ).toBe(false);
  });

  it.each(['Labor', 'tenant/foo', 'xn--bcher-kva', 'bad_label', 'tenant-a ', ' tenant-a'])(
    'rejects the invalid canonical instance id %s before realm-mode handling',
    (instanceId) => {
      expect(
        createInstanceSchema.safeParse({
          instanceId,
          displayName: 'Demo',
          parentDomain: 'studio.smart-village.app',
          realmMode: 'existing',
          authRealm: 'demo',
          authClientId: 'sva-studio-login',
        }).success
      ).toBe(false);
    }
  );

  it('allows create requests without a tenant admin client contract', () => {
    const result = createInstanceSchema.safeParse({
      instanceId: 'de-test',
      displayName: 'Demo',
      parentDomain: 'studio.smart-village.app',
      realmMode: 'new',
      authRealm: 'de-test',
      authClientId: 'sva-studio-login',
      tenantAdminBootstrap,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(resolveCreateInstanceDefaults(result.data)).toMatchObject({
        authRealm: 'de-test',
        authClientId: 'sva-studio-login',
        tenantAdminClient: { clientId: 'sva-studio-realm-admin' },
      });
    }
  });

  it('derives new-realm technical defaults when clients omit them', () => {
    const result = createInstanceSchema.safeParse({
      instanceId: 'de-test',
      displayName: 'Demo',
      parentDomain: 'studio.smart-village.app',
      realmMode: 'new',
      tenantAdminBootstrap,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(resolveCreateInstanceDefaults(result.data)).toMatchObject({
        authRealm: 'de-test',
        authClientId: 'sva-studio-login',
        tenantAdminClient: { clientId: 'sva-studio-realm-admin' },
      });
    }
  });

  it('rejects conflicting new-realm technical defaults', () => {
    expect(
      createInstanceSchema.safeParse({
        instanceId: 'de-test',
        displayName: 'Demo',
        parentDomain: 'studio.smart-village.app',
        realmMode: 'new',
        authClientId: 'custom-login',
      }).success
    ).toBe(false);
  });

  it('keeps the instance id in the update URL instead of requiring it in the body', () => {
    expect(
      updateInstanceSchema.safeParse({
        displayName: 'Demo',
        parentDomain: 'studio.smart-village.app',
        realmMode: 'existing',
        authRealm: 'de-test',
        authClientId: 'sva-studio-login',
      }).success
    ).toBe(true);
  });

  it('accepts a persisted username-only tenant admin profile during unrelated updates', () => {
    expect(
      updateInstanceSchema.safeParse({
        displayName: 'Legacy tenant',
        parentDomain: 'studio.smart-village.app',
        realmMode: 'existing',
        authRealm: 'de-test',
        authClientId: 'sva-studio-login',
        tenantAdminBootstrap: { username: 'tenant-admin' },
      }).success
    ).toBe(true);
    expect(
      createInstanceSchema.safeParse({
        instanceId: 'de-test',
        displayName: 'New tenant',
        parentDomain: 'studio.smart-village.app',
        realmMode: 'new',
        tenantAdminBootstrap: { username: 'tenant-admin' },
      }).success
    ).toBe(false);
  });

  it('rejects reserved instance ids for audit routes', () => {
    const result = createInstanceSchema.safeParse({
      instanceId: 'audit',
      displayName: 'Demo',
      parentDomain: 'studio.smart-village.app',
      realmMode: 'new',
      authRealm: 'de-test',
      authClientId: 'sva-studio-login',
    });

    expect(result.success).toBe(false);
  });

  it('ignores legacy waste-management settings in create requests', () => {
    const result = createInstanceSchema.safeParse({
      instanceId: 'de-test',
      displayName: 'Demo',
      parentDomain: 'studio.smart-village.app',
      realmMode: 'new',
      authRealm: 'de-test',
      authClientId: 'sva-studio-login',
      tenantAdminBootstrap,
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
      authClientId: 'sva-studio-login',
      tenantAdminBootstrap,
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

  it('rejects secret rotation on the non-critical reconcile route', () => {
    expect(reconcileKeycloakSchema.safeParse({ rotateClientSecret: true }).success).toBe(false);
    expect(
      reconcileKeycloakSchema.safeParse({
        planFingerprint: '0'.repeat(64),
        tenantAdminTemporaryPassword: 'temporary-password',
      }).success
    ).toBe(true);
  });

  it('accepts empty reseed payloads', () => {
    const result = seedIamBaselineSchema.safeParse({});

    expect(result.success).toBe(true);
  });

  it('accepts bootstrap payloads with optional module ids', () => {
    expect(bootstrapAdminStructureSchema.safeParse({}).success).toBe(true);
    expect(bootstrapAdminStructureSchema.safeParse({ moduleIds: ['news', 'events'] }).success).toBe(
      true
    );
    expect(bootstrapAdminStructureSchema.safeParse({ moduleIds: [' ', 'news'] }).success).toBe(
      false
    );
  });
});
