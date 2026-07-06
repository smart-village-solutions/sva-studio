import { afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  dispatchSvaMainserverGenericItemsRequest: vi.fn(),
  refreshProjectionAfterMainserverMutation: vi.fn(),
}));

vi.mock('@sva/sva-mainserver/server', () => ({
  dispatchSvaMainserverGenericItemsRequest: state.dispatchSvaMainserverGenericItemsRequest,
}));

vi.mock('./mainserver-projection-refresh.server', () => ({
  refreshProjectionAfterMainserverMutation: state.refreshProjectionAfterMainserverMutation,
}));

import { dispatchMainserverGenericItemsRequest } from './mainserver-generic-items-api.server';

describe('mainserver generic items app adapter', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('delegates to the package generic items route contract', async () => {
    const response = new Response('generic-items', { status: 200 });
    const request = new Request('https://studio.test/api/v1/mainserver/generic-items');
    state.dispatchSvaMainserverGenericItemsRequest.mockResolvedValue(response);

    await expect(dispatchMainserverGenericItemsRequest(request)).resolves.toBe(response);
    expect(state.dispatchSvaMainserverGenericItemsRequest).toHaveBeenCalledWith(request);
    expect(state.refreshProjectionAfterMainserverMutation).toHaveBeenCalledWith(
      request,
      response,
      'generic-items.generic-item'
    );
  });

  it('does not refresh projections when the mainserver route does not handle the request', async () => {
    const request = new Request('https://studio.test/api/v1/mainserver/other-content');
    state.dispatchSvaMainserverGenericItemsRequest.mockResolvedValue(null);

    await expect(dispatchMainserverGenericItemsRequest(request)).resolves.toBeNull();
    expect(state.refreshProjectionAfterMainserverMutation).not.toHaveBeenCalled();
  });
});
