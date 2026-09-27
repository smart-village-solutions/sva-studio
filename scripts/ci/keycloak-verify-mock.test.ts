import { createHash, createPublicKey, verify } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';

let mock: ChildProcess;
let origin: string;
const redirectUri = 'http://tenant.studio.example.invalid/auth/callback';
const rootRedirectUri = 'http://studio.example.invalid/auth/callback';

const availablePort = async (): Promise<number> =>
  new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') return reject(new Error('port_unavailable'));
      server.close(() => resolvePort(address.port));
    });
  });

beforeAll(async () => {
  const port = await availablePort();
  origin = `http://127.0.0.1:${port}`;
  mock = spawn(process.execPath, [resolve('scripts/ci/keycloak-verify-mock.cjs')], {
    env: {
      ...process.env,
      PORT: String(port),
      KEYCLOAK_BASE_URL: origin,
      VERIFY_AUTH_REDIRECT_URI: redirectUri,
      VERIFY_ROOT_REDIRECT_URI: rootRedirectUri,
    },
    stdio: 'ignore',
  });
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(`${origin}/realms/example-instance/.well-known/openid-configuration`);
      if (response.ok) return;
    } catch { /* wait for the child process */ }
    await new Promise((done) => setTimeout(done, 50));
  }
  throw new Error('verify_mock_not_ready');
});

it('issues the platform role only on the second signed root-host OIDC session', async () => {
  const claimRoles = async (sequence: number): Promise<unknown> => {
    const verifier = `verify-root-${sequence}-${'a'.repeat(32)}`;
    const authorizationUrl = new URL(`${origin}/realms/sva-studio/protocol/openid-connect/auth`);
    for (const [key, value] of Object.entries({
      client_id: 'sva-studio',
      response_type: 'code',
      redirect_uri: rootRedirectUri,
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      code_challenge_method: 'S256',
      state: `root-state-${sequence}`,
      nonce: `root-nonce-${sequence}`,
    })) authorizationUrl.searchParams.set(key, value);
    const authorize = await fetch(authorizationUrl, { redirect: 'manual' });
    expect(authorize.status).toBe(302);
    const callback = new URL(authorize.headers.get('location') || '');
    expect(callback.origin + callback.pathname).toBe(rootRedirectUri);
    const exchange = await fetch(`${origin}/realms/sva-studio/protocol/openid-connect/token`, {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from('sva-studio:verify-auth-client-secret').toString('base64')}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: callback.searchParams.get('code') || '',
        code_verifier: verifier,
        redirect_uri: rootRedirectUri,
      }),
    });
    expect(exchange.status).toBe(200);
    const token = (await exchange.json() as { access_token: string }).access_token;
    const payload = JSON.parse(Buffer.from(token.split('.')[1] || '', 'base64url').toString('utf8')) as {
      realm_access?: { roles: string[] };
    };
    return payload.realm_access?.roles;
  };

  expect(await claimRoles(1)).toBeUndefined();
  expect(await claimRoles(2)).toEqual(['instance_registry_admin']);
});

afterAll(() => mock?.kill());

it('exchanges a one-time PKCE authorization code for a signed OIDC ID token', async () => {
  const verifier = 'a'.repeat(48);
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const authorizationUrl = new URL(`${origin}/realms/example-instance/protocol/openid-connect/auth`);
  for (const [key, value] of Object.entries({
    client_id: 'sva-studio',
    response_type: 'code',
    redirect_uri: redirectUri,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state: 'verify-state',
    nonce: 'verify-nonce',
  })) authorizationUrl.searchParams.set(key, value);

  const authorize = await fetch(authorizationUrl, { redirect: 'manual' });
  expect(authorize.status).toBe(302);
  const callback = new URL(authorize.headers.get('location') || '');
  expect(callback.origin + callback.pathname).toBe(redirectUri);
  expect(callback.searchParams.get('state')).toBe('verify-state');
  const code = callback.searchParams.get('code');
  expect(code).toBeTruthy();

  const tokenUrl = `${origin}/realms/example-instance/protocol/openid-connect/token`;
  const exchange = (codeVerifier: string) => fetch(tokenUrl, {
    method: 'POST',
    headers: {
      authorization: `Basic ${Buffer.from('sva-studio:verify-auth-client-secret').toString('base64')}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: code || '',
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
    }),
  });
  expect((await exchange('wrong-verifier')).status).toBe(400);
  const response = await exchange(verifier);
  expect(response.status).toBe(200);
  const token = (await response.json() as { id_token: string }).id_token;
  const [header, payload, signature] = token.split('.');
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>;
  const jwks = await (await fetch(`${origin}/realms/example-instance/protocol/openid-connect/certs`)).json() as {
    keys: JsonWebKey[];
  };
  expect(verify('RSA-SHA256', Buffer.from(`${header}.${payload}`), createPublicKey({ key: jwks.keys[0], format: 'jwk' }), Buffer.from(signature, 'base64url'))).toBe(true);
  expect(claims).toMatchObject({
    iss: `${origin}/realms/example-instance`,
    aud: 'sva-studio',
    nonce: 'verify-nonce',
    sub: 'verify-ssf-user',
  });
  expect((await exchange(verifier)).status).toBe(400);
});
