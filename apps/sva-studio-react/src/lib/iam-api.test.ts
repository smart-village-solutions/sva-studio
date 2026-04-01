import { beforeEach, describe, expect, it, vi } from 'vitest';

const browserLoggerMock = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@sva/sdk/logging', () => ({
  createBrowserLogger: () => browserLoggerMock,
}));

import {
  asIamError,
  assignGroupMembership,
  assignGroupRole,
  assignOrganizationMembership,
  bulkDeactivateUsers,
  createGroup,
  createOrganization,
  deleteGroup,
  getMyPendingLegalTexts,
  getMyProfile,
  getDataExportStatus,
  getMyDataSubjectRights,
  deactivateOrganization,
  getGroup,
  getOrganization,
  getMyOrganizationContext,
  IamHttpError,
  listAdminDsrCases,
  listGovernanceCases,
  listGroups,
  listOrganizations,
  reconcileRoles,
  removeGroupMembership,
  removeGroupRole,
  requestDataExport,
  syncUsersFromKeycloak,
  removeOrganizationMembership,
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
      requestId: 'req-1',
    });
  });

  it('dispatches the legal acceptance event on the corresponding error code', async () => {
    const dispatchEvent = vi.fn();
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
                expected_migration: '0018_iam_account_groups_origin_compat.sql',
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
      requestId: 'req-json-500',
    });

    expect(browserLoggerMock.error).toHaveBeenCalledWith('IAM API request failed', {
      request_id: 'req-json-500',
      status: 500,
      code: 'internal_error',
      details: {
        reason_code: 'missing_column',
        schema_object: 'iam.account_groups.origin',
        expected_migration: '0018_iam_account_groups_origin_compat.sql',
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
      message: 'boom',
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

    const error = asIamError(await updateOrganization('org-1', { displayName: 'Alpha 2' }).catch((value) => value));

    expect(error).toMatchObject({
      status: 500,
      code: 'internal_error',
      message: 'network down',
    });
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
      expect.objectContaining({ signal: controller.signal, credentials: 'include' })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/iam/admin/data-subject-rights/cases?page=2&pageSize=20&type=request&status=queued&search=bob',
      expect.objectContaining({ signal: controller.signal, credentials: 'include' })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/iam/me/data-subject-rights/requests', expect.any(Object));
    expect(fetchMock).toHaveBeenNthCalledWith(4, '/iam/me/data-export/status?jobId=job-1', expect.any(Object));
  });
});
