import { describe, expect, it, vi } from 'vitest';

const hostHandler = vi.hoisted(() => vi.fn(async () => new Response('waste-host')));

vi.mock('@sva/auth-runtime/waste-host', () => ({
  wasteManagementHandlers: new Proxy({}, { get: () => hostHandler }),
}));

import { pluginWasteManagement } from '../src/plugin.js';
import { createPluginServerHandlers } from '../src/server.js';

describe('Waste server entry', () => {
  it('binds every declared method to the host-composed Waste handler', async () => {
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
    expect(hostHandler).toHaveBeenCalledWith(request);
  });
});
