import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { ssfPlugin } from '../src/index.js';
import {
  SSF_RUNTIME_ENDPOINT_PATH,
  SSF_RUNTIME_INSTANCE_HEADER,
  SSF_RUNTIME_SERVER_HANDLER_ID,
  SSF_RUNTIME_SERVICE_ACTION,
  SSF_RUNTIME_SERVICE_ID,
} from '../src/constants.js';

describe('SSF plugin metadata', () => {
  it('uses the approved namespace and declares only the internal V1 service contribution', () => {
    const manifest = JSON.parse(
      readFileSync(new URL('../plugin.manifest.json', import.meta.url), 'utf8')
    ) as Record<string, unknown>;

    expect(ssfPlugin).toMatchObject({
      id: 'ssf',
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
            tenantBinding: { kind: 'header', headerName: SSF_RUNTIME_INSTANCE_HEADER },
          },
        },
      ],
      contentHistory: { mode: 'none', reasonCode: 'infrastructure_only' },
    });
    expect(manifest).toMatchObject({
      pluginId: 'ssf',
      manifestVersion: 1,
      extensionTier: 'admin',
      tenantActivationPolicy: 'automatic',
    });
    expect(manifest['hostCompatibility']).toMatchObject({
      requiredCapabilities: ['iam', 'server'],
    });
    expect(manifest['entryPoints']).toEqual({
      browser: './dist/index.js',
      server: './dist/server/index.js',
    });
  });
});
