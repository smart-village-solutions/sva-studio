import { describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  dispatchSvaMainserverEventsRequest: vi.fn(),
  refreshProjectionAfterMainserverMutation: vi.fn(),
}));

vi.mock('@sva/sva-mainserver/server', () => ({
  dispatchSvaMainserverEventsRequest: state.dispatchSvaMainserverEventsRequest,
}));

vi.mock('./mainserver-projection-refresh.server', () => ({
  refreshProjectionAfterMainserverMutation: state.refreshProjectionAfterMainserverMutation,
}));

import { dispatchMainserverEventsRequest } from './mainserver-events-api.server';

describe('mainserver events app adapter', () => {
  it('delegates to the package events route contract', async () => {
    const response = new Response('events', { status: 200 });
    const request = new Request('https://studio.test/api/v1/mainserver/events');
    state.dispatchSvaMainserverEventsRequest.mockResolvedValue(response);

    await expect(dispatchMainserverEventsRequest(request)).resolves.toBe(response);
    expect(state.dispatchSvaMainserverEventsRequest).toHaveBeenCalledWith(request);
    expect(state.refreshProjectionAfterMainserverMutation).toHaveBeenCalledWith(
      request,
      response,
      'events.event-record'
    );
  });
});
