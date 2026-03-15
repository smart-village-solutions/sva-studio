import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  loadInstanceIntegrationRecord: vi.fn(),
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@sva/data/server', () => ({
  loadInstanceIntegrationRecord: state.loadInstanceIntegrationRecord,
}));

vi.mock('@sva/sdk/server', () => ({
  createSdkLogger: () => state.logger,
  getWorkspaceContext: () => ({
    requestId: 'req-mainserver',
    traceId: 'trace-mainserver',
  }),
}));

describe('loadSvaMainserverInstanceConfig', () => {
  beforeEach(() => {
    state.loadInstanceIntegrationRecord.mockReset();
    state.logger.debug.mockReset();
    state.logger.info.mockReset();
    state.logger.warn.mockReset();
    state.logger.error.mockReset();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('loads enabled https configuration from the data layer', async () => {
    state.loadInstanceIntegrationRecord.mockResolvedValue({
      instanceId: 'de-musterhausen',
      providerKey: 'sva_mainserver',
      graphqlBaseUrl: 'https://mainserver.example.invalid/graphql',
      oauthTokenUrl: 'https://mainserver.example.invalid/oauth/token',
      enabled: true,
      lastVerifiedAt: '2026-03-15T10:00:00.000Z',
      lastVerifiedStatus: 'ok',
    });

    const { loadSvaMainserverInstanceConfig } = await import('./config-store');

    await expect(loadSvaMainserverInstanceConfig('de-musterhausen')).resolves.toMatchObject({
      instanceId: 'de-musterhausen',
      graphqlBaseUrl: 'https://mainserver.example.invalid/graphql',
      oauthTokenUrl: 'https://mainserver.example.invalid/oauth/token',
      enabled: true,
    });
  });

  it('rejects invalid non-https upstream URLs', async () => {
    state.loadInstanceIntegrationRecord.mockResolvedValue({
      instanceId: 'de-musterhausen',
      providerKey: 'sva_mainserver',
      graphqlBaseUrl: 'http://mainserver.example.invalid/graphql',
      oauthTokenUrl: 'https://mainserver.example.invalid/oauth/token',
      enabled: true,
    });

    const { loadSvaMainserverInstanceConfig } = await import('./config-store');

    await expect(loadSvaMainserverInstanceConfig('de-musterhausen')).rejects.toMatchObject({
      code: 'invalid_config',
    });
    expect(state.logger.warn).toHaveBeenCalledWith(
      'Invalid SVA Mainserver upstream URL configuration detected',
      expect.objectContaining({
        workspace_id: 'de-musterhausen',
        field_name: 'graphql_base_url',
        error_code: 'invalid_config',
      })
    );
  });

  it('rejects private and local upstream hosts even with https', async () => {
    state.loadInstanceIntegrationRecord.mockResolvedValue({
      instanceId: 'de-musterhausen',
      providerKey: 'sva_mainserver',
      graphqlBaseUrl: 'https://127.0.0.1/graphql',
      oauthTokenUrl: 'https://mainserver.example.invalid/oauth/token',
      enabled: true,
    });

    const { loadSvaMainserverInstanceConfig } = await import('./config-store');

    await expect(loadSvaMainserverInstanceConfig('de-musterhausen')).rejects.toMatchObject({
      code: 'invalid_config',
    });
  });

  it('rejects https localhost upstream URLs', async () => {
    state.loadInstanceIntegrationRecord.mockResolvedValue({
      instanceId: 'de-musterhausen',
      providerKey: 'sva_mainserver',
      graphqlBaseUrl: 'https://localhost/graphql',
      oauthTokenUrl: 'https://mainserver.example.invalid/oauth/token',
      enabled: true,
    });

    const { loadSvaMainserverInstanceConfig } = await import('./config-store');

    await expect(loadSvaMainserverInstanceConfig('de-musterhausen')).rejects.toMatchObject({
      code: 'invalid_config',
    });
  });

  it('rejects RFC1918 and link-local hosts in upstream URLs', async () => {
    state.loadInstanceIntegrationRecord.mockResolvedValue({
      instanceId: 'de-musterhausen',
      providerKey: 'sva_mainserver',
      graphqlBaseUrl: 'https://10.1.2.3/graphql',
      oauthTokenUrl: 'https://fe80::1/oauth/token',
      enabled: true,
    });

    const { loadSvaMainserverInstanceConfig } = await import('./config-store');

    await expect(loadSvaMainserverInstanceConfig('de-musterhausen')).rejects.toMatchObject({
      code: 'invalid_config',
    });
  });

  it('rejects IPv4-mapped IPv6 addresses as SSRF targets', async () => {
    state.loadInstanceIntegrationRecord.mockResolvedValue({
      instanceId: 'de-musterhausen',
      providerKey: 'sva_mainserver',
      graphqlBaseUrl: 'https://[::ffff:127.0.0.1]/graphql',
      oauthTokenUrl: 'https://mainserver.example.invalid/oauth/token',
      enabled: true,
    });

    const { loadSvaMainserverInstanceConfig } = await import('./config-store');

    await expect(loadSvaMainserverInstanceConfig('de-musterhausen')).rejects.toMatchObject({
      code: 'invalid_config',
    });
  });

  it('allows public IPv4-mapped IPv6 hosts', async () => {
    state.loadInstanceIntegrationRecord.mockResolvedValue({
      instanceId: 'de-musterhausen',
      providerKey: 'sva_mainserver',
      graphqlBaseUrl: 'https://[::ffff:8.8.8.8]/graphql',
      oauthTokenUrl: 'https://mainserver.example.invalid/oauth/token',
      enabled: true,
      lastVerifiedAt: '2026-03-15T10:00:00.000Z',
      lastVerifiedStatus: 'ok',
    });

    const { loadSvaMainserverInstanceConfig } = await import('./config-store');

    await expect(loadSvaMainserverInstanceConfig('de-musterhausen')).resolves.toMatchObject({
      instanceId: 'de-musterhausen',
      enabled: true,
    });
  });

  it('rejects malformed IPv4-mapped IPv6 hosts conservatively', async () => {
    state.loadInstanceIntegrationRecord.mockResolvedValue({
      instanceId: 'de-musterhausen',
      providerKey: 'sva_mainserver',
      graphqlBaseUrl: 'https://[::ffff:7f00:1:2]/graphql',
      oauthTokenUrl: 'https://mainserver.example.invalid/oauth/token',
      enabled: true,
    });

    const { loadSvaMainserverInstanceConfig } = await import('./config-store');

    await expect(loadSvaMainserverInstanceConfig('de-musterhausen')).rejects.toMatchObject({
      code: 'invalid_config',
    });
  });

  it('maps unexpected data-layer failures to database_unavailable', async () => {
    state.loadInstanceIntegrationRecord.mockRejectedValue(new Error('db offline'));

    const { loadSvaMainserverInstanceConfig } = await import('./config-store');

    await expect(loadSvaMainserverInstanceConfig('de-musterhausen')).rejects.toMatchObject({
      code: 'database_unavailable',
    });
    expect(state.logger.error).toHaveBeenCalledWith(
      'SVA Mainserver instance config load hit a database error',
      expect.objectContaining({
        workspace_id: 'de-musterhausen',
        error_code: 'database_unavailable',
      })
    );
  });
});
