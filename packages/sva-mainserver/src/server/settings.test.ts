import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  loadInstanceIntegrationRecord: vi.fn(),
  saveInstanceIntegrationRecord: vi.fn(),
}));

vi.mock('@sva/data/server', () => ({
  loadInstanceIntegrationRecord: state.loadInstanceIntegrationRecord,
  saveInstanceIntegrationRecord: state.saveInstanceIntegrationRecord,
}));

describe('settings', () => {
  beforeEach(() => {
    state.loadInstanceIntegrationRecord.mockReset();
    state.saveInstanceIntegrationRecord.mockReset();
  });

  it('loads settings when integration record exists', async () => {
    state.loadInstanceIntegrationRecord.mockResolvedValue({
      instanceId: 'de-musterhausen',
      providerKey: 'sva_mainserver',
      graphqlBaseUrl: 'https://mainserver.example/graphql',
      oauthTokenUrl: 'https://mainserver.example/oauth/token',
      enabled: true,
      lastVerifiedAt: '2026-03-15T10:00:00.000Z',
      lastVerifiedStatus: 'ok',
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
    state.loadInstanceIntegrationRecord.mockResolvedValue(null);

    const { loadSvaMainserverSettings } = await import('./settings');

    await expect(loadSvaMainserverSettings('de-musterhausen')).resolves.toBeNull();
  });

  it('saves normalized settings and preserves verification metadata', async () => {
    state.loadInstanceIntegrationRecord.mockResolvedValue({
      instanceId: 'de-musterhausen',
      providerKey: 'sva_mainserver',
      graphqlBaseUrl: 'https://old.example/graphql',
      oauthTokenUrl: 'https://old.example/oauth/token',
      enabled: true,
      lastVerifiedAt: '2026-03-14T09:00:00.000Z',
      lastVerifiedStatus: 'ok',
    });

    const { saveSvaMainserverSettings } = await import('./settings');

    await saveSvaMainserverSettings({
      instanceId: 'de-musterhausen',
      graphqlBaseUrl: 'https://new.example/graphql',
      oauthTokenUrl: 'https://new.example/oauth/token',
      enabled: false,
    });

    expect(state.saveInstanceIntegrationRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'de-musterhausen',
        providerKey: 'sva_mainserver',
        graphqlBaseUrl: 'https://new.example/graphql',
        oauthTokenUrl: 'https://new.example/oauth/token',
        enabled: false,
        lastVerifiedAt: '2026-03-14T09:00:00.000Z',
        lastVerifiedStatus: 'ok',
      })
    );
  });

  it('rejects invalid upstream URLs', async () => {
    state.loadInstanceIntegrationRecord.mockResolvedValue(null);

    const { saveSvaMainserverSettings } = await import('./settings');

    await expect(
      saveSvaMainserverSettings({
        instanceId: 'de-musterhausen',
        graphqlBaseUrl: 'http://example.com/graphql',
        oauthTokenUrl: 'https://new.example/oauth/token',
        enabled: true,
      })
    ).rejects.toThrow('Die konfigurierte Upstream-URL graphql_base_url ist ungültig.');
  });

  it('allows loopback http URLs in development', async () => {
    state.loadInstanceIntegrationRecord.mockResolvedValue(null);

    const { saveSvaMainserverSettings } = await import('./settings');

    await saveSvaMainserverSettings({
      instanceId: 'de-musterhausen',
      graphqlBaseUrl: 'http://localhost:4000/graphql',
      oauthTokenUrl: 'http://127.0.0.1:8080/oauth/token',
      enabled: true,
    });

    expect(state.saveInstanceIntegrationRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        graphqlBaseUrl: 'http://localhost:4000/graphql',
        oauthTokenUrl: 'http://127.0.0.1:8080/oauth/token',
      })
    );
  });
});
