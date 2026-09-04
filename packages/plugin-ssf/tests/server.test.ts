import type {
  PluginServerHandlerExecutionContext,
  PluginTechnicalServiceTenantContext,
} from '@sva/plugin-sdk';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SSF_RUNTIME_SERVER_HANDLER_ID } from '../src/constants.js';
import type { SsfRuntimeConfiguration } from '../src/contracts.js';
import { createPluginServerHandlers, createSsfPluginServerHandlers } from '../src/server/index.js';

const revision = `sha256:${'a'.repeat(64)}` as const;
const configurationRevision = `sha256:${'b'.repeat(64)}` as const;

const tenant: PluginTechnicalServiceTenantContext = {
  instanceId: 'tenant-a',
  displayName: 'Tenant A',
  timeZone: 'Europe/Berlin',
  authorizationRevision: revision,
};

const serviceContext = (): PluginServerHandlerExecutionContext => ({
  request: new Request('https://studio.test/internal/plugins/ssf/v1/runtime-configuration', {
    headers: { 'X-Correlation-Id': 'correlation-1' },
  }),
  pluginId: 'ssf',
  handlerId: SSF_RUNTIME_SERVER_HANDLER_ID,
  scope: 'service',
  service: {
    id: 'ssf-runtime',
    subject: 'service-subject',
    actionId: 'ssf.runtime-configuration.read',
  },
  tenant,
});

const successfulConfiguration: SsfRuntimeConfiguration = {
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
  authorizationRevision: revision,
};

describe('SSF plugin server handler', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('binds the declared handler id and maps the verified service context', async () => {
    const runtimeHandler = vi.fn().mockResolvedValue(successfulConfiguration);
    const handlers = createSsfPluginServerHandlers({ runtimeHandler });

    expect(Object.keys(handlers)).toEqual([SSF_RUNTIME_SERVER_HANDLER_ID]);
    const response = await handlers[SSF_RUNTIME_SERVER_HANDLER_ID]?.(serviceContext());

    expect(runtimeHandler).toHaveBeenCalledWith({
      tenant: { id: 'tenant-a', displayName: 'Tenant A', timeZone: 'Europe/Berlin' },
      authorizationRevision: revision,
    });
    expect(response?.status).toBe(200);
    expect(response?.headers.get('X-Correlation-Id')).toBe('correlation-1');
    await expect(response?.json()).resolves.toEqual(successfulConfiguration);
  });

  it('rejects non-service execution contexts without calling domain logic', async () => {
    const runtimeHandler = vi.fn();
    const handlers = createSsfPluginServerHandlers({ runtimeHandler });
    const userContext: PluginServerHandlerExecutionContext = {
      request: new Request('https://studio.test/api/v1/plugins/ssf/runtime-configuration', {
        headers: { 'X-Correlation-Id': 'correlation-2' },
      }),
      pluginId: 'ssf',
      handlerId: SSF_RUNTIME_SERVER_HANDLER_ID,
      scope: 'platform',
      actor: { id: 'user-a', roles: [] },
    };

    const response = await handlers[SSF_RUNTIME_SERVER_HANDLER_ID]?.(userContext);

    expect(runtimeHandler).not.toHaveBeenCalled();
    expect(response?.status).toBe(503);
  });

  it('maps domain and database failures to the stable V1 response without leaking details', async () => {
    const runtimeHandler = vi.fn().mockRejectedValue(new Error('postgres secret details'));
    const handlers = createSsfPluginServerHandlers({ runtimeHandler });

    const response = await handlers[SSF_RUNTIME_SERVER_HANDLER_ID]?.(serviceContext());
    const body = await response?.text();

    expect(response?.status).toBe(503);
    expect(body).toContain('runtime_configuration_unavailable');
    expect(body).not.toContain('postgres secret details');
    expect(response?.headers.get('X-Correlation-Id')).toBe('correlation-1');
  });

  it('keeps the default server binding unavailable without an explicit database', async () => {
    vi.stubEnv('SVA_STUDIO_SSF_DATABASE_URL', '');

    const response =
      await createPluginServerHandlers()[SSF_RUNTIME_SERVER_HANDLER_ID]?.(serviceContext());

    expect(response?.status).toBe(503);
    await expect(response?.json()).resolves.toMatchObject({
      contractVersion: '1.0',
      error: { code: 'runtime_configuration_unavailable', retryable: true },
    });
  });
});
