import { dispatchSvaMainserverGenericItemsRequest } from '@sva/sva-mainserver/server';

import { refreshProjectionAfterMainserverMutation } from './mainserver-projection-refresh.server.js';

export const dispatchMainserverGenericItemsRequest = async (request: Request): Promise<Response | null> => {
  const response = await dispatchSvaMainserverGenericItemsRequest(request);
  if (response) {
    const contentType = new URL(request.url).pathname.startsWith('/api/v1/mainserver/faqs')
      ? 'faq.faq'
      : 'generic-items.generic-item';
    await refreshProjectionAfterMainserverMutation(request, response, contentType);
  }
  return response;
};
