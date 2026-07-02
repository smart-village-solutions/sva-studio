import { describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  dispatchSvaMainserverSurveysRequest: vi.fn(),
  refreshProjectionAfterMainserverMutation: vi.fn(),
}));

vi.mock('@sva/sva-mainserver/server', () => ({
  dispatchSvaMainserverSurveysRequest: state.dispatchSvaMainserverSurveysRequest,
}));

vi.mock('./mainserver-projection-refresh.server', () => ({
  refreshProjectionAfterMainserverMutation: state.refreshProjectionAfterMainserverMutation,
}));

import { dispatchMainserverSurveysRequest } from './mainserver-surveys-api.server';

describe('mainserver surveys app adapter', () => {
  it('delegates to the package surveys route contract', async () => {
    const response = new Response('surveys', { status: 200 });
    const request = new Request('https://studio.test/api/v1/mainserver/surveys');
    state.dispatchSvaMainserverSurveysRequest.mockResolvedValue(response);

    await expect(dispatchMainserverSurveysRequest(request)).resolves.toBe(response);
    expect(state.dispatchSvaMainserverSurveysRequest).toHaveBeenCalledWith(request);
    expect(state.refreshProjectionAfterMainserverMutation).toHaveBeenCalledWith(
      request,
      response,
      'surveys.survey'
    );
  });
});
