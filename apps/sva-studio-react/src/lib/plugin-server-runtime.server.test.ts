import type { PluginManifest, PluginServerExecutionHandler } from '@sva/plugin-sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authRuntimeMocks = vi.hoisted(() => ({
  createPluginServerHandlerDispatcher: vi.fn(() => async () => null),
  createSsfRuntimePluginServiceAccess: vi.fn(
    (_dependencies?: {
      readAuthorizationRevision: (instanceId: string) => Promise<string | null>;
      readDatabaseReadiness: (instanceId: string) => Promise<boolean>;
    }) => ({
      authenticateService: vi.fn(),
      bindServiceTenant: vi.fn(),
    })
  ),
}));

const ssfRuntimeMocks = vi.hoisted(() => ({
  pool: {} as object,
  readReadySsfAuthorizationRevision: vi.fn(),
  readSsfTenant: vi.fn(),
  resolveSsfDatabasePool: vi.fn(),
}));

vi.mock('@sva/auth-runtime/server', () => authRuntimeMocks);
vi.mock('@sva/plugin-ssf/runtime', () => ssfRuntimeMocks);

vi.mock('./plugins.js', () => ({
  studioPluginSnapshot: {
    pluginSources: [],
    registry: { pluginServerHandlerRegistry: new Map() },
  },
}));

import {
  createPluginServerExecutionHandlersFromSnapshot,
  createStudioPluginServerHandlerDispatcher,
} from './plugin-server-runtime.server.js';

const source = (pluginId: string) => ({
  pluginId,
  sourceType: 'workspace' as const,
  sourceRef: `packages/plugin-${pluginId}`,
  manifest: {
    pluginId,
    entryPoints: { server: './dist/server.js' },
  } as PluginManifest,
});

describe('plugin server runtime loader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ssfRuntimeMocks.resolveSsfDatabasePool.mockReturnValue(null);
  });

  it('loads executable bindings only from declared server entries', async () => {
    const handler: PluginServerExecutionHandler = () => new Response('ok');
    const loadServerModule = vi.fn().mockResolvedValue({
      createPluginServerHandlers: () => ({ 'news.list': handler }),
    });

    await expect(
      createPluginServerExecutionHandlersFromSnapshot({
        pluginSources: [source('news')],
        loadServerModule,
      })
    ).resolves.toEqual({ 'news.list': handler });
    expect(loadServerModule).toHaveBeenCalledWith(source('news'));
  });

  it('fails closed for a missing factory or duplicate handler binding', async () => {
    await expect(
      createPluginServerExecutionHandlersFromSnapshot({
        pluginSources: [source('news')],
        loadServerModule: vi.fn().mockResolvedValue({}),
      })
    ).rejects.toThrow('missing_plugin_server_module_factory:news');

    await expect(
      createPluginServerExecutionHandlersFromSnapshot({
        pluginSources: [source('news'), source('weather')],
        loadServerModule: vi.fn().mockResolvedValue({
          createPluginServerHandlers: () => ({ 'shared.handler': () => new Response() }),
        }),
      })
    ).rejects.toThrow('duplicate_plugin_server_handler_binding:shared.handler');
  });

  it('rejects non-function server handler bindings before publication', async () => {
    await expect(
      createPluginServerExecutionHandlersFromSnapshot({
        pluginSources: [source('news')],
        loadServerModule: vi.fn().mockResolvedValue({
          createPluginServerHandlers: () => ({ 'news.list': 'not-a-handler' }),
        }),
      })
    ).rejects.toThrow('invalid_plugin_server_handler_binding:news:news.list');
  });

  it('installs fail-closed SSF service access while preserving explicit test overrides', async () => {
    const authenticateService = vi.fn();

    await createStudioPluginServerHandlerDispatcher({
      dependencies: { authenticateService },
    });

    expect(authRuntimeMocks.createSsfRuntimePluginServiceAccess).toHaveBeenCalledTimes(1);
    expect(authRuntimeMocks.createSsfRuntimePluginServiceAccess).toHaveBeenCalledWith({
      readAuthorizationRevision: expect.any(Function),
      readDatabaseReadiness: expect.any(Function),
    });
    expect(authRuntimeMocks.createPluginServerHandlerDispatcher).toHaveBeenCalledWith(
      expect.objectContaining({
        dependencies: expect.objectContaining({
          authenticateService,
          bindServiceTenant: expect.any(Function),
        }),
      })
    );
  });

  it('binds SSF readiness providers to one configured plugin database pool', async () => {
    ssfRuntimeMocks.resolveSsfDatabasePool.mockReturnValue(ssfRuntimeMocks.pool);
    ssfRuntimeMocks.readSsfTenant.mockResolvedValue({ instanceId: 'tenant-a' });
    ssfRuntimeMocks.readReadySsfAuthorizationRevision.mockResolvedValue('sha256:revision');

    await createStudioPluginServerHandlerDispatcher();

    const dependencies = authRuntimeMocks.createSsfRuntimePluginServiceAccess.mock.calls.at(-1)?.[0];
    if (!dependencies) throw new Error('missing_ssf_runtime_dependencies');
    await expect(dependencies.readDatabaseReadiness('tenant-a')).resolves.toBe(true);
    await expect(dependencies.readAuthorizationRevision('tenant-a')).resolves.toBe(
      'sha256:revision'
    );
    expect(ssfRuntimeMocks.readSsfTenant).toHaveBeenCalledWith(ssfRuntimeMocks.pool, 'tenant-a');
    expect(ssfRuntimeMocks.readReadySsfAuthorizationRevision).toHaveBeenCalledWith(
      ssfRuntimeMocks.pool,
      'tenant-a'
    );
  });

  it('keeps SSF readiness closed without a configured plugin database', async () => {
    ssfRuntimeMocks.resolveSsfDatabasePool.mockReturnValue(null);

    await createStudioPluginServerHandlerDispatcher();

    const dependencies = authRuntimeMocks.createSsfRuntimePluginServiceAccess.mock.calls.at(-1)?.[0];
    if (!dependencies) throw new Error('missing_ssf_runtime_dependencies');
    await expect(dependencies.readDatabaseReadiness('tenant-a')).resolves.toBe(false);
    await expect(dependencies.readAuthorizationRevision('tenant-a')).resolves.toBeNull();
    expect(ssfRuntimeMocks.readSsfTenant).not.toHaveBeenCalled();
    expect(ssfRuntimeMocks.readReadySsfAuthorizationRevision).not.toHaveBeenCalled();
  });
});
