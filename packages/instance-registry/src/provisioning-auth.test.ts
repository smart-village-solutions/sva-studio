import { describe, expect, it, vi } from 'vitest';

import {
  createInstanceKeycloakPlanReader,
  createInstanceKeycloakPreflightReader,
  createInstanceKeycloakStatusReader,
} from './provisioning-auth.js';
import type { KeycloakProvisioningInput, KeycloakReadState } from './provisioning-auth-types.js';

const ssfClientRequirement = {
  contractVersion: '1.0',
  pluginId: 'ssf',
  clientId: 'ssf',
  audience: 'ssf',
  enabled: false,
} as const;

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
  pluginOidcClients: [ssfClientRequirement],
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
  pluginOidcClients: [
    {
      requirement: ssfClientRequirement,
      clientRepresentation: {
        id: 'ssf-client-1',
        clientId: 'ssf',
        enabled: false,
        rootUrl: '',
        redirectUris: [],
        webOrigins: [],
        standardFlowEnabled: false,
        implicitFlowEnabled: false,
        directAccessGrantsEnabled: false,
        serviceAccountsEnabled: false,
        attributes: { 'post.logout.redirect.uris': '' },
      },
      protocolMappers: [
        {
          name: 'studio-ssf-audience',
          protocol: 'openid-connect',
          protocolMapper: 'oidc-audience-mapper',
          config: {
            'included.client.audience': 'ssf',
            'included.custom.audience': '',
            'id.token.claim': 'false',
            'access.token.claim': 'true',
            'lightweight.claim': 'false',
            'introspection.token.claim': 'true',
          },
        },
      ],
    },
  ],
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
  },
  keycloakClientSecret: 'secret',
  tenantAdminClientSecret: 'tenant-secret',
  systemAdminRole: { name: 'system_admin' },
}));

describe('provisioning-auth readers', () => {
  it('builds preflight and status from an injected Keycloak state reader', async () => {
    const preflight = createInstanceKeycloakPreflightReader(readState);
    const status = createInstanceKeycloakStatusReader(readState);

    await expect(preflight(input)).resolves.toEqual(
      expect.objectContaining({ overallStatus: 'ready' })
    );
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
    const preflight = createInstanceKeycloakPreflightReader(
      failingReadState,
      () => 'mapped access error'
    );
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
    await expect(plan(input)).resolves.toEqual(
      expect.objectContaining({ overallStatus: 'blocked' })
    );
  });

  it('marks tenant admin client drift as an update in the plan preview', async () => {
    const driftedReadState = vi.fn(async (): Promise<KeycloakReadState> => ({
      ...(await readState(input)),
      tenantAdminClientRepresentation: {
        id: 'tenant-admin-client-1',
        clientId: 'tenant-admin',
        redirectUris: ['https://legacy.example.org/callback'],
        attributes: {
          'post.logout.redirect.uris': 'https://legacy.example.org/logout',
        },
        webOrigins: ['https://legacy.example.org'],
        rootUrl: 'https://legacy.example.org',
      },
    }));
    const preflight = createInstanceKeycloakPreflightReader(driftedReadState);
    const plan = createInstanceKeycloakPlanReader(driftedReadState, preflight);

    await expect(plan(input)).resolves.toEqual(
      expect.objectContaining({
        steps: expect.arrayContaining([
          expect.objectContaining({
            stepKey: 'tenant_admin_client',
            action: 'update',
            details: expect.objectContaining({
              clientExists: true,
              rootUrlMatch: false,
              redirectUrisMatch: false,
              logoutUrisMatch: false,
              webOriginsMatch: false,
            }),
          }),
        ]),
      })
    );
  });

  it('marks tenant admin flow flag drift as an update in the plan preview', async () => {
    const driftedReadState = vi.fn(async (): Promise<KeycloakReadState> => ({
      ...(await readState(input)),
      tenantAdminClientRepresentation: {
        ...(await readState(input)).tenantAdminClientRepresentation,
        directAccessGrantsEnabled: false,
        serviceAccountsEnabled: false,
        standardFlowEnabled: false,
      },
    }));
    const preflight = createInstanceKeycloakPreflightReader(driftedReadState);
    const plan = createInstanceKeycloakPlanReader(driftedReadState, preflight);

    await expect(plan(input)).resolves.toEqual(
      expect.objectContaining({
        steps: expect.arrayContaining([
          expect.objectContaining({
            stepKey: 'tenant_admin_client',
            action: 'update',
            details: expect.objectContaining({
              directAccessGrantsEnabledMatch: false,
              serviceAccountsEnabledMatch: false,
              standardFlowEnabledMatch: false,
            }),
          }),
        ]),
      })
    );
  });

  it('reports SSF client drift and verifies the exact disabled state after reconciliation', async () => {
    const currentState = await readState(input);
    const ssfClientState = currentState.pluginOidcClients[0];
    if (!ssfClientState) throw new Error('missing_ssf_client_state');
    const driftedReadState = vi.fn(async (): Promise<KeycloakReadState> => ({
      ...currentState,
      pluginOidcClients: [
        {
          ...ssfClientState,
          clientRepresentation: {
            ...ssfClientState.clientRepresentation,
            enabled: true,
            redirectUris: ['https://provider.example/callback'],
          },
        },
      ],
    }));
    const driftedPlan = createInstanceKeycloakPlanReader(
      driftedReadState,
      createInstanceKeycloakPreflightReader(driftedReadState)
    );
    const alignedPlan = createInstanceKeycloakPlanReader(
      readState,
      createInstanceKeycloakPreflightReader(readState)
    );

    await expect(driftedPlan(input)).resolves.toEqual(
      expect.objectContaining({
        steps: expect.arrayContaining([
          expect.objectContaining({ stepKey: 'plugin_client_ssf', action: 'update' }),
        ]),
      })
    );
    await expect(alignedPlan(input)).resolves.toEqual(
      expect.objectContaining({
        steps: expect.arrayContaining([
          expect.objectContaining({ stepKey: 'plugin_client_ssf', action: 'verify' }),
        ]),
      })
    );
  });
});
