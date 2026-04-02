import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type MockInstance = {
  instanceId: string;
  primaryHostname: string;
  status: string;
  authRealm: string;
  authClientId: string;
  authIssuerUrl?: string;
};

const state: {
  instanceConfig: { instanceId?: string } | null;
  instanceById: MockInstance | null;
  instanceByHostname: MockInstance | null;
  loadInstanceByHostnameError: Error | null;
  authClientSecret: string | null;
  authStateSecret: string | null;
} = {
  instanceConfig: { instanceId: 'bb-guben' },
  instanceById: null,
  instanceByHostname: null,
  loadInstanceByHostnameError: null,
  authClientSecret: 'client-secret',
  authStateSecret: null,
};

vi.mock('@sva/data/server', () => ({
  loadInstanceById: vi.fn(async () => state.instanceById),
  loadInstanceByHostname: vi.fn(async () => {
    if (state.loadInstanceByHostnameError) {
      throw state.loadInstanceByHostnameError;
    }
    return state.instanceByHostname;
  }),
}));

vi.mock('@sva/sdk/server', () => ({
  getInstanceConfig: vi.fn(() => state.instanceConfig),
}));

vi.mock('./runtime-secrets.server.js', () => ({
  getAuthClientSecret: vi.fn(() => state.authClientSecret),
  getAuthStateSecret: vi.fn(() => state.authStateSecret),
}));

import {
  getAuthConfig,
  resolveAuthConfigForInstance,
  resolveAuthConfigForRequest,
} from './config.js';

const originalEnv = { ...process.env };

const createActiveInstance = (overrides: Partial<MockInstance> = {}): MockInstance => ({
  instanceId: 'bb-guben',
  primaryHostname: 'bb-guben.studio.smart-village.app',
  status: 'active',
  authRealm: 'bb-guben',
  authClientId: 'sva-studio',
  ...overrides,
});

describe('runtime auth config resolution', () => {
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      SVA_AUTH_ISSUER: 'https://issuer.example.com/realms/global',
      SVA_AUTH_CLIENT_ID: 'global-client',
      SVA_AUTH_CLIENT_SECRET: 'global-secret',
      SVA_AUTH_REDIRECT_URI: 'https://studio.smart-village.app/auth/callback',
      SVA_AUTH_POST_LOGOUT_REDIRECT_URI: 'https://studio.smart-village.app/',
    };
    delete process.env.KEYCLOAK_ADMIN_BASE_URL;
    state.instanceConfig = { instanceId: 'bb-guben' };
    state.instanceById = null;
    state.instanceByHostname = null;
    state.loadInstanceByHostnameError = null;
    state.authClientSecret = 'client-secret';
    state.authStateSecret = null;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('resolves instance auth config via realm-derived issuer and host origin', async () => {
    process.env.KEYCLOAK_ADMIN_BASE_URL = 'https://keycloak.example.com/';
    state.instanceById = createActiveInstance();

    await expect(resolveAuthConfigForInstance('bb-guben')).resolves.toEqual(
      expect.objectContaining({
        instanceId: 'bb-guben',
        authRealm: 'bb-guben',
        issuer: 'https://keycloak.example.com/realms/bb-guben',
        clientId: 'sva-studio',
        redirectUri: 'https://bb-guben.studio.smart-village.app/auth/callback',
        postLogoutRedirectUri: 'https://bb-guben.studio.smart-village.app/',
      })
    );
  });

  it('uses explicit issuer and request origin for tenant host requests', async () => {
    state.instanceByHostname = createActiveInstance({
      authIssuerUrl: 'https://sso.example.com/realms/bb-guben',
    });

    const request = new Request('https://BB-GUBEN.studio.smart-village.app/admin');

    await expect(resolveAuthConfigForRequest(request)).resolves.toEqual(
      expect.objectContaining({
        instanceId: 'bb-guben',
        authRealm: 'bb-guben',
        issuer: 'https://sso.example.com/realms/bb-guben',
        clientId: 'sva-studio',
        redirectUri: 'https://bb-guben.studio.smart-village.app/auth/callback',
        postLogoutRedirectUri: 'https://bb-guben.studio.smart-village.app/',
      })
    );
  });

  it('falls back to the global auth config when no instance config is active', async () => {
    state.instanceConfig = null;

    const request = new Request('https://studio.smart-village.app/admin');

    await expect(resolveAuthConfigForRequest(request)).resolves.toEqual(getAuthConfig());
  });

  it('falls back to the global auth config when hostname lookup fails', async () => {
    state.loadInstanceByHostnameError = new Error('db offline');

    const request = new Request('https://bb-guben.studio.smart-village.app/admin');

    await expect(resolveAuthConfigForRequest(request)).resolves.toEqual(getAuthConfig());
  });

  it('rejects inactive tenant hosts', async () => {
    state.instanceByHostname = createActiveInstance({ status: 'provisioning' });

    const request = new Request('https://bb-guben.studio.smart-village.app/admin');

    await expect(resolveAuthConfigForRequest(request)).rejects.toThrow(
      'Tenant host bb-guben.studio.smart-village.app is not active'
    );
  });

  it('rejects missing or inactive instance auth configs by instance id', async () => {
    await expect(resolveAuthConfigForInstance('missing-instance')).rejects.toThrow(
      'Active instance auth config not found for missing-instance'
    );
  });
});
