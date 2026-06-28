import { describe, expect, it, vi } from 'vitest';

import type { AuthenticatedRequestContext } from '../../middleware.js';
import {
  authorizeWasteMasterDataMutationPathRequest,
  authorizeWasteMasterDataMutationRequest,
} from './master-data-request-guards.js';
import type { WasteManagementHandlerDeps } from './types.js';

const actor: AuthenticatedRequestContext = {
  sessionId: 'session-1',
  user: {
    id: 'user-1',
    instanceId: 'tenant-a',
    roles: ['system_admin'],
  },
};

const createHeaders = () => ({
  origin: 'https://studio.test',
  'x-requested-with': 'XMLHttpRequest',
});

const createDeps = (action = 'waste-management.master-data.manage'): WasteManagementHandlerDeps => ({
  getRequestId: () => 'req-test',
  resolvePermissions: vi.fn(async () => ({
    ok: true as const,
    permissions: [
      {
        action,
        resourceType: 'waste-management',
      },
    ],
  })),
});

describe('authorizeWasteMasterDataMutationRequest', () => {
  it('returns the authorized request context for create mutations', async () => {
    const result = await authorizeWasteMasterDataMutationRequest(
      new Request('https://studio.test/api/v1/waste-management/regions', {
        method: 'POST',
        headers: createHeaders(),
      }),
      actor,
      createDeps()
    );

    expect(result).not.toBeInstanceOf(Response);
    expect(result).toMatchObject({
      instanceId: 'tenant-a',
      requestId: 'req-test',
    });
  });

  it('rejects update mutations without a path resource id', async () => {
    const result = await authorizeWasteMasterDataMutationPathRequest(
      new Request('https://studio.test/api/v1/waste-management/regions/', {
        method: 'PATCH',
        headers: createHeaders(),
      }),
      actor,
      createDeps(),
      { resourceIdName: 'regionId' }
    );

    expect(result).toBeInstanceOf(Response);
    const response = result as Response;
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'invalid_request',
        message: 'regionId fehlt im Pfad.',
      },
    });
  });

  it('rejects create mutations when the csrf guard fails', async () => {
    const result = await authorizeWasteMasterDataMutationRequest(
      new Request('https://studio.test/api/v1/waste-management/regions', {
        method: 'POST',
      }),
      actor,
      createDeps()
    );

    expect(result).toBeInstanceOf(Response);
    const response = result as Response;
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'csrf_validation_failed',
      },
    });
  });
});
