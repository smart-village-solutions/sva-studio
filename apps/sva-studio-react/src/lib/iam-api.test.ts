import { beforeEach, describe, expect, it, vi } from 'vitest';

const browserLoggerMock = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@sva/monitoring-client/logging', () => ({
  createBrowserLogger: () => browserLoggerMock,
}));

import {
  asIamError,
  activateInstance,
  assignGroupMembership,
  assignGroupRole,
  archiveInstance,
  assignOrganizationMembership,
  bulkDeactivateUsers,
  createInstance,
  updateInstance,
  createGroup,
  createOrganization,
  deleteGroup,
  executeInstanceKeycloakProvisioning,
  fetchWithRequestTimeout,
  getMyPendingLegalTexts,
  getMyProfile,
  getDataExportStatus,
  getInstance,
  getInstanceKeycloakPreflight,
  getInstanceKeycloakProvisioningRun,
  getInstanceKeycloakStatus,
  getRuntimeHealth,
  getMyDataSubjectRights,
  deactivateOrganization,
  getGroup,
  getOrganization,
  getMyOrganizationContext,
  IamHttpError,
  listAdminDsrCases,
  listGovernanceCases,
  listGroups,
  listInstances,
  listOrganizations,
  planInstanceKeycloakProvisioning,
  reconcileRoles,
  reconcileInstanceKeycloak,
  removeGroupMembership,
  removeGroupRole,
  requestDataExport,
  syncUsersFromKeycloak,
  removeOrganizationMembership,
  suspendInstance,
  updateMyProfile,
  updateMyOrganizationContext,
  updateGroup,
  updateOrganization,
  LEGAL_ACCEPTANCE_REQUIRED_EVENT,
} from './iam-api';

describe('iam-api organization helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.stubEnv('NODE_ENV', 'test');
    browserLoggerMock.debug.mockReset();
    browserLoggerMock.info.mockReset();
    browserLoggerMock.warn.mockReset();
    browserLoggerMock.error.mockReset();
  });

  it('builds organization list queries and sends credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [],
          pagination: { page: 2, pageSize: 10, total: 0 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    await listOrganizations({
      page: 2,
      pageSize: 10,
      search: 'alpha',
      organizationType: 'municipality',
      status: 'active',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/iam/organizations?page=2&pageSize=10&search=alpha&organizationType=municipality&status=active',
      expect.objectContaining({
        credentials: 'include',
      })
    );
  });

  it('sends JSON headers for organization mutations', async () => {
    const fetchMock = vi.fn().mockImplementation(async () =>
      new Response(JSON.stringify({ data: { id: 'org-1' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('crypto', { randomUUID: () => 'uuid-test-1' });

    await createOrganization({
      organizationKey: 'alpha',
      displayName: 'Alpha',
      organizationType: 'county',
      contentAuthorPolicy: 'org_only',
    });
    await updateOrganization('org-1', { displayName: 'Alpha 2' });
    await assignOrganizationMembership('org-1', { accountId: 'account-1', visibility: 'external' });
    await removeOrganizationMembership('org-1', 'account-1');
    await updateMyOrganizationContext('org-1');
    await getMyOrganizationContext();
    await getOrganization('org-1');
    await deactivateOrganization('org-1');

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/v1/iam/organizations',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'Idempotency-Key': 'uuid-test-1',
        }),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/v1/iam/organizations/org-1',
      expect.objectContaining({
        method: 'PATCH',
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      '/api/v1/iam/organizations/org-1/memberships',
      expect.objectContaining({
        method: 'POST',
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      '/api/v1/iam/organizations/org-1/memberships/account-1',
      expect.objectContaining({
        method: 'DELETE',
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      '/api/v1/iam/me/context',
      expect.objectContaining({
        method: 'PUT',
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      6,
      '/api/v1/iam/me/context',
      expect.objectContaining({
        credentials: 'include',
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      7,
      '/api/v1/iam/organizations/org-1',
      expect.objectContaining({
        credentials: 'include',
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      8,
      '/api/v1/iam/organizations/org-1',
      expect.objectContaining({
        method: 'DELETE',
      })
    );
  });

  it('converts API error payloads to IamHttpError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: 'organization_inactive',
              message: 'inactive',
            },
            requestId: 'req-1',
          }),
          { status: 409, headers: { 'content-type': 'application/json' } }
        )
      )
    );

    await expect(updateOrganization('org-1', { displayName: 'Alpha 2' })).rejects.toMatchObject({
      status: 409,
      code: 'organization_inactive',
      classification: 'unknown',
      diagnosticStatus: 'degradiert',
      recommendedAction: 'erneut_versuchen',
      requestId: 'req-1',
    });
  });

  it('dispatches the legal acceptance event on the corresponding error code', async () => {
    const dispatchEvent = vi.fn();
    vi.stubGlobal('window', {});
    vi.stubGlobal('dispatchEvent', dispatchEvent);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: 'legal_acceptance_required',
              message: 'consent missing',
            },
            requestId: 'req-legal',
          }),
          { status: 403, headers: { 'content-type': 'application/json' } }
        )
      )
    );

    await expect(updateOrganization('org-1', { displayName: 'Alpha 2' })).rejects.toMatchObject({
      status: 403,
      code: 'legal_acceptance_required',
      requestId: 'req-legal',
    });
    expect(dispatchEvent).toHaveBeenCalledWith(expect.any(CustomEvent));
    expect((dispatchEvent.mock.calls[0]?.[0] as CustomEvent).type).toBe(LEGAL_ACCEPTANCE_REQUIRED_EVENT);
  });

  it('supports the flat error response shape and request id header', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: 'organization_inactive',
            message: 'inactive',
          }),
          {
            status: 409,
            headers: {
              'content-type': 'application/json',
              'X-Request-Id': 'req-header-1',
            },
          }
        )
      )
    );

    await expect(updateOrganization('org-1', { displayName: 'Alpha 2' })).rejects.toMatchObject({
      status: 409,
      code: 'organization_inactive',
      classification: 'unknown',
      diagnosticStatus: 'degradiert',
      recommendedAction: 'erneut_versuchen',
      requestId: 'req-header-1',
    });
    expect(browserLoggerMock.error).toHaveBeenCalledWith(
      'IAM API request failed',
      expect.objectContaining({
        request_id: 'req-header-1',
        status: 409,
        code: 'organization_inactive',
      })
    );
  });

  it('logs only safe diagnostic details for json api failures in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: 'internal_error',
              message: 'boom',
              details: {
                reason_code: 'missing_column',
                schema_object: 'iam.account_groups.origin',
                expected_migration: '0019_iam_account_groups_origin_compat.sql',
                email: 'alice@example.com',
              },
            },
            requestId: 'req-json-500',
          }),
          { status: 500, headers: { 'content-type': 'application/json' } }
        )
      )
    );

    await expect(updateOrganization('org-1', { displayName: 'Alpha 2' })).rejects.toMatchObject({
      status: 500,
      code: 'internal_error',
      classification: 'database_or_schema_drift',
      diagnosticStatus: 'degradiert',
      recommendedAction: 'migration_pruefen',
      safeDetails: {
        reason_code: 'missing_column',
        schema_object: 'iam.account_groups.origin',
        expected_migration: '0019_iam_account_groups_origin_compat.sql',
      },
      requestId: 'req-json-500',
    });

    expect(browserLoggerMock.error).toHaveBeenCalledWith('IAM API request failed', {
      request_id: 'req-json-500',
      status: 500,
      code: 'internal_error',
      details: {
        reason_code: 'missing_column',
        schema_object: 'iam.account_groups.origin',
        expected_migration: '0019_iam_account_groups_origin_compat.sql',
      },
    });
    expect(browserLoggerMock.error.mock.calls[0]?.[1]).not.toHaveProperty('email');
    expect(browserLoggerMock.error.mock.calls[0]?.[1]).not.toHaveProperty('body');
    expect(browserLoggerMock.error.mock.calls[0]?.[1]).not.toHaveProperty('payload');
  });

  it('wraps unknown values in asIamError', () => {
    const resolved = asIamError('boom');

    expect(resolved).toBeInstanceOf(IamHttpError);
    expect(resolved).toMatchObject({
      status: 500,
      code: 'internal_error',
      classification: 'unknown',
      diagnosticStatus: 'degradiert',
      recommendedAction: 'support_kontaktieren',
      message: 'boom',
    });
  });

  it('prefers explicit runtime diagnostics from API payloads', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: 'keycloak_unavailable',
              message: 'boom',
              classification: 'keycloak_reconcile',
              status: 'manuelle_pruefung_erforderlich',
              recommendedAction: 'rollenabgleich_pruefen',
              safeDetails: {
                sync_error_code: 'IDP_FORBIDDEN',
                sync_state: 'failed',
              },
            },
            requestId: 'req-reconcile',
          }),
          { status: 503, headers: { 'content-type': 'application/json' } }
        )
      )
    );

    await expect(reconcileRoles()).rejects.toMatchObject({
      status: 503,
      code: 'keycloak_unavailable',
      classification: 'keycloak_reconcile',
      diagnosticStatus: 'manuelle_pruefung_erforderlich',
      recommendedAction: 'rollenabgleich_pruefen',
      safeDetails: {
        sync_error_code: 'IDP_FORBIDDEN',
        sync_state: 'failed',
      },
      requestId: 'req-reconcile',
    });
  });

  it('normalizes mixed-version diagnostic payloads and legacy sync detail keys', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: 'keycloak_unavailable',
              message: 'boom',
              classification: 'future_server_value',
              status: 'unexpected_status',
              recommendedAction: 'future_action',
              details: {
                syncState: 'failed',
                syncError: {
                  code: 'IDP_FORBIDDEN',
                },
              },
            },
            requestId: 'req-mixed-version',
          }),
          { status: 503, headers: { 'content-type': 'application/json' } }
        )
      )
    );

    await expect(reconcileRoles()).rejects.toMatchObject({
      status: 503,
      code: 'keycloak_unavailable',
      classification: 'keycloak_reconcile',
      diagnosticStatus: 'manuelle_pruefung_erforderlich',
      recommendedAction: 'rollenabgleich_pruefen',
      safeDetails: {
        sync_error_code: 'IDP_FORBIDDEN',
        sync_state: 'failed',
      },
      requestId: 'req-mixed-version',
    });
  });

  it('surfaces non-json success payloads as typed errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('ok', {
          status: 200,
          headers: { 'content-type': 'text/plain' },
        })
      )
    );

    await expect(getOrganization('org-1')).rejects.toMatchObject({
      status: 200,
      code: 'non_json_response',
    });
  });

  it('wraps network failures in asIamError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const error = asIamError(await updateOrganization('org-1', { displayName: 'Alpha 2' }).catch((error_) => error_));

    expect(error).toMatchObject({
      status: 500,
      code: 'internal_error',
      message: 'network down',
    });
  });

  it('maps timed out transport requests to timeout errors', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn((_input: string, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => {
              reject(init.signal?.reason ?? new DOMException('Aborted', 'AbortError'));
            },
            { once: true }
          );
        });
      })
    );

    const request = fetchWithRequestTimeout('/api/v1/iam/organizations', undefined, { timeoutMs: 50 });
    const expectation = expect(request).rejects.toMatchObject({
      status: 0,
      code: 'timeout',
      message: 'request_timeout',
    });

    await vi.advanceTimersByTimeAsync(50);

    await expectation;
  });

  it('maps externally aborted requests to aborted errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_input: string, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => {
              reject(init.signal?.reason ?? new DOMException('Aborted', 'AbortError'));
            },
            { once: true }
          );
        });
      })
    );
    const controller = new AbortController();

    const request = fetchWithRequestTimeout('/api/v1/iam/organizations', undefined, {
      signal: controller.signal,
      timeoutMs: 5_000,
    });
    const expectation = expect(request).rejects.toMatchObject({
      status: 0,
      code: 'aborted',
      message: 'request_aborted',
    });

    controller.abort();

    await expectation;
  });

  it('uses crypto.randomUUID for idempotency keys', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { id: 'org-1' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('crypto', { randomUUID: () => 'uuid-test-1' });

    await createOrganization({
      organizationKey: 'alpha',
      displayName: 'Alpha',
      organizationType: 'county',
      contentAuthorPolicy: 'org_only',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/iam/organizations',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Idempotency-Key': 'uuid-test-1',
        }),
      })
    );
  });

  it('falls back to http status messages when json error payloads omit message and code', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: {} }), {
          status: 502,
          headers: {
            'content-type': 'application/json',
            'X-Request-Id': 'req-empty-error',
          },
        })
      )
    );

    await expect(updateOrganization('org-1', { displayName: 'Alpha 2' })).rejects.toMatchObject({
      status: 502,
      code: 'internal_error',
      message: 'http_502',
      requestId: 'req-empty-error',
    });
    expect(browserLoggerMock.error).toHaveBeenCalledWith(
      'IAM API request failed',
      expect.objectContaining({
        code: 'internal_error',
        request_id: 'req-empty-error',
      })
    );
  });
});

describe('iam-api user sync helper', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv('NODE_ENV', 'test');
    browserLoggerMock.debug.mockReset();
    browserLoggerMock.info.mockReset();
    browserLoggerMock.warn.mockReset();
    browserLoggerMock.error.mockReset();
  });

  it('posts to the keycloak sync endpoint with CSRF headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            importedCount: 1,
            updatedCount: 2,
            skippedCount: 3,
            totalKeycloakUsers: 6,
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    await syncUsersFromKeycloak();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/iam/users/sync-keycloak',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        }),
        body: '{}',
        credentials: 'include',
      })
    );
  });

  it('logs non-json API failures in development with request id fallback', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('<html>boom</html>', {
          status: 500,
          headers: {
            'content-type': 'text/html',
            'X-Request-Id': 'req-non-json',
          },
        })
      )
    );

    await expect(syncUsersFromKeycloak()).rejects.toMatchObject({
      status: 500,
      code: 'non_json_response',
      requestId: 'req-non-json',
    });
    expect(browserLoggerMock.error).toHaveBeenCalledWith(
      'IAM API request failed',
      expect.objectContaining({
        request_id: 'req-non-json',
        status: 500,
        code: 'non_json_response',
      })
    );
    expect(browserLoggerMock.error.mock.calls[0]?.[1]).not.toHaveProperty('body');
    expect(browserLoggerMock.error.mock.calls[0]?.[1]).not.toHaveProperty('payload');
  });

  it('does not log API failures in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'internal_error', message: 'boom' }), {
          status: 500,
          headers: { 'content-type': 'application/json' },
        })
      )
    );

    await expect(syncUsersFromKeycloak()).rejects.toMatchObject({
      status: 500,
      code: 'internal_error',
    });
    expect(browserLoggerMock.error).not.toHaveBeenCalled();
  });
});

describe('iam-api group helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv('NODE_ENV', 'test');
  });

  it('uses the canonical groups endpoints and mutation headers', async () => {
    const fetchMock = vi.fn().mockImplementation(async () =>
      new Response(
        JSON.stringify({
          data: {
            id: 'group-1',
          },
          pagination: { page: 1, pageSize: 1, total: 1 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('crypto', { randomUUID: () => 'uuid-group-1' });

    await listGroups();
    await getGroup('group-1');
    await createGroup({ groupKey: 'admins', displayName: 'Admins', roleIds: ['role-1'] });
    await updateGroup('group-1', { displayName: 'Admins Updated', isActive: false });
    await deleteGroup('group-1');

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/v1/iam/groups',
      expect.objectContaining({ credentials: 'include' })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/v1/iam/groups/group-1',
      expect.objectContaining({ credentials: 'include' })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      '/api/v1/iam/groups',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'Idempotency-Key': 'uuid-group-1',
        }),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      '/api/v1/iam/groups/group-1',
      expect.objectContaining({ method: 'PATCH' })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      '/api/v1/iam/groups/group-1',
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('covers group membership, role assignment and reconciliation endpoints', async () => {
    const fetchMock = vi.fn().mockImplementation(async () =>
      new Response(JSON.stringify({ data: { ok: true } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('crypto', { randomUUID: () => 'uuid-group-op' });

    await assignGroupRole('group-1', { roleId: 'role-1' });
    await removeGroupRole('group-1', 'role-1');
    await assignGroupMembership('group-1', { keycloakSubject: 'kc-1' });
    await removeGroupMembership('group-1', 'kc-1');
    await reconcileRoles();

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/v1/iam/groups/group-1/roles',
      expect.objectContaining({ method: 'POST' })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/v1/iam/groups/group-1/roles/role-1',
      expect.objectContaining({ method: 'DELETE' })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      '/api/v1/iam/groups/group-1/memberships',
      expect.objectContaining({ method: 'POST' })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      '/api/v1/iam/groups/group-1/memberships',
      expect.objectContaining({
        method: 'DELETE',
        body: JSON.stringify({ keycloakSubject: 'kc-1' }),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      '/api/v1/iam/admin/reconcile',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({}),
      })
    );
  });
});

describe('iam-api instance helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv('NODE_ENV', 'test');
    browserLoggerMock.debug.mockReset();
    browserLoggerMock.info.mockReset();
    browserLoggerMock.warn.mockReset();
    browserLoggerMock.error.mockReset();
  });

  it('uses the canonical instance endpoints with reauth and idempotency headers', async () => {
    const fetchMock = vi.fn().mockImplementation(async () =>
      new Response(JSON.stringify({ data: { instanceId: 'demo', status: 'active' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('crypto', { randomUUID: () => 'uuid-instance-1' });

    await listInstances({ search: 'demo', status: 'active' });
    await getInstance('demo');
    await createInstance({
      instanceId: 'demo',
      displayName: 'Demo',
      parentDomain: 'studio.example.org',
      realmMode: 'new',
      authRealm: 'demo',
      authClientId: 'sva-studio',
    });
    await updateInstance('demo', {
      displayName: 'Demo Updated',
      parentDomain: 'studio.example.org',
      realmMode: 'existing',
      authRealm: 'demo',
      authClientId: 'sva-studio',
    });
    await getRuntimeHealth();
    await getInstanceKeycloakStatus('demo');
    await getInstanceKeycloakPreflight('demo');
    await planInstanceKeycloakProvisioning('demo');
    await executeInstanceKeycloakProvisioning('demo', {
      intent: 'provision',
      tenantAdminTemporaryPassword: 'test-temp-password',
    });
    await getInstanceKeycloakProvisioningRun('demo', 'run-1');
    await reconcileInstanceKeycloak('demo', {
      tenantAdminTemporaryPassword: 'test-temp-password',
      rotateClientSecret: true,
    });
    await activateInstance('demo');
    await suspendInstance('demo');
    await archiveInstance('demo');

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/v1/iam/instances?search=demo&status=active',
      expect.objectContaining({ credentials: 'include' })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/v1/iam/instances/demo',
      expect.objectContaining({ credentials: 'include' })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      '/api/v1/iam/instances',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-SVA-Reauth-Confirmed': 'true',
          'Idempotency-Key': 'uuid-instance-1',
        }),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      '/api/v1/iam/instances/demo',
      expect.objectContaining({
        method: 'PATCH',
        headers: expect.objectContaining({
          'X-SVA-Reauth-Confirmed': 'true',
        }),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      '/api/v1/iam/health/ready',
      expect.objectContaining({ credentials: 'include' })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      6,
      '/api/v1/iam/instances/demo/keycloak/status',
      expect.objectContaining({ credentials: 'include' })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      7,
      '/api/v1/iam/instances/demo/keycloak/preflight',
      expect.objectContaining({ credentials: 'include' })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      8,
      '/api/v1/iam/instances/demo/keycloak/plan',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-SVA-Reauth-Confirmed': 'true',
        }),
        body: JSON.stringify({}),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      9,
      '/api/v1/iam/instances/demo/keycloak/execute',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-SVA-Reauth-Confirmed': 'true',
        }),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      10,
      '/api/v1/iam/instances/demo/keycloak/runs/run-1',
      expect.objectContaining({ credentials: 'include' })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      11,
      '/api/v1/iam/instances/demo/keycloak/reconcile',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-SVA-Reauth-Confirmed': 'true',
        }),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      12,
      '/api/v1/iam/instances/demo/activate',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-SVA-Reauth-Confirmed': 'true',
        }),
        body: JSON.stringify({ status: 'active' }),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      13,
      '/api/v1/iam/instances/demo/suspend',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ status: 'suspended' }),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      14,
      '/api/v1/iam/instances/demo/archive',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ status: 'archived' }),
      })
    );
  });
});

describe('iam-api profile helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv('NODE_ENV', 'test');
  });

  it('uses the profile, legal text and bulk deactivate endpoints with the expected contracts', async () => {
    const fetchMock = vi.fn().mockImplementation(async () =>
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('crypto', { randomUUID: () => 'uuid-user-op' });

    await getMyProfile();
    await updateMyProfile({ displayName: 'Alice Example' });
    await getMyPendingLegalTexts();
    await bulkDeactivateUsers(['user-1', 'user-2']);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/v1/iam/users/me/profile',
      expect.objectContaining({ credentials: 'include' })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/v1/iam/users/me/profile',
      expect.objectContaining({ method: 'PATCH' })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      '/iam/me/legal-texts/pending',
      expect.objectContaining({ credentials: 'include' })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      '/api/v1/iam/users/bulk-deactivate',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Idempotency-Key': 'uuid-user-op',
        }),
      })
    );
  });
});

describe('iam-api transparency helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv('NODE_ENV', 'test');
  });

  it('starts self-service exports via POST with an idempotency key and JSON body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            exportJobId: 'export-1',
            status: 'queued',
            format: 'json',
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('crypto', { randomUUID: () => 'idem-export-1' });

    await requestDataExport({ format: 'json', async: true });

    expect(fetchMock).toHaveBeenCalledWith(
      '/iam/me/data-export',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Idempotency-Key': 'idem-export-1',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ format: 'json', async: true }),
        credentials: 'include',
      })
    );
  });

  it('returns plain text export payloads without forcing JSON parsing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('csv-export', {
          status: 200,
          headers: { 'content-type': 'text/csv' },
        })
      )
    );
    vi.stubGlobal('crypto', { randomUUID: () => 'idem-export-2' });

    await expect(requestDataExport({ format: 'csv', async: false })).resolves.toEqual({
      data: 'csv-export',
    });
  });

  it('forwards abort signals for governance and DSR list requests', async () => {
    const fetchMock = vi.fn().mockImplementation(async () =>
      new Response(
        JSON.stringify({
          data: [],
          pagination: { page: 1, pageSize: 12, total: 0 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );
    const controller = new AbortController();
    vi.stubGlobal('fetch', fetchMock);

    await listGovernanceCases({ page: 1, pageSize: 12, type: 'delegation', status: 'open', search: 'alice' }, {
      signal: controller.signal,
    });
    await listAdminDsrCases({ page: 2, pageSize: 20, type: 'request', status: 'queued', search: 'bob' }, {
      signal: controller.signal,
    });
    await getMyDataSubjectRights();
    await getDataExportStatus('job-1');

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/iam/governance/workflows?page=1&pageSize=12&type=delegation&status=open&search=alice',
      expect.objectContaining({
        signal: expect.any(AbortSignal),
        credentials: 'include',
        headers: expect.objectContaining({ Accept: 'application/json' }),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/iam/admin/data-subject-rights/cases?page=2&pageSize=20&type=request&status=queued&search=bob',
      expect.objectContaining({
        signal: expect.any(AbortSignal),
        credentials: 'include',
        headers: expect.objectContaining({ Accept: 'application/json' }),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/iam/me/data-subject-rights/requests', expect.any(Object));
    expect(fetchMock).toHaveBeenNthCalledWith(4, '/iam/me/data-export/status?jobId=job-1', expect.any(Object));
  });
});
