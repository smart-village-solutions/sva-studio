import type {
  PluginServerExecutionHandler,
  PluginServerHandlerRegistryEntry,
} from '@sva/plugin-sdk';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@sva/server-runtime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@sva/server-runtime')>()),
  getWorkspaceContext: () => ({ requestId: 'request-1' }),
}));

import {
  assertPluginServerHandlerCoverage,
  createPluginServerHandlerDispatcher,
} from './dispatcher.js';

const tenantDescriptor = (): PluginServerHandlerRegistryEntry => ({
  id: 'news.list',
  ownerPluginId: 'news',
  path: '/api/v1/plugins/news/items',
  method: 'GET',
  actionId: 'news.read',
  accessRequirement: {
    kind: 'tenant',
    moduleId: 'news',
    resourceContext: 'collection',
    actions: { mode: 'allOf', values: ['news.read'] },
  },
});

const platformDescriptor = (): PluginServerHandlerRegistryEntry => ({
  ...tenantDescriptor(),
  id: 'news.platform',
  path: '/api/v1/plugins/news/platform',
  actionId: 'news.platform-read',
  accessRequirement: {
    kind: 'platform',
    roles: { mode: 'allOf', values: ['instance_registry_admin'] },
  },
});

const authenticateAs = (user: { id: string; roles: string[]; instanceId?: string }) =>
  vi.fn(async (_request: Request, handler: (context: never) => Promise<Response> | Response) =>
    handler({ sessionId: 'session-1', user } as never)
  );

describe('plugin server handler dispatcher', () => {
  it('rejects incomplete and unknown executable registrations', () => {
    const descriptor = tenantDescriptor();
    expect(() =>
      assertPluginServerHandlerCoverage({
        descriptors: new Map([[descriptor.id, descriptor]]),
        handlers: {},
      })
    ).toThrow('missing_plugin_server_handlers:news.list');
    expect(() =>
      assertPluginServerHandlerCoverage({
        descriptors: new Map(),
        handlers: { 'news.unknown': vi.fn() },
      })
    ).toThrow('unknown_plugin_server_handlers:news.unknown');

    const duplicateEndpoint = { ...descriptor, id: 'news.list-duplicate' };
    expect(() =>
      assertPluginServerHandlerCoverage({
        descriptors: new Map([
          [descriptor.id, descriptor],
          [duplicateEndpoint.id, duplicateEndpoint],
        ]),
        handlers: {
          [descriptor.id]: vi.fn(),
          [duplicateEndpoint.id]: vi.fn(),
        },
      })
    ).toThrow(
      'duplicate_plugin_server_endpoint:GET /api/v1/plugins/news/items:news.list:news.list-duplicate'
    );
  });

  it('matches exact paths and returns method information without authenticating', async () => {
    const descriptor = tenantDescriptor();
    const authenticate = authenticateAs({ id: 'user-1', roles: [], instanceId: 'tenant-a' });
    const dispatch = createPluginServerHandlerDispatcher({
      descriptors: new Map([[descriptor.id, descriptor]]),
      handlers: { [descriptor.id]: vi.fn() },
      dependencies: { authenticate },
    });

    await expect(
      dispatch(new Request('https://tenant.test/api/v1/plugins/news/other'))
    ).resolves.toBeNull();
    const response = await dispatch(
      new Request('https://tenant.test/api/v1/plugins/news/items', { method: 'POST' })
    );
    expect(response?.status).toBe(405);
    expect(response?.headers.get('Allow')).toBe('GET');
    expect(authenticate).not.toHaveBeenCalled();
  });

  it('authorizes tenant activation and permissions before invoking the handler', async () => {
    const descriptor = tenantDescriptor();
    const handler = vi.fn<PluginServerExecutionHandler>(() => new Response('ok'));
    const dispatch = createPluginServerHandlerDispatcher({
      descriptors: new Map([[descriptor.id, descriptor]]),
      handlers: { [descriptor.id]: handler },
      dependencies: {
        authenticate: authenticateAs({ id: 'user-1', roles: [], instanceId: 'tenant-a' }),
        readTenantAccess: vi.fn().mockResolvedValue({ allowed: true, reason: 'ready' }),
        resolvePermissions: vi.fn().mockResolvedValue({
          ok: true,
          permissions: [{ action: 'news.read', resourceType: 'news' }],
        }),
      },
    });

    const response = await dispatch(new Request('https://tenant.test/api/v1/plugins/news/items'));
    expect(response?.status).toBe(200);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        pluginId: 'news',
        handlerId: 'news.list',
        scope: 'tenant',
        actor: expect.objectContaining({ id: 'user-1', instanceId: 'tenant-a' }),
      })
    );
  });

  it('denies inactive tenant and non-root platform requests before execution', async () => {
    const tenant = tenantDescriptor();
    const platform = platformDescriptor();
    const handler = vi.fn(() => new Response('unexpected'));
    const tenantDispatch = createPluginServerHandlerDispatcher({
      descriptors: new Map([[tenant.id, tenant]]),
      handlers: { [tenant.id]: handler },
      dependencies: {
        authenticate: authenticateAs({ id: 'user-1', roles: [], instanceId: 'tenant-a' }),
        readTenantAccess: vi.fn().mockResolvedValue({ allowed: false, reason: 'inactive' }),
      },
    });
    const platformDispatch = createPluginServerHandlerDispatcher({
      descriptors: new Map([[platform.id, platform]]),
      handlers: { [platform.id]: handler },
      dependencies: {
        authenticate: authenticateAs({ id: 'admin-1', roles: ['instance_registry_admin'] }),
        isPlatformHost: () => false,
      },
    });

    expect(
      (await tenantDispatch(new Request('https://tenant.test/api/v1/plugins/news/items')))?.status
    ).toBe(403);
    expect(
      (await platformDispatch(new Request('https://tenant.test/api/v1/plugins/news/platform')))
        ?.status
    ).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });
});
