import { describe, expect, it, vi } from 'vitest';

const wasteHandler = vi.hoisted(() => vi.fn(async () => new Response('waste-handler')));
const runtimeMocks = vi.hoisted(() => ({
  createWasteJobStarter: vi.fn(() => vi.fn()),
  createWasteServerContext: vi.fn(() => ({ sharedWasteManagementDeps: {} })),
  createWasteServerLoaders: vi.fn(() => ({ loadSettings: vi.fn() })),
}));

vi.mock('@sva/waste-management-runtime/server', () => ({
  wasteManagementHttpRuntime: {
    createWasteManagementHandlers: () => new Proxy({}, { get: () => wasteHandler }),
    ...runtimeMocks,
  },
}));
vi.mock('../src/server-context.js', () => ({
  createWastePluginServerDependencies: vi.fn(() => ({
    sharedWasteManagementDeps: {},
    loaders: {},
    withAuthenticatedWasteManagementHandler: async (ctx: unknown, request: Request, handler: (request: Request, ctx: unknown) => Promise<Response>) => handler(request, ctx),
  })),
}));

import { pluginWasteManagement } from '../src/plugin.js';
import { createPluginServerHandlers } from '../src/server.js';

describe('Waste server entry', () => {
  it('assembles server dependencies only from the supplied host capabilities', async () => {
    const { createWastePluginServerDependencies } =
      await vi.importActual<typeof import('../src/server-context.js')>('../src/server-context.js');
    const capabilities = { resolveIamActorInfo: vi.fn() } as never;

    const dependencies = createWastePluginServerDependencies(capabilities);

    expect(runtimeMocks.createWasteJobStarter).toHaveBeenCalledWith(capabilities);
    expect(runtimeMocks.createWasteServerContext).toHaveBeenCalledWith(
      expect.objectContaining({ resolveIamActorInfo: capabilities.resolveIamActorInfo })
    );
    expect(runtimeMocks.createWasteServerLoaders).toHaveBeenCalledWith(capabilities);
    expect(dependencies).toMatchObject({
      sharedWasteManagementDeps: {},
      loaders: { loadSettings: expect.any(Function) },
    });
    expect(() => createWastePluginServerDependencies(undefined as never)).toThrow(
      'waste_plugin_server_capabilities_required'
    );
  });

  it('binds every declared method to the Waste handler', async () => {
    const capabilities = {} as never;
    const bindings = createPluginServerHandlers(capabilities);
    const descriptors = pluginWasteManagement.serverHandlers ?? [];
    expect(Object.keys(bindings).sort()).toEqual(descriptors.map(({ id }) => id).sort());

    const request = new Request('https://studio.test/api/v1/waste-management/history');
    const response = await bindings['waste-management.getHistory.get']?.({
      request,
      pluginId: 'waste-management',
      handlerId: 'waste-management.getHistory.get',
      scope: 'tenant',
      sessionId: 'session-1',
      pathParams: {},
      actor: { id: 'user-1', roles: [], instanceId: 'tenant-a' },
    });
    expect(response?.status).toBe(200);
    expect(wasteHandler).toHaveBeenCalledWith(request);
  });

  it('rejects service contexts before invoking a tenant Waste handler', async () => {
    const bindings = createPluginServerHandlers({} as never);
    const response = await bindings['waste-management.getHistory.get']?.({
      request: new Request('https://studio.test/api/v1/waste-management/history'),
      pluginId: 'waste-management',
      handlerId: 'waste-management.getHistory.get',
      scope: 'service',
      service: { id: 'service', subject: 'subject', actionId: 'waste.history.read' },
      tenant: { instanceId: 'tenant-a', displayName: 'Tenant', timeZone: 'Europe/Berlin', authorizationRevision: '1' },
    });
    expect(response?.status).toBe(403);
    expect(wasteHandler).not.toHaveBeenCalled();
  });
});
