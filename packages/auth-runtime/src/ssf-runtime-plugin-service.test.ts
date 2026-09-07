import type { InstanceRegistryRecord } from '@sva/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createSsfRuntimePluginServiceAccess,
  resolveSsfTenantReadinessReason,
} from './ssf-runtime-plugin-service.js';

const revision = `sha256:${'a'.repeat(64)}`;

const descriptor = () => ({
  id: 'ssf.runtime-configuration',
  ownerPluginId: 'ssf',
  path: '/internal/plugins/ssf/v1/runtime-configuration',
  method: 'GET' as const,
  actionId: 'ssf.runtime-configuration.read',
  accessRequirement: {
    kind: 'service' as const,
    serviceId: 'ssf-runtime',
    tenantBinding: { kind: 'header' as const, headerName: 'X-Studio-Instance-Id' },
  },
});

const instance = (status: InstanceRegistryRecord['status'] = 'active'): InstanceRegistryRecord => ({
  instanceId: 'tenant-a',
  displayName: 'Tenant A',
  status,
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
});

const request = (overrides: { headers?: HeadersInit; query?: string } = {}) =>
  new Request(
    `https://studio.test/internal/plugins/ssf/v1/runtime-configuration${overrides.query ?? ''}`,
    {
      headers: {
        Authorization: 'Bearer valid-token',
        'X-Studio-Instance-Id': 'tenant-a',
        'X-Correlation-Id': 'correlation-1',
        ...overrides.headers,
      },
    }
  );

const readBody = async (response: Response) =>
  (await response.json()) as {
    contractVersion: string;
    error: { code: string; retryable: boolean; correlationId: string };
  };

describe('SSF runtime plugin service host gates', () => {
  const authenticateToken = vi.fn();
  const readInstance = vi.fn();
  const readPluginAccess = vi.fn();
  const readDatabaseReadiness = vi.fn();
  const readAuthorizationRevision = vi.fn();
  const readTimeZone = vi.fn();
  const emitSecurityAudit = vi.fn();

  beforeEach(() => {
    authenticateToken.mockReset().mockResolvedValue({
      kind: 'authenticated',
      subject: 'service-subject',
    });
    readInstance.mockReset().mockResolvedValue(instance());
    readPluginAccess.mockReset().mockResolvedValue({ allowed: true, reason: 'ready' });
    readDatabaseReadiness.mockReset().mockResolvedValue(true);
    readAuthorizationRevision.mockReset().mockResolvedValue(revision);
    readTimeZone.mockReset().mockResolvedValue('Europe/Berlin');
    emitSecurityAudit.mockReset().mockResolvedValue(undefined);
  });

  const createAccess = () =>
    createSsfRuntimePluginServiceAccess({
      authenticateToken,
      readInstance,
      readPluginAccess,
      readDatabaseReadiness,
      readAuthorizationRevision,
      readTimeZone,
      emitSecurityAudit,
    });

  it.each([
    [false, revision, 'Europe/Berlin', 'ssf_database_not_ready'],
    [true, null, 'Europe/Berlin', 'ssf_authorization_revision_missing'],
    [true, 'invalid', 'Europe/Berlin', 'ssf_authorization_revision_missing'],
    [true, revision, null, 'ssf_tenant_timezone_missing'],
    [true, revision, 'Mars/Olympus', 'ssf_tenant_timezone_missing'],
    [true, revision, 'Europe/Berlin', null],
  ] as const)(
    'reports database=%s, revision=%s and timezone=%s as %s',
    (databaseReady, authorizationRevision, timeZone, expected) => {
      expect(
        resolveSsfTenantReadinessReason({ databaseReady, authorizationRevision, timeZone })
      ).toBe(expected);
    }
  );

  it('authenticates only the exact declared service contract', async () => {
    const access = createAccess();
    const result = await access.authenticateService?.({
      request: request(),
      descriptor: descriptor(),
      serviceId: 'ssf-runtime',
    });

    expect(result).toEqual({
      kind: 'authenticated',
      subject: 'service-subject',
    });
    expect(authenticateToken).toHaveBeenCalledWith('valid-token');

    const wrongAction = { ...descriptor(), actionId: 'ssf.other.read' };
    const rejected = await access.authenticateService?.({
      request: request(),
      descriptor: wrongAction,
      serviceId: 'ssf-runtime',
    });
    expect(rejected?.kind).toBe('rejected');
    if (rejected?.kind === 'rejected') expect(rejected.response.status).toBe(503);
  });

  it.each([
    [undefined, 401, 'service_authentication_invalid'],
    [
      {
        kind: 'rejected' as const,
        status: 403 as const,
        code: 'service_action_forbidden' as const,
        reason: 'missing_action_scope' as const,
      },
      403,
      'service_action_forbidden',
    ],
  ])(
    'rejects missing or invalid service credentials before tenant gates',
    async (result, status, code) => {
      if (result) authenticateToken.mockResolvedValue(result);
      const access = createAccess();
      const authRequest = request(
        result ? {} : { headers: { Authorization: '', 'X-Studio-Instance-Id': 'tenant-a' } }
      );
      const authentication = await access.authenticateService?.({
        request: authRequest,
        descriptor: descriptor(),
        serviceId: 'ssf-runtime',
      });

      expect(authentication?.kind).toBe('rejected');
      if (authentication?.kind === 'rejected') {
        expect(authentication.response.status).toBe(status);
        expect((await readBody(authentication.response)).error.code).toBe(code);
      }
      expect(readInstance).not.toHaveBeenCalled();
      expect(emitSecurityAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'plugin_action_denied',
          outcome: 'denied',
          pluginAction: expect.objectContaining({ reasonCode: code }),
        })
      );
      expect(JSON.stringify(emitSecurityAudit.mock.calls)).not.toContain('valid-token');
    }
  );

  it('binds the canonical active tenant only after every readiness provider succeeds', async () => {
    const access = createAccess();
    const result = await access.bindServiceTenant?.({
      request: request(),
      descriptor: descriptor(),
      serviceId: 'ssf-runtime',
      serviceSubject: 'service-subject',
      tenantHeaderName: 'X-Studio-Instance-Id',
    });

    expect(result).toEqual({
      kind: 'bound',
      tenant: {
        instanceId: 'tenant-a',
        displayName: 'Tenant A',
        timeZone: 'Europe/Berlin',
        authorizationRevision: revision,
      },
    });
    expect(readPluginAccess).toHaveBeenCalledWith('tenant-a', 'ssf');
  });

  it.each([
    ['unknown tenant', () => readInstance.mockResolvedValue(null), 404, 'tenant_not_found'],
    [
      'suspended tenant',
      () => readInstance.mockResolvedValue(instance('suspended')),
      409,
      'tenant_suspended',
    ],
    [
      'inactive plugin',
      () => readPluginAccess.mockResolvedValue({ allowed: false, reason: 'inactive' }),
      409,
      'ssf_plugin_inactive',
    ],
    [
      'pending plugin',
      () => readPluginAccess.mockResolvedValue({ allowed: false, reason: 'pending' }),
      409,
      'ssf_tenant_not_ready',
    ],
    [
      'database not ready',
      () => readDatabaseReadiness.mockResolvedValue(false),
      409,
      'ssf_tenant_not_ready',
    ],
    [
      'missing authorization revision',
      () => readAuthorizationRevision.mockResolvedValue(null),
      409,
      'ssf_tenant_not_ready',
    ],
    [
      'missing tenant timezone',
      () => readTimeZone.mockResolvedValue(null),
      409,
      'ssf_tenant_not_ready',
    ],
    [
      'invalid tenant timezone',
      () => readTimeZone.mockResolvedValue('Mars/Olympus'),
      409,
      'ssf_tenant_not_ready',
    ],
  ] as const)('fails closed for %s', async (_name, arrange, status, code) => {
    arrange();
    const access = createAccess();
    const result = await access.bindServiceTenant?.({
      request: request(),
      descriptor: descriptor(),
      serviceId: 'ssf-runtime',
      serviceSubject: 'service-subject',
      tenantHeaderName: 'X-Studio-Instance-Id',
    });

    expect(result?.kind).toBe('rejected');
    if (result?.kind === 'rejected') {
      expect(result.response.status).toBe(status);
      expect((await readBody(result.response)).error.code).toBe(code);
    }
  });

  it('fails closed while the tenant is still provisioning', async () => {
    readInstance.mockResolvedValue(instance('provisioning'));
    const access = createAccess();

    const result = await access.bindServiceTenant?.({
      request: request(),
      descriptor: descriptor(),
      serviceId: 'ssf-runtime',
      serviceSubject: 'service-subject',
      tenantHeaderName: 'X-Studio-Instance-Id',
    });

    expect(result?.kind).toBe('rejected');
    if (result?.kind === 'rejected') {
      expect(result.response.status).toBe(409);
      await expect(readBody(result.response)).resolves.toMatchObject({
        error: { code: 'ssf_tenant_not_ready', retryable: true },
      });
    }
    expect(readPluginAccess).not.toHaveBeenCalled();
  });

  it.each([
    ['missing correlation', { headers: { 'X-Correlation-Id': '' } }],
    ['foreign query tenant', { query: '?instanceId=tenant-b' }],
    ['invalid tenant id', { headers: { 'X-Studio-Instance-Id': 'Tenant A' } }],
  ])('rejects %s without reading the registry', async (_name, requestOverrides) => {
    const access = createAccess();
    const result = await access.bindServiceTenant?.({
      request: request(requestOverrides),
      descriptor: descriptor(),
      serviceId: 'ssf-runtime',
      serviceSubject: 'service-subject',
      tenantHeaderName: 'X-Studio-Instance-Id',
    });

    expect(result?.kind).toBe('rejected');
    expect(readInstance).not.toHaveBeenCalled();
    expect(emitSecurityAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'plugin_action_denied',
        pluginAction: expect.objectContaining({ reasonCode: 'tenant_not_found' }),
      })
    );
    expect(JSON.stringify(emitSecurityAudit.mock.calls)).not.toContain('tenant-b');
  });

  it('maps registry failures to the stable unavailable response without leaking details', async () => {
    readInstance.mockRejectedValue(new Error('postgres secret details'));
    const access = createAccess();
    const result = await access.bindServiceTenant?.({
      request: request(),
      descriptor: descriptor(),
      serviceId: 'ssf-runtime',
      serviceSubject: 'service-subject',
      tenantHeaderName: 'X-Studio-Instance-Id',
    });

    expect(result?.kind).toBe('rejected');
    if (result?.kind === 'rejected') {
      expect(result.response.status).toBe(503);
      const body = await result.response.text();
      expect(body).toContain('runtime_configuration_unavailable');
      expect(body).not.toContain('postgres secret details');
    }
  });

  it('does not let a security-audit outage replace the authentication rejection', async () => {
    emitSecurityAudit.mockRejectedValue(new Error('audit unavailable'));
    const access = createAccess();

    const result = await access.authenticateService?.({
      request: request({ headers: { Authorization: '' } }),
      descriptor: descriptor(),
      serviceId: 'ssf-runtime',
    });

    expect(result?.kind).toBe('rejected');
    if (result?.kind === 'rejected') expect(result.response.status).toBe(401);
  });

  it('observes successful revisions without consuming the response body', async () => {
    const access = createAccess();
    const responseBody = {
      configurationRevision: `sha256:${'b'.repeat(64)}`,
      authorizationRevision: revision,
    };
    const response = Response.json(responseBody);

    await access.observeServiceResponse?.({
      request: request(),
      descriptor: descriptor(),
      tenant: {
        instanceId: 'tenant-a',
        displayName: 'Tenant A',
        timeZone: 'Europe/Berlin',
        authorizationRevision: revision,
      },
      response,
      durationMs: 12,
    });

    await expect(response.json()).resolves.toEqual(responseBody);
  });

  it('observes failed and malformed responses without throwing', async () => {
    const access = createAccess();
    const tenant = {
      instanceId: 'tenant-a',
      displayName: 'Tenant A',
      timeZone: 'Europe/Berlin',
      authorizationRevision: revision,
    };

    await expect(
      access.observeServiceResponse?.({
        request: request(),
        descriptor: descriptor(),
        tenant,
        response: new Response(null, { status: 503 }),
        durationMs: 12,
      })
    ).resolves.toBeUndefined();
    await expect(
      access.observeServiceResponse?.({
        request: request(),
        descriptor: descriptor(),
        tenant,
        response: new Response('{', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
        durationMs: 12,
      })
    ).resolves.toBeUndefined();
    await expect(
      access.observeServiceResponse?.({
        request: request(),
        descriptor: { ...descriptor(), ownerPluginId: 'other' },
        tenant,
        response: Response.json({}),
        durationMs: 12,
      })
    ).resolves.toBeUndefined();
  });
});
