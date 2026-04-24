import { describe, expect, it } from 'vitest';

import {
  buildKeycloakStatus,
  buildMissingRealmStatus,
  buildPreflightChecks,
  toOverallPreflightStatus,
} from './provisioning-auth-evaluation.js';
import { buildExpectedClientConfig } from './provisioning-auth-utils.js';

describe('provisioning-auth-evaluation', () => {
  it('builds missing realm status for tenant and global secret sources', () => {
    const tenantSecretStatus = buildMissingRealmStatus(true, 'tenant-secret');
    const globalSecretStatus = buildMissingRealmStatus(false, undefined);

    expect(tenantSecretStatus.realmExists).toBe(false);
    expect(tenantSecretStatus.clientSecretConfigured).toBe(true);
    expect(tenantSecretStatus.tenantClientSecretReadable).toBe(true);
    expect(tenantSecretStatus.runtimeSecretSource).toBe('tenant');

    expect(globalSecretStatus.clientSecretConfigured).toBe(false);
    expect(globalSecretStatus.tenantClientSecretReadable).toBe(false);
    expect(globalSecretStatus.runtimeSecretSource).toBe('global');
  });

  it('returns blocked preflight checks when technical access fails', () => {
    const checks = buildPreflightChecks({
      realmMode: 'existing',
      authClientSecretConfigured: true,
      authClientSecret: 'secret',
      accessError: 'forbidden',
    });

    expect(checks).toHaveLength(2);
    expect(checks[1]).toMatchObject({
      checkKey: 'keycloak_admin_access',
      status: 'blocked',
    });
    expect(toOverallPreflightStatus(checks)).toBe('blocked');
  });

  it('classifies realm mode and tenant secret checks for new and existing realms', () => {
    const newRealmChecks = buildPreflightChecks({
      realmMode: 'new',
      authClientSecretConfigured: false,
      state: undefined,
      tenantAdminClient: {
        clientId: 'sva-studio-admin',
        secretConfigured: false,
      },
      tenantAdminBootstrap: { username: 'demo-admin' },
    });

    const existingRealmChecks = buildPreflightChecks({
      realmMode: 'existing',
      authClientSecretConfigured: false,
      state: {
        realm: { realm: 'demo' },
      } as never,
      tenantAdminBootstrap: undefined,
    });

    expect(newRealmChecks.find((check) => check.checkKey === 'realm_mode')?.status).toBe('ready');
    expect(newRealmChecks.find((check) => check.checkKey === 'tenant_secret')?.status).toBe('warning');
    expect(newRealmChecks.find((check) => check.checkKey === 'tenant_admin_profile')?.status).toBe('ready');
    expect(newRealmChecks.find((check) => check.checkKey === 'tenant_admin_client')?.status).toBe('ready');
    expect(toOverallPreflightStatus(newRealmChecks)).toBe('warning');

    expect(existingRealmChecks.find((check) => check.checkKey === 'realm_mode')?.status).toBe('ready');
    expect(existingRealmChecks.find((check) => check.checkKey === 'tenant_secret')?.status).toBe('blocked');
    expect(existingRealmChecks.find((check) => check.checkKey === 'tenant_admin_profile')?.status).toBe('blocked');
    expect(toOverallPreflightStatus(existingRealmChecks)).toBe('blocked');
  });

  it('builds keycloak status with mapper, uri and tenant admin checks', () => {
    const expectedClient = buildExpectedClientConfig('demo.example.org');

    const status = buildKeycloakStatus({
      authClientSecretConfigured: true,
      authClientSecret: 'tenant-secret',
      instanceId: 'demo',
      authRealm: 'demo',
      authClientId: 'sva-studio',
      realmMode: 'existing',
      state: {
        client: {} as never,
        expectedClient,
        realm: { realm: 'demo' },
        clientRepresentation: {
          id: 'client-1',
          redirectUris: [...expectedClient.redirectUris],
          webOrigins: [...expectedClient.webOrigins],
          attributes: {
            'post.logout.redirect.uris': expectedClient.postLogoutRedirectUris.join('##'),
          },
        } as never,
        protocolMappers: [{ name: 'instanceId' }],
        tenantAdminStatus: {
          tenantAdminExists: true,
          tenantAdminHasSystemAdmin: true,
          tenantAdminHasInstanceRegistryAdmin: true,
          tenantAdminInstanceIdMatches: true,
        },
        keycloakClientSecret: 'tenant-secret',
        systemAdminRole: { id: 'role-1', externalName: 'system_admin' } as never,
        instanceRegistryAdminRole: { id: 'role-2', externalName: 'instance_registry_admin' } as never,
      },
    });

    expect(status.realmExists).toBe(true);
    expect(status.clientExists).toBe(true);
    expect(status.instanceIdMapperExists).toBe(true);
    expect(status.redirectUrisMatch).toBe(true);
    expect(status.logoutUrisMatch).toBe(true);
    expect(status.webOriginsMatch).toBe(true);
    expect(status.clientSecretAligned).toBe(true);
    expect(status.runtimeSecretSource).toBe('tenant');
  });
});
