import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { generateKeyPair, SignJWT } from 'jose';
const mocks = vi.hoisted(() => ({ session: vi.fn(), config: vi.fn(), jwks: vi.fn() }));
vi.mock('./redis-session.js', () => ({ getSession: mocks.session }));
vi.mock('./config.js', () => ({ resolveAuthConfigForInstance: mocks.config }));
vi.mock('./service-token.js', () => ({ getRemoteServiceJwks: mocks.jwks }));
import * as gateway from './ssf-recording-gateway.js';

const issuer = 'https://id.test/realms/tenant';
const ctx = {
  pluginId: 'ssf',
  handlerId: 'ssf.organisation-keys.read',
  scope: 'tenant' as const,
  sessionId: 's',
  actor: { id: 'user', instanceId: 'tenant', roles: [] },
  pathParams: {},
  request: new Request('https://studio.test/api'),
};
const claims = {
  sub: 'user',
  sid: 'original-session',
  azp: 'studio',
  studio_tenant_id: 'tenant',
  acr: '2',
  auth_time: 100,
  ssf_permissions: ['ssf.configuration.tenant.manage'],
};
const pair = await generateKeyPair('RS256');
const sign = (overrides: Record<string, unknown> = {}) =>
  new SignJWT({
    ...claims,
    aud: 'ssf-frontend',
    exp: Math.floor(Date.now() / 1000) + 120,
    ...overrides,
  })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(issuer)
    .sign(pair.privateKey);
const request = vi.fn();
beforeEach(async () => {
  vi.resetAllMocks();
  vi.stubGlobal('fetch', request);
  vi.stubEnv('SVA_STUDIO_SSF_CONTROL_PLANE_BASE_URL', 'https://gateway.test');
  mocks.jwks.mockReturnValue(async () => pair.publicKey);
  mocks.config.mockResolvedValue({
    kind: 'instance',
    instanceId: 'tenant',
    issuer,
    clientId: 'studio',
    clientSecret: 'fixture',
  });
  mocks.session.mockResolvedValue({
    userId: 'user',
    accessToken: await sign(),
    auth: { kind: 'instance', instanceId: 'tenant', issuer, clientId: 'studio' },
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it('exchanges the original session token for the fixed audience and forwards only its bearer', async () => {
  const token = await sign();
  request
    .mockResolvedValueOnce(
      Response.json({
        access_token: token,
        token_type: 'Bearer',
        issued_token_type: 'urn:ietf:params:oauth:token-type:access_token',
      })
    )
    .mockResolvedValueOnce(Response.json({ keys: [] }));
  expect(
    (await gateway.forwardSsfRecordingRequest(ctx, { path: '/organisation-keys', method: 'GET' }))
      .status
  ).toBe(200);
  const [url, init] = request.mock.calls[0] ?? [];
  expect(url).toBe(issuer + '/protocol/openid-connect/token');
  expect(Object.fromEntries(init.body)).toMatchObject({
    grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
    audience: 'ssf-frontend',
    subject_token: (await mocks.session()).accessToken,
  });
  expect(request.mock.calls[1]?.[0]).toBe(
    'https://gateway.test/api/admin/recording/v2/organisation-keys'
  );
  expect(new Headers(request.mock.calls[1]?.[1].headers).get('authorization')).toBe(
    'Bearer ' + token
  );
});
it.each([
  { sub: 'other' },
  { sid: 'different-session' },
  { acr: '3' },
  { auth_time: 101 },
  { studio_tenant_id: 'other' },
  { ssf_permissions: [] },
])('rejects changed identity, assurance or permission', async (change) => {
  request.mockResolvedValueOnce(
    Response.json({
      access_token: await sign(change),
      token_type: 'Bearer',
      issued_token_type: 'urn:ietf:params:oauth:token-type:access_token',
    })
  );
  expect(
    (await gateway.forwardSsfRecordingRequest(ctx, { path: '/organisation-keys', method: 'GET' }))
      .ok
  ).toBe(false);
  expect(request).toHaveBeenCalledTimes(1);
});
it('does not exchange a session from a different realm or send a bearer to another origin', async () => {
  mocks.session.mockResolvedValue({
    userId: 'user',
    accessToken: await sign(),
    auth: { kind: 'platform', issuer: 'https://id.test/realms/root' },
  });
  expect(
    (await gateway.forwardSsfRecordingRequest(ctx, { path: '/organisation-keys', method: 'GET' }))
      .ok
  ).toBe(false);
  expect(
    (await gateway.forwardSsfRecordingRequest(ctx, { path: '//other.test', method: 'GET' })).ok
  ).toBe(false);
  expect(request).not.toHaveBeenCalled();
});

it.each([
  { acr: 'pwd', auth_time: undefined },
  { acr: undefined, auth_time: undefined },
  { acr: 'mfa', auth_time: 1 },
])('accepts the signed optional authentication context without a freshness gate', async (extra) => {
  const token = await sign(extra);
  const session = await mocks.session();
  mocks.session.mockResolvedValue({ ...session, accessToken: token });
  request
    .mockResolvedValueOnce(
      Response.json({
        access_token: token,
        token_type: 'Bearer',
        issued_token_type: 'urn:ietf:params:oauth:token-type:access_token',
      })
    )
    .mockResolvedValueOnce(Response.json({ keys: [] }));
  expect(
    (await gateway.forwardSsfRecordingRequest(ctx, { method: 'GET', path: '/organisation-keys' }))
      .status
  ).toBe(200);
});
it('requires normal login when the authenticated session no longer exists', async () => {
  mocks.session.mockResolvedValue(null);
  const res = await gateway.forwardSsfRecordingRequest(ctx, {
    method: 'GET',
    path: '/organisation-keys',
  });
  expect(res.status).toBe(401);
  expect(await res.json()).toEqual({ error: { code: 'AUTHENTICATION_REQUIRED' } });
  expect(request).not.toHaveBeenCalled();
});

it.each([
  {},
  { aud: 'another-client' },
  { studio_tenant_id: undefined, ssf_permissions: undefined },
])(
  'reports missing source audience provisioning without reauthenticating a valid session',
  async (change) => {
    const original = await sign({ aud: undefined, ...change });
    mocks.session.mockResolvedValue({ ...(await mocks.session()), accessToken: original });
    const res = await gateway.forwardSsfRecordingRequest(ctx, {
      method: 'GET',
      path: '/organisation-keys',
    });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: { code: 'RECORDING_UNAVAILABLE' } });
    expect(request).not.toHaveBeenCalled();
  }
);
it('denies an expired source even when its audience is also missing', async () => {
  mocks.session.mockResolvedValue({
    ...(await mocks.session()),
    accessToken: await sign({ aud: undefined, exp: 1 }),
  });
  const res = await gateway.forwardSsfRecordingRequest(ctx, {
    method: 'GET',
    path: '/organisation-keys',
  });
  expect(res.status).toBe(401);
  expect(request).not.toHaveBeenCalled();
});
it('reports a wrongly issued downstream token as an exchange failure', async () => {
  request.mockResolvedValueOnce(
    Response.json({
      access_token: await sign({ aud: 'other' }),
      token_type: 'Bearer',
      issued_token_type: 'urn:ietf:params:oauth:token-type:access_token',
    })
  );
  const res = await gateway.forwardSsfRecordingRequest(ctx, {
    method: 'GET',
    path: '/organisation-keys',
  });
  expect(res.status).toBe(503);
  expect(request).toHaveBeenCalledTimes(1);
});

const readKeys = () =>
  gateway.forwardSsfRecordingRequest(ctx, { path: '/organisation-keys', method: 'GET' });

it.each([
  { sub: 'other-user' },
  { azp: 'another-client' },
  { client_id: 'service' },
  { preferred_username: 'service-account-job' },
  { studio_tenant_id: 'other-tenant' },
  { ssf_permissions: [] },
  { ssf_permissions: 'ssf.configuration.tenant.manage' },
])('requires a tenant-bound authorized human subject before exchanging %j', async (overrides) => {
  mocks.session.mockResolvedValue({
    ...(await mocks.session()),
    accessToken: await sign(overrides),
  });
  const res = await readKeys();
  expect(res.status).toBe(403);
  expect(await res.json()).toEqual({ error: { code: 'PERMISSION_REQUIRED' } });
  expect(request).not.toHaveBeenCalled();
});

it.each([
  { kind: 'platform' },
  { instanceId: 'different' },
  { issuer: issuer + '-other' },
  { clientId: 'other-login-client' },
])('prevents exchange when the current client binding no longer matches %j', async (overrides) => {
  mocks.config.mockResolvedValue({ ...(await mocks.config()), ...overrides });
  expect((await readKeys()).status).toBe(403);
  expect(request).not.toHaveBeenCalled();
});

it.each([
  'http://gateway.test',
  'https://user@gateway.test',
  'https://:pass@gateway.test',
  'https://gateway.test/another-base',
  'https://gateway.test/?api=1',
  'https://gateway.test/#else',
])('refuses a Gateway base with credentials or a noncanonical origin %s', async (origin) => {
  vi.stubEnv('SVA_STUDIO_SSF_CONTROL_PLANE_BASE_URL', origin);
  expect((await readKeys()).status).toBe(503);
  expect(request).not.toHaveBeenCalled();
});

it.each([
  ['invalid_token', 401, 'AUTHENTICATION_REQUIRED'],
  ['invalid_grant', 401, 'AUTHENTICATION_REQUIRED'],
  ['invalid_client', 503, 'RECORDING_UNAVAILABLE'],
] as const)(
  'translates OAuth exchange failure %s without sharing details',
  async (error, status, code) => {
    request.mockResolvedValueOnce(
      Response.json({ error, error_description: 'private' }, { status: 400 })
    );
    const res = await readKeys();
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error: { code } });
    expect(request).toHaveBeenCalledTimes(1);
  }
);

it.each([{ issued_token_type: 'refresh' }, { token_type: 'Basic' }, { access_token: null }])(
  'refuses a malformed token response before using its bearer %j',
  async (overrides) => {
    request.mockResolvedValueOnce(
      Response.json({
        issued_token_type: 'urn:ietf:params:oauth:token-type:access_token',
        token_type: 'Bearer',
        access_token: await sign(),
        ...overrides,
      })
    );
    expect((await readKeys()).status).toBe(503);
    expect(request).toHaveBeenCalledTimes(1);
  }
);

it('returns unavailability on a network error during exchange', async () => {
  request.mockRejectedValueOnce(new Error('private transport message'));
  const res = await readKeys();
  expect(res.status).toBe(503);
  expect(await res.json()).toEqual({ error: { code: 'RECORDING_UNAVAILABLE' } });
});

it('forwards the approved method and canonical JSON body on an authenticated mutation', async () => {
  const bearer = await sign({ aud: ['studio', 'ssf-frontend'] });
  mocks.session.mockResolvedValue({ ...(await mocks.session()), accessToken: bearer });
  request
    .mockResolvedValueOnce(
      Response.json({
        issued_token_type: 'urn:ietf:params:oauth:token-type:access_token',
        token_type: 'Bearer',
        access_token: bearer,
      })
    )
    .mockResolvedValueOnce(new Response(null, { status: 201 }));
  const body = JSON.stringify({ expectedActiveKeyId: null, publicKey: 'A'.repeat(87) });
  const result = await gateway.forwardSsfRecordingRequest(
    { ...ctx, handlerId: 'ssf.organisation-keys.prepare' },
    { method: 'POST', path: '/organisation-keys/preparations', body }
  );
  expect(result.status).toBe(201);
  expect(request.mock.calls[1]?.[1]).toMatchObject({
    method: 'POST',
    body,
    headers: { Authorization: 'Bearer ' + bearer, 'Content-Type': 'application/json' },
  });
});

it('redacts an unreadable identity-provider rejection', async () => {
  request.mockResolvedValueOnce(new Response('private provider diagnostic', { status: 502 }));
  const res = await readKeys();
  expect(res.status).toBe(503);
  expect(await res.json()).toEqual({ error: { code: 'RECORDING_UNAVAILABLE' } });
  expect(request).toHaveBeenCalledTimes(1);
});
