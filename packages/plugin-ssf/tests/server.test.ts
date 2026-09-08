import type {
  PluginServerHandlerExecutionContext,
  PluginTechnicalServiceTenantContext,
} from '@sva/plugin-sdk';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SSF_RUNTIME_SERVER_HANDLER_ID } from '../src/constants.js';
import type { SsfRuntimeConfiguration } from '../src/contracts.js';
import { SsfTenantDefaultLocaleUnavailableError } from '../src/admin-repository.js';
import {
  createPluginServerHandlers,
  createSsfAdminServerHandlers,
  createSsfPluginServerHandlers,
} from '../src/server/index.js';

const revision = `sha256:${'a'.repeat(64)}` as const;
const configurationRevision = `sha256:${'b'.repeat(64)}` as const;

const tenant: PluginTechnicalServiceTenantContext = {
  instanceId: 'tenant-a',
  displayName: 'Tenant A',
  timeZone: 'Europe/Berlin',
  authorizationRevision: revision,
};

const serviceContext = (
  correlationId: string | null = 'correlation-1'
): PluginServerHandlerExecutionContext => ({
  request: new Request('https://studio.test/internal/plugins/ssf/v1/runtime-configuration', {
    headers: correlationId === null ? {} : { 'X-Correlation-Id': correlationId },
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

const emptyOverrides = {
  tenantSettings: null,
  tenantLocales: [],
  serverSettings: null,
  serverLocales: [],
} as const;

const adminContext = (
  scope: 'platform' | 'tenant',
  method: 'GET' | 'PUT',
  body?: unknown
): PluginServerHandlerExecutionContext => ({
  request: new Request('https://studio.test/api/v1/plugins/ssf/configuration', {
    method,
    headers: {
      'X-Correlation-Id': 'admin-correlation-1',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  }),
  pluginId: 'ssf',
  handlerId: 'ssf.configuration',
  scope,
  actor: { id: 'user-a', roles: [], ...(scope === 'tenant' ? { instanceId: 'tenant-a' } : {}) },
});

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

  it.each([
    ['missing', null],
    ['oversized', 'a'.repeat(129)],
    ['non-printable', 'correlation\u007f'],
  ])('does not reflect a %s correlation id', async (_case, correlationId) => {
    const runtimeHandler = vi.fn().mockResolvedValue(successfulConfiguration);
    const handlers = createSsfPluginServerHandlers({ runtimeHandler });

    const response = await handlers[SSF_RUNTIME_SERVER_HANDLER_ID]?.(serviceContext(correlationId));

    expect(response?.status).toBe(200);
    expect(response?.headers.get('X-Correlation-Id')).toBe('unavailable');
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

  it('reads system defaults only in the platform scope', async () => {
    const dependencies = {
      readSystem: vi.fn().mockResolvedValue(emptyOverrides),
      writeSystem: vi.fn(),
      readTenant: vi.fn().mockResolvedValue(emptyOverrides),
      writeTenant: vi.fn(),
    };
    const handlers = createSsfAdminServerHandlers(dependencies);

    const allowed = await handlers['ssf.system-configuration.read']?.(
      adminContext('platform', 'GET')
    );
    const denied = await handlers['ssf.system-configuration.read']?.(adminContext('tenant', 'GET'));

    expect(allowed?.status).toBe(200);
    expect(allowed?.headers.get('X-Correlation-Id')).toBe('admin-correlation-1');
    await expect(allowed?.json()).resolves.toMatchObject({ defaultLocale: 'de-DE' });
    expect(denied?.status).toBe(403);
    expect(dependencies.readSystem).toHaveBeenCalledTimes(1);
  });

  it('binds tenant writes to the verified actor tenant and rejects invalid input atomically', async () => {
    const dependencies = {
      readSystem: vi.fn().mockResolvedValue(emptyOverrides),
      writeSystem: vi.fn(),
      readTenant: vi.fn().mockResolvedValue(emptyOverrides),
      writeTenant: vi.fn().mockResolvedValue(undefined),
    };
    const handlers = createSsfAdminServerHandlers(dependencies);
    const validInput = {
      defaultLocale: null,
      conversationContentStorageMode: null,
      locales: ['de-DE', 'en'].map((locale) => ({
        locale,
        enabled: null,
        authenticatedHomeExplanationHtml: null,
        guestExplanationHtml: null,
        conversationContentStorageQuestionHtml: null,
      })),
    };

    const accepted = await handlers['ssf.tenant-configuration.write']?.(
      adminContext('tenant', 'PUT', validInput)
    );
    const rejected = await handlers['ssf.tenant-configuration.write']?.(
      adminContext('tenant', 'PUT', { ...validInput, locales: [] })
    );

    expect(accepted?.status).toBe(200);
    expect(dependencies.writeTenant).toHaveBeenCalledWith('tenant-a', validInput);
    expect(rejected?.status).toBe(422);
    expect(dependencies.writeTenant).toHaveBeenCalledTimes(1);
  });

  it('maps a transaction-local tenant default validation failure to 422', async () => {
    const handlers = createSsfAdminServerHandlers({
      readSystem: vi.fn().mockResolvedValue(emptyOverrides),
      writeSystem: vi.fn(),
      readTenant: vi.fn().mockResolvedValue(emptyOverrides),
      writeTenant: vi.fn().mockRejectedValue(new SsfTenantDefaultLocaleUnavailableError()),
    });
    const response = await handlers['ssf.tenant-configuration.write']?.(
      adminContext('tenant', 'PUT', {
        defaultLocale: 'en',
        conversationContentStorageMode: null,
        locales: ['de-DE', 'en'].map((locale) => ({
          locale,
          enabled: null,
          authenticatedHomeExplanationHtml: null,
          guestExplanationHtml: null,
          conversationContentStorageQuestionHtml: null,
        })),
      })
    );

    expect(response?.status).toBe(422);
    expect(response?.headers.get('X-Correlation-Id')).toBe('admin-correlation-1');
  });
});
