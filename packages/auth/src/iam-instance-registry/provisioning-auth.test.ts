import { beforeEach, describe, expect, it, vi } from 'vitest';

const state: {
  ensureRealm: ReturnType<typeof vi.fn>;
  ensureOidcClient: ReturnType<typeof vi.fn>;
  configCalls: string[];
  clientConfigs: Array<{ realm: string }>;
} = {
  ensureRealm: vi.fn(async () => {}),
  ensureOidcClient: vi.fn(async () => {}),
  configCalls: [],
  clientConfigs: [],
};

vi.mock('../keycloak-admin-client.js', () => ({
  KeycloakAdminClient: vi.fn().mockImplementation(function (this: object, config: { realm: string }) {
    state.clientConfigs.push(config);
    return {
      ensureRealm: state.ensureRealm,
      ensureOidcClient: state.ensureOidcClient,
    };
  }),
  getKeycloakAdminClientConfigFromEnv: vi.fn((realm: string) => {
    state.configCalls.push(realm);
    return { realm };
  }),
}));

import { provisionInstanceAuthArtifacts } from './provisioning-auth.js';

describe('provisionInstanceAuthArtifacts', () => {
  beforeEach(() => {
    state.ensureRealm.mockClear();
    state.ensureOidcClient.mockClear();
    state.configCalls = [];
    state.clientConfigs = [];
    delete process.env.SVA_PUBLIC_BASE_URL;
  });

  it('provisions a tenant realm with https defaults', async () => {
    await provisionInstanceAuthArtifacts({
      instanceId: 'bb-guben',
      primaryHostname: 'bb-guben.studio.smart-village.app',
      authRealm: 'bb-guben',
      authClientId: 'sva-studio',
    });

    expect(state.configCalls).toEqual(['bb-guben']);
    expect(state.clientConfigs).toEqual([{ realm: 'bb-guben' }]);
    expect(state.ensureRealm).toHaveBeenCalledWith({ displayName: 'bb-guben' });
    expect(state.ensureOidcClient).toHaveBeenCalledWith({
      clientId: 'sva-studio',
      redirectUris: ['https://bb-guben.studio.smart-village.app/auth/callback'],
      postLogoutRedirectUris: ['https://bb-guben.studio.smart-village.app/'],
      webOrigins: ['https://bb-guben.studio.smart-village.app'],
      rootUrl: 'https://bb-guben.studio.smart-village.app',
    });
  });

  it('derives the tenant origin protocol from the public base url and tolerates invalid values', async () => {
    process.env.SVA_PUBLIC_BASE_URL = 'http://localhost:3000';

    await provisionInstanceAuthArtifacts({
      instanceId: 'de-musterhausen',
      primaryHostname: 'de-musterhausen.localhost',
      authRealm: 'de-musterhausen',
      authClientId: 'sva-studio',
    });

    expect(state.ensureOidcClient).toHaveBeenCalledWith(
      expect.objectContaining({
        redirectUris: ['http://de-musterhausen.localhost/auth/callback'],
        postLogoutRedirectUris: ['http://de-musterhausen.localhost/'],
        rootUrl: 'http://de-musterhausen.localhost',
      })
    );

    process.env.SVA_PUBLIC_BASE_URL = 'not a url';

    await provisionInstanceAuthArtifacts({
      instanceId: 'bb-guben',
      primaryHostname: 'bb-guben.studio.smart-village.app',
      authRealm: 'bb-guben',
      authClientId: 'sva-studio',
    });

    expect(state.ensureOidcClient).toHaveBeenLastCalledWith(
      expect.objectContaining({
        redirectUris: ['https://bb-guben.studio.smart-village.app/auth/callback'],
        rootUrl: 'https://bb-guben.studio.smart-village.app',
      })
    );
  });
});
