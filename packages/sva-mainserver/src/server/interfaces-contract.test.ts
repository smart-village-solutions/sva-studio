import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  withAuthenticatedUser: vi.fn(),
  getSvaMainserverConnectionStatus: vi.fn(),
  loadSvaMainserverSettings: vi.fn(),
  saveSvaMainserverSettings: vi.fn(),
}));

vi.mock('@sva/auth-runtime/server', () => ({
  withAuthenticatedUser: state.withAuthenticatedUser,
}));

vi.mock('./service.js', () => ({
  getSvaMainserverConnectionStatus: state.getSvaMainserverConnectionStatus,
}));

vi.mock('./settings.js', () => ({
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
    let capturedResponse: Response | null = null;
    state.withAuthenticatedUser.mockImplementation(
      async (_request: Request, handler: (ctx: { user: { id: string; instanceId?: string; roles: string[] } }) => Promise<Response>) =>
        handler({
          user: {
            id: 'subject-1',
            instanceId: 'de-musterhausen',
            roles: ['app_manager'],
          },
        }).then((response) => {
          capturedResponse = response;
          return response;
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

    const { loadSvaMainserverInterfacesOverview } = await import('./interfaces-contract');

    await expect(loadSvaMainserverInterfacesOverview(new Request('http://localhost'))).resolves.toMatchObject({
      instanceId: 'de-musterhausen',
      config: expect.objectContaining({ enabled: true }),
      status: expect.objectContaining({ status: 'connected' }),
    });
    expect(capturedResponse?.headers.get('Cache-Control')).toBe('no-store');
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

    const { loadSvaMainserverInterfacesOverview } = await import('./interfaces-contract');

    await expect(loadSvaMainserverInterfacesOverview(new Request('http://localhost'))).resolves.toMatchObject({
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

    const { loadSvaMainserverInterfacesOverview } = await import('./interfaces-contract');

    await expect(loadSvaMainserverInterfacesOverview(new Request('http://localhost'))).resolves.toMatchObject({
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

    const { loadSvaMainserverInterfacesOverview } = await import('./interfaces-contract');

    await expect(loadSvaMainserverInterfacesOverview(new Request('http://localhost'))).resolves.toMatchObject({
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

    const { loadSvaMainserverInterfacesOverview } = await import('./interfaces-contract');

    await expect(loadSvaMainserverInterfacesOverview(new Request('http://localhost'))).resolves.toMatchObject({
      instanceId: '',
      status: expect.objectContaining({
        status: 'error',
        errorCode: 'forbidden',
      }),
    });
  });

  it('maps known upstream error payloads to their error code', async () => {
    state.withAuthenticatedUser.mockResolvedValue(
      new Response(JSON.stringify({ error: 'integration_disabled' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { loadSvaMainserverInterfacesOverview } = await import('./interfaces-contract');

    await expect(loadSvaMainserverInterfacesOverview(new Request('http://localhost'))).resolves.toMatchObject({
      instanceId: '',
      status: expect.objectContaining({
        status: 'error',
        errorCode: 'integration_disabled',
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

    const { loadSvaMainserverInterfacesOverview } = await import('./interfaces-contract');

    await expect(loadSvaMainserverInterfacesOverview(new Request('http://localhost'))).resolves.toMatchObject({
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

    const { loadSvaMainserverInterfacesOverview } = await import('./interfaces-contract');

    await expect(loadSvaMainserverInterfacesOverview(new Request('http://localhost'))).resolves.toMatchObject({
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

    const { loadSvaMainserverInterfacesOverview } = await import('./interfaces-contract');

    await expect(loadSvaMainserverInterfacesOverview(new Request('http://localhost'))).resolves.toMatchObject({
      instanceId: '',
      status: expect.objectContaining({
        status: 'error',
        errorCode: 'network_error',
      }),
    });
  });

  it('returns a network error when overview loading throws unexpectedly', async () => {
    state.withAuthenticatedUser.mockRejectedValue(new Error('auth transport failed'));

    const { loadSvaMainserverInterfacesOverview } = await import('./interfaces-contract');

    await expect(loadSvaMainserverInterfacesOverview(new Request('http://localhost'))).resolves.toMatchObject({
      instanceId: '',
      status: expect.objectContaining({
        status: 'error',
        errorCode: 'network_error',
      }),
    });
  });

  it('saves mainserver settings for authorized users', async () => {
    let capturedResponse: Response | null = null;
    state.withAuthenticatedUser.mockImplementation(
      async (_request: Request, handler: (ctx: { user: { id: string; instanceId?: string; roles: string[] } }) => Promise<Response>) =>
        handler({
          user: {
            id: 'subject-1',
            instanceId: 'de-musterhausen',
            roles: ['system_admin'],
          },
        }).then((response) => {
          capturedResponse = response;
          return response;
        })
    );
    state.saveSvaMainserverSettings.mockResolvedValue({
      instanceId: 'de-musterhausen',
      providerKey: 'sva_mainserver',
      graphqlBaseUrl: 'https://mainserver.example/graphql',
      oauthTokenUrl: 'https://mainserver.example/oauth/token',
      enabled: true,
    });

    const { saveSvaMainserverInterfaceSettings } = await import('./interfaces-contract');

    await saveSvaMainserverInterfaceSettings(new Request('http://localhost'), {
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
    expect(capturedResponse?.headers.get('Cache-Control')).toBe('no-store');
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

    const { saveSvaMainserverInterfaceSettings } = await import('./interfaces-contract');

    await expect(
      saveSvaMainserverInterfaceSettings(new Request('http://localhost'), {
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

    const { saveSvaMainserverInterfaceSettings } = await import('./interfaces-contract');

    await expect(
      saveSvaMainserverInterfaceSettings(new Request('http://localhost'), {
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

    const { saveSvaMainserverInterfaceSettings } = await import('./interfaces-contract');

    await expect(
      saveSvaMainserverInterfaceSettings(new Request('http://localhost'), {
        data: {
          graphqlBaseUrl: 'https://mainserver.example/graphql',
          oauthTokenUrl: 'https://mainserver.example/oauth/token',
          enabled: true,
        },
      })
    ).rejects.toThrow('forbidden');
  });

  it('rejects save requests when the session misses an instance context', async () => {
    state.withAuthenticatedUser.mockImplementation(
      async (_request: Request, handler: (ctx: { user: { id: string; instanceId?: string; roles: string[] } }) => Promise<Response>) =>
        handler({
          user: {
            id: 'subject-1',
            roles: ['system_admin'],
          },
        })
    );

    const { saveSvaMainserverInterfaceSettings } = await import('./interfaces-contract');

    await expect(
      saveSvaMainserverInterfaceSettings(new Request('http://localhost'), {
        data: {
          graphqlBaseUrl: 'https://mainserver.example/graphql',
          oauthTokenUrl: 'https://mainserver.example/oauth/token',
          enabled: true,
        },
      })
    ).rejects.toThrow('invalid_config');

    expect(state.saveSvaMainserverSettings).not.toHaveBeenCalled();
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

    const { saveSvaMainserverInterfaceSettings } = await import('./interfaces-contract');

    await expect(
      saveSvaMainserverInterfaceSettings(new Request('http://localhost'), {
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

    const { saveSvaMainserverInterfaceSettings } = await import('./interfaces-contract');

    await expect(
      saveSvaMainserverInterfaceSettings(new Request('http://localhost'), {
        data: {
          graphqlBaseUrl: 'https://mainserver.example/graphql',
          oauthTokenUrl: 'https://mainserver.example/oauth/token',
          enabled: true,
        },
      })
    ).rejects.toThrow('invalid_config');
  });

  it('preserves oauth_token_url validation errors from error instances', async () => {
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
    const validationError = Object.assign(
      new Error('Die konfigurierte Upstream-URL oauth_token_url ist ungültig.'),
      {
        code: 'invalid_config',
        statusCode: 400,
      }
    );
    state.saveSvaMainserverSettings.mockRejectedValue(validationError);

    const { saveSvaMainserverInterfaceSettings } = await import('./interfaces-contract');

    await expect(
      saveSvaMainserverInterfaceSettings(new Request('http://localhost'), {
        data: {
          graphqlBaseUrl: 'https://mainserver.example/graphql',
          oauthTokenUrl: 'https://mainserver.example/oauth/token',
          enabled: true,
        },
      })
    ).rejects.toThrow('invalid_config');
  });

  it('wraps non-error save failures as network_error', async () => {
    state.withAuthenticatedUser.mockRejectedValue({
      response: {
        body: {
          detail: 'gateway timeout while forwarding request',
        },
      },
    });

    const { saveSvaMainserverInterfaceSettings } = await import('./interfaces-contract');

    await expect(
      saveSvaMainserverInterfaceSettings(new Request('http://localhost'), {
        data: {
          graphqlBaseUrl: 'https://mainserver.example/graphql',
          oauthTokenUrl: 'https://mainserver.example/oauth/token',
          enabled: true,
        },
      })
    ).rejects.toThrow('network_error');
  });
});
