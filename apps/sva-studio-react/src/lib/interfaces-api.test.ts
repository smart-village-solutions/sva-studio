import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  request: new Request('http://localhost/interfaces'),
  loadSvaMainserverInterfacesOverview: vi.fn(),
  listStoredInterfaces: vi.fn(),
  loadInstanceById: vi.fn(),
  upsertStoredInterface: vi.fn(),
  getStoredInterface: vi.fn(),
  deleteStoredInterface: vi.fn(),
  runStoredInterfaceHealthcheck: vi.fn(),
  checkStoredInterfaceHealth: vi.fn(),
  isCustomInterfaceStorageAvailable: vi.fn(),
  saveSvaMainserverSettings: vi.fn(),
  withAuthenticatedUser: vi.fn(),
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
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
  saveSvaMainserverSettings: state.saveSvaMainserverSettings,
}));

vi.mock('@sva/auth-runtime/server', () => ({
  withAuthenticatedUser: state.withAuthenticatedUser,
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => state.logger,
}));

vi.mock('@sva/data-repositories/server', () => ({
  loadInstanceById: state.loadInstanceById,
}));

vi.mock('./instance-interfaces-server.js', () => ({
  listStoredInterfaces: state.listStoredInterfaces,
  upsertStoredInterface: state.upsertStoredInterface,
  getStoredInterface: state.getStoredInterface,
  deleteStoredInterface: state.deleteStoredInterface,
  checkStoredInterfaceHealth: state.checkStoredInterfaceHealth,
  isCustomInterfaceStorageAvailable: state.isCustomInterfaceStorageAvailable,
}));

vi.mock('./instance-interface-healthcheck.server.js', () => ({
  runStoredInterfaceHealthcheck: state.runStoredInterfaceHealthcheck,
}));

describe('interfaces app adapter', () => {
  beforeEach(() => {
    vi.resetModules();
    state.loadSvaMainserverInterfacesOverview.mockReset();
    state.listStoredInterfaces.mockReset();
    state.loadInstanceById.mockReset();
    state.upsertStoredInterface.mockReset();
    state.getStoredInterface.mockReset();
    state.deleteStoredInterface.mockReset();
    state.runStoredInterfaceHealthcheck.mockReset();
    state.checkStoredInterfaceHealth.mockReset();
    state.isCustomInterfaceStorageAvailable.mockReset();
    state.saveSvaMainserverSettings.mockReset();
    state.withAuthenticatedUser.mockReset();
    state.logger.error.mockReset();
    state.logger.info.mockReset();
    state.logger.warn.mockReset();
    state.serverModuleLoads = 0;
    state.contractModuleLoads = 0;
    state.checkStoredInterfaceHealth.mockReturnValue({
      status: 'unknown',
      checkedAt: '2026-05-12T08:00:00.000Z',
    });
    state.runStoredInterfaceHealthcheck.mockResolvedValue(null);
    state.isCustomInterfaceStorageAvailable.mockReturnValue(true);
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

  it('loads stored interfaces only for authorized users in their own instance context', async () => {
    state.withAuthenticatedUser.mockImplementation(
      async (_request: Request, handler: (ctx: { user: { id: string; instanceId?: string; roles: string[] } }) => Promise<unknown>) =>
        handler({
          user: {
            id: 'subject-1',
            instanceId: 'de-musterhausen',
            roles: ['interface_manager'],
          },
        })
    );
    state.loadSvaMainserverInterfacesOverview.mockResolvedValue({
      instanceId: 'de-musterhausen',
      config: null,
      status: {
        status: 'connected',
        checkedAt: '2026-05-03T17:00:00.000Z',
      },
    });
    state.listStoredInterfaces.mockReturnValue([
      {
        id: 's3-1',
        instanceId: 'de-musterhausen',
        type: 's3',
        name: 'Uploads',
        enabled: true,
        config: {
          endpoint: 'https://s3.example',
          region: 'eu-central-1',
          bucket: 'uploads',
          accessKeyId: 'key-1',
          forcePathStyle: false,
        },
        createdAt: '2026-05-03T17:00:00.000Z',
        updatedAt: '2026-05-03T17:00:00.000Z',
      },
    ]);
    state.loadInstanceById.mockResolvedValue({
      instanceId: 'de-musterhausen',
      assignedModules: ['waste-management'],
    });

    const { listInstanceInterfacesServerFn } = await import('./interfaces-api');

    await expect(listInstanceInterfacesServerFn()).resolves.toEqual({
      instanceId: 'de-musterhausen',
      availableTypes: ['mainserver', 's3', 'supabase'],
      entries: [
        expect.objectContaining({
          id: 's3-1',
          instanceId: 'de-musterhausen',
          type: 's3',
        }),
      ],
    });
    expect(state.listStoredInterfaces).toHaveBeenCalledWith('de-musterhausen');
  });

  it('omits supabase from the available types when the waste-management module is not assigned', async () => {
    state.withAuthenticatedUser.mockImplementation(
      async (_request: Request, handler: (ctx: { user: { id: string; instanceId?: string; roles: string[] } }) => Promise<unknown>) =>
        handler({
          user: {
            id: 'subject-1',
            instanceId: 'de-musterhausen',
            roles: ['interface_manager'],
          },
        })
    );
    state.loadSvaMainserverInterfacesOverview.mockResolvedValue({
      instanceId: 'de-musterhausen',
      config: null,
      status: {
        status: 'connected',
        checkedAt: '2026-05-03T17:00:00.000Z',
      },
    });
    state.listStoredInterfaces.mockResolvedValue([]);
    state.loadInstanceById.mockResolvedValue({
      instanceId: 'de-musterhausen',
      assignedModules: ['news'],
    });

    const { listInstanceInterfacesServerFn } = await import('./interfaces-api');

    await expect(listInstanceInterfacesServerFn()).resolves.toEqual({
      instanceId: 'de-musterhausen',
      availableTypes: ['mainserver', 's3'],
      entries: [],
    });
  });

  it('fails closed to default interface types when assigned modules are missing at runtime', async () => {
    state.withAuthenticatedUser.mockImplementation(
      async (_request: Request, handler: (ctx: { user: { id: string; instanceId?: string; roles: string[] } }) => Promise<unknown>) =>
        handler({
          user: {
            id: 'subject-1',
            instanceId: 'de-musterhausen',
            roles: ['interface_manager'],
          },
        })
    );
    state.loadSvaMainserverInterfacesOverview.mockResolvedValue({
      instanceId: 'de-musterhausen',
      config: null,
      status: {
        status: 'connected',
        checkedAt: '2026-05-03T17:00:00.000Z',
      },
    });
    state.listStoredInterfaces.mockResolvedValue([]);
    state.loadInstanceById.mockResolvedValue({
      instanceId: 'de-musterhausen',
    });

    const { listInstanceInterfacesServerFn } = await import('./interfaces-api');

    await expect(listInstanceInterfacesServerFn()).resolves.toEqual({
      instanceId: 'de-musterhausen',
      availableTypes: ['mainserver', 's3'],
      entries: [],
    });
  });

  it('rejects malformed authenticated interface list payloads before they reach the UI', async () => {
    state.withAuthenticatedUser.mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          result: {
            instanceId: 'de-musterhausen',
            entries: [],
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );

    const { listInstanceInterfacesServerFn } = await import('./interfaces-api');

    await expect(listInstanceInterfacesServerFn()).rejects.toThrow('invalid_interfaces_payload');
    expect(state.logger.error).toHaveBeenCalledWith(
      'List interfaces produced an invalid payload',
      expect.objectContaining({
        operation: 'list_interfaces',
        invalid_payload_type: 'object',
      })
    );
  });

  it('rejects list requests from users without interfaces permissions before reading stored entries', async () => {
    state.withAuthenticatedUser.mockImplementation(
      async (_request: Request, handler: (ctx: { user: { id: string; instanceId?: string; roles: string[] } }) => Promise<unknown>) =>
        handler({
          user: {
            id: 'subject-1',
            instanceId: 'de-musterhausen',
            roles: ['editor'],
          },
        })
    );

    const { listInstanceInterfacesServerFn } = await import('./interfaces-api');

    await expect(listInstanceInterfacesServerFn()).rejects.toThrow('forbidden');
    expect(state.listStoredInterfaces).not.toHaveBeenCalled();
  });

  it('delegates saving to the settings contract with request context and payload', async () => {
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
    state.saveSvaMainserverSettings.mockResolvedValue(config);

    const { saveSvaMainserverInterfaceSettings } = await import('./interfaces-api');

    await expect(saveSvaMainserverInterfaceSettings({ data: payload })).resolves.toEqual(config);
    expect(state.withAuthenticatedUser).toHaveBeenCalledWith(state.request, expect.any(Function));
    expect(state.saveSvaMainserverSettings).toHaveBeenCalledWith({
      instanceId: 'de-musterhausen',
      graphqlBaseUrl: payload.graphqlBaseUrl,
      oauthTokenUrl: payload.oauthTokenUrl,
      enabled: true,
    });
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

  it('rejects interface upserts for foreign instance ids before mutating stored interfaces', async () => {
    state.withAuthenticatedUser.mockImplementation(
      async (_request: Request, handler: (ctx: { user: { id: string; instanceId?: string; roles: string[] } }) => Promise<unknown>) =>
        handler({
          user: {
            id: 'subject-1',
            instanceId: 'de-musterhausen',
            roles: ['interface_manager'],
          },
        })
    );

    const { upsertInstanceInterfaceServerFn } = await import('./interfaces-api');

    await expect(
      upsertInstanceInterfaceServerFn({
        data: {
          instanceId: 'other-instance',
          draft: {
            type: 's3',
            name: 'Uploads',
            enabled: true,
            config: {
              endpoint: 'https://s3.example',
              region: 'eu-central-1',
              bucket: 'uploads',
              accessKeyId: 'key-1',
              secretAccessKey: 'secret-1',
              forcePathStyle: false,
            },
          },
        },
      })
    ).rejects.toThrow('forbidden');

    expect(state.upsertStoredInterface).not.toHaveBeenCalled();
  });

  it('delegates custom interface upserts to the registry-backed adapter', async () => {
    state.withAuthenticatedUser.mockImplementation(
      async (_request: Request, handler: (ctx: { user: { id: string; instanceId?: string; roles: string[] } }) => Promise<unknown>) =>
        handler({
          user: {
            id: 'subject-1',
            instanceId: 'de-musterhausen',
            roles: ['interface_manager'],
          },
        })
    );
    state.upsertStoredInterface.mockResolvedValue({
      id: 's3-1',
      instanceId: 'de-musterhausen',
      type: 's3',
      name: 'Uploads',
      enabled: true,
      config: {
        endpoint: 'https://s3.example',
        region: 'eu-central-1',
        bucket: 'uploads',
        accessKeyId: 'key-1',
        forcePathStyle: false,
      },
      createdAt: '2026-05-12T08:00:00.000Z',
      updatedAt: '2026-05-12T08:00:00.000Z',
    });

    const { upsertInstanceInterfaceServerFn } = await import('./interfaces-api');

    await expect(
      upsertInstanceInterfaceServerFn({
        data: {
          instanceId: 'de-musterhausen',
          draft: {
            type: 's3',
            name: 'Uploads',
            enabled: true,
            config: {
              endpoint: 'https://s3.example',
              region: 'eu-central-1',
              bucket: 'uploads',
              accessKeyId: 'key-1',
              secretAccessKey: 'secret-1',
              forcePathStyle: false,
            },
          },
        },
      })
    ).resolves.toEqual(
      expect.objectContaining({
        id: 's3-1',
        type: 's3',
        instanceId: 'de-musterhausen',
      })
    );

    expect(state.upsertStoredInterface).toHaveBeenCalledWith(
      'de-musterhausen',
      expect.objectContaining({
        type: 's3',
        name: 'Uploads',
      }),
      undefined
    );
    expect(state.runStoredInterfaceHealthcheck).toHaveBeenCalledWith({
      instanceId: 'de-musterhausen',
      interfaceId: 's3-1',
    });
  });

  it('rejects supabase interface upserts when the waste-management module is not assigned', async () => {
    state.withAuthenticatedUser.mockImplementation(
      async (_request: Request, handler: (ctx: { user: { id: string; instanceId?: string; roles: string[] } }) => Promise<unknown>) =>
        handler({
          user: {
            id: 'subject-1',
            instanceId: 'de-musterhausen',
            roles: ['interface_manager'],
          },
        })
    );
    state.loadInstanceById.mockResolvedValue({
      instanceId: 'de-musterhausen',
      assignedModules: ['news'],
    });

    const { upsertInstanceInterfaceServerFn } = await import('./interfaces-api');

    await expect(
      upsertInstanceInterfaceServerFn({
        data: {
          instanceId: 'de-musterhausen',
          draft: {
            type: 'supabase',
            name: 'Abfallkalender',
            enabled: true,
            config: {
              projectUrl: 'https://tenant.supabase.co',
              schemaName: 'wm',
              databaseUrl: 'postgres://db.example.local/wm',
              serviceRoleKey: 'service-role-key',
            },
          },
        },
      })
    ).rejects.toThrow('supabase_requires_waste_management_module');

    expect(state.upsertStoredInterface).not.toHaveBeenCalled();
  });

  it('preserves specific S3 upsert errors for the client', async () => {
    state.withAuthenticatedUser.mockImplementation(
      async (_request: Request, handler: (ctx: { user: { id: string; instanceId?: string; roles: string[] } }) => Promise<unknown>) =>
        handler({
          user: {
            id: 'subject-1',
            instanceId: 'de-musterhausen',
            roles: ['interface_manager'],
          },
        })
    );
    state.upsertStoredInterface.mockRejectedValue(new Error('secret_unreadable'));

    const { upsertInstanceInterfaceServerFn } = await import('./interfaces-api');

    await expect(
      upsertInstanceInterfaceServerFn({
        data: {
          instanceId: 'de-musterhausen',
          draft: {
            type: 's3',
            name: 'Uploads',
            enabled: true,
            config: {
              endpoint: 'https://s3.example',
              region: 'eu-central-1',
              bucket: 'uploads',
              accessKeyId: 'key-1',
              secretAccessKey: 'secret-1',
              forcePathStyle: false,
            },
          },
        },
      })
    ).rejects.toThrow('secret_unreadable');
  });

  it('rejects interface deletions for users without interfaces permissions', async () => {
    state.withAuthenticatedUser.mockImplementation(
      async (_request: Request, handler: (ctx: { user: { id: string; instanceId?: string; roles: string[] } }) => Promise<unknown>) =>
        handler({
          user: {
            id: 'subject-1',
            instanceId: 'de-musterhausen',
            roles: ['editor'],
          },
        })
    );

    const { deleteInstanceInterfaceServerFn } = await import('./interfaces-api');

    await expect(
      deleteInstanceInterfaceServerFn({
        data: {
          instanceId: 'de-musterhausen',
          id: 's3-1',
        },
      })
    ).rejects.toThrow('forbidden');

    expect(state.deleteStoredInterface).not.toHaveBeenCalled();
  });

  it('delegates custom interface deletions to the registry-backed adapter', async () => {
    state.withAuthenticatedUser.mockImplementation(
      async (_request: Request, handler: (ctx: { user: { id: string; instanceId?: string; roles: string[] } }) => Promise<unknown>) =>
        handler({
          user: {
            id: 'subject-1',
            instanceId: 'de-musterhausen',
            roles: ['interface_manager'],
          },
        })
    );
    state.deleteStoredInterface.mockResolvedValue(true);

    const { deleteInstanceInterfaceServerFn } = await import('./interfaces-api');

    await expect(
      deleteInstanceInterfaceServerFn({
        data: {
          instanceId: 'de-musterhausen',
          id: 's3-1',
        },
      })
    ).resolves.toEqual({ deleted: true });

    expect(state.deleteStoredInterface).toHaveBeenCalledWith('de-musterhausen', 's3-1');
  });

  it('rejects interface deletions when the store reports no deleted entry', async () => {
    state.withAuthenticatedUser.mockImplementation(
      async (_request: Request, handler: (ctx: { user: { id: string; instanceId?: string; roles: string[] } }) => Promise<unknown>) =>
        handler({
          user: {
            id: 'subject-1',
            instanceId: 'de-musterhausen',
            roles: ['interface_manager'],
          },
        })
    );
    state.deleteStoredInterface.mockResolvedValue(false);

    const { deleteInstanceInterfaceServerFn } = await import('./interfaces-api');

    await expect(
      deleteInstanceInterfaceServerFn({
        data: {
          instanceId: 'de-musterhausen',
          id: 'missing',
        },
      })
    ).rejects.toThrow('interface_not_found');
  });
});
