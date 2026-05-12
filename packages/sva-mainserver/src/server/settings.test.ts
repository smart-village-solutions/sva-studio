import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  loadDefaultExternalInterfaceRecord: vi.fn(),
  saveExternalInterfaceRecord: vi.fn(),
  dnsLookup: vi.fn(async () => [{ address: '203.0.113.10', family: 4 }]),
}));

vi.mock('@sva/data-repositories/server', () => ({
  loadDefaultExternalInterfaceRecord: state.loadDefaultExternalInterfaceRecord,
  saveExternalInterfaceRecord: state.saveExternalInterfaceRecord,
}));

vi.mock('node:dns/promises', () => ({
  lookup: state.dnsLookup,
}));

describe('settings', () => {
  beforeEach(() => {
    state.loadDefaultExternalInterfaceRecord.mockReset();
    state.saveExternalInterfaceRecord.mockReset();
    state.dnsLookup.mockReset();
    state.dnsLookup.mockResolvedValue([{ address: '203.0.113.10', family: 4 }]);
  });

  it('loads settings when integration record exists', async () => {
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
      baseUrl: 'https://mainserver.example/graphql',
      authMode: 'oauth2',
      publicConfig: {
        graphqlBaseUrl: 'https://mainserver.example/graphql',
        oauthTokenUrl: 'https://mainserver.example/oauth/token',
      },
      statusCheckKind: 'sva_mainserver',
      visibleStatus: 'ok',
      lastCheckedAt: '2026-03-15T10:00:00.000Z',
    });

    const { loadSvaMainserverSettings } = await import('./settings');

    await expect(loadSvaMainserverSettings('de-musterhausen')).resolves.toMatchObject({
      instanceId: 'de-musterhausen',
      providerKey: 'sva_mainserver',
      enabled: true,
      lastVerifiedStatus: 'ok',
    });
  });

  it('returns null when no integration record exists', async () => {
    state.loadDefaultExternalInterfaceRecord.mockResolvedValue(null);

    const { loadSvaMainserverSettings } = await import('./settings');

    await expect(loadSvaMainserverSettings('de-musterhausen')).resolves.toBeNull();
  });

  it('saves normalized settings and preserves verification metadata', async () => {
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
      baseUrl: 'https://old.example.invalid/graphql',
      authMode: 'oauth2',
      publicConfig: {
        graphqlBaseUrl: 'https://old.example.invalid/graphql',
        oauthTokenUrl: 'https://old.example.invalid/oauth/token',
      },
      statusCheckKind: 'sva_mainserver',
      visibleStatus: 'ok',
      lastCheckedAt: '2026-03-14T09:00:00.000Z',
    });

    const { saveSvaMainserverSettings } = await import('./settings');

    await saveSvaMainserverSettings({
      instanceId: 'de-musterhausen',
      graphqlBaseUrl: 'https://new.example.invalid/graphql',
      oauthTokenUrl: 'https://new.example.invalid/oauth/token',
      enabled: false,
    });

    expect(state.saveExternalInterfaceRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'de-musterhausen',
        typeKey: 'sva_mainserver',
        publicConfig: {
          graphqlBaseUrl: 'https://new.example.invalid/graphql',
          oauthTokenUrl: 'https://new.example.invalid/oauth/token',
        },
        enabled: false,
        lastCheckedAt: '2026-03-14T09:00:00.000Z',
        visibleStatus: 'disabled',
      })
    );
  });

  it('rejects invalid upstream URLs', async () => {
    state.loadDefaultExternalInterfaceRecord.mockResolvedValue(null);

    const { saveSvaMainserverSettings } = await import('./settings');

    await expect(
      saveSvaMainserverSettings({
        instanceId: 'de-musterhausen',
        graphqlBaseUrl: 'http://example.com/graphql',
        oauthTokenUrl: 'https://new.example.invalid/oauth/token',
        enabled: true,
      })
    ).rejects.toThrow('Die konfigurierte Upstream-URL graphql_base_url ist ungültig.');
  });

  it('rejects upstream URLs with embedded credentials', async () => {
    state.loadDefaultExternalInterfaceRecord.mockResolvedValue(null);

    const { saveSvaMainserverSettings } = await import('./settings');

    await expect(
      saveSvaMainserverSettings({
        instanceId: 'de-musterhausen',
        graphqlBaseUrl: 'https://demo:secret@example.com/graphql',
        oauthTokenUrl: 'https://new.example.invalid/oauth/token',
        enabled: true,
      })
    ).rejects.toThrow('Die konfigurierte Upstream-URL graphql_base_url ist ungültig.');
  });

  it('rejects upstream URLs with URL fragments', async () => {
    state.loadDefaultExternalInterfaceRecord.mockResolvedValue(null);

    const { saveSvaMainserverSettings } = await import('./settings');

    await expect(
      saveSvaMainserverSettings({
        instanceId: 'de-musterhausen',
        graphqlBaseUrl: 'https://new.example.invalid/graphql#fragment',
        oauthTokenUrl: 'https://new.example.invalid/oauth/token',
        enabled: true,
      })
    ).rejects.toThrow('Die konfigurierte Upstream-URL graphql_base_url ist ungültig.');
  });

  it('rejects private and loopback upstream URLs during save', async () => {
    state.loadDefaultExternalInterfaceRecord.mockResolvedValue(null);

    const { saveSvaMainserverSettings } = await import('./settings');

    await expect(
      saveSvaMainserverSettings({
        instanceId: 'de-musterhausen',
        graphqlBaseUrl: 'https://localhost:4000/graphql',
        oauthTokenUrl: 'https://[::1]:8080/oauth/token',
        enabled: true,
      })
    ).rejects.toThrow('Die konfigurierte Upstream-URL graphql_base_url ist ungültig.');
  });
});
