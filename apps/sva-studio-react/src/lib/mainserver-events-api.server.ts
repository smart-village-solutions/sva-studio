import { dispatchSvaMainserverEventsRequest } from '@sva/sva-mainserver/server';
import { refreshProjectionAfterMainserverMutation } from './mainserver-projection-refresh.server.js';

export const dispatchMainserverEventsRequest = async (request: Request): Promise<Response | null> => {
  const response = await dispatchSvaMainserverEventsRequest(request);
  if (response) {
    await refreshProjectionAfterMainserverMutation(request, response, 'events.event-record');
  }
  return response;
};
