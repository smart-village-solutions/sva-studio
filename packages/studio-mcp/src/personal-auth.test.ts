import { createServer, request as httpRequest } from 'node:http';
import { personalSessionBinding, type StoredPersonalSession } from './personal-session-store.js';
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
    state.refreshTokenGrant.mockResolvedValue({ access_token: 'refreshed-access-token', claims: () => undefined, expiresIn: () => 300 });
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

  it('rejects duplicate login attempts and an already authenticated context', async () => {
    const { PersonalMcpContextManager } = await import('./personal-auth.js');
    const callbackPort = await unusedPort();
    const manager = new PersonalMcpContextManager([context], { callbackPort });
    const loginUrl = new URL(await manager.startLogin(context.id));
    await expect(manager.startLogin(context.id)).rejects.toMatchObject({ code: 'context_login_pending' });

    await fetch(`http://127.0.0.1:${callbackPort}/callback?state=${loginUrl.searchParams.get('state')}&code=authorization-code`);
    await expect(manager.startLogin(context.id)).rejects.toMatchObject({ code: 'context_already_authenticated' });
    await manager.dispose();
  });

  it('clears login state when the callback has no code or token exchange fails', async () => {
    const { PersonalMcpContextManager } = await import('./personal-auth.js');
    const callbackPort = await unusedPort();
    const manager = new PersonalMcpContextManager([context], { callbackPort });
    const firstLogin = new URL(await manager.startLogin(context.id));
    const missingCode = await fetch(
      `http://127.0.0.1:${callbackPort}/callback?state=${firstLogin.searchParams.get('state')}`
    );
    expect(missingCode.status).toBe(400);
    expect(manager.list()[0]?.loginPending).toBe(false);

    const secondLogin = new URL(await manager.startLogin(context.id));
    state.authorizationCodeGrant.mockRejectedValueOnce(new Error('provider failure'));
    const failedExchange = await fetch(
      `http://127.0.0.1:${callbackPort}/callback?state=${secondLogin.searchParams.get('state')}&code=authorization-code`
    );
    expect(failedExchange.status).toBe(400);
    expect(manager.list()[0]).toMatchObject({ loginPending: false });
    expect(manager.list()[0]).not.toHaveProperty('account');
    await manager.dispose();
  });

  it('rejects identity-provider endpoints outside the configured issuer', async () => {
    const { PersonalMcpContextManager } = await import('./personal-auth.js');
    state.discovery.mockResolvedValueOnce({
      serverMetadata: () => ({
        ...metadata,
        token_endpoint: 'https://other.example/token',
      }),
    });
    const manager = new PersonalMcpContextManager([context], { callbackPort: await unusedPort() });
    await expect(manager.startLogin(context.id)).rejects.toMatchObject({ code: 'oidc_provider_unavailable' });
    await manager.dispose();
  });

  it('requires a login again when an expired session has no usable refresh token', async () => {
    const { PersonalMcpContextManager } = await import('./personal-auth.js');
    const callbackPort = await unusedPort();
    const manager = new PersonalMcpContextManager([context], { callbackPort });
    const loginUrl = new URL(await manager.startLogin(context.id));
    state.authorizationCodeGrant.mockResolvedValueOnce({
      access_token: 'short-lived-token',
      claims: () => ({ sub: 'subject-1' }),
      expiresIn: () => 0,
    });
    await fetch(`http://127.0.0.1:${callbackPort}/callback?state=${loginUrl.searchParams.get('state')}&code=authorization-code`);
    await expect(manager.getAccessToken(context.id)).rejects.toMatchObject({ code: 'context_login_required' });
    expect(manager.list()[0]).not.toHaveProperty('account');
    await manager.dispose();
  });

  it('removes an expired session when refresh fails', async () => {
    const { PersonalMcpContextManager } = await import('./personal-auth.js');
    const callbackPort = await unusedPort();
    const manager = new PersonalMcpContextManager([context], { callbackPort });
    const loginUrl = new URL(await manager.startLogin(context.id));
    state.authorizationCodeGrant.mockResolvedValueOnce({
      access_token: 'short-lived-token',
      refresh_token: 'refresh-token',
      claims: () => ({ sub: 'subject-1' }),
      expiresIn: () => 0,
    });
    await fetch(`http://127.0.0.1:${callbackPort}/callback?state=${loginUrl.searchParams.get('state')}&code=authorization-code`);
    state.refreshTokenGrant.mockRejectedValueOnce(new Error('refresh failed'));
    await expect(manager.getAccessToken(context.id)).rejects.toMatchObject({ code: 'oidc_token_refresh_failed' });
    await expect(manager.getAccessToken(context.id)).rejects.toMatchObject({ code: 'context_login_required' });
    await manager.dispose();
  });

  it('requires an authenticated configured context before returning an access token', async () => {
    const { PersonalMcpContextManager } = await import('./personal-auth.js');
    const manager = new PersonalMcpContextManager([context]);
    await expect(manager.getAccessToken(context.id)).rejects.toMatchObject({ code: 'context_login_required' });
    await expect(manager.getAccessToken('missing')).rejects.toMatchObject({ code: 'context_login_required' });
    await expect(manager.startLogin('missing')).rejects.toMatchObject({ code: 'context_not_configured' });
    await manager.logout(context.id);
    await manager.dispose();
  });

  it('accepts callbacks only for the exact loopback GET endpoint', async () => {
    const { PersonalMcpContextManager } = await import('./personal-auth.js');
    const callbackPort = await unusedPort();
    const manager = new PersonalMcpContextManager([context], { callbackPort });
    await manager.startLogin(context.id);

    const post = await fetch(`http://127.0.0.1:${callbackPort}/callback`, { method: 'POST' });
    const otherPath = await fetch(`http://127.0.0.1:${callbackPort}/other`);
    const wrongHostStatus = await new Promise<number>((resolve, reject) => {
      const request = httpRequest({
        hostname: '127.0.0.1',
        port: callbackPort,
        path: '/callback',
        headers: { host: `wrong.example:${callbackPort}` },
      }, (response) => resolve(response.statusCode ?? 0));
      request.once('error', reject);
      request.end();
    });
    expect([post.status, otherPath.status, wrongHostStatus]).toEqual([404, 404, 404]);
    expect(manager.list()[0]?.loginPending).toBe(true);
    manager.cancelLogin(context.id);
    await manager.dispose();
  });

  it('reports unavailable remote revocation while keeping logout local', async () => {
    const { PersonalMcpContextManager } = await import('./personal-auth.js');
    const callbackPort = await unusedPort();
    state.discovery.mockResolvedValue({
      serverMetadata: () => ({ ...metadata, revocation_endpoint: undefined }),
    });
    const manager = new PersonalMcpContextManager([context], { callbackPort });
    const loginUrl = new URL(await manager.startLogin(context.id));
    await fetch(`http://127.0.0.1:${callbackPort}/callback?state=${loginUrl.searchParams.get('state')}&code=authorization-code`);

    await expect(manager.logout(context.id)).rejects.toMatchObject({ code: 'oidc_logout_revocation_failed' });
    expect(manager.list()[0]).not.toHaveProperty('account');
    expect(state.tokenRevocation).not.toHaveBeenCalled();
    await manager.dispose();
  });
  const persistentStore = () => {
    let saved: StoredPersonalSession | undefined = {
      version: 1,
      binding: personalSessionBinding(context),
      subject: 'subject-1',
      account: 'provider-demo',
      refreshToken: 'stored-test-refresh-token',
    };
    return {
      load: vi.fn(async () => saved),
      save: vi.fn(async (_context: typeof context, session: StoredPersonalSession) => {
        saved = session;
      }),
      delete: vi.fn(async () => {
        saved = undefined;
      }),
    };
  };

  it('persists only refresh credentials on login and restores the same identity after restart', async () => {
    const { PersonalMcpContextManager } = await import('./personal-auth.js');
    const store = persistentStore();
    await store.delete();
    const port = await unusedPort();
    const manager = new PersonalMcpContextManager([context], {
      callbackPort: port,
      sessionStore: store,
    });
    const url = new URL(await manager.startLogin(context.id));
    expect(
      (
        await fetch(
          `http://127.0.0.1:${port}/callback?state=${url.searchParams.get('state')}&code=test`
        )
      ).status
    ).toBe(200);
    expect(store.save).toHaveBeenCalledWith(context, {
      version: 1,
      binding: personalSessionBinding(context),
      subject: 'subject-1',
      account: 'provider-demo',
      refreshToken: 'refresh-token-should-never-be-output',
    });
    await manager.dispose();
    expect(state.tokenRevocation).not.toHaveBeenCalled();
    const restarted = new PersonalMcpContextManager([context], { sessionStore: store });
    await expect(restarted.getAccessToken(context.id)).resolves.toBe('refreshed-access-token');
    expect(state.fetchUserInfo).toHaveBeenLastCalledWith(
      expect.anything(),
      'refreshed-access-token',
      'subject-1'
    );
    expect(restarted.list()[0]?.account).toBe('provider-demo');
    await restarted.logout(context.id);
    expect(await store.load()).toBeUndefined();
    expect(state.tokenRevocation).toHaveBeenCalled();
    await restarted.dispose();
  });

  it.each(['binding', 'subject', 'refresh'] as const)(
    'rejects a restored session with invalid %s',
    async (kind) => {
      const { PersonalMcpContextManager } = await import('./personal-auth.js');
      const store = persistentStore();
      if (kind === 'binding') {
        const saved = await store.load();
        if (!saved) throw new Error('fixture_missing');
        store.load.mockResolvedValue({ ...saved, binding: 'other-context' });
      }
      if (kind === 'subject') state.fetchUserInfo.mockResolvedValueOnce({ sub: 'other-subject' });
      if (kind === 'refresh')
        state.refreshTokenGrant.mockRejectedValueOnce(new Error('private provider detail'));
      const manager = new PersonalMcpContextManager([context], { sessionStore: store });
      await expect(manager.getAccessToken(context.id)).rejects.toMatchObject({
        code: 'context_login_required',
      });
      expect(store.delete).toHaveBeenCalledWith(context);
      expect(manager.list()[0]).not.toHaveProperty('account');
      if (kind === 'binding') expect(state.refreshTokenGrant).not.toHaveBeenCalled();
      await manager.dispose();
    }
  );

  it('saves rotated refresh tokens before returning an access token', async () => {
    const { PersonalMcpContextManager } = await import('./personal-auth.js');
    const store = persistentStore();
    state.refreshTokenGrant.mockResolvedValueOnce({
      access_token: 'new-access',
      refresh_token: 'rotated-test-refresh',
      claims: () => undefined,
      expiresIn: () => 300,
    });
    const manager = new PersonalMcpContextManager([context], { sessionStore: store });
    await expect(manager.getAccessToken(context.id)).resolves.toBe('new-access');
    expect((await store.load())?.refreshToken).toBe('rotated-test-refresh');
    await manager.dispose();
  });

  it('logs out a saved session without restoring or refreshing it', async () => {
    const { PersonalMcpContextManager } = await import('./personal-auth.js');
    const store = persistentStore();
    const manager = new PersonalMcpContextManager([context], { sessionStore: store });
    state.tokenRevocation.mockRejectedValueOnce(new Error('provider unavailable'));
    await expect(manager.logout(context.id)).rejects.toMatchObject({
      code: 'oidc_logout_revocation_failed',
    });
    expect(await store.load()).toBeUndefined();
    expect(state.refreshTokenGrant).not.toHaveBeenCalled();
    await manager.dispose();
  });

  it('does not resurrect a saved session when logout overlaps restoration', async () => {
    const { PersonalMcpContextManager } = await import('./personal-auth.js');
    const store = persistentStore();
    let complete!: (response: unknown) => void;
    state.refreshTokenGrant.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        })
    );
    const manager = new PersonalMcpContextManager([context], { sessionStore: store });
    const token = manager.getAccessToken(context.id);
    await vi.waitFor(() => expect(state.refreshTokenGrant).toHaveBeenCalled());
    const logout = manager.logout(context.id);
    complete({
      access_token: 'new-access',
      refresh_token: 'rotated-test-refresh',
      claims: () => undefined,
      expiresIn: () => 300,
    });
    await token;
    await logout;
    expect(await store.load()).toBeUndefined();
    expect(manager.list()[0]).not.toHaveProperty('account');
    await expect(manager.getAccessToken(context.id)).rejects.toMatchObject({
      code: 'context_login_required',
    });
    await manager.dispose();
  });

  it('fails closed when rotated credentials cannot be saved', async () => {
    const { PersonalMcpContextManager } = await import('./personal-auth.js');
    const store = persistentStore();
    store.save.mockRejectedValueOnce(new Error('storage unavailable'));
    const manager = new PersonalMcpContextManager([context], { sessionStore: store });
    await expect(manager.getAccessToken(context.id)).rejects.toMatchObject({
      code: 'context_login_required',
    });
    expect(await store.load()).toBeUndefined();
    expect(manager.list()[0]).not.toHaveProperty('account');
    await manager.dispose();
  });

  it('removes an older saved identity when a new login has no refresh token', async () => {
    const { PersonalMcpContextManager } = await import('./personal-auth.js');
    const store = persistentStore();
    const port = await unusedPort();
    const manager = new PersonalMcpContextManager([context], {
      callbackPort: port,
      sessionStore: store,
    });
    const url = new URL(await manager.startLogin(context.id));
    await expect(manager.getAccessToken(context.id)).rejects.toMatchObject({
      code: 'context_login_pending',
    });
    expect(state.refreshTokenGrant).not.toHaveBeenCalled();
    state.authorizationCodeGrant.mockResolvedValueOnce({
      access_token: 'new-account-access',
      claims: () => ({ sub: 'subject-2' }),
      expiresIn: () => 300,
    });
    state.fetchUserInfo.mockResolvedValueOnce({
      sub: 'subject-2',
      preferred_username: 'other-account',
    });
    expect(
      (
        await fetch(
          `http://127.0.0.1:${port}/callback?state=${url.searchParams.get('state')}&code=test`
        )
      ).status
    ).toBe(200);
    expect(manager.list()[0]?.account).toBe('other-account');
    expect(await store.load()).toBeUndefined();
    await manager.dispose();
    const restarted = new PersonalMcpContextManager([context], { sessionStore: store });
    await expect(restarted.getAccessToken(context.id)).rejects.toMatchObject({
      code: 'context_login_required',
    });
    await restarted.dispose();
  });
  it('removes the old saved identity before a new browser login can fail', async () => {
    const { PersonalMcpContextManager } = await import('./personal-auth.js');
    const store = persistentStore();
    const port = await unusedPort();
    const manager = new PersonalMcpContextManager([context], { callbackPort: port, sessionStore: store });
    const url = new URL(await manager.startLogin(context.id));
    expect(await store.load()).toBeUndefined();
    state.authorizationCodeGrant.mockRejectedValueOnce(new Error('provider unavailable'));
    expect((await fetch(`http://127.0.0.1:${port}/callback?state=${url.searchParams.get('state')}&code=test`)).status).toBe(400);
    await expect(manager.getAccessToken(context.id)).rejects.toMatchObject({ code: 'context_login_required' });
    expect(state.refreshTokenGrant).not.toHaveBeenCalled();
    await manager.dispose();
  });

  it('surfaces keychain errors from the browser callback without restoring an older account', async () => {
    const { PersonalMcpContextManager, PersonalMcpAuthError } = await import('./personal-auth.js');
    const store = persistentStore();
    const port = await unusedPort();
    const manager = new PersonalMcpContextManager([context], { callbackPort: port, sessionStore: store });
    const url = new URL(await manager.startLogin(context.id));
    store.save.mockRejectedValueOnce(new PersonalMcpAuthError('personal_session_store_unavailable'));
    const response = await fetch(`http://127.0.0.1:${port}/callback?state=${url.searchParams.get('state')}&code=test`);
    expect(response.status).toBe(503);
    expect(await response.text()).toContain('personal_session_store_unavailable');
    expect(manager.list()[0]).not.toHaveProperty('account');
    expect(await store.load()).toBeUndefined();
    await manager.dispose();
  });

  it.each(['restore', 'refresh'] as const)('preserves keychain error codes during %s', async (kind) => {
    const { PersonalMcpContextManager, PersonalMcpAuthError } = await import('./personal-auth.js');
    const store = persistentStore();
    if (kind === 'refresh') state.refreshTokenGrant.mockResolvedValueOnce({ access_token: 'expired-access', claims: () => undefined, expiresIn: () => 0 });
    store.save.mockImplementation(async () => {
      if (kind === 'refresh' && store.save.mock.calls.length === 1) return;
      throw new PersonalMcpAuthError('personal_session_store_unavailable');
    });
    const manager = new PersonalMcpContextManager([context], { sessionStore: store });
    await expect(manager.getAccessToken(context.id)).rejects.toMatchObject({ code: 'personal_session_store_unavailable' });
    expect(manager.list()[0]).not.toHaveProperty('account');
    expect(await store.load()).toBeUndefined();
    await manager.dispose();
  });

});
