import { afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  dispatchSvaMainserverGenericItemsRequest: vi.fn(),
  dispatchSvaMainserverConstructionSitesRequest: vi.fn().mockResolvedValue(null),
  dispatchSvaMainserverVouchersRequest: vi.fn().mockResolvedValue(null),
  refreshProjectionAfterMainserverMutation: vi.fn(),
}));

vi.mock('@sva/sva-mainserver/server', () => ({
  dispatchSvaMainserverGenericItemsRequest: state.dispatchSvaMainserverGenericItemsRequest,
  dispatchSvaMainserverConstructionSitesRequest:
    state.dispatchSvaMainserverConstructionSitesRequest,
  dispatchSvaMainserverVouchersRequest: state.dispatchSvaMainserverVouchersRequest,
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

  it('refreshes the project projection after successful project mutations', async () => {
    const response = new Response('project', { status: 201 });
    const request = new Request('https://studio.test/api/v1/mainserver/projects', {
      method: 'POST',
    });
    state.dispatchSvaMainserverGenericItemsRequest.mockResolvedValue(response);

    await expect(dispatchMainserverGenericItemsRequest(request)).resolves.toBe(response);
    expect(state.refreshProjectionAfterMainserverMutation).toHaveBeenCalledWith(
      request,
      response,
      'projects.project'
    );
  });
  it('dispatches construction sites and refreshes their canonical projection', async () => {
    const response = new Response(JSON.stringify({ data: { id: '42' } }), { status: 201 });
    const request = new Request('https://studio.test/api/v1/mainserver/construction-sites', {
      method: 'POST',
    });
    state.dispatchSvaMainserverConstructionSitesRequest.mockResolvedValueOnce(response);
    await expect(dispatchMainserverGenericItemsRequest(request)).resolves.toBe(response);
    expect(state.refreshProjectionAfterMainserverMutation).toHaveBeenCalledWith(
      request,
      response,
      'construction-sites.construction-site'
    );
    expect(state.dispatchSvaMainserverGenericItemsRequest).not.toHaveBeenCalled();
  });
  it('dispatches the optional voucher plugin through the existing adapter', async () => {
    const response = new Response(JSON.stringify({ data: { id: '1' } }), { status: 200 });
    const request = new Request('https://studio.test/api/v1/mainserver/vouchers/commit', {
      method: 'POST',
    });
    state.dispatchSvaMainserverVouchersRequest.mockResolvedValueOnce(response);
    await expect(dispatchMainserverGenericItemsRequest(request)).resolves.toBe(response);
    expect(state.refreshProjectionAfterMainserverMutation).toHaveBeenCalledWith(
      request,
      response,
      'vouchers.voucher'
    );
    expect(state.dispatchSvaMainserverGenericItemsRequest).not.toHaveBeenCalled();
  });
});
