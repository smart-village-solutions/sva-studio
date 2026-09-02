import type { PluginManifest, PluginServerExecutionHandler } from '@sva/plugin-sdk';
import { describe, expect, it, vi } from 'vitest';

const authRuntimeMocks = vi.hoisted(() => ({
  createPluginServerHandlerDispatcher: vi.fn(() => async () => null),
  createSsfRuntimePluginServiceAccess: vi.fn(() => ({
    authenticateService: vi.fn(),
    bindServiceTenant: vi.fn(),
  })),
}));

vi.mock('@sva/auth-runtime/server', () => authRuntimeMocks);

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
    expect(authRuntimeMocks.createPluginServerHandlerDispatcher).toHaveBeenCalledWith(
      expect.objectContaining({
        dependencies: expect.objectContaining({
          authenticateService,
          bindServiceTenant: expect.any(Function),
        }),
      })
    );
  });
});
