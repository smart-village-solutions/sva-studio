import { afterEach, describe, expect, it, vi } from 'vitest';

import { probeKasselTenantEndpoint } from './kassel-tenant-provisioning.js';

const input = {
  primaryHostname: 'tenant.dialog.kassel.de',
  authIssuerUrl: 'https://auth.dialog.kassel.de/realms/smartcity',
  authClientId: 'sva-studio-login',
  expectedRouterName: 'studio-tenant-tenant',
  expectedConfigHash: 'sha256:expected',
} as const;

const routerHeaders = (headers: Record<string, string> = {}) => ({
  'X-SVA-Tenant-Router': input.expectedRouterName,
  'X-SVA-Tenant-Config': input.expectedConfigHash,
  ...headers,
});

const loginRedirectResponse = (overrides: Record<string, string> = {}) => {
  const authorize = new URL(`${input.authIssuerUrl}/protocol/openid-connect/auth`);
  authorize.searchParams.set('client_id', input.authClientId);
  authorize.searchParams.set('state', 'opaque');
  authorize.searchParams.set('code_challenge', 'challenge');
  authorize.searchParams.set('code_challenge_method', 'S256');
  authorize.searchParams.set('redirect_uri', `https://${input.primaryHostname}/auth/callback`);
  for (const [key, value] of Object.entries(overrides)) authorize.searchParams.set(key, value);
  return new Response(null, {
    status: 302,
    headers: routerHeaders({ Location: authorize.toString() }),
  });
};

describe('Kassel tenant public probes', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses the narrowly enabled login endpoint for the ingress probe', async () => {
    vi.stubEnv('SVA_TENANT_INGRESS_MODE', 'kassel-traefik-file');
    const fetcher = vi.fn(async () => loginRedirectResponse());

    await expect(
      probeKasselTenantEndpoint({ ...input, kind: 'ingress' }, fetcher)
    ).resolves.toEqual({ status: 302, hostname: input.primaryHostname });
    expect(fetcher).toHaveBeenCalledWith(
      `https://${input.primaryHostname}/auth/login`,
      expect.objectContaining({ redirect: 'manual' })
    );
  });

  it('rejects ingress responses without the expected login redirect', async () => {
    vi.stubEnv('SVA_TENANT_INGRESS_MODE', 'kassel-traefik-file');
    const localRedirect = new Response(null, {
      status: 302,
      headers: routerHeaders({ Location: '/welcome' }),
    });

    await expect(
      probeKasselTenantEndpoint(
        { ...input, kind: 'ingress' },
        vi.fn(async () => localRedirect)
      )
    ).rejects.toThrow('kassel_login_redirect_invalid');

    await expect(
      probeKasselTenantEndpoint(
        { ...input, kind: 'ingress' },
        vi.fn(
          async () =>
            new Response(null, {
              status: 302,
              headers: routerHeaders({ Location: 'https://unrelated.example.test/' }),
            })
        )
      )
    ).rejects.toThrow('kassel_login_redirect_invalid');
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
      async () =>
        new Response(null, {
          status: 302,
          headers: routerHeaders({ Location: authorize.toString() }),
        })
    );

    await expect(probeKasselTenantEndpoint({ ...input, kind: 'login' }, fetcher)).resolves.toEqual({
      status: 302,
      issuerOrigin: 'https://auth.dialog.kassel.de',
      issuerPath: '/realms/smartcity/protocol/openid-connect/auth',
      callbackOrigin: `https://${input.primaryHostname}`,
    });
  });

  it.each([
    ['server error', new Response('failed', { status: 500, headers: routerHeaders() })],
    ['no redirect', new Response('ok', { status: 200, headers: routerHeaders() })],
    [
      'internal issuer',
      new Response(null, {
        status: 302,
        headers: {
          ...routerHeaders(),
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
    authorize.searchParams.set('redirect_uri', `https://${input.primaryHostname}${callbackPath}`);

    await expect(
      probeKasselTenantEndpoint(
        { ...input, kind: 'login' },
        vi.fn(
          async () =>
            new Response(null, {
              status: 302,
              headers: routerHeaders({ Location: authorize.toString() }),
            })
        )
      )
    ).rejects.toThrow(/^kassel_login_/u);
  });

  it.each([
    ['state', ''],
    ['code_challenge', ''],
  ])('rejects an empty %s parameter', async (parameter, value) => {
    vi.stubEnv('SVA_TENANT_INGRESS_MODE', 'kassel-traefik-file');

    await expect(
      probeKasselTenantEndpoint(
        { ...input, kind: 'login' },
        vi.fn(async () => loginRedirectResponse({ [parameter]: value }))
      )
    ).rejects.toThrow('kassel_login_redirect_invalid');
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

  it('rejects a response that is not tied to the published router revision', async () => {
    vi.stubEnv('SVA_TENANT_INGRESS_MODE', 'kassel-traefik-file');
    await expect(
      probeKasselTenantEndpoint(
        { ...input, kind: 'ingress' },
        vi.fn(async () => new Response('ok', { status: 200 }))
      )
    ).rejects.toThrow('kassel_ingress_router_not_loaded');
  });
});
