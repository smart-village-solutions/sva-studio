import { dispatchSvaMainserverNewsRequest } from '@sva/sva-mainserver/server';
import { refreshProjectionAfterMainserverMutation } from './mainserver-projection-refresh.server.js';

export const dispatchMainserverNewsRequest = async (request: Request): Promise<Response | null> => {
  const response = await dispatchSvaMainserverNewsRequest(request);
  if (response) {
    await refreshProjectionAfterMainserverMutation(request, response, 'news.article');
  }
  return response;
};
