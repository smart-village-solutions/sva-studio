import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  request: new Request('http://localhost/interfaces'),
  loadSvaMainserverInterfacesOverview: vi.fn(),
  saveSvaMainserverInterfaceSettings: vi.fn(),
}));

vi.mock('@tanstack/react-start', () => ({
  createServerFn: (_options?: unknown) => ({
    inputValidator: () => ({
      handler: (handler: (input: { data: unknown }) => Promise<unknown>) => handler,
    }),
    handler: (handler: () => Promise<unknown>) => handler,
  }),
}));

vi.mock('@tanstack/react-start/server', () => ({
  getRequest: () => state.request,
}));

vi.mock('@sva/sva-mainserver/server', () => ({
  loadSvaMainserverInterfacesOverview: state.loadSvaMainserverInterfacesOverview,
  saveSvaMainserverInterfaceSettings: state.saveSvaMainserverInterfaceSettings,
}));

describe('interfaces app adapter', () => {
  beforeEach(() => {
    state.loadSvaMainserverInterfacesOverview.mockReset();
    state.saveSvaMainserverInterfaceSettings.mockReset();
  });

  it('delegates overview loading to the package contract with the current request', async () => {
    const overview = {
      instanceId: 'de-musterhausen',
      config: null,
      status: {
        status: 'connected' as const,
        checkedAt: '2026-05-03T17:00:00.000Z',
      },
    };
    state.loadSvaMainserverInterfacesOverview.mockResolvedValue(overview);

    const { loadSvaMainserverInterfacesOverviewServerFn } = await import('./interfaces-api');

    await expect(loadSvaMainserverInterfacesOverviewServerFn()).resolves.toEqual(overview);
    expect(state.loadSvaMainserverInterfacesOverview).toHaveBeenCalledWith(state.request);
  });

  it('delegates saving to the package contract with request and payload', async () => {
    const config = {
      instanceId: 'de-musterhausen',
      providerKey: 'sva_mainserver',
      graphqlBaseUrl: 'https://mainserver.example/graphql',
      oauthTokenUrl: 'https://mainserver.example/oauth/token',
      enabled: true,
    };
    const payload = {
      graphqlBaseUrl: 'https://mainserver.example/graphql',
      oauthTokenUrl: 'https://mainserver.example/oauth/token',
      enabled: true,
    };
    state.saveSvaMainserverInterfaceSettings.mockResolvedValue(config);

    const { saveSvaMainserverInterfaceSettings } = await import('./interfaces-api');

    await expect(saveSvaMainserverInterfaceSettings({ data: payload })).resolves.toEqual(config);
    expect(state.saveSvaMainserverInterfaceSettings).toHaveBeenCalledWith(state.request, {
      data: payload,
    });
  });
});
