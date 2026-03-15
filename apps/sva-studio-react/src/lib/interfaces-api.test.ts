import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  request: new Request('http://localhost'),
  withAuthenticatedUser: vi.fn(),
  getSvaMainserverConnectionStatus: vi.fn(),
  loadSvaMainserverSettings: vi.fn(),
  saveSvaMainserverSettings: vi.fn(),
}));

vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => ({
    inputValidator: () => ({
      handler: (handler: (input: { data: unknown }) => Promise<unknown>) => handler,
    }),
    handler: (handler: () => Promise<unknown>) => handler,
  }),
}));

vi.mock('@tanstack/react-start/server', () => ({
  getRequest: () => state.request,
}));

vi.mock('@sva/auth/server', () => ({
  withAuthenticatedUser: state.withAuthenticatedUser,
}));

vi.mock('@sva/sva-mainserver/server', () => ({
  getSvaMainserverConnectionStatus: state.getSvaMainserverConnectionStatus,
  loadSvaMainserverSettings: state.loadSvaMainserverSettings,
  saveSvaMainserverSettings: state.saveSvaMainserverSettings,
}));

describe('interfaces.server', () => {
  beforeEach(() => {
    state.withAuthenticatedUser.mockReset();
    state.getSvaMainserverConnectionStatus.mockReset();
    state.loadSvaMainserverSettings.mockReset();
    state.saveSvaMainserverSettings.mockReset();
  });

  it('loads interfaces overview for admin roles', async () => {
    state.withAuthenticatedUser.mockImplementation(
      async (_request: Request, handler: (ctx: { user: { id: string; instanceId?: string; roles: string[] } }) => Promise<Response>) =>
        handler({
          user: {
            id: 'subject-1',
            instanceId: 'de-musterhausen',
            roles: ['app_manager'],
          },
        })
    );
    state.loadSvaMainserverSettings.mockResolvedValue({
      instanceId: 'de-musterhausen',
      providerKey: 'sva_mainserver',
      graphqlBaseUrl: 'https://mainserver.example/graphql',
      oauthTokenUrl: 'https://mainserver.example/oauth/token',
      enabled: true,
    });
    state.getSvaMainserverConnectionStatus.mockResolvedValue({
      status: 'connected',
      checkedAt: '2026-03-15T11:00:00.000Z',
    });

    const { loadInterfacesOverview } = await import('./interfaces-api');

    await expect(loadInterfacesOverview()).resolves.toMatchObject({
      instanceId: 'de-musterhausen',
      config: expect.objectContaining({ enabled: true }),
      status: expect.objectContaining({ status: 'connected' }),
    });
  });

  it('returns forbidden status for users without management role', async () => {
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

    const { loadInterfacesOverview } = await import('./interfaces-api');

    await expect(loadInterfacesOverview()).resolves.toMatchObject({
      instanceId: 'de-musterhausen',
      status: expect.objectContaining({
        status: 'error',
        errorCode: 'forbidden',
      }),
    });
  });

  it('saves mainserver settings for authorized users', async () => {
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
    state.saveSvaMainserverSettings.mockResolvedValue({
      instanceId: 'de-musterhausen',
      providerKey: 'sva_mainserver',
      graphqlBaseUrl: 'https://mainserver.example/graphql',
      oauthTokenUrl: 'https://mainserver.example/oauth/token',
      enabled: true,
    });

    const { saveSvaMainserverInterfaceSettings } = await import('./interfaces-api');

    await saveSvaMainserverInterfaceSettings({
      data: {
        graphqlBaseUrl: 'https://mainserver.example/graphql',
        oauthTokenUrl: 'https://mainserver.example/oauth/token',
        enabled: true,
      },
    });

    expect(state.saveSvaMainserverSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'de-musterhausen',
        enabled: true,
      })
    );
  });

  it('allows interface_manager users to save mainserver settings', async () => {
    state.withAuthenticatedUser.mockImplementation(
      async (_request: Request, handler: (ctx: { user: { id: string; instanceId?: string; roles: string[] } }) => Promise<Response>) =>
        handler({
          user: {
            id: 'subject-1',
            instanceId: 'de-musterhausen',
            roles: ['interface_manager'],
          },
        })
    );
    state.saveSvaMainserverSettings.mockResolvedValue({
      instanceId: 'de-musterhausen',
      providerKey: 'sva_mainserver',
      graphqlBaseUrl: 'https://mainserver.example/graphql',
      oauthTokenUrl: 'https://mainserver.example/oauth/token',
      enabled: true,
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
    ).resolves.toMatchObject({
      instanceId: 'de-musterhausen',
      enabled: true,
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
    ).rejects.toThrow('Einstellungen konnten nicht gespeichert werden.');
  });
});
