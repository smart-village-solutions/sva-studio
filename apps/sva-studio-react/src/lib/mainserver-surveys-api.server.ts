import { dispatchSvaMainserverSurveysRequest } from '@sva/sva-mainserver/server';

import { refreshProjectionAfterMainserverMutation } from './mainserver-projection-refresh.server.js';

export const dispatchMainserverSurveysRequest = async (request: Request): Promise<Response | null> => {
  const response = await dispatchSvaMainserverSurveysRequest(request);
  if (response) {
    await refreshProjectionAfterMainserverMutation(request, response, 'surveys.survey');
  }
  return response;
};
