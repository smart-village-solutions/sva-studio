import { dispatchSvaMainserverGenericItemsRequest } from '@sva/sva-mainserver/server';

import { refreshProjectionAfterMainserverMutation } from './mainserver-projection-refresh.server.js';

export const dispatchMainserverGenericItemsRequest = async (request: Request): Promise<Response | null> => {
  const response = await dispatchSvaMainserverGenericItemsRequest(request);
  if (response) {
    const pathname = new URL(request.url).pathname;
    const contentType = pathname.startsWith('/api/v1/mainserver/faqs')
      ? 'faq.faq'
      : pathname.startsWith('/api/v1/mainserver/cockpit-cards')
        ? 'cockpit-cards.cockpit-card'
        : 'generic-items.generic-item';
    await refreshProjectionAfterMainserverMutation(request, response, contentType);
  }
  return response;
};
