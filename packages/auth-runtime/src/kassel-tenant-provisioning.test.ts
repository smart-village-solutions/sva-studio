import { afterEach, describe, expect, it, vi } from 'vitest';

import { probeKasselTenantEndpoint } from './kassel-tenant-provisioning.js';

const input = {
  primaryHostname: 'tenant.dialog.kassel.de',
  authIssuerUrl: 'https://auth.dialog.kassel.de/realms/smartcity',
  authClientId: 'sva-studio-login',
} as const;

describe('Kassel tenant public probes', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('accepts a publicly trusted tenant response', async () => {
    vi.stubEnv('SVA_TENANT_INGRESS_MODE', 'kassel-traefik-file');
    const fetcher = vi.fn(async () => new Response('ok', { status: 200 }));

    await expect(
      probeKasselTenantEndpoint({ ...input, kind: 'ingress' }, fetcher)
    ).resolves.toEqual({ status: 200, hostname: input.primaryHostname });
    expect(fetcher).toHaveBeenCalledWith(
      `https://${input.primaryHostname}/`,
      expect.objectContaining({ redirect: 'manual' })
    );
  });

  it('accepts only the expected public issuer and tenant callback', async () => {
    vi.stubEnv('SVA_TENANT_INGRESS_MODE', 'kassel-traefik-file');
    const authorize = new URL(`${input.authIssuerUrl}/protocol/openid-connect/auth`);
    authorize.searchParams.set('client_id', 'sva-studio-login');
    authorize.searchParams.set('state', 'opaque');
    authorize.searchParams.set('code_challenge', 'challenge');
    authorize.searchParams.set('code_challenge_method', 'S256');
    authorize.searchParams.set('redirect_uri', `https://${input.primaryHostname}/auth/callback`);
    const fetcher = vi.fn(
      async () => new Response(null, { status: 302, headers: { Location: authorize.toString() } })
    );

    await expect(
      probeKasselTenantEndpoint({ ...input, kind: 'login' }, fetcher)
    ).resolves.toEqual({
      status: 302,
      issuerOrigin: 'https://auth.dialog.kassel.de',
      issuerPath: '/realms/smartcity/protocol/openid-connect/auth',
      callbackOrigin: `https://${input.primaryHostname}`,
    });
  });

  it.each([
    ['server error', new Response('failed', { status: 500 })],
    ['no redirect', new Response('ok', { status: 200 })],
    [
      'internal issuer',
      new Response(null, {
        status: 302,
        headers: {
          Location:
            'http://ssf-backend-keycloak-1:8080/realms/smartcity/protocol/openid-connect/auth?client_id=studio&state=x&code_challenge=y&redirect_uri=https%3A%2F%2Ftenant.dialog.kassel.de%2Fauth%2Fcallback',
        },
      }),
    ],
  ])('rejects login probe with %s', async (_case, response) => {
    vi.stubEnv('SVA_TENANT_INGRESS_MODE', 'kassel-traefik-file');
    await expect(
      probeKasselTenantEndpoint(
        { ...input, kind: 'login' },
        vi.fn(async () => response)
      )
    ).rejects.toThrow(/^kassel_login_/u);
  });

  it.each([
    ['wrong client', 'other-client', 'S256', '/auth/callback'],
    ['weak PKCE method', input.authClientId, 'plain', '/auth/callback'],
    ['wrong callback path', input.authClientId, 'S256', '/other'],
  ])('rejects %s', async (_case, clientId, method, callbackPath) => {
    vi.stubEnv('SVA_TENANT_INGRESS_MODE', 'kassel-traefik-file');
    const authorize = new URL(`${input.authIssuerUrl}/protocol/openid-connect/auth`);
    authorize.searchParams.set('client_id', clientId);
    authorize.searchParams.set('state', 'opaque');
    authorize.searchParams.set('code_challenge', 'challenge');
    authorize.searchParams.set('code_challenge_method', method);
    authorize.searchParams.set(
      'redirect_uri',
      `https://${input.primaryHostname}${callbackPath}`
    );

    await expect(
      probeKasselTenantEndpoint(
        { ...input, kind: 'login' },
        vi.fn(async () =>
          new Response(null, { status: 302, headers: { Location: authorize.toString() } })
        )
      )
    ).rejects.toThrow(/^kassel_login_/u);
  });

  it('cannot run outside the explicit Kassel mode', async () => {
    vi.stubEnv('SVA_TENANT_INGRESS_MODE', 'external');
    await expect(
      probeKasselTenantEndpoint(
        { ...input, kind: 'ingress' },
        vi.fn(async () => new Response('ok'))
      )
    ).rejects.toThrow('kassel_tenant_ingress_mode_disabled');
  });
});
