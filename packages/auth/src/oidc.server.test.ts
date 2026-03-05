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

vi.mock('@sva/sdk/server', () => ({
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
});
