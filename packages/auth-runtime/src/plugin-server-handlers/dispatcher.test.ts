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

const itemDescriptor = (): PluginServerHandlerRegistryEntry => ({
  ...tenantDescriptor(),
  id: 'news.update',
  path: '/api/v1/plugins/news/items/article-1',
  method: 'PATCH',
  actionId: 'news.update',
  accessRequirement: {
    kind: 'tenant',
    moduleId: 'news',
    actions: { mode: 'allOf', values: ['news.update'] },
  },
});

const authenticateAs = (
  user: { id: string; roles: string[]; instanceId?: string },
  activeOrganizationId?: string
) =>
  vi.fn(async (_request: Request, handler: (context: never) => Promise<Response> | Response) =>
    handler({ sessionId: 'session-1', user, activeOrganizationId } as never)
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
    const resolvePermissions = vi.fn().mockResolvedValue({
      ok: true,
      permissions: [{ action: 'news.read', resourceType: 'news' }],
    });
    const dispatch = createPluginServerHandlerDispatcher({
      descriptors: new Map([[descriptor.id, descriptor]]),
      handlers: { [descriptor.id]: handler },
      dependencies: {
        authenticate: authenticateAs(
          { id: 'user-1', roles: [], instanceId: 'tenant-a' },
          'organization-a'
        ),
        readTenantAccess: vi.fn().mockResolvedValue({ allowed: true, reason: 'ready' }),
        resolvePermissions,
      },
    });

    const response = await dispatch(new Request('https://tenant.test/api/v1/plugins/news/items'));
    expect(response?.status).toBe(200);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        pluginId: 'news',
        handlerId: 'news.list',
        scope: 'tenant',
        activeOrganizationId: 'organization-a',
        actor: expect.objectContaining({ id: 'user-1', instanceId: 'tenant-a' }),
      })
    );
    expect(resolvePermissions).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      keycloakSubject: 'user-1',
      organizationId: 'organization-a',
    });
  });

  it('denies tenant collection access without an active organization before resolving grants', async () => {
    const descriptor = tenantDescriptor();
    const handler = vi.fn<PluginServerExecutionHandler>(() => new Response('unexpected'));
    const resolvePermissions = vi.fn().mockResolvedValue({
      ok: true,
      permissions: [{ action: 'news.read', resourceType: 'news' }],
    });
    const dispatch = createPluginServerHandlerDispatcher({
      descriptors: new Map([[descriptor.id, descriptor]]),
      handlers: { [descriptor.id]: handler },
      dependencies: {
        authenticate: authenticateAs({ id: 'user-1', roles: [], instanceId: 'tenant-a' }),
        readTenantAccess: vi.fn().mockResolvedValue({ allowed: true, reason: 'ready' }),
        resolvePermissions,
      },
    });

    const response = await dispatch(new Request('https://tenant.test/api/v1/plugins/news/items'));

    expect(response?.status).toBe(403);
    expect(resolvePermissions).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });

  it.each([
    ['own-scoped', { accessScope: 'own' as const }],
    ['resource-scoped', { resourceId: 'article-1' }],
    ['geo-scoped', { geoScope: 'region-a' }],
    ['custom-scoped', { scope: { region: 'region-a' } }],
  ])('denies tenant collection access backed only by a %s grant', async (_name, scope) => {
    const descriptor = tenantDescriptor();
    const handler = vi.fn<PluginServerExecutionHandler>(() => new Response('unexpected'));
    const dispatch = createPluginServerHandlerDispatcher({
      descriptors: new Map([[descriptor.id, descriptor]]),
      handlers: { [descriptor.id]: handler },
      dependencies: {
        authenticate: authenticateAs(
          { id: 'user-1', roles: [], instanceId: 'tenant-a' },
          'organization-a'
        ),
        readTenantAccess: vi.fn().mockResolvedValue({ allowed: true, reason: 'ready' }),
        resolvePermissions: vi.fn().mockResolvedValue({
          ok: true,
          permissions: [{ action: 'news.read', resourceType: 'news.article', ...scope }],
        }),
      },
    });

    const response = await dispatch(new Request('https://tenant.test/api/v1/plugins/news/items'));

    expect(response?.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it.each([
    ['missing host evidence', undefined],
    [
      'foreign instance',
      {
        action: 'news.update',
        allowed: true,
        instanceId: 'tenant-b',
        organizationId: 'organization-a',
        resourceType: 'news.article',
        resourceId: 'article-1',
      },
    ],
    [
      'foreign organization',
      {
        action: 'news.update',
        allowed: true,
        instanceId: 'tenant-a',
        organizationId: 'organization-b',
        resourceType: 'news.article',
        resourceId: 'article-1',
      },
    ],
    [
      'wrong action',
      {
        action: 'news.delete',
        allowed: true,
        instanceId: 'tenant-a',
        organizationId: 'organization-a',
        resourceType: 'news.article',
        resourceId: 'article-1',
      },
    ],
    [
      'wrong resource type',
      {
        action: 'news.update',
        allowed: true,
        instanceId: 'tenant-a',
        organizationId: 'organization-a',
        resourceType: 'news.category',
        resourceId: 'article-1',
      },
    ],
    [
      'wrong resource id',
      {
        action: 'news.update',
        allowed: true,
        instanceId: 'tenant-a',
        organizationId: 'organization-a',
        resourceType: 'news.article',
        resourceId: 'article-2',
      },
    ],
  ] as const)('denies scoped handlers with %s before invocation', async (_name, evidence) => {
    const descriptor = itemDescriptor();
    const handler = vi.fn<PluginServerExecutionHandler>(() => new Response('unexpected'));
    const dispatch = createPluginServerHandlerDispatcher({
      descriptors: new Map([[descriptor.id, descriptor]]),
      handlers: { [descriptor.id]: handler },
      dependencies: {
        authenticate: authenticateAs(
          { id: 'user-1', roles: [], instanceId: 'tenant-a' },
          'organization-a'
        ),
        readTenantAccess: vi.fn().mockResolvedValue({ allowed: true, reason: 'ready' }),
        resolvePermissions: vi.fn().mockResolvedValue({
          ok: true,
          permissions: [
            {
              action: 'news.update',
              resourceType: 'news.article',
              accessScope: 'organization',
              organizationId: 'organization-a',
              resourceId: 'article-1',
            },
          ],
        }),
        resolveResourceCapability: evidence ? vi.fn().mockResolvedValue(evidence) : undefined,
        validateCsrf: vi.fn(() => null),
      },
    });

    const response = await dispatch(
      new Request('https://tenant.test/api/v1/plugins/news/items/article-1', {
        method: 'PATCH',
      })
    );

    expect(response?.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it.each(['own', 'organization'] as const)(
    'passes only host-derived resource evidence for %s scope into the central evaluator',
    async (accessScope) => {
      const descriptor = itemDescriptor();
      const handler = vi.fn<PluginServerExecutionHandler>(() => new Response('ok'));
      const resolveResourceCapability = vi.fn().mockResolvedValue({
        action: 'news.update',
        allowed: true,
        instanceId: 'tenant-a',
        organizationId: 'organization-a',
        resourceType: 'news.article',
        resourceId: 'article-1',
      });
      const dispatch = createPluginServerHandlerDispatcher({
        descriptors: new Map([[descriptor.id, descriptor]]),
        handlers: { [descriptor.id]: handler },
        dependencies: {
          authenticate: authenticateAs(
            { id: 'user-1', roles: [], instanceId: 'tenant-a' },
            'organization-a'
          ),
          readTenantAccess: vi.fn().mockResolvedValue({ allowed: true, reason: 'ready' }),
          resolvePermissions: vi.fn().mockResolvedValue({
            ok: true,
            permissions: [
              {
                action: 'news.update',
                resourceType: 'news.article',
                accessScope,
                resourceId: 'article-1',
                ...(accessScope === 'organization' ? { organizationId: 'organization-a' } : {}),
              },
            ],
          }),
          resolveResourceCapability,
          validateCsrf: vi.fn(() => null),
        },
      });
      const request = new Request('https://tenant.test/api/v1/plugins/news/items/article-1', {
        method: 'PATCH',
      });

      expect((await dispatch(request))?.status).toBe(200);
      expect(resolveResourceCapability).toHaveBeenCalledWith({
        request,
        descriptor,
        instanceId: 'tenant-a',
        organizationId: 'organization-a',
        actorAccountId: 'user-1',
      });
      expect(handler).toHaveBeenCalledOnce();
    }
  );

  it('rejects mutating handlers when central CSRF validation fails', async () => {
    const descriptor = { ...tenantDescriptor(), id: 'news.create', method: 'POST' as const };
    const handler = vi.fn<PluginServerExecutionHandler>(() => new Response('unexpected'));
    const validateCsrf = vi.fn(() => new Response(null, { status: 403 }));
    const dispatch = createPluginServerHandlerDispatcher({
      descriptors: new Map([[descriptor.id, descriptor]]),
      handlers: { [descriptor.id]: handler },
      dependencies: {
        authenticate: authenticateAs({ id: 'user-1', roles: [], instanceId: 'tenant-a' }),
        validateCsrf,
      },
    });

    const request = new Request('https://tenant.test/api/v1/plugins/news/items', {
      method: 'POST',
    });
    const response = await dispatch(request);

    expect(response?.status).toBe(403);
    expect(validateCsrf).toHaveBeenCalledWith(request, 'request-1');
    expect(handler).not.toHaveBeenCalled();
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

  it('localizes dispatcher errors from the request language', async () => {
    const platform = platformDescriptor();
    const dispatch = createPluginServerHandlerDispatcher({
      descriptors: new Map([[platform.id, platform]]),
      handlers: { [platform.id]: vi.fn() },
      dependencies: {
        authenticate: authenticateAs({ id: 'user-1', roles: [] }),
        isPlatformHost: () => true,
      },
    });

    const response = await dispatch(
      new Request('https://platform.test/api/v1/plugins/news/platform', {
        headers: { 'Accept-Language': 'en-US,en;q=0.9' },
      })
    );

    await expect(response?.json()).resolves.toMatchObject({
      error: {
        message: 'You do not have platform permission for this plugin endpoint.',
      },
    });
  });
});
