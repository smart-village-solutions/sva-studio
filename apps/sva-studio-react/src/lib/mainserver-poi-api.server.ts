import { dispatchSvaMainserverPoiRequest } from '@sva/sva-mainserver/server';
import { refreshProjectionAfterMainserverMutation } from './mainserver-projection-refresh.server.js';

export const dispatchMainserverPoiRequest = async (request: Request): Promise<Response | null> => {
  const response = await dispatchSvaMainserverPoiRequest(request);
  if (response) {
    await refreshProjectionAfterMainserverMutation(request, response, 'poi.point-of-interest');
  }
  return response;
};
