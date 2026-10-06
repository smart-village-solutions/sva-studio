import { createServer } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  discovery: vi.fn(),
  buildAuthorizationUrl: vi.fn(),
  authorizationCodeGrant: vi.fn(),
  fetchUserInfo: vi.fn(),
  refreshTokenGrant: vi.fn(),
  tokenRevocation: vi.fn(),
  randomState: vi.fn(),
  randomNonce: vi.fn(),
  randomPKCECodeVerifier: vi.fn(),
  calculatePKCECodeChallenge: vi.fn(),
  customFetch: Symbol('customFetch'),
}));

vi.mock('openid-client', () => state);

const context = {
  id: 'tenant-demo-provider',
  name: 'Demo Tenant Provider',
  kind: 'tenant' as const,
  tenantId: 'demo',
  baseUrl: 'https://demo.studio.example',
  issuer: 'https://id.example/realms/demo',
  clientId: 'sva-studio-mcp-personal',
};

const metadata = {
  issuer: context.issuer,
  authorization_endpoint: 'https://id.example/realms/demo/protocol/openid-connect/auth',
  token_endpoint: 'https://id.example/realms/demo/protocol/openid-connect/token',
  userinfo_endpoint: 'https://id.example/realms/demo/protocol/openid-connect/userinfo',
  revocation_endpoint: 'https://id.example/realms/demo/protocol/openid-connect/revoke',
  jwks_uri: 'https://id.example/realms/demo/protocol/openid-connect/certs',
};

const unusedPort = async (): Promise<number> => {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('test_port_unavailable');
  const { port } = address;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
};

describe('personal MCP context authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.randomState.mockReturnValue('state-bound-to-this-login');
    state.randomNonce.mockReturnValue('nonce-bound-to-this-login');
    state.randomPKCECodeVerifier.mockReturnValue('pkce-verifier-held-in-process');
    state.calculatePKCECodeChallenge.mockResolvedValue('pkce-challenge');
    state.buildAuthorizationUrl.mockImplementation((_configuration, parameters) => {
      const url = new URL(metadata.authorization_endpoint);
      for (const [key, value] of Object.entries(parameters as Record<string, string>)) {
        url.searchParams.set(key, value);
      }
      return url;
    });
    state.discovery.mockResolvedValue({ serverMetadata: () => metadata });
    state.authorizationCodeGrant.mockResolvedValue({
      access_token: 'access-token-should-never-be-output',
      refresh_token: 'refresh-token-should-never-be-output',
      claims: () => ({ sub: 'subject-1' }),
      expiresIn: () => 300,
    });
    state.fetchUserInfo.mockResolvedValue({ sub: 'subject-1', preferred_username: 'provider-demo' });
    state.refreshTokenGrant.mockResolvedValue({ access_token: 'refreshed-access-token', expiresIn: () => 300 });
    state.tokenRevocation.mockResolvedValue(undefined);
  });

  afterEach(() => vi.useRealTimers());

  it('binds the login callback to state, nonce and PKCE, then keeps identity only in memory', async () => {
    const { PersonalMcpContextManager } = await import('./personal-auth.js');
    const callbackPort = await unusedPort();
    const manager = new PersonalMcpContextManager([context], { callbackPort });
    const loginUrl = new URL(await manager.startLogin(context.id));
    expect(loginUrl.searchParams.get('client_id')).toBe(context.clientId);
    expect(loginUrl.searchParams.get('redirect_uri')).toBe(`http://127.0.0.1:${callbackPort}/callback`);
    expect(loginUrl.searchParams.get('response_type')).toBe('code');
    expect(loginUrl.searchParams.get('scope')).toBe('openid profile');
    expect(loginUrl.searchParams.get('prompt')).toBe('login');
    expect(loginUrl.searchParams.get('code_challenge_method')).toBe('S256');
    expect(manager.list()[0]).toMatchObject({ id: context.id, host: 'demo.studio.example', realm: 'demo', tenantId: 'demo', loginPending: true });

    const wrongState = await fetch(`http://127.0.0.1:${callbackPort}/callback?state=wrong&code=unused`);
    expect(wrongState.status).toBe(400);
    expect(manager.list()[0]?.loginPending).toBe(true);

    const callback = await fetch(`http://127.0.0.1:${callbackPort}/callback?state=state-bound-to-this-login&code=authorization-code`);
    expect(callback.status).toBe(200);
    expect(await manager.getAccessToken(context.id)).toBe('access-token-should-never-be-output');
    expect(state.authorizationCodeGrant).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ searchParams: expect.any(URLSearchParams) }),
      { pkceCodeVerifier: 'pkce-verifier-held-in-process', expectedState: 'state-bound-to-this-login', expectedNonce: 'nonce-bound-to-this-login' }
    );
    expect(manager.list()[0]).toMatchObject({ account: 'provider-demo', loginPending: false });

    await manager.logout(context.id);
    expect(state.tokenRevocation).toHaveBeenCalledWith(expect.anything(), 'refresh-token-should-never-be-output', { token_type_hint: 'refresh_token' });
    expect(manager.list()[0]).not.toHaveProperty('account');
    await manager.dispose();
  });

  it('clears pending state when authorization is denied or times out', async () => {
    const { PersonalMcpContextManager } = await import('./personal-auth.js');
    const callbackPort = await unusedPort();
    const manager = new PersonalMcpContextManager([context], { callbackPort, loginTimeoutMs: 10_000 });
    const loginUrl = new URL(await manager.startLogin(context.id));
    const denied = await fetch(`http://127.0.0.1:${callbackPort}/callback?state=${loginUrl.searchParams.get('state')}&error=access_denied`);
    expect(denied.status).toBe(400);
    expect(manager.list()[0]?.loginPending).toBe(false);

    vi.useFakeTimers();
    await manager.startLogin(context.id);
    await vi.advanceTimersByTimeAsync(10_001);
    expect(manager.list()[0]?.loginPending).toBe(false);
    await manager.dispose();
  });

  it('refreshes only the selected context and removes it when logout starts', async () => {
    const { PersonalMcpContextManager } = await import('./personal-auth.js');
    const callbackPort = await unusedPort();
    const manager = new PersonalMcpContextManager([context], { callbackPort });
    const loginUrl = new URL(await manager.startLogin(context.id));
    await fetch(`http://127.0.0.1:${callbackPort}/callback?state=${loginUrl.searchParams.get('state')}&code=authorization-code`);
    state.authorizationCodeGrant.mockResolvedValueOnce({
      access_token: 'expired-token', refresh_token: 'refresh-token', claims: () => ({ sub: 'subject-1' }), expiresIn: () => 0,
    });
    // Complete a second independent context to install an already-expired session.
    await manager.logout(context.id);
    await manager.startLogin(context.id);
    const buildResults = state.buildAuthorizationUrl.mock.results;
    const secondLoginUrl = new URL(buildResults[buildResults.length - 1]?.value as URL);
    await fetch(`http://127.0.0.1:${callbackPort}/callback?state=${secondLoginUrl.searchParams.get('state')}&code=authorization-code`);
    expect(await manager.getAccessToken(context.id)).toBe('refreshed-access-token');
    expect(state.refreshTokenGrant).toHaveBeenCalledWith(expect.anything(), 'refresh-token');
    manager.cancelLogin(context.id);
    expect(manager.list()[0]?.loginPending).toBe(false);
    await manager.dispose();
  });

  it('refuses callback binding when another MCP process owns the provisioned port', async () => {
    const { PersonalMcpContextManager } = await import('./personal-auth.js');
    const occupiedPort = await unusedPort();
    const listener = createServer();
    await new Promise<void>((resolve) => listener.listen(occupiedPort, '127.0.0.1', resolve));
    const manager = new PersonalMcpContextManager([context], { callbackPort: occupiedPort });
    await expect(manager.startLogin(context.id)).rejects.toMatchObject({ code: 'login_callback_unavailable' });
    await new Promise<void>((resolve) => listener.close(() => resolve()));
    await manager.dispose();
  });

  it('keeps logout local even when remote refresh-token revocation fails', async () => {
    const { PersonalMcpContextManager } = await import('./personal-auth.js');
    const callbackPort = await unusedPort();
    const manager = new PersonalMcpContextManager([context], { callbackPort });
    const loginUrl = new URL(await manager.startLogin(context.id));
    await fetch(`http://127.0.0.1:${callbackPort}/callback?state=${loginUrl.searchParams.get('state')}&code=authorization-code`);
    state.tokenRevocation.mockRejectedValueOnce(new Error('provider unavailable'));

    await expect(manager.logout(context.id)).rejects.toMatchObject({ code: 'oidc_logout_revocation_failed' });
    expect(manager.list()[0]).not.toHaveProperty('account');
    await manager.dispose();
  });
});
