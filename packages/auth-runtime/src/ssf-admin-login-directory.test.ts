import { createHash } from 'node:crypto';

import { instanceStatuses, type InstanceRegistryRecord } from '@sva/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listInstances: vi.fn(),
  authenticate: vi.fn(),
  emitSecurityAudit: vi.fn(),
}));
vi.mock('./audit-events.js', () => ({ emitAuthAuditEvent: mocks.emitSecurityAudit }));
vi.mock('./iam-instance-registry/repository.js', () => ({
  withRegistryRepository: (work: (repository: typeof mocks) => unknown) => work(mocks),
}));
vi.mock('./ssf-runtime-service-token.js', () => ({
  SSF_ADMIN_LOGIN_DIRECTORY_ACTION: 'ssf.admin-login-directory.read',
  authenticateSsfServiceToken: mocks.authenticate,
}));

import { dispatchSsfAdminLoginDirectoryRequest } from './ssf-admin-login-directory.js';

const request = (authorization = 'Bearer service-token', method = 'GET') =>
  new Request('http://studio:3000/internal/plugins/ssf/v1/admin-login-tenants', {
    method,
    headers: { authorization, 'X-Correlation-Id': 'directory-test' },
  });

const instance = (overrides: Partial<InstanceRegistryRecord> = {}): InstanceRegistryRecord => ({
  instanceId: 'kassel',
  displayName: 'Stadt Kassel',
  status: 'active',
  authRealm: 'tenant-kassel',
  parentDomain: 'example.org',
  primaryHostname: 'kassel.example.org',
  timeZone: 'Europe/Berlin',
  realmMode: 'existing',
  authClientId: 'studio',
  authClientSecretConfigured: true,
  assignedModules: [],
  featureFlags: {},
  createdAt: '2026-09-10T00:00:00Z',
  updatedAt: '2026-09-10T00:00:00Z',
  ...overrides,
});

describe('SSF admin login directory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticate.mockResolvedValue({ kind: 'authenticated', subject: 'ssf-service' });
    mocks.listInstances.mockResolvedValue([]);
  });

  it('lists only active local records with a deterministic revision', async () => {
    mocks.listInstances.mockResolvedValue([
      ...instanceStatuses.map((status) => instance({ status })),
      instance({
        instanceId: 'a',
        displayName: 'Aachen',
        authRealm: 'aachen',
        tenantAdminBootstrap: { username: 'private', email: 'private@example.org' },
      }),
    ]);
    const response = await dispatchSsfAdminLoginDirectoryRequest(request());
    expect(response?.status).toBe(200);
    const tenants = [
      { id: 'a', displayName: 'Aachen', realm: 'aachen' },
      { id: 'kassel', displayName: 'Stadt Kassel', realm: 'tenant-kassel' },
    ];
    expect(await response?.json()).toEqual({
      contractVersion: '1.0',
      directoryRevision: `sha256:${createHash('sha256')
        .update(JSON.stringify(tenants))
        .digest('hex')}`,
      tenants,
    });
    expect(mocks.authenticate).toHaveBeenCalledWith(
      'service-token',
      'ssf.admin-login-directory.read'
    );
    expect(mocks.listInstances).toHaveBeenCalledOnce();
  });

  it('returns a valid empty directory', async () => {
    const response = await dispatchSsfAdminLoginDirectoryRequest(request());
    expect(response?.status).toBe(200);
    expect(await response?.json()).toEqual({
      contractVersion: '1.0',
      directoryRevision: `sha256:${createHash('sha256').update('[]').digest('hex')}`,
      tenants: [],
    });
  });

  it('keeps the revision stable across source order and changes it with public data', async () => {
    const kassel = instance();
    const aachen = instance({ instanceId: 'a', displayName: 'Aachen', authRealm: 'aachen' });
    mocks.listInstances.mockResolvedValue([kassel, aachen]);
    const first = (await (await dispatchSsfAdminLoginDirectoryRequest(request()))?.json()) as {
      directoryRevision: string;
    };
    mocks.listInstances.mockResolvedValue([aachen, kassel]);
    const reordered = (await (await dispatchSsfAdminLoginDirectoryRequest(request()))?.json()) as {
      directoryRevision: string;
    };
    mocks.listInstances.mockResolvedValue([
      aachen,
      instance({ displayName: 'Kassel', updatedAt: '2027-01-01T00:00:00Z' }),
    ]);
    const changed = (await (await dispatchSsfAdminLoginDirectoryRequest(request()))?.json()) as {
      directoryRevision: string;
    };

    expect(reordered.directoryRevision).toBe(first.directoryRevision);
    expect(changed.directoryRevision).not.toBe(first.directoryRevision);
  });

  it.each(['', 'Basic credentials', 'Bearer two tokens'])(
    'rejects missing or malformed credentials: %s',
    async (value) => {
      const response = await dispatchSsfAdminLoginDirectoryRequest(request(value));
      expect(response?.status).toBe(401);
      expect(mocks.authenticate).not.toHaveBeenCalled();
      expect(mocks.listInstances).not.toHaveBeenCalled();
      expect(mocks.emitSecurityAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: 'denied',
          scope: { kind: 'platform' },
          pluginAction: expect.objectContaining({
            actionId: 'ssf.admin-login-directory.read',
            reasonCode: 'service_authentication_invalid',
          }),
        })
      );
    }
  );

  it.each([
    [401, 'service_authentication_invalid', 'invalid_service_token'],
    [403, 'service_action_forbidden', 'missing_action_scope'],
    [503, 'runtime_configuration_unavailable', 'identity_provider_unavailable'],
  ] as const)(
    'preserves authentication failure %s without reading the registry',
    async (status, code, reason) => {
      mocks.authenticate.mockResolvedValue({ kind: 'rejected', status, code, reason });
      const response = await dispatchSsfAdminLoginDirectoryRequest(request());
      expect(response?.status).toBe(status);
      expect(response?.headers.get('Cache-Control')).toBe('no-store');
      expect(await response?.json()).toEqual({
        error: {
          code:
            status === 401
              ? 'service_authentication_invalid'
              : status === 403
                ? 'service_action_forbidden'
                : 'admin_login_directory_unavailable',
          correlationId: 'directory-test',
        },
      });
      expect(mocks.listInstances).not.toHaveBeenCalled();
      expect(mocks.emitSecurityAudit).toHaveBeenCalledTimes(status === 503 ? 0 : 1);
      if (status !== 503) {
        expect(mocks.emitSecurityAudit).toHaveBeenCalledWith(
          expect.objectContaining({
            pluginAction: expect.objectContaining({
              actionId: 'ssf.admin-login-directory.read',
              reasonCode: code,
            }),
          })
        );
      }
    }
  );

  it('reports a registry outage as 503 without exposing internal details', async () => {
    mocks.listInstances.mockRejectedValue(new Error('database password secret'));
    const response = await dispatchSsfAdminLoginDirectoryRequest(request());
    expect(response?.status).toBe(503);
    expect(await response?.text()).not.toContain('secret');
  });

  it('does not handle other routes or execute a non-GET request', async () => {
    expect(
      await dispatchSsfAdminLoginDirectoryRequest(new Request('http://studio/other'))
    ).toBeNull();
    const response = await dispatchSsfAdminLoginDirectoryRequest(
      request('Bearer service-token', 'POST')
    );
    expect(response?.status).toBe(405);
    expect(response?.headers.get('Allow')).toBe('GET');
    expect(mocks.authenticate).not.toHaveBeenCalled();
    expect(mocks.listInstances).not.toHaveBeenCalled();
  });
});
