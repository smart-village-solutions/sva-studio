import { describe, expect, it, vi } from 'vitest';

import {
  createInstanceKeycloakPlanReader,
  createInstanceKeycloakPreflightReader,
  createInstanceKeycloakStatusReader,
} from './provisioning-auth.js';
import type { KeycloakProvisioningInput, KeycloakReadState } from './provisioning-auth-types.js';

const input: KeycloakProvisioningInput = {
  instanceId: 'demo',
  primaryHostname: 'demo.example.org',
  realmMode: 'existing',
  authRealm: 'demo',
  authClientId: 'sva-studio',
  authClientSecretConfigured: true,
  authClientSecret: 'secret',
  tenantAdminClient: {
    clientId: 'tenant-admin',
    secretConfigured: true,
  },
  tenantAdminClientSecret: 'tenant-secret',
  tenantAdminBootstrap: {
    username: 'tenant-admin',
  },
};

const readState = vi.fn(async (): Promise<KeycloakReadState> => ({
  client: {},
  expectedClient: {
    redirectUris: ['https://demo.example.org/*'],
    postLogoutRedirectUris: ['https://demo.example.org/*'],
    webOrigins: ['https://demo.example.org'],
    rootUrl: 'https://demo.example.org',
  },
  expectedTenantAdminClient: {
    redirectUris: ['https://demo.example.org/*'],
    postLogoutRedirectUris: ['https://demo.example.org/*'],
    webOrigins: ['https://demo.example.org'],
    rootUrl: 'https://demo.example.org',
    standardFlowEnabled: true,
    directAccessGrantsEnabled: true,
    serviceAccountsEnabled: true,
  },
  realm: { realm: 'demo', enabled: true },
  clientRepresentation: {
    id: 'client-1',
    clientId: 'sva-studio',
    redirectUris: ['https://demo.example.org/*'],
    attributes: {
      'post.logout.redirect.uris': 'https://demo.example.org/*',
    },
    webOrigins: ['https://demo.example.org'],
    rootUrl: 'https://demo.example.org',
  },
  tenantAdminClientRepresentation: {
    id: 'tenant-admin-client-1',
    clientId: 'tenant-admin',
    redirectUris: ['https://demo.example.org/*'],
    attributes: {
      'post.logout.redirect.uris': 'https://demo.example.org/*',
    },
    webOrigins: ['https://demo.example.org'],
    rootUrl: 'https://demo.example.org',
    standardFlowEnabled: true,
    directAccessGrantsEnabled: true,
    serviceAccountsEnabled: true,
  },
  protocolMappers: [
    {
      name: 'instanceId',
      protocol: 'openid-connect',
      protocolMapper: 'oidc-usermodel-attribute-mapper',
      config: {
        'user.attribute': 'instanceId',
        'claim.name': 'instanceId',
      },
    },
  ],
  tenantAdminStatus: {
    tenantAdminExists: true,
    tenantAdminHasSystemAdmin: true,
    tenantAdminHasInstanceRegistryAdmin: true,
    tenantAdminInstanceIdMatches: true,
  },
  keycloakClientSecret: 'secret',
  tenantAdminClientSecret: 'tenant-secret',
  systemAdminRole: { name: 'system_admin' },
  instanceRegistryAdminRole: { name: 'instance_registry_admin' },
}));

describe('provisioning-auth readers', () => {
  it('builds preflight and status from an injected Keycloak state reader', async () => {
    const preflight = createInstanceKeycloakPreflightReader(readState);
    const status = createInstanceKeycloakStatusReader(readState);

    await expect(preflight(input)).resolves.toEqual(expect.objectContaining({ overallStatus: 'ready' }));
    await expect(status(input)).resolves.toEqual(
      expect.objectContaining({
        realmExists: true,
        clientExists: true,
        clientSecretAligned: true,
      })
    );
  });

  it('maps state reader failures into blocked preflight and fallback plans', async () => {
    const failingReadState = vi.fn(async (): Promise<KeycloakReadState> => {
      throw new Error('keycloak unavailable');
    });
    const preflight = createInstanceKeycloakPreflightReader(failingReadState, () => 'mapped access error');
    const plan = createInstanceKeycloakPlanReader(failingReadState, preflight);

    await expect(preflight(input)).resolves.toEqual(
      expect.objectContaining({
        overallStatus: 'blocked',
        checks: expect.arrayContaining([
          expect.objectContaining({
            checkKey: 'keycloak_admin_access',
            details: expect.objectContaining({ error: 'mapped access error' }),
          }),
        ]),
      })
    );
    await expect(plan(input)).resolves.toEqual(expect.objectContaining({ overallStatus: 'blocked' }));
  });
});
