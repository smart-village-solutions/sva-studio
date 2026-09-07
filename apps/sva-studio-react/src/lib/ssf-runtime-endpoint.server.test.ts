import type { InstanceRegistryRecord } from '@sva/core';
import {
  createPluginServerHandlerDispatcher,
  createSsfRuntimePluginServiceAccess,
} from '@sva/auth-runtime/server';
import type { PluginServerHandlerRegistryEntry } from '@sva/plugin-sdk';
import { describe, expect, it, vi } from 'vitest';

import {
  SSF_RUNTIME_ENDPOINT_PATH,
  SSF_RUNTIME_INSTANCE_HEADER,
  SSF_RUNTIME_SERVER_HANDLER_ID,
  SSF_RUNTIME_SERVICE_ACTION,
  SSF_RUNTIME_SERVICE_ID,
  type SsfRuntimeConfiguration,
} from '../../../../packages/plugin-ssf/src/index.js';
import { createSsfPluginServerHandlers } from '../../../../packages/plugin-ssf/src/server/index.js';

const authorizationRevision = `sha256:${'a'.repeat(64)}` as const;
const configurationRevision = `sha256:${'b'.repeat(64)}` as const;

const descriptor: PluginServerHandlerRegistryEntry = {
  id: SSF_RUNTIME_SERVER_HANDLER_ID,
  ownerPluginId: 'ssf',
  path: SSF_RUNTIME_ENDPOINT_PATH,
  method: 'GET',
  actionId: SSF_RUNTIME_SERVICE_ACTION,
  accessRequirement: {
    kind: 'service',
    serviceId: SSF_RUNTIME_SERVICE_ID,
    tenantBinding: { kind: 'header', headerName: SSF_RUNTIME_INSTANCE_HEADER },
  },
};

const instance: InstanceRegistryRecord = {
  instanceId: 'tenant-a',
  displayName: 'Tenant A',
  status: 'active',
  parentDomain: 'studio.test',
  primaryHostname: 'tenant-a.studio.test',
  realmMode: 'existing',
  authRealm: 'tenant-a',
  authClientId: 'studio',
  authClientSecretConfigured: true,
  assignedModules: ['ssf'],
  featureFlags: {},
  createdAt: '2026-09-02T00:00:00.000Z',
  updatedAt: '2026-09-02T00:00:00.000Z',
};

const configuration: SsfRuntimeConfiguration = {
  contractVersion: '1.0',
  tenant: { id: 'tenant-a', displayName: 'Tenant A', timeZone: 'Europe/Berlin' },
  branding: { logo: null, icon: null },
  localization: {
    defaultLocale: 'de',
    locales: [
      {
        locale: 'de',
        authenticatedHomeExplanationHtml: '<p>Willkommen</p>',
        guestExplanationHtml: '<p>Willkommen</p>',
        conversationContentStorageQuestionHtml: null,
      },
    ],
  },
  conversationContentStorage: { mode: 'disabled' },
  configurationRevision,
  authorizationRevision,
};

const createEndpoint = (runtimeHandler = vi.fn().mockResolvedValue(configuration)) => {
  const access = createSsfRuntimePluginServiceAccess({
    authenticateToken: vi.fn().mockResolvedValue({
      kind: 'authenticated',
      subject: 'service-subject',
    }),
    readInstance: vi.fn().mockResolvedValue(instance),
    readPluginAccess: vi.fn().mockResolvedValue({ allowed: true, reason: 'ready' }),
    readDatabaseReadiness: vi.fn().mockResolvedValue(true),
    readAuthorizationRevision: vi.fn().mockResolvedValue(authorizationRevision),
    readTimeZone: vi.fn().mockResolvedValue('Europe/Berlin'),
    emitSecurityAudit: vi.fn().mockResolvedValue(undefined),
  });
  return {
    runtimeHandler,
    dispatch: createPluginServerHandlerDispatcher({
      descriptors: new Map([[descriptor.id, descriptor]]),
      handlers: createSsfPluginServerHandlers({ runtimeHandler }),
      dependencies: access,
    }),
  };
};

const request = (overrides: { authorization?: string; query?: string } = {}) =>
  new Request(`https://studio.test${SSF_RUNTIME_ENDPOINT_PATH}${overrides.query ?? ''}`, {
    headers: {
      Authorization: overrides.authorization ?? 'Bearer valid-token',
      [SSF_RUNTIME_INSTANCE_HEADER]: 'tenant-a',
      'X-Correlation-Id': 'correlation-1',
    },
  });

describe('SSF runtime endpoint integration', () => {
  it('dispatches an authenticated and fully bound request to the plugin handler', async () => {
    const endpoint = createEndpoint();

    const response = await endpoint.dispatch(request());

    expect(response?.status).toBe(200);
    await expect(response?.json()).resolves.toEqual(configuration);
    expect(endpoint.runtimeHandler).toHaveBeenCalledOnce();
  });

  it('blocks browser-like and competing tenant requests before domain execution', async () => {
    const endpoint = createEndpoint();

    const browserResponse = await endpoint.dispatch(request({ authorization: '' }));
    const competingTenantResponse = await endpoint.dispatch(
      request({ query: '?instanceId=tenant-b' })
    );

    expect(browserResponse?.status).toBe(401);
    expect(competingTenantResponse?.status).toBe(404);
    expect(endpoint.runtimeHandler).not.toHaveBeenCalled();
  });
});
