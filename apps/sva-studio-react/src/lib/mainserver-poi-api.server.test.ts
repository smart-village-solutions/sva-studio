import { describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  dispatchSvaMainserverPoiRequest: vi.fn(),
}));

vi.mock('@sva/sva-mainserver/server', () => ({
  dispatchSvaMainserverPoiRequest: state.dispatchSvaMainserverPoiRequest,
}));

import { dispatchMainserverPoiRequest } from './mainserver-poi-api.server';

describe('mainserver poi app adapter', () => {
  it('delegates to the package poi route contract', async () => {
    const response = new Response('poi', { status: 200 });
    const request = new Request('https://studio.test/api/v1/mainserver/poi');
    state.dispatchSvaMainserverPoiRequest.mockResolvedValue(response);

    await expect(dispatchMainserverPoiRequest(request)).resolves.toBe(response);
    expect(state.dispatchSvaMainserverPoiRequest).toHaveBeenCalledWith(request);
  });
});
