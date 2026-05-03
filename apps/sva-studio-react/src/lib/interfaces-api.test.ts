import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  request: new Request('http://localhost/interfaces'),
  loadSvaMainserverInterfacesOverview: vi.fn(),
  saveSvaMainserverInterfaceSettings: vi.fn(),
  serverModuleLoads: 0,
  contractModuleLoads: 0,
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
  ...(state.serverModuleLoads++, {}),
  getRequest: () => state.request,
}));

vi.mock('@sva/sva-mainserver/server', () => ({
  ...(state.contractModuleLoads++, {}),
  loadSvaMainserverInterfacesOverview: state.loadSvaMainserverInterfacesOverview,
  saveSvaMainserverInterfaceSettings: state.saveSvaMainserverInterfaceSettings,
}));

describe('interfaces app adapter', () => {
  beforeEach(() => {
    vi.resetModules();
    state.loadSvaMainserverInterfacesOverview.mockReset();
    state.saveSvaMainserverInterfaceSettings.mockReset();
    state.serverModuleLoads = 0;
    state.contractModuleLoads = 0;
  });

  it('keeps server-only modules out of eager module evaluation', async () => {
    await import('./interfaces-api');

    expect(state.serverModuleLoads).toBe(0);
    expect(state.contractModuleLoads).toBe(0);
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

  it('exports the overview alias with the same server function binding', async () => {
    const overview = {
      instanceId: 'de-musterhausen',
      config: null,
      status: {
        status: 'connected' as const,
        checkedAt: '2026-05-03T17:00:00.000Z',
      },
    };
    state.loadSvaMainserverInterfacesOverview.mockResolvedValue(overview);

    const { loadInterfacesOverview } = await import('./interfaces-api');

    await expect(loadInterfacesOverview()).resolves.toEqual(overview);
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

    expect(state.saveSvaMainserverSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'de-musterhausen',
        enabled: true,
      })
    );
  });

  it('sanitizes internal save errors before surfacing them to clients', async () => {
    state.withAuthenticatedUser.mockImplementation(
      async (_request: Request, handler: (ctx: { user: { id: string; instanceId?: string; roles: string[] } }) => Promise<Response>) =>
        handler({
          user: {
            id: 'subject-1',
            instanceId: 'de-musterhausen',
            roles: ['system_admin'],
          },
        })
    );
    state.saveSvaMainserverSettings.mockRejectedValue(new Error('Error: boom\n    at save (/srv/app.ts:1:1)'));

    const { saveSvaMainserverInterfaceSettings } = await import('./interfaces-api');

    await expect(
      saveSvaMainserverInterfaceSettings({
        data: {
          graphqlBaseUrl: 'https://mainserver.example/graphql',
          oauthTokenUrl: 'https://mainserver.example/oauth/token',
          enabled: true,
        },
      })
    ).rejects.toThrow('network_error');
  });

  it('rejects save requests from users without interfaces permissions', async () => {
    state.withAuthenticatedUser.mockImplementation(
      async (_request: Request, handler: (ctx: { user: { id: string; instanceId?: string; roles: string[] } }) => Promise<Response>) =>
        handler({
          user: {
            id: 'subject-1',
            instanceId: 'de-musterhausen',
            roles: ['editor'],
          },
        })
    );

    const { saveSvaMainserverInterfaceSettings } = await import('./interfaces-api');

    await expect(
      saveSvaMainserverInterfaceSettings({
        data: {
          graphqlBaseUrl: 'https://mainserver.example/graphql',
          oauthTokenUrl: 'https://mainserver.example/oauth/token',
          enabled: true,
        },
      })
    ).rejects.toThrow('forbidden');
  });

  it('rejects save requests when the enabled flag is missing', async () => {
    state.withAuthenticatedUser.mockImplementation(
      async (_request: Request, handler: (ctx: { user: { id: string; instanceId?: string; roles: string[] } }) => Promise<Response>) =>
        handler({
          user: {
            id: 'subject-1',
            instanceId: 'de-musterhausen',
            roles: ['system_admin'],
          },
        })
    );

    const { saveSvaMainserverInterfaceSettings } = await import('./interfaces-api');

    await expect(
      saveSvaMainserverInterfaceSettings({
        data: {
          graphqlBaseUrl: 'https://mainserver.example/graphql',
          oauthTokenUrl: 'https://mainserver.example/oauth/token',
        },
      })
    ).rejects.toThrow('invalid_config');

    expect(state.saveSvaMainserverSettings).not.toHaveBeenCalled();
  });

  it('rejects save requests when the instance context is missing', async () => {
    state.withAuthenticatedUser.mockImplementation(
      async (_request: Request, handler: (ctx: { user: { id: string; instanceId?: string; roles: string[] } }) => Promise<Response>) =>
        handler({
          user: {
            id: 'subject-1',
            roles: ['system_admin'],
          },
        })
    );

    const { saveSvaMainserverInterfaceSettings } = await import('./interfaces-api');

    await expect(
      saveSvaMainserverInterfaceSettings({
        data: {
          graphqlBaseUrl: 'https://mainserver.example/graphql',
          oauthTokenUrl: 'https://mainserver.example/oauth/token',
          enabled: true,
        },
      })
    ).rejects.toThrow('invalid_config');

    expect(state.saveSvaMainserverSettings).not.toHaveBeenCalled();
  });

  it('preserves invalid_config errors from settings validation with their affected field', async () => {
    state.withAuthenticatedUser.mockImplementation(
      async (_request: Request, handler: (ctx: { user: { id: string; instanceId?: string; roles: string[] } }) => Promise<Response>) =>
        handler({
          user: {
            id: 'subject-1',
            instanceId: 'de-musterhausen',
            roles: ['system_admin'],
          },
        })
    );
    state.saveSvaMainserverSettings.mockRejectedValue({
      code: 'invalid_config',
      message: 'Die konfigurierte Upstream-URL graphql_base_url ist ungültig.',
      statusCode: 400,
    });

    const { saveSvaMainserverInterfaceSettings } = await import('./interfaces-api');

    await expect(
      saveSvaMainserverInterfaceSettings({
        data: {
          graphqlBaseUrl: 'https://mainserver.example/graphql',
          oauthTokenUrl: 'https://mainserver.example/oauth/token',
          enabled: true,
        },
      })
    ).rejects.toThrow('invalid_config');
  });
});
