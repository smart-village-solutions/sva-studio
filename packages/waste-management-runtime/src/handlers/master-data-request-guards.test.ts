import { describe, expect, it } from 'vitest';

import {
  createWasteAuthDeps,
  createWasteMutationRequest,
  createWasteTestActor,
} from '../../tests/test-utils/handler-fixtures.js';

import {
  authorizeWasteMasterDataMutationPathRequest,
  authorizeWasteMasterDataMutationRequest,
} from './master-data-request-guards.js';
import type { WasteManagementHandlerDeps } from './types.js';

const actor = createWasteTestActor();

const createDeps = (action = 'waste-management.master-data.manage'): WasteManagementHandlerDeps =>
  createWasteAuthDeps([action]);

describe('authorizeWasteMasterDataMutationRequest', () => {
  it('fails closed when the host permission resolver is missing', async () => {
    const result = await authorizeWasteMasterDataMutationRequest(
      createWasteMutationRequest('POST', 'https://studio.test/api/v1/waste-management/regions'),
      actor,
      { getRequestId: () => 'req-test' }
    );

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(503);
    await expect((result as Response).json()).resolves.toMatchObject({
      error: { code: 'database_unavailable' },
    });
  });

  it('returns the authorized request context for create mutations', async () => {
    const result = await authorizeWasteMasterDataMutationRequest(
      createWasteMutationRequest('POST', 'https://studio.test/api/v1/waste-management/regions'),
      actor,
      createDeps()
    );

    expect(result).not.toBeInstanceOf(Response);
    expect(result).toMatchObject({
      instanceId: 'tenant-a',
      requestId: 'req-test',
    });
  });

  it('rejects address master-data mutations without the plugin manage action', async () => {
    const result = await authorizeWasteMasterDataMutationPathRequest(
      createWasteMutationRequest('DELETE', 'https://studio.test/api/v1/waste-management/regions/region-1'),
      actor,
      createDeps('waste-management.tours.manage'),
      { resourceIdName: 'regionId' }
    );

    expect(result).toBeInstanceOf(Response);
    const response = result as Response;
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'forbidden' } });
  });

  it('rejects update mutations without a path resource id', async () => {
    const result = await authorizeWasteMasterDataMutationPathRequest(
      createWasteMutationRequest('PATCH', 'https://studio.test/api/v1/waste-management/regions/'),
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
