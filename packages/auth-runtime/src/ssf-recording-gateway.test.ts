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
  const [url, init] = request.mock.calls[0]!;
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
