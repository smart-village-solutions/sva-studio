import { afterEach, describe, expect, it, vi } from 'vitest';

import { dispatchInstanceProvisionerRequest } from './instance-provisioner-proxy.server';

describe('instance provisioner proxy', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('does not intercept requests when the internal provisioner target is not configured', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await dispatchInstanceProvisionerRequest(
      new Request('https://studio.example.test/api/v1/iam/instances/draft-readiness', {
        method: 'POST',
      })
    );

    expect(response).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['POST', '/api/v1/iam/instances'],
    ['POST', '/api/v1/iam/instances/draft-readiness'],
    ['GET', '/api/v1/iam/instances/keycloak-realms'],
  ])('forwards the allowlisted %s %s request to the private provisioner', async (method, path) => {
    vi.stubEnv('SVA_INSTANCE_PROVISIONER_INTERNAL_BASE_URL', 'http://provisioner:3000');
    const upstreamResponse = new Response(JSON.stringify({ data: { ready: true } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
    const fetchMock = vi.fn().mockResolvedValue(upstreamResponse);
    vi.stubGlobal('fetch', fetchMock);
    const body = method === 'POST' ? JSON.stringify({ instanceId: 'tenant-one' }) : undefined;
    const headers = new Headers({
      authorization: 'Bearer token-one',
      'content-type': 'application/json',
      origin: 'https://studio.example.test',
      'x-requested-with': 'XMLHttpRequest',
    });
    headers.set('cookie', 'sva_auth_session=session-one');
    const request = new Request(`https://studio.example.test${path}?trace=one`, {
      method,
      headers,
      body,
    });

    const response = await dispatchInstanceProvisionerRequest(request);

    expect(response).toBe(upstreamResponse);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [forwardedUrl, forwardedInit] = fetchMock.mock.calls[0] as [URL, RequestInit];
    const forwardedHeaders = forwardedInit.headers as Headers;
    expect(forwardedUrl.toString()).toBe(`http://provisioner:3000${path}?trace=one`);
    expect(forwardedInit.method).toBe(method);
    expect(forwardedHeaders.get('authorization')).toBe('Bearer token-one');
    expect(forwardedHeaders.get('x-forwarded-host')).toBe('studio.example.test');
    expect(forwardedHeaders.get('x-forwarded-proto')).toBe('https');
    if (body) {
      expect(new TextDecoder().decode(forwardedInit.body as ArrayBuffer)).toBe(body);
    }
  });

  it('forwards the browser session cookie for revalidation in the provisioner', async () => {
    vi.stubEnv('SVA_INSTANCE_PROVISIONER_INTERNAL_BASE_URL', 'http://provisioner:3000');
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    const request = {
      url: 'https://studio.example.test/api/v1/iam/instances/draft-readiness',
      method: 'POST',
      headers: {
        forEach: (callback: (value: string, key: string) => void) => {
          callback('sva_auth_session=session-one', 'cookie');
          callback('https://studio.example.test', 'origin');
          callback('XMLHttpRequest', 'x-requested-with');
        },
      },
      arrayBuffer: async () => new ArrayBuffer(0),
    } as unknown as Request;

    await dispatchInstanceProvisionerRequest(request);

    const forwardedInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const forwardedHeaders = forwardedInit.headers as Headers;
    expect(forwardedHeaders.get('cookie')).toBe('sva_auth_session=session-one');
    expect(forwardedHeaders.get('origin')).toBe('https://studio.example.test');
    expect(forwardedHeaders.get('x-requested-with')).toBe('XMLHttpRequest');
  });

  it.each([
    ['GET', '/api/v1/iam/instances'],
    ['GET', '/api/v1/iam/instances/draft-readiness'],
    ['POST', '/api/v1/iam/instances/keycloak-realms'],
    ['POST', '/api/v1/iam/instances/tenant-one/keycloak/execute'],
  ])('does not forward non-allowlisted %s %s requests', async (method, path) => {
    vi.stubEnv('SVA_INSTANCE_PROVISIONER_INTERNAL_BASE_URL', 'http://provisioner:3000');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await dispatchInstanceProvisionerRequest(
      new Request(`https://studio.example.test${path}`, { method })
    );

    expect(response).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails closed when the configured target is not the private provisioner service', async () => {
    vi.stubEnv('SVA_INSTANCE_PROVISIONER_INTERNAL_BASE_URL', 'https://attacker.example.test');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await dispatchInstanceProvisionerRequest(
      new Request('https://studio.example.test/api/v1/iam/instances/keycloak-realms')
    );

    expect(response?.status).toBe(503);
    await expect(response?.json()).resolves.toMatchObject({
      error: { code: 'instance_provisioner_unavailable' },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns a controlled response when the private provisioner cannot be reached', async () => {
    vi.stubEnv('SVA_INSTANCE_PROVISIONER_INTERNAL_BASE_URL', 'http://provisioner:3000');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection detail')));

    const response = await dispatchInstanceProvisionerRequest(
      new Request('https://studio.example.test/api/v1/iam/instances/draft-readiness', {
        method: 'POST',
      })
    );

    expect(response?.status).toBe(503);
    await expect(response?.json()).resolves.toEqual({
      error: {
        code: 'instance_provisioner_unavailable',
        message: 'Der interne Provisioning-Dienst ist derzeit nicht erreichbar.',
      },
    });
  });
});
