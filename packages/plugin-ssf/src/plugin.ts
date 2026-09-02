import type { PluginDefinition } from '@sva/plugin-sdk';

import {
  SSF_RUNTIME_ENDPOINT_PATH,
  SSF_RUNTIME_INSTANCE_HEADER,
  SSF_RUNTIME_SERVER_HANDLER_ID,
  SSF_RUNTIME_SERVICE_ACTION,
  SSF_RUNTIME_SERVICE_ID,
} from './constants.js';

export const ssfPlugin = {
  id: 'ssf',
  displayName: 'Smart Speech Flow',
  routes: [],
  serverHandlers: [
    {
      id: SSF_RUNTIME_SERVER_HANDLER_ID,
      path: SSF_RUNTIME_ENDPOINT_PATH,
      method: 'GET',
      actionId: SSF_RUNTIME_SERVICE_ACTION,
      accessRequirement: {
        kind: 'service',
        serviceId: SSF_RUNTIME_SERVICE_ID,
        tenantBinding: {
          kind: 'header',
          headerName: SSF_RUNTIME_INSTANCE_HEADER,
        },
      },
    },
  ],
  contentHistory: {
    mode: 'none',
    reasonCode: 'infrastructure_only',
  },
} as const satisfies PluginDefinition;
