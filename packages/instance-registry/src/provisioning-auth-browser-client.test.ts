import { describe, expect, it } from 'vitest';

import {
  readPluginOidcClientRequirements,
  readPluginOidcClientAlignment,
} from './provisioning-auth-plugin-clients.js';
import type { PluginOidcClientRequirement } from './provisioning-auth-types.js';

const browser = {
  contractVersion: '2.0',
  pluginId: 'ssf',
  clientId: 'ssf-frontend',
  audience: 'ssf-frontend',
  enabled: false,
  redirectUris: ['https://dialog.example.org/login/*'],
  webOrigins: ['https://dialog.example.org'],
} as const;
const read = (requirement: unknown) =>
  readPluginOidcClientRequirements({
    authClientId: 'studio',
    tenantAdminClient: { clientId: 'studio-admin' },
    pluginOidcClients: [requirement as PluginOidcClientRequirement],
  });

describe('plugin browser OIDC contract', () => {
  it('accepts the versioned public browser baseline alongside the resource client contract', () => {
    expect(read(browser)).toEqual([browser]);
    expect(
      read({
        contractVersion: '1.0',
        pluginId: 'ssf',
        clientId: 'ssf',
        audience: 'ssf',
        enabled: false,
      })
    ).toHaveLength(1);
  });
  it.each([
    { clientId: 'studio' },
    { clientId: 'studio-admin' },
    { audience: 'other' },
    { enabled: true },
    { webOrigins: ['*'] },
    { webOrigins: ['https://*.example.org'] },
    { webOrigins: ['http://dialog.example.org'] },
    { redirectUris: ['https://evil.example.org/login/*'] },
    { redirectUris: ['https://dialog.example.org/*'] },
    { redirectUris: ['https://dialog.example.org/admin'] },
    { redirectUris: ['https://user:password@dialog.example.org/login/callback'] },
    { redirectUris: [] },
    { webOrigins: [] },
    { clientSecret: 'forbidden' },
  ])('rejects an unsafe browser contract: %j', (patch) => {
    expect(() => read({ ...browser, ...patch })).toThrow('plugin_oidc_client_requirement_invalid');
  });
  it('requires public code flow, PKCE and bounded tokens during read-back', () => {
    const clientRepresentation = {
      clientId: browser.clientId,
      enabled: false,
      protocol: 'openid-connect',
      publicClient: true,
      rootUrl: '',
      redirectUris: browser.redirectUris,
      webOrigins: browser.webOrigins,
      standardFlowEnabled: true,
      implicitFlowEnabled: false,
      directAccessGrantsEnabled: false,
      serviceAccountsEnabled: false,
      attributes: { 'pkce.code.challenge.method': 'S256', 'access.token.lifespan': '900' },
    };
    const protocolMappers = [
      {
        name: 'studio-ssf-audience',
        protocol: 'openid-connect',
        protocolMapper: 'oidc-audience-mapper',
        config: {
          'included.client.audience': 'ssf-frontend',
          'id.token.claim': 'false',
          'access.token.claim': 'true',
          'lightweight.claim': 'false',
          'introspection.token.claim': 'true',
        },
      },
    ];
    const aligned = (patch: object) =>
      readPluginOidcClientAlignment(browser as unknown as PluginOidcClientRequirement, {
        clientRepresentation: { ...clientRepresentation, ...patch },
        protocolMappers,
      }).aligned;
    expect(aligned({})).toBe(true);
    expect(aligned({ enabled: true })).toBe(true); // lifecycle owns activation
    for (const patch of [
      { publicClient: false },
      { standardFlowEnabled: false },
      { implicitFlowEnabled: true },
      { directAccessGrantsEnabled: true },
      { serviceAccountsEnabled: true },
      { attributes: {} },
      { redirectUris: ['https://other.example.org/login/*'] },
      { webOrigins: ['*'] },
    ])
      expect(aligned(patch)).toBe(false);
  });
});

it('provisions a disabled browser client, reads back security settings, and never writes Studio clients', async () => {
  const { vi } = await import('vitest');
  const { reconcilePluginOidcClients } = await import('./provisioning-auth-state.js');
  let representation: Record<string, unknown> | null = null;
  let mappers: object[] = [];
  const client = {
    ensureOidcClient: vi.fn(async (input) => {
      representation = {
        ...input,
        protocol: 'openid-connect',
        attributes: {
          'pkce.code.challenge.method': input.pkceCodeChallengeMethod,
          'access.token.lifespan': String(input.accessTokenLifespan),
        },
      };
    }),
    ensureAudienceProtocolMapper: vi.fn(async (input) => {
      mappers = [
        {
          name: input.name,
          protocol: 'openid-connect',
          protocolMapper: 'oidc-audience-mapper',
          config: {
            'included.client.audience': input.audience,
            'id.token.claim': 'false',
            'access.token.claim': 'true',
            'lightweight.claim': 'false',
            'introspection.token.claim': 'true',
          },
        },
      ];
    }),
    getOidcClientByClientId: vi.fn(async () => representation),
    listClientProtocolMappers: vi.fn(async () => mappers),
  };
  const input = { authClientId: 'studio', pluginOidcClients: [browser] };
  await reconcilePluginOidcClients(client, input);
  expect(client.ensureOidcClient).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      clientId: 'ssf-frontend',
      enabled: false,
      publicClient: true,
      standardFlowEnabled: true,
      pkceCodeChallengeMethod: 'S256',
      accessTokenLifespan: 900,
      uriPolicy: 'replace',
    })
  );
  representation = { ...representation, enabled: true };
  client.ensureOidcClient.mockClear();
  await reconcilePluginOidcClients(client, input);
  expect(client.ensureOidcClient).toHaveBeenCalledWith(
    expect.objectContaining({ clientId: 'ssf-frontend', enabled: true })
  );
  client.getOidcClientByClientId.mockImplementation(async () => ({
    ...representation,
    publicClient: false,
  }));
  await expect(reconcilePluginOidcClients(client, input)).rejects.toThrow(
    'plugin_oidc_client_readback_failed:ssf:ssf-frontend'
  );
});
