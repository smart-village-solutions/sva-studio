import { exportJWK, generateKeyPair, SignJWT, createLocalJWKSet } from 'jose';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  binding: vi.fn(),
  enrichRoles: vi.fn(async (user: unknown) => user),
  resolveSessionUser: vi.fn(async (_request: Request, user: unknown) => user),
  getRemoteJwks: vi.fn(),
  lifecycle: vi.fn(async (): Promise<Response | null> => null),
}));

vi.mock('./config-request.js', () => ({ resolvePersonalApiAuthBinding: mocks.binding }));
vi.mock('./effective-session-roles.js', () => ({
  enrichSessionUserWithEffectiveRoles: mocks.enrichRoles,
}));
vi.mock('./middleware-hosts.js', () => ({ resolveSessionUser: mocks.resolveSessionUser }));
vi.mock('./middleware-guards.js', () => ({ ensureAccountLifecycleAllowsAccess: mocks.lifecycle }));
vi.mock('./service-token.js', () => ({
  getRemoteServiceJwks: mocks.getRemoteJwks,
  isServiceIdentityProviderUnavailable: () => false,
}));

describe('personal MCP API token authentication', () => {
  let privateKey: CryptoKey;
  let localJwks: ReturnType<typeof createLocalJWKSet>;
  let authenticate: typeof import('./personal-api-auth.js').authenticatePersonalApiRequest;

  beforeAll(async () => {
    const keys = await generateKeyPair('RS256');
    privateKey = keys.privateKey;
    localJwks = createLocalJWKSet(await exportJWK(keys.publicKey).then((jwk) => ({ keys: [jwk] })));
  });

  beforeEach(async () => {
    vi.resetModules();
    vi.resetAllMocks();
    mocks.binding.mockResolvedValue({
      issuer: 'https://id.example/realms/tenant-a',
      audience: 'sva-studio-login',
      scope: { kind: 'instance', instanceId: 'tenant-a' },
    });
    mocks.getRemoteJwks.mockReturnValue(localJwks);
    mocks.resolveSessionUser.mockImplementation(async (_request, user) => user);
    mocks.enrichRoles.mockImplementation(async (user) => user);
    mocks.lifecycle.mockResolvedValue(null);
    ({ authenticatePersonalApiRequest: authenticate } = await import('./personal-api-auth.js'));
  });

  const signToken = async (
    claims: { azp?: string; aud?: string; iss?: string; sub?: string } = {}
  ) =>
    new SignJWT({ azp: claims.azp ?? 'sva-studio-mcp-personal' })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer(claims.iss ?? 'https://id.example/realms/tenant-a')
      .setAudience(claims.aud ?? 'sva-studio-login')
      .setSubject(claims.sub ?? 'kc-provider-1')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey);

  it('separately binds azp to the personal client and aud to the Studio client', async () => {
    const signed = await signToken();
    const result = await authenticate(
      new Request('https://tenant-a.example/api/v1/iam/users', {
        headers: { authorization: `Bearer ${signed}` },
      })
    );

    expect(result).toMatchObject({
      user: { id: 'kc-provider-1', instanceId: 'tenant-a' },
      expiresAt: expect.any(Number),
    });
    expect(mocks.resolveSessionUser).toHaveBeenCalledWith(
      expect.any(Request),
      expect.objectContaining({ id: 'kc-provider-1', instanceId: 'tenant-a' })
    );
  });

  it('rejects wrong client, audience, issuer, and subject claims', async () => {
    const payloads = [
      { azp: 'sva-studio' },
      { aud: 'sva-studio-mcp-personal' },
      { iss: 'https://id.example/realms/other' },
      { sub: '' },
    ];
    for (const claims of payloads) {
      const signed = await signToken(claims);
      const result = await authenticate(
        new Request('https://tenant-a.example/api/v1/iam/users', {
          headers: { authorization: `Bearer ${signed}` },
        })
      );
      expect(result).toBeInstanceOf(Response);
      expect((result as Response).status).toBe(401);
    }
  });

  it.each([403, 503])(
    'stops before role hydration when the current account check returns %s',
    async (status) => {
      mocks.lifecycle.mockResolvedValue(new Response(null, { status }));
      const result = await authenticate(
        new Request('https://tenant-a.example/api/v1/iam/users', {
          headers: { authorization: `Bearer ${await signToken()}` },
        })
      );
      expect(result).toBeInstanceOf(Response);
      expect((result as Response).status).toBe(status);
      expect(mocks.lifecycle).toHaveBeenCalledWith(
        expect.any(Request),
        expect.objectContaining({
          id: 'kc-provider-1',
          instanceId: 'tenant-a',
        }),
        { requireCurrentAccount: true }
      );
      expect(mocks.enrichRoles).not.toHaveBeenCalled();
    }
  );
});
