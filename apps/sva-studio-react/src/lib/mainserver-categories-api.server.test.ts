import { describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  dispatchSvaMainserverCategoriesRequest: vi.fn(),
}));

vi.mock('@sva/sva-mainserver/server', () => ({
  dispatchSvaMainserverCategoriesRequest: state.dispatchSvaMainserverCategoriesRequest,
}));

import { dispatchMainserverCategoriesRequest } from './mainserver-categories-api.server';

describe('mainserver categories app adapter', () => {
  it('delegates to the package categories route contract', async () => {
    const response = new Response('categories', { status: 200 });
    const request = new Request('https://studio.test/api/v1/mainserver/categories');
    state.dispatchSvaMainserverCategoriesRequest.mockResolvedValue(response);

    await expect(dispatchMainserverCategoriesRequest(request)).resolves.toBe(response);
    expect(state.dispatchSvaMainserverCategoriesRequest).toHaveBeenCalledWith(request);
  });
});
