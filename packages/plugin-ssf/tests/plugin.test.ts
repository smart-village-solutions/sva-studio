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
  it('keeps the runtime service and adds separated Root and Tenant administration', () => {
    const manifest = JSON.parse(
      readFileSync(new URL('../plugin.manifest.json', import.meta.url), 'utf8')
    ) as Record<string, unknown>;

    expect(ssfPlugin).toMatchObject({
      id: 'ssf',
      routes: expect.arrayContaining([
        expect.objectContaining({
          id: 'ssf-system-configuration',
          accessRequirement: expect.objectContaining({ kind: 'platform' }),
        }),
        expect.objectContaining({
          id: 'ssf-tenant-configuration',
          accessRequirement: expect.objectContaining({ kind: 'tenant', moduleId: 'ssf' }),
        }),
      ]),
      serverHandlers: expect.arrayContaining([
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
      ]),
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
      browser: './dist/browser.js',
      server: './dist/server/index.js',
    });
  });
});
