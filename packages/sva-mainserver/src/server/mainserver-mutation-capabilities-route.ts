import { withAuthenticatedUser } from '@sva/auth-runtime/server';

import { errorJson, json } from './content-route-core.js';
import { getEnabledMainserverMutationCapabilities } from './mainserver-mutation-capabilities.js';

export const MAINSERVER_MUTATION_CAPABILITIES_PATH = '/api/v1/mainserver/mutation-capabilities';

export const dispatchSvaMainserverMutationCapabilitiesRequest = async (
  request: Request
): Promise<Response | null> => {
  if (new URL(request.url).pathname !== MAINSERVER_MUTATION_CAPABILITIES_PATH) {
    return null;
  }

  return withAuthenticatedUser(request, async () => {
    if (request.method !== 'GET') {
      return errorJson(
        405,
        'invalid_request',
        'Methode für Mainserver-Capabilities nicht unterstützt.'
      );
    }

    return json({ data: { enabledActions: getEnabledMainserverMutationCapabilities() } });
  });
};
