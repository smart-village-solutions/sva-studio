import {
  dispatchSvaMainserverCategoriesRequest,
  dispatchSvaMainserverMutationCapabilitiesRequest,
} from '@sva/sva-mainserver/server';

export const dispatchMainserverMetadataRequest = async (
  request: Request
): Promise<Response | null> =>
  (await dispatchSvaMainserverMutationCapabilitiesRequest(request)) ??
  dispatchSvaMainserverCategoriesRequest(request);
