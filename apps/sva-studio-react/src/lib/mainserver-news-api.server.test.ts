import { describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  dispatchSvaMainserverNewsRequest: vi.fn(),
}));

vi.mock('@sva/sva-mainserver/server', () => ({
  dispatchSvaMainserverNewsRequest: state.dispatchSvaMainserverNewsRequest,
}));

import { dispatchMainserverNewsRequest } from './mainserver-news-api.server';

describe('mainserver news app adapter', () => {
  it('delegates to the package news route contract', async () => {
    const response = new Response('news', { status: 200 });
    const request = new Request('https://studio.test/api/v1/mainserver/news');
    state.dispatchSvaMainserverNewsRequest.mockResolvedValue(response);

    await expect(dispatchMainserverNewsRequest(request)).resolves.toBe(response);
    expect(state.dispatchSvaMainserverNewsRequest).toHaveBeenCalledWith(request);
  });
});
