import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';

vi.mock('../log-context.js', () => ({
  buildLogContext: () => ({ request_id: 'req-service-token' }),
}));

describe('registry service token authentication', () => {
  afterEach(() => {
    delete process.env.SVA_STUDIO_MCP_ENABLED;
    delete process.env.SVA_STUDIO_MCP_ISSUER;
    delete process.env.SVA_STUDIO_MCP_AUDIENCE;
    delete process.env.SVA_STUDIO_MCP_CLIENT_ID;
  });

  it('accepts the exact platform role, client action and authorized party', async () => {
    process.env.SVA_STUDIO_MCP_ENABLED = 'true';
    process.env.SVA_STUDIO_MCP_ISSUER = 'https://id.example/realms/studio';
    const { authenticateRegistryServiceToken } = await import('./service-token.js');
    const verifier = vi.fn(async () => ({
      sub: 'service-account-mcp',
      azp: 'sva-studio-mcp',
      realm_access: { roles: ['instance_registry_admin'] },
      resource_access: { 'sva-studio-mcp': { roles: ['instance.create'] } },
    }));

    const result = await authenticateRegistryServiceToken('token', 'instance.create', verifier);

    expect(result).toEqual({
      kind: 'authenticated',
      context: {
        authKind: 'keycloak_service',
        actionId: 'instance.create',
        user: { id: 'keycloak-service:service-account-mcp', roles: ['instance_registry_admin'] },
      },
    });
    expect(verifier).toHaveBeenCalledWith('token', {
      issuer: 'https://id.example/realms/studio',
      audience: 'sva-studio-mcp',
      clientId: 'sva-studio-mcp',
    });
  });

  it.each([
    ['invalid_service_token', { sub: 'service', azp: 'other', realm_access: { roles: ['instance_registry_admin'] }, resource_access: { 'sva-studio-mcp': { roles: ['instance.create'] } } }],
    ['missing_platform_role', { sub: 'service', azp: 'sva-studio-mcp', realm_access: { roles: [] }, resource_access: { 'sva-studio-mcp': { roles: ['instance.create'] } } }],
    ['missing_action_scope', { sub: 'service', azp: 'sva-studio-mcp', realm_access: { roles: ['instance_registry_admin'] }, resource_access: { 'sva-studio-mcp': { roles: ['instance.read'] } } }],
  ])('rejects claims with %s', async (expectedCode, payload) => {
    process.env.SVA_STUDIO_MCP_ENABLED = 'true';
    process.env.SVA_STUDIO_MCP_ISSUER = 'https://id.example/realms/studio';
    const { authenticateRegistryServiceToken } = await import('./service-token.js');
    const result = await authenticateRegistryServiceToken('token', 'instance.create', async () => payload);

    expect(result.kind).toBe('response');
    if (result.kind === 'response') {
      expect(result.response.status).toBe(expectedCode === 'invalid_service_token' ? 401 : 403);
      await expect(result.response.json()).resolves.toMatchObject({ error: { code: expectedCode } });
    }
  });

  it('treats a verifier network failure as an unavailable identity provider', async () => {
    process.env.SVA_STUDIO_MCP_ENABLED = 'true';
    process.env.SVA_STUDIO_MCP_ISSUER = 'https://id.example/realms/studio';
    const { authenticateRegistryServiceToken } = await import('./service-token.js');
    const result = await authenticateRegistryServiceToken('token', 'instance.read', async () => {
      throw new TypeError('fetch failed');
    });

    expect(result.kind).toBe('response');
    if (result.kind === 'response') {
      expect(result.response.status).toBe(503);
      await expect(result.response.json()).resolves.toMatchObject({ error: { code: 'identity_provider_unavailable' } });
    }
  });

  it('keeps the service-token path disabled by default', async () => {
    process.env.SVA_STUDIO_MCP_ISSUER = 'https://id.example/realms/studio';
    const { authenticateRegistryServiceToken } = await import('./service-token.js');
    const verifier = vi.fn();

    const result = await authenticateRegistryServiceToken('token', 'instance.read', verifier);

    expect(result.kind).toBe('response');
    expect(verifier).not.toHaveBeenCalled();
    if (result.kind === 'response') {
      expect(result.response.status).toBe(503);
      await expect(result.response.json()).resolves.toMatchObject({
        error: { code: 'identity_provider_unavailable' },
      });
    }
  });

  it('distinguishes an absent Authorization header from a malformed Bearer header', async () => {
    const { readBearerToken } = await import('./service-token.js');
    expect(readBearerToken(new Request('https://studio.example/api'))).toBeUndefined();
    expect(readBearerToken(new Request('https://studio.example/api', { headers: { authorization: 'Basic abc' } }))).toBeNull();
    expect(readBearerToken(new Request('https://studio.example/api', { headers: { authorization: 'Bearer abc' } }))).toBe('abc');
  });

  it.each([
    ['issuer', { issuer: 'https://id.example/realms/other', audience: 'sva-studio-mcp', expiresIn: 60 }],
    ['audience', { issuer: 'https://id.example/realms/studio', audience: 'other', expiresIn: 60 }],
    ['expiry', { issuer: 'https://id.example/realms/studio', audience: 'sva-studio-mcp', expiresIn: -60 }],
  ])('rejects a JWT with invalid %s before claim authorization', async (_reason, claims) => {
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const publicJwk = await exportJWK(publicKey);
    const token = await new SignJWT({ sub: 'service', azp: 'sva-studio-mcp' })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuer(claims.issuer)
      .setAudience(claims.audience)
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) + claims.expiresIn)
      .sign(privateKey);
    const { verifyRegistryServiceJwt } = await import('./service-token.js');

    await expect(
      verifyRegistryServiceJwt(
        token,
        {
          issuer: 'https://id.example/realms/studio',
          audience: 'sva-studio-mcp',
          clientId: 'sva-studio-mcp',
        },
        createLocalJWKSet({ keys: [{ ...publicJwk, kid: 'test-key', alg: 'RS256', use: 'sig' }] })
      )
    ).rejects.toBeInstanceOf(Error);
  });

  it('rejects invalid signatures, algorithms, future nbf values and unknown key ids', async () => {
    const trusted = await generateKeyPair('RS256');
    const untrusted = await generateKeyPair('RS256');
    const publicJwk = await exportJWK(trusted.publicKey);
    const keySet = createLocalJWKSet({ keys: [{ ...publicJwk, kid: 'trusted', alg: 'RS256', use: 'sig' }] });
    const config = {
      issuer: 'https://id.example/realms/studio',
      audience: 'sva-studio-mcp',
      clientId: 'sva-studio-mcp',
    } as const;
    const build = (privateKey: Parameters<SignJWT['sign']>[0], kid: string, notBefore?: number) => {
      let jwt = new SignJWT({ sub: 'service', azp: 'sva-studio-mcp' })
        .setProtectedHeader({ alg: 'RS256', kid })
        .setIssuer(config.issuer)
        .setAudience(config.audience)
        .setIssuedAt()
        .setExpirationTime('5m');
      if (notBefore !== undefined) jwt = jwt.setNotBefore(notBefore);
      return jwt.sign(privateKey);
    };
    const { verifyRegistryServiceJwt } = await import('./service-token.js');

    const [invalidSignature, unknownKid, futureNbf] = await Promise.all([
      build(untrusted.privateKey, 'trusted'),
      build(trusted.privateKey, 'unknown'),
      build(trusted.privateKey, 'trusted', Math.floor(Date.now() / 1000) + 300),
    ]);
    for (const token of [invalidSignature, unknownKid, futureNbf]) {
      await expect(verifyRegistryServiceJwt(token, config, keySet)).rejects.toBeInstanceOf(Error);
    }

    const hmacKey = new TextEncoder().encode('a-secure-test-key-with-at-least-32-bytes');
    const invalidAlgorithm = await new SignJWT({ sub: 'service' })
      .setProtectedHeader({ alg: 'HS256', kid: 'trusted' })
      .setIssuer(config.issuer)
      .setAudience(config.audience)
      .setExpirationTime('5m')
      .sign(hmacKey);
    await expect(verifyRegistryServiceJwt(invalidAlgorithm, config, keySet)).rejects.toBeInstanceOf(Error);
  });

  it('requires an explicit expiration claim', async () => {
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const publicJwk = await exportJWK(publicKey);
    const token = await new SignJWT({ sub: 'service', azp: 'sva-studio-mcp' })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuer('https://id.example/realms/studio')
      .setAudience('sva-studio-mcp')
      .setIssuedAt()
      .sign(privateKey);
    const { verifyRegistryServiceJwt } = await import('./service-token.js');
    await expect(verifyRegistryServiceJwt(token, {
      issuer: 'https://id.example/realms/studio',
      audience: 'sva-studio-mcp',
      clientId: 'sva-studio-mcp',
    }, createLocalJWKSet({ keys: [{ ...publicJwk, kid: 'test-key', alg: 'RS256', use: 'sig' }] })))
      .rejects.toThrow('service_token_exp_required');
  });
});
