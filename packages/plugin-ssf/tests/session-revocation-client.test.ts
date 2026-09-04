import { describe, expect, it, vi } from 'vitest';

import {
  createConfiguredSsfSessionRevocationClient,
  createSsfClientCredentialsTokenProvider,
  createSsfSessionRevocationClient,
  readSsfControlPlaneClientConfig,
  SSF_CONTROL_PLANE_CLIENT_ID,
  SSF_SESSION_REVOCATION_PATH,
  SsfSessionRevocationError,
} from '../src/runtime.js';

const revision = `sha256:${'a'.repeat(64)}`;

describe('SSF session revocation client', () => {
  it('loads only a complete HTTPS deployment configuration', () => {
    expect(readSsfControlPlaneClientConfig({})).toBeNull();
    expect(() =>
      readSsfControlPlaneClientConfig({
        SVA_STUDIO_SSF_CONTROL_PLANE_BASE_URL: 'https://ssf.example.test',
      })
    ).toThrow('ssf_control_plane_configuration_incomplete');

    expect(
      readSsfControlPlaneClientConfig({
        SVA_STUDIO_SSF_CONTROL_PLANE_BASE_URL: 'https://ssf.example.test/',
        SVA_STUDIO_SSF_CONTROL_PLANE_TOKEN_URL:
          'https://keycloak.example.test/realms/ssf/protocol/openid-connect/token',
        SVA_STUDIO_SSF_CONTROL_PLANE_CLIENT_SECRET: 'secret',
      })
    ).toEqual({
      baseUrl: 'https://ssf.example.test',
      tokenUrl: 'https://keycloak.example.test/realms/ssf/protocol/openid-connect/token',
      clientId: SSF_CONTROL_PLANE_CLIENT_ID,
      clientSecret: 'secret',
    });
  });

  it('obtains a client-credentials token with the caller abort signal', async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({ access_token: 'service-token', expires_in: 60 })
    );
    const provider = createSsfClientCredentialsTokenProvider({
      tokenUrl: 'https://keycloak.example.test/realms/ssf/protocol/openid-connect/token',
      clientId: SSF_CONTROL_PLANE_CLIENT_ID,
      clientSecret: 'secret',
      fetchImpl,
    });
    const signal = new AbortController().signal;

    await expect(provider(signal)).resolves.toBe('service-token');
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://keycloak.example.test/realms/ssf/protocol/openid-connect/token',
      expect.objectContaining({
        method: 'POST',
        signal,
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: SSF_CONTROL_PLANE_CLIENT_ID,
          client_secret: 'secret',
        }),
      })
    );
  });

  it('composes token and revocation requests from deployment configuration', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ access_token: 'service-token' }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const client = createConfiguredSsfSessionRevocationClient(
      {
        baseUrl: 'https://ssf.example.test',
        tokenUrl: 'https://keycloak.example.test/realms/ssf/protocol/openid-connect/token',
        clientId: SSF_CONTROL_PLANE_CLIENT_ID,
        clientSecret: 'secret',
      },
      fetchImpl
    );

    await client.revoke({
      instanceId: 'tenant-a',
      authorizationRevision: revision,
      signal: new AbortController().signal,
    });

    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      'https://keycloak.example.test/realms/ssf/protocol/openid-connect/token',
      `https://ssf.example.test${SSF_SESSION_REVOCATION_PATH}`,
    ]);
  });

  it('sends the minimal tenant-bound idempotent consumer contract', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    const getAccessToken = vi.fn(async () => 'service-token');
    const client = createSsfSessionRevocationClient({
      baseUrl: 'https://translate.smart-village.solutions/',
      fetchImpl,
      getAccessToken,
      createCorrelationId: () => 'correlation-1',
    });
    const signal = new AbortController().signal;

    await client.revoke({ instanceId: 'kasseldialog', authorizationRevision: revision, signal });
    await client.revoke({ instanceId: 'kasseldialog', authorizationRevision: revision, signal });

    expect(getAccessToken).toHaveBeenCalledWith(signal);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe(`https://translate.smart-village.solutions${SSF_SESSION_REVOCATION_PATH}`);
    expect(init).toMatchObject({
      method: 'POST',
      signal,
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer service-token',
        'Content-Type': 'application/json',
        'X-Correlation-Id': 'correlation-1',
        'X-Studio-Instance-Id': 'kasseldialog',
      },
      body: JSON.stringify({ authorizationRevision: revision }),
    });
    const firstHeaders = init?.headers as Record<string, string>;
    const secondHeaders = fetchImpl.mock.calls[1]?.[1]?.headers as Record<string, string>;
    expect(firstHeaders['Idempotency-Key']).toMatch(/^ssf-authorization:[0-9a-f]{64}$/u);
    expect(secondHeaders['Idempotency-Key']).toBe(firstHeaders['Idempotency-Key']);
    expect(firstHeaders['Idempotency-Key']).not.toContain('kasseldialog');
  });

  it('keeps requests for two tenants distinct', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    const client = createSsfSessionRevocationClient({
      baseUrl: 'https://ssf.example.test',
      fetchImpl,
      getAccessToken: async () => 'service-token',
      createCorrelationId: () => 'correlation-1',
    });
    const signal = new AbortController().signal;

    await client.revoke({ instanceId: 'tenant-a', authorizationRevision: revision, signal });
    await client.revoke({ instanceId: 'tenant-b', authorizationRevision: revision, signal });

    const firstHeaders = fetchImpl.mock.calls[0]?.[1]?.headers as Record<string, string>;
    const secondHeaders = fetchImpl.mock.calls[1]?.[1]?.headers as Record<string, string>;
    expect(firstHeaders['X-Studio-Instance-Id']).toBe('tenant-a');
    expect(secondHeaders['X-Studio-Instance-Id']).toBe('tenant-b');
    expect(firstHeaders['Idempotency-Key']).not.toBe(secondHeaders['Idempotency-Key']);
  });

  it.each([
    [429, true],
    [500, true],
    [401, false],
    [409, false],
  ] as const)(
    'classifies HTTP %s without reading or logging its body',
    async (status, retryable) => {
      const client = createSsfSessionRevocationClient({
        baseUrl: 'https://ssf.example.test',
        fetchImpl: vi.fn(async () => new Response('sensitive detail', { status })),
        getAccessToken: async () => 'service-token',
      });

      await expect(
        client.revoke({
          instanceId: 'tenant-a',
          authorizationRevision: revision,
          signal: new AbortController().signal,
        })
      ).rejects.toMatchObject<SsfSessionRevocationError>({
        message: `ssf_session_revocation_http_${status}`,
        retryable,
        statusCode: status,
      });
    }
  );

  it('fails before token or network access for invalid tenant or revision input', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    const getAccessToken = vi.fn(async () => 'service-token');
    const client = createSsfSessionRevocationClient({
      baseUrl: 'https://ssf.example.test',
      fetchImpl,
      getAccessToken,
    });
    const signal = new AbortController().signal;

    await expect(
      client.revoke({ instanceId: 'Tenant A', authorizationRevision: revision, signal })
    ).rejects.toThrow('ssf_session_revocation_instance_invalid');
    await expect(
      client.revoke({ instanceId: 'tenant-a', authorizationRevision: 'desired', signal })
    ).rejects.toThrow('ssf_session_revocation_revision_invalid');
    expect(getAccessToken).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('maps token and network failures to bounded retryable errors', async () => {
    const signal = new AbortController().signal;
    const tokenFailure = createSsfSessionRevocationClient({
      baseUrl: 'https://ssf.example.test',
      getAccessToken: async () => {
        throw new Error('secret token detail');
      },
    });
    await expect(
      tokenFailure.revoke({ instanceId: 'tenant-a', authorizationRevision: revision, signal })
    ).rejects.toMatchObject({
      message: 'ssf_session_revocation_token_unavailable',
      retryable: true,
    });

    const networkFailure = createSsfSessionRevocationClient({
      baseUrl: 'https://ssf.example.test',
      getAccessToken: async () => 'service-token',
      fetchImpl: vi.fn(async () => {
        throw new Error('private network detail');
      }),
    });
    await expect(
      networkFailure.revoke({ instanceId: 'tenant-a', authorizationRevision: revision, signal })
    ).rejects.toMatchObject({
      message: 'ssf_session_revocation_network_error',
      retryable: true,
    });
  });

  it('rejects an insecure or credential-bearing base URL', () => {
    const getAccessToken = async () => 'service-token';

    expect(() =>
      createSsfSessionRevocationClient({ baseUrl: 'http://ssf.example.test', getAccessToken })
    ).toThrow('ssf_session_revocation_base_url_invalid');
    expect(() =>
      createSsfSessionRevocationClient({
        baseUrl: 'https://user:password@ssf.example.test',
        getAccessToken,
      })
    ).toThrow('ssf_session_revocation_base_url_invalid');
  });
});
