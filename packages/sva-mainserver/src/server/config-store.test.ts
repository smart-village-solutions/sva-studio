import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  loadDefaultExternalInterfaceRecord: vi.fn(),
  dnsLookup: vi.fn(async () => [{ address: '8.8.8.8', family: 4 }]),
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@sva/data-repositories/server', () => ({
  loadDefaultExternalInterfaceRecord: state.loadDefaultExternalInterfaceRecord,
}));

vi.mock('node:dns/promises', () => ({
  lookup: state.dnsLookup,
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => state.logger,
  getWorkspaceContext: () => ({
    requestId: 'req-mainserver',
    traceId: 'trace-mainserver',
  }),
}));

describe('loadSvaMainserverInstanceConfig', () => {
  beforeEach(() => {
    state.loadDefaultExternalInterfaceRecord.mockReset();
    state.dnsLookup.mockReset();
    state.dnsLookup.mockResolvedValue([{ address: '8.8.8.8', family: 4 }]);
    state.logger.debug.mockReset();
    state.logger.info.mockReset();
    state.logger.warn.mockReset();
    state.logger.error.mockReset();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('loads enabled https configuration from the data layer', async () => {
    state.loadDefaultExternalInterfaceRecord.mockResolvedValue({
      id: 'sva-mainserver:de-musterhausen',
      instanceId: 'de-musterhausen',
      typeKey: 'sva_mainserver',
      ownerKind: 'host',
      ownerId: 'host',
      displayName: 'SVA Mainserver',
      alias: 'default',
      enabled: true,
      isDefault: true,
      category: 'api',
      baseUrl: 'https://mainserver.example.invalid/graphql',
      authMode: 'oauth2',
      publicConfig: {
        graphqlBaseUrl: 'https://mainserver.example.invalid/graphql',
        oauthTokenUrl: 'https://mainserver.example.invalid/oauth/token',
      },
      statusCheckKind: 'sva_mainserver',
      visibleStatus: 'ok',
      lastCheckedAt: '2026-03-15T10:00:00.000Z',
    });

    const { loadSvaMainserverInstanceConfig } = await import('./config-store');

    await expect(loadSvaMainserverInstanceConfig('de-musterhausen')).resolves.toMatchObject({
      instanceId: 'de-musterhausen',
      graphqlBaseUrl: 'https://mainserver.example.invalid/graphql',
      oauthTokenUrl: 'https://mainserver.example.invalid/oauth/token',
      enabled: true,
    });
  });

  it('maps unknown visible status to an undefined legacy verification status', async () => {
    state.loadDefaultExternalInterfaceRecord.mockResolvedValue({
      id: 'sva-mainserver:de-musterhausen',
      instanceId: 'de-musterhausen',
      typeKey: 'sva_mainserver',
      ownerKind: 'host',
      ownerId: 'host',
      displayName: 'SVA Mainserver',
      alias: 'default',
      enabled: true,
      isDefault: true,
      category: 'api',
      baseUrl: 'https://mainserver.example.invalid/graphql',
      authMode: 'oauth2',
      publicConfig: {
        graphqlBaseUrl: 'https://mainserver.example.invalid/graphql',
        oauthTokenUrl: 'https://mainserver.example.invalid/oauth/token',
      },
      statusCheckKind: 'sva_mainserver',
      visibleStatus: 'unknown',
      lastCheckedAt: '2026-03-15T10:00:00.000Z',
    });

    const { loadSvaMainserverInstanceConfig } = await import('./config-store');

    await expect(loadSvaMainserverInstanceConfig('de-musterhausen')).resolves.toMatchObject({
      lastVerifiedAt: '2026-03-15T10:00:00.000Z',
      lastVerifiedStatus: undefined,
    });
  });

  it('rejects invalid non-https upstream URLs', async () => {
    state.loadDefaultExternalInterfaceRecord.mockResolvedValue({
      id: 'sva-mainserver:de-musterhausen',
      instanceId: 'de-musterhausen',
      typeKey: 'sva_mainserver',
      ownerKind: 'host',
      ownerId: 'host',
      displayName: 'SVA Mainserver',
      alias: 'default',
      enabled: true,
      isDefault: true,
      category: 'api',
      publicConfig: {
        graphqlBaseUrl: 'http://mainserver.example.invalid/graphql',
        oauthTokenUrl: 'https://mainserver.example.invalid/oauth/token',
      },
      statusCheckKind: 'sva_mainserver',
      visibleStatus: 'unknown',
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
    state.loadDefaultExternalInterfaceRecord.mockResolvedValue({
      id: 'sva-mainserver:de-musterhausen',
      instanceId: 'de-musterhausen',
      typeKey: 'sva_mainserver',
      ownerKind: 'host',
      ownerId: 'host',
      displayName: 'SVA Mainserver',
      alias: 'default',
      enabled: true,
      isDefault: true,
      category: 'api',
      publicConfig: {
        graphqlBaseUrl: 'https://127.0.0.1/graphql',
        oauthTokenUrl: 'https://mainserver.example.invalid/oauth/token',
      },
      statusCheckKind: 'sva_mainserver',
      visibleStatus: 'unknown',
    });

    const { loadSvaMainserverInstanceConfig } = await import('./config-store');

    await expect(loadSvaMainserverInstanceConfig('de-musterhausen')).rejects.toMatchObject({
      code: 'invalid_config',
    });
  });

  it('rejects https localhost upstream URLs', async () => {
    state.loadDefaultExternalInterfaceRecord.mockResolvedValue({
      id: 'sva-mainserver:de-musterhausen',
      instanceId: 'de-musterhausen',
      typeKey: 'sva_mainserver',
      ownerKind: 'host',
      ownerId: 'host',
      displayName: 'SVA Mainserver',
      alias: 'default',
      enabled: true,
      isDefault: true,
      category: 'api',
      publicConfig: {
        graphqlBaseUrl: 'https://localhost/graphql',
        oauthTokenUrl: 'https://mainserver.example.invalid/oauth/token',
      },
      statusCheckKind: 'sva_mainserver',
      visibleStatus: 'unknown',
    });

    const { loadSvaMainserverInstanceConfig } = await import('./config-store');

    await expect(loadSvaMainserverInstanceConfig('de-musterhausen')).rejects.toMatchObject({
      code: 'invalid_config',
    });
  });

  it('rejects RFC1918 and link-local hosts in upstream URLs', async () => {
    state.loadDefaultExternalInterfaceRecord.mockResolvedValue({
      id: 'sva-mainserver:de-musterhausen',
      instanceId: 'de-musterhausen',
      typeKey: 'sva_mainserver',
      ownerKind: 'host',
      ownerId: 'host',
      displayName: 'SVA Mainserver',
      alias: 'default',
      enabled: true,
      isDefault: true,
      category: 'api',
      publicConfig: {
        graphqlBaseUrl: 'https://10.1.2.3/graphql',
        oauthTokenUrl: 'https://fe80::1/oauth/token',
      },
      statusCheckKind: 'sva_mainserver',
      visibleStatus: 'unknown',
    });

    const { loadSvaMainserverInstanceConfig } = await import('./config-store');

    await expect(loadSvaMainserverInstanceConfig('de-musterhausen')).rejects.toMatchObject({
      code: 'invalid_config',
    });
  });

  it('rejects IPv4-mapped IPv6 addresses as SSRF targets', async () => {
    state.loadDefaultExternalInterfaceRecord.mockResolvedValue({
      id: 'sva-mainserver:de-musterhausen',
      instanceId: 'de-musterhausen',
      typeKey: 'sva_mainserver',
      ownerKind: 'host',
      ownerId: 'host',
      displayName: 'SVA Mainserver',
      alias: 'default',
      enabled: true,
      isDefault: true,
      category: 'api',
      publicConfig: {
        graphqlBaseUrl: 'https://[::ffff:127.0.0.1]/graphql',
        oauthTokenUrl: 'https://mainserver.example.invalid/oauth/token',
      },
      statusCheckKind: 'sva_mainserver',
      visibleStatus: 'unknown',
    });

    const { loadSvaMainserverInstanceConfig } = await import('./config-store');

    await expect(loadSvaMainserverInstanceConfig('de-musterhausen')).rejects.toMatchObject({
      code: 'invalid_config',
    });
  });

  it('allows public IPv4-mapped IPv6 hosts', async () => {
    state.loadDefaultExternalInterfaceRecord.mockResolvedValue({
      id: 'sva-mainserver:de-musterhausen',
      instanceId: 'de-musterhausen',
      typeKey: 'sva_mainserver',
      ownerKind: 'host',
      ownerId: 'host',
      displayName: 'SVA Mainserver',
      alias: 'default',
      enabled: true,
      isDefault: true,
      category: 'api',
      publicConfig: {
        graphqlBaseUrl: 'https://[::ffff:8.8.8.8]/graphql',
        oauthTokenUrl: 'https://mainserver.example.invalid/oauth/token',
      },
      statusCheckKind: 'sva_mainserver',
      visibleStatus: 'ok',
      lastCheckedAt: '2026-03-15T10:00:00.000Z',
    });

    const { loadSvaMainserverInstanceConfig } = await import('./config-store');

    await expect(loadSvaMainserverInstanceConfig('de-musterhausen')).resolves.toMatchObject({
      instanceId: 'de-musterhausen',
      enabled: true,
    });
  });

  it('rejects malformed IPv4-mapped IPv6 hosts conservatively', async () => {
    state.loadDefaultExternalInterfaceRecord.mockResolvedValue({
      id: 'sva-mainserver:de-musterhausen',
      instanceId: 'de-musterhausen',
      typeKey: 'sva_mainserver',
      ownerKind: 'host',
      ownerId: 'host',
      displayName: 'SVA Mainserver',
      alias: 'default',
      enabled: true,
      isDefault: true,
      category: 'api',
      publicConfig: {
        graphqlBaseUrl: 'https://[::ffff:7f00:1:2]/graphql',
        oauthTokenUrl: 'https://mainserver.example.invalid/oauth/token',
      },
      statusCheckKind: 'sva_mainserver',
      visibleStatus: 'unknown',
    });

    const { loadSvaMainserverInstanceConfig } = await import('./config-store');

    await expect(loadSvaMainserverInstanceConfig('de-musterhausen')).rejects.toMatchObject({
      code: 'invalid_config',
    });
  });

  it('maps unexpected data-layer failures to database_unavailable', async () => {
    state.loadDefaultExternalInterfaceRecord.mockRejectedValue(new Error('db offline'));

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

  it('rejects upstream hosts that resolve to private addresses via DNS', async () => {
    state.loadDefaultExternalInterfaceRecord.mockResolvedValue({
      id: 'sva-mainserver:de-musterhausen',
      instanceId: 'de-musterhausen',
      typeKey: 'sva_mainserver',
      ownerKind: 'host',
      ownerId: 'host',
      displayName: 'SVA Mainserver',
      alias: 'default',
      enabled: true,
      isDefault: true,
      category: 'api',
      publicConfig: {
        graphqlBaseUrl: 'https://public.example.invalid/graphql',
        oauthTokenUrl: 'https://mainserver.example.invalid/oauth/token',
      },
      statusCheckKind: 'sva_mainserver',
      visibleStatus: 'unknown',
    });
    state.dnsLookup.mockResolvedValueOnce([{ address: '127.0.0.1', family: 4 }]);

    const { loadSvaMainserverInstanceConfig } = await import('./config-store');

    await expect(loadSvaMainserverInstanceConfig('de-musterhausen')).rejects.toMatchObject({
      code: 'invalid_config',
    });
  });
});
