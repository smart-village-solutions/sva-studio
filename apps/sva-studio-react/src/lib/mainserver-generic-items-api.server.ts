import { dispatchSvaMainserverGenericItemsRequest } from '@sva/sva-mainserver/server';

import { refreshProjectionAfterMainserverMutation } from './mainserver-projection-refresh.server.js';

export const dispatchMainserverGenericItemsRequest = async (request: Request): Promise<Response | null> => {
  const response = await dispatchSvaMainserverGenericItemsRequest(request);
  if (response) {
    await refreshProjectionAfterMainserverMutation(request, response, 'generic-items.generic-item');
  }
  return response;
};
