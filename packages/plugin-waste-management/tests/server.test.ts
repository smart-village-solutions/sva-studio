import { describe, expect, it, vi } from 'vitest';

const wasteHandler = vi.hoisted(() => vi.fn(async () => new Response('waste-handler')));

vi.mock('@sva/waste-management-runtime/server', () => ({
  wasteManagementHttpRuntime: {
    createWasteManagementHandlers: () => new Proxy({}, { get: () => wasteHandler }),
  },
}));
vi.mock('../src/server-context.js', () => ({
  sharedWasteManagementDeps: {},
  withAuthenticatedWasteManagementHandler: vi.fn(),
}));
vi.mock('../src/server-loaders.js', () => ({
  wasteManagementOverviewLoaders: {},
  wasteManagementEntityLoaders: {},
  wasteManagementEntitySavers: {},
  wasteManagementServerLoaderInternals: {},
}));

import { pluginWasteManagement } from '../src/plugin.js';
import { createPluginServerHandlers } from '../src/server.js';

describe('Waste server entry', () => {
  it('binds every declared method to the Waste handler', async () => {
    const bindings = createPluginServerHandlers();
    const descriptors = pluginWasteManagement.serverHandlers ?? [];
    expect(Object.keys(bindings).sort()).toEqual(descriptors.map(({ id }) => id).sort());

    const request = new Request('https://studio.test/api/v1/waste-management/history');
    const response = await bindings['waste-management.getHistory.get']?.({
      request,
      pluginId: 'waste-management',
      handlerId: 'waste-management.getHistory.get',
      scope: 'tenant',
      pathParams: {},
      actor: { id: 'user-1', roles: [], instanceId: 'tenant-a' },
    });
    expect(response?.status).toBe(200);
    expect(wasteHandler).toHaveBeenCalledWith(request);
  });
});
