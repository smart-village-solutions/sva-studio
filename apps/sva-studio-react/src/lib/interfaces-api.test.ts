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

  it('returns a validation error when the session misses an instance context', async () => {
    state.withAuthenticatedUser.mockImplementation(
      async (_request: Request, handler: (ctx: { user: { id: string; instanceId?: string; roles: string[] } }) => Promise<Response>) =>
        handler({
          user: {
            id: 'subject-1',
            roles: ['system_admin'],
          },
        })
    );

    const { loadInterfacesOverview } = await import('./interfaces-api');

    await expect(loadInterfacesOverview()).resolves.toMatchObject({
      instanceId: '',
      status: expect.objectContaining({
        status: 'error',
        errorCode: 'invalid_config',
      }),
    });
  });

  it('maps unauthorized auth responses to an unauthorized status', async () => {
    state.withAuthenticatedUser.mockResolvedValue(
      new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { loadInterfacesOverview } = await import('./interfaces-api');

    await expect(loadInterfacesOverview()).resolves.toMatchObject({
      instanceId: '',
      status: expect.objectContaining({
        status: 'error',
        errorCode: 'unauthorized',
      }),
    });
  });

  it('maps non-contract forbidden responses to a forbidden status', async () => {
    state.withAuthenticatedUser.mockResolvedValue(
      new Response(JSON.stringify({ error: 'forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { loadInterfacesOverview } = await import('./interfaces-api');

    await expect(loadInterfacesOverview()).resolves.toMatchObject({
      instanceId: '',
      status: expect.objectContaining({
        status: 'error',
        errorCode: 'forbidden',
      }),
    });
  });

  it('maps load failures from the data layer to invalid_config', async () => {
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
    state.loadSvaMainserverSettings.mockRejectedValue(new Error('db down'));

    const { loadInterfacesOverview } = await import('./interfaces-api');

    await expect(loadInterfacesOverview()).resolves.toMatchObject({
      instanceId: 'de-musterhausen',
      status: expect.objectContaining({
        status: 'error',
        errorCode: 'invalid_config',
      }),
    });
  });

  it('returns a sanitized network error when the connection check fails unexpectedly', async () => {
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
    state.loadSvaMainserverSettings.mockResolvedValue(null);
    state.getSvaMainserverConnectionStatus.mockRejectedValue({
      response: {
        data: {
          message: 'secret backend detail',
        },
      },
    });

    const { loadInterfacesOverview } = await import('./interfaces-api');

    await expect(loadInterfacesOverview()).resolves.toMatchObject({
      instanceId: 'de-musterhausen',
      status: expect.objectContaining({
        status: 'error',
        errorCode: 'network_error',
      }),
    });
  });

  it('falls back to a network error when the overview response shape is invalid', async () => {
    state.withAuthenticatedUser.mockResolvedValue(
      new Response(JSON.stringify({ instanceId: 'de-musterhausen', status: { foo: 'bar' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { loadInterfacesOverview } = await import('./interfaces-api');

    await expect(loadInterfacesOverview()).resolves.toMatchObject({
      instanceId: '',
      status: expect.objectContaining({
        status: 'error',
        errorCode: 'network_error',
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
