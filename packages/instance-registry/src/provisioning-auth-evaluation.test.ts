import { describe, expect, it } from 'vitest';

import {
  buildKeycloakStatus,
  buildMissingRealmStatus,
  buildPlan,
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
    expect(existingRealmChecks.find((check) => check.checkKey === 'tenant_admin_profile')?.status).toBe('warning');
    expect(toOverallPreflightStatus(existingRealmChecks)).toBe('blocked');
  });

  it('keeps technical repairs available for an existing realm without admin bootstrap data', () => {
    const checks = buildPreflightChecks({
      realmMode: 'existing',
      authClientSecretConfigured: true,
      authClientSecret: 'secret',
      tenantAdminClient: {
        clientId: 'tenant-admin',
        secretConfigured: true,
      },
      tenantAdminClientSecret: 'tenant-admin-secret',
      state: {
        realm: { realm: 'imported' },
      } as never,
    });

    expect(checks.find((check) => check.checkKey === 'tenant_admin_profile')?.status).toBe('warning');
    expect(toOverallPreflightStatus(checks)).toBe('warning');
  });

  it('skips bootstrap-admin creation in plans for imported realms without a profile', () => {
    const plan = buildPlan({
      realmMode: 'existing',
      preflight: { overallStatus: 'warning', checkedAt: '2026-09-11T00:00:00Z', checks: [] },
    });

    expect(plan.steps.find((step) => step.stepKey === 'tenant_admin')).toMatchObject({
      action: 'skip',
    });
    expect(plan.driftSummary).not.toContain('Tenant-Admin wird erstellt');
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
        pluginOidcClients: [],
        protocolMappers: [],
        tenantAdminStatus: {
          tenantAdminExists: true,
          tenantAdminHasSystemAdmin: true,
        },
        keycloakClientSecret: 'tenant-secret',
        systemAdminRole: {
          id: 'role-1',
          externalName: 'system_admin',
          attributes: {
            managed_by: ['studio'],
            instance_id: ['demo'],
            role_key: ['system_admin'],
          },
        } as never,
      },
    });

    expect(status.realmExists).toBe(true);
    expect(status.clientExists).toBe(true);
    expect(status.redirectUrisMatch).toBe(true);
    expect(status.logoutUrisMatch).toBe(true);
    expect(status.webOriginsMatch).toBe(true);
    expect(status.pluginOidcClientsAligned).toBe(true);
    expect(status.systemAdminRoleExists).toBe(true);
    expect(status.clientSecretAligned).toBe(true);
    expect(status.runtimeSecretSource).toBe('tenant');
  });

  it('does not report a same-named role with foreign ownership as the protected role', () => {
    const expectedClient = buildExpectedClientConfig('demo.example.org');
    const status = buildKeycloakStatus({
      authClientSecretConfigured: true,
      instanceId: 'demo',
      authRealm: 'demo',
      authClientId: 'sva-studio',
      realmMode: 'existing',
      state: {
        expectedClient,
        clientRepresentation: null,
        pluginOidcClients: [],
        tenantAdminStatus: { tenantAdminExists: false, tenantAdminHasSystemAdmin: false },
        systemAdminRole: {
          externalName: 'system_admin',
          attributes: {
            managed_by: ['studio'],
            instance_id: ['tenant-other'],
            role_key: ['system_admin'],
          },
        },
      } as never,
    });

    expect(status.systemAdminRoleExists).toBe(false);
  });

  it('reports plugin OIDC client drift in the operational status', () => {
    const expectedClient = buildExpectedClientConfig('demo.example.org');
    const status = buildKeycloakStatus({
      authClientSecretConfigured: true,
      authClientSecret: 'tenant-secret',
      instanceId: 'demo',
      authRealm: 'demo',
      authClientId: 'sva-studio',
      realmMode: 'existing',
      state: {
        expectedClient,
        clientRepresentation: null,
        pluginOidcClients: [{
          requirement: {
            contractVersion: '1.0',
            pluginId: 'ssf',
            clientId: 'ssf',
            audience: 'ssf',
            enabled: false,
          },
          clientRepresentation: { clientId: 'ssf', enabled: true },
          protocolMappers: [],
        }],
      } as never,
    });

    expect(status.pluginOidcClientsAligned).toBe(false);
  });
});
