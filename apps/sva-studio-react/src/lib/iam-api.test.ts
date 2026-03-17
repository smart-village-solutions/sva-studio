import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  asIamError,
  assignOrganizationMembership,
  createOrganization,
  getDataExportStatus,
  getMyDataSubjectRights,
  deactivateOrganization,
  getOrganization,
  getMyOrganizationContext,
  IamHttpError,
  listAdminDsrCases,
  listGovernanceCases,
  listOrganizations,
  requestDataExport,
  syncUsersFromKeycloak,
  removeOrganizationMembership,
  updateMyOrganizationContext,
  updateOrganization,
} from './iam-api';

describe('iam-api organization helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubEnv('NODE_ENV', 'test');
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

  it('supports the flat error response shape and request id header', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    consoleError.mockClear();
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
    expect(consoleError).toHaveBeenCalledWith(
      'IAM API request failed',
      expect.objectContaining({
        request_id: 'req-header-1',
        status: 409,
        code: 'organization_inactive',
      })
    );
  });

  it('logs only request id, status and code for json api failures in development', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    consoleError.mockClear();
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: 'internal_error',
            message: 'boom',
            requestId: 'req-json-500',
            details: { email: 'alice@example.com' },
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

    expect(consoleError).toHaveBeenCalledWith('IAM API request failed', {
      request_id: 'req-json-500',
      status: 500,
      code: 'internal_error',
    });
    expect(consoleError.mock.calls[0]?.[1]).not.toHaveProperty('details');
    expect(consoleError.mock.calls[0]?.[1]).not.toHaveProperty('body');
    expect(consoleError.mock.calls[0]?.[1]).not.toHaveProperty('payload');
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
});

describe('iam-api user sync helper', () => {
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
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    consoleError.mockClear();
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
    expect(consoleError).toHaveBeenCalledWith(
      'IAM API request failed',
      expect.objectContaining({
        request_id: 'req-non-json',
        status: 500,
        code: 'non_json_response',
      })
    );
    expect(consoleError.mock.calls[0]?.[1]).not.toHaveProperty('body');
    expect(consoleError.mock.calls[0]?.[1]).not.toHaveProperty('payload');
  });

  it('does not log API failures in production', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    consoleError.mockClear();
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
    expect(consoleError).not.toHaveBeenCalled();
  });
});

describe('iam-api transparency helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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
