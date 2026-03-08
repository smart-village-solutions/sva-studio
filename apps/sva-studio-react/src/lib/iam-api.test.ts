import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  asIamError,
  assignOrganizationMembership,
  createOrganization,
  deactivateOrganization,
  getOrganization,
  getMyOrganizationContext,
  IamHttpError,
  listOrganizations,
  removeOrganizationMembership,
  updateMyOrganizationContext,
  updateOrganization,
} from './iam-api';

describe('iam-api organization helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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

  it('wraps unknown values in asIamError', () => {
    const resolved = asIamError('boom');

    expect(resolved).toBeInstanceOf(IamHttpError);
    expect(resolved).toMatchObject({
      status: 500,
      code: 'internal_error',
      message: 'boom',
    });
  });
});
