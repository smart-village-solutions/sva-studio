import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  dispatchSvaMainserverCategoriesRequest: vi.fn(),
  dispatchSvaMainserverMutationCapabilitiesRequest: vi.fn(),
}));

vi.mock('@sva/sva-mainserver/server', () => ({
  dispatchSvaMainserverCategoriesRequest: state.dispatchSvaMainserverCategoriesRequest,
  dispatchSvaMainserverMutationCapabilitiesRequest:
    state.dispatchSvaMainserverMutationCapabilitiesRequest,
}));

import { dispatchMainserverMetadataRequest } from './mainserver-metadata-api.server';

describe('mainserver metadata app adapter', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('delegates to the package categories route contract', async () => {
    const response = new Response('categories', { status: 200 });
    const request = new Request('https://studio.test/api/v1/mainserver/categories');
    state.dispatchSvaMainserverCategoriesRequest.mockResolvedValue(response);

    await expect(dispatchMainserverMetadataRequest(request)).resolves.toBe(response);
    expect(state.dispatchSvaMainserverCategoriesRequest).toHaveBeenCalledWith(request);
  });

  it('handles mutation capabilities before the categories route contract', async () => {
    const response = Response.json({ data: { enabledActions: ['surveys.create'] } });
    const request = new Request('https://studio.test/api/v1/mainserver/mutation-capabilities');
    state.dispatchSvaMainserverMutationCapabilitiesRequest.mockResolvedValue(response);

    await expect(dispatchMainserverMetadataRequest(request)).resolves.toBe(response);
    expect(state.dispatchSvaMainserverCategoriesRequest).not.toHaveBeenCalled();
  });
});
