import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  discoveryImpl: vi.fn(),
  loggerError: vi.fn(),
  workspaceContext: {
    workspaceId: 'ws-test',
    requestId: 'req-test',
    traceId: 'trace-test',
  },
}));

vi.mock('openid-client', () => ({
  discovery: (...args: unknown[]) => state.discoveryImpl(...args),
}));

vi.mock('./config', () => ({
  getAuthConfig: () => ({
    issuer: 'https://issuer.example.com/realms/test',
    clientId: 'client-id',
    clientSecret: 'client-secret',
  }),
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: state.loggerError,
  }),
  getWorkspaceContext: () => state.workspaceContext,
}));

describe('oidc.server getOidcConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    state.discoveryImpl.mockReset();
  });

  it('caches the discovered OIDC configuration', async () => {
    const discoveredConfig = { issuer: 'issuer-config' } as unknown;
    state.discoveryImpl.mockResolvedValue(discoveredConfig);

    const { getOidcConfig } = await import('./oidc.server');
    const first = await getOidcConfig();
    const second = await getOidcConfig();

    expect(first).toBe(discoveredConfig);
    expect(second).toBe(discoveredConfig);
    expect(state.discoveryImpl).toHaveBeenCalledTimes(1);
  });

  it('resets cache and logs when discovery fails, then allows retry', async () => {
    const discoveryError = new Error('discovery failed');
    const discoveredConfig = { issuer: 'issuer-config-retry' } as unknown;

    state.discoveryImpl
      .mockRejectedValueOnce(discoveryError)
      .mockResolvedValueOnce(discoveredConfig);

    const { getOidcConfig } = await import('./oidc.server');

    await expect(getOidcConfig()).rejects.toThrow('discovery failed');
    const retry = await getOidcConfig();

    expect(retry).toBe(discoveredConfig);
    expect(state.discoveryImpl).toHaveBeenCalledTimes(2);
    expect(state.loggerError).toHaveBeenCalledWith(
      'OIDC discovery failed',
      expect.objectContaining({
        operation: 'oidc_discovery',
        issuer: 'https://issuer.example.com/realms/test',
        workspace_id: 'ws-test',
        request_id: 'req-test',
        trace_id: 'trace-test',
      })
    );
  });

  it('separates cached OIDC discovery results by issuer and client id', async () => {
    const configA = { issuer: 'issuer-a' } as unknown;
    const configB = { issuer: 'issuer-b' } as unknown;
    state.discoveryImpl.mockResolvedValueOnce(configA).mockResolvedValueOnce(configB);

    const { getOidcConfig } = await import('./oidc.server');

    const first = await getOidcConfig({
      issuer: 'https://issuer.example.com/realms/a',
      clientId: 'client-a',
      clientSecret: 'secret-a',
    });
    const second = await getOidcConfig({
      issuer: 'https://issuer.example.com/realms/b',
      clientId: 'client-b',
      clientSecret: 'secret-b',
    });
    const repeat = await getOidcConfig({
      issuer: 'https://issuer.example.com/realms/a',
      clientId: 'client-a',
      clientSecret: 'secret-a',
    });

    expect(first).toBe(configA);
    expect(second).toBe(configB);
    expect(repeat).toBe(configA);
    expect(state.discoveryImpl).toHaveBeenCalledTimes(2);
  });

  it('separates cached OIDC discovery results by client secret changes', async () => {
    const configA = { issuer: 'issuer-a' } as unknown;
    const configB = { issuer: 'issuer-a-refreshed' } as unknown;
    state.discoveryImpl.mockResolvedValueOnce(configA).mockResolvedValueOnce(configB);

    const { getOidcConfig } = await import('./oidc.server');

    const first = await getOidcConfig({
      issuer: 'https://issuer.example.com/realms/a',
      clientId: 'client-a',
      clientSecret: 'secret-a',
    });
    const second = await getOidcConfig({
      issuer: 'https://issuer.example.com/realms/a',
      clientId: 'client-a',
      clientSecret: 'secret-b',
    });

    expect(first).toBe(configA);
    expect(second).toBe(configB);
    expect(state.discoveryImpl).toHaveBeenCalledTimes(2);
  });

  it('invalidates cached discovery results explicitly', async () => {
    const configA = { issuer: 'issuer-a' } as unknown;
    const configB = { issuer: 'issuer-a-fresh' } as unknown;
    state.discoveryImpl.mockResolvedValueOnce(configA).mockResolvedValueOnce(configB);

    const { getOidcConfig, invalidateOidcConfig } = await import('./oidc.server');
    const authConfig = {
      issuer: 'https://issuer.example.com/realms/a',
      clientId: 'client-a',
      clientSecret: 'secret-a',
    };

    const first = await getOidcConfig(authConfig);
    invalidateOidcConfig(authConfig);
    const second = await getOidcConfig(authConfig);

    expect(first).toBe(configA);
    expect(second).toBe(configB);
    expect(state.discoveryImpl).toHaveBeenCalledTimes(2);
  });

  it('evicts the oldest cached oidc configuration once the cache limit is exceeded', async () => {
    state.discoveryImpl.mockImplementation(async (_issuer: URL, clientId: string) => ({ clientId }) as unknown);

    const { getOidcConfig } = await import('./oidc.server');

    for (let index = 0; index <= 32; index += 1) {
      await getOidcConfig({
        issuer: `https://issuer.example.com/realms/${index}`,
        clientId: `client-${index}`,
        clientSecret: `secret-${index}`,
      });
    }

    await getOidcConfig({
      issuer: 'https://issuer.example.com/realms/0',
      clientId: 'client-0',
      clientSecret: 'secret-0',
    });

    expect(state.discoveryImpl).toHaveBeenCalledTimes(34);
  });
});
