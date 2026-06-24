import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createJsonResponse, createTestDepsBuilder } from '../test-support/handler-test-helpers.js';
import type { CreateRoleHandlerDeps } from './role-create-handler.js';
import {
  completeCreateRoleIdempotency,
  failCreateCompensation,
  failCreateRoleUnavailable,
  failCreatedRole,
  failLocalRoleCreateDatabaseWrite,
  failTechnicalRoleDatabaseWrite,
} from './role-create-sync-failures.js';
import {
  persistLocalRoleCreate,
  reserveCreateRoleIdempotency,
  syncTechnicalRoleCreate,
  type PreparedRoleCreate,
} from './role-create-sync.js';

const actor = {
  instanceId: 'de-musterhausen',
  actorAccountId: 'actor-account-1',
  requestId: 'req-create-role',
  traceId: 'trace-create-role',
};

const payload = {
  roleName: 'editor',
  displayName: 'Editor',
  description: 'Can edit content',
  roleLevel: 25,
  permissionIds: ['permission-1'],
};

const roleItem = {
  id: 'role-1',
  roleKey: 'editor',
  displayName: 'Editor',
};

const identityProvider = {
  provider: {
    createRole: vi.fn(async () => undefined),
    deleteRole: vi.fn(async () => undefined),
  },
};

const preparedCreate = {
  actor,
  data: payload,
  displayName: 'Editor',
  externalRoleName: 'editor',
  idempotencyKey: 'idem-1',
  roleKey: 'editor',
} satisfies PreparedRoleCreate<typeof payload>;

const createDeps = createTestDepsBuilder<
  CreateRoleHandlerDeps<typeof payload, { readonly displayName: string; readonly instanceId: string; readonly roleKey: string }, typeof identityProvider, typeof roleItem>
>(() => ({
  asApiItem: vi.fn((data, requestId) => ({ data, ...(requestId ? { requestId } : {}) })),
  buildRoleAttributes: vi.fn(({ displayName, instanceId, roleKey }) => ({ displayName, instanceId, roleKey })),
  buildRoleSyncFailure: vi.fn(({ fallbackMessage, requestId }) =>
    createJsonResponse(503, { error: { code: 'keycloak_unavailable', message: fallbackMessage }, requestId })
  ),
  completeIdempotency: vi.fn(async () => undefined),
  createApiError: vi.fn((status, code, message, requestId, details) =>
    createJsonResponse(status, { error: { code, message, ...(details ? { details } : {}) }, requestId })
  ),
  iamRoleSyncCounter: {
    add: vi.fn(),
  },
  iamUserOperationsCounter: {
    add: vi.fn(),
  },
  jsonResponse: vi.fn(createJsonResponse),
  logger: {
    error: vi.fn(),
  },
  mapRoleSyncErrorCode: vi.fn(() => 'IDP_UNAVAILABLE'),
  parseCreateRoleBody: vi.fn(async () => ({ ok: true, data: payload, rawBody: JSON.stringify(payload) })),
  persistCreatedRole: vi.fn(async () => roleItem),
  requireIdempotencyKey: vi.fn(() => ({ key: 'idem-1' })),
  requireRoleIdentityProvider: vi.fn(async () => identityProvider),
  reserveIdempotency: vi.fn(async () => ({ status: 'reserved' as const })),
  resolveRoleMutationActor: vi.fn(async () => ({ actor })),
  sanitizeRoleErrorMessage: vi.fn((error) => (error instanceof Error ? error.message : String(error))),
  toPayloadHash: vi.fn(() => 'hash-1'),
  trackKeycloakCall: vi.fn(async (_operation, work) => work()),
})) satisfies CreateRoleHandlerDeps<
  typeof payload,
  { readonly displayName: string; readonly instanceId: string; readonly roleKey: string },
  typeof identityProvider,
  typeof roleItem
>;

describe('role-create-sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    identityProvider.provider.createRole.mockClear();
    identityProvider.provider.deleteRole.mockClear();
  });

  it('completes idempotency with the canonical create-role endpoint', async () => {
    const deps = createDeps();

    await completeCreateRoleIdempotency(deps, {
      actor,
      idempotencyKey: 'idem-1',
      status: 'COMPLETED',
      responseStatus: 201,
      responseBody: { ok: true },
    });

    expect(deps.completeIdempotency).toHaveBeenCalledWith({
      instanceId: 'de-musterhausen',
      actorAccountId: 'actor-account-1',
      endpoint: 'POST:/api/v1/iam/roles',
      idempotencyKey: 'idem-1',
      status: 'COMPLETED',
      responseStatus: 201,
      responseBody: { ok: true },
    });
  });

  it('maps idempotency reserve conflict, replay and reserved branches', async () => {
    const conflictDeps = createDeps({
      reserveIdempotency: vi.fn(async () => ({ status: 'conflict', message: 'duplicate key' })),
    });
    await expect(
      reserveCreateRoleIdempotency(conflictDeps, { actor, idempotencyKey: 'idem-1', rawBody: '{}' })
    ).resolves.toMatchObject({ status: 409 });

    const replayDeps = createDeps({
      reserveIdempotency: vi.fn(async () => ({
        status: 'replay',
        responseStatus: 202,
        responseBody: { data: { id: 'role-1' } },
      })),
    });
    await expect(
      reserveCreateRoleIdempotency(replayDeps, { actor, idempotencyKey: 'idem-1', rawBody: '{}' })
    ).resolves.toMatchObject({ status: 202 });

    const reservedDeps = createDeps();
    await expect(
      reserveCreateRoleIdempotency(reservedDeps, { actor, idempotencyKey: 'idem-1', rawBody: '{}' })
    ).resolves.toBeNull();
  });

  it('persists local role creates and records db write failures deterministically', async () => {
    const deps = createDeps();

    const successResponse = await persistLocalRoleCreate(deps, preparedCreate);

    expect(successResponse.status).toBe(201);
    await expect(successResponse.json()).resolves.toMatchObject({
      data: roleItem,
      requestId: 'req-create-role',
    });
    expect(deps.iamUserOperationsCounter.add).toHaveBeenCalledWith(1, {
      action: 'create_role',
      result: 'success',
    });

    const failingDeps = createDeps({
      persistCreatedRole: vi.fn(async () => {
        throw new Error('db write failed');
      }),
    });

    const failureResponse = await persistLocalRoleCreate(failingDeps, preparedCreate);

    expect(failureResponse.status).toBe(409);
    await expect(failureResponse.json()).resolves.toMatchObject({
      error: {
        code: 'conflict',
        details: {
          syncState: 'failed',
          syncError: { code: 'DB_WRITE_FAILED' },
        },
      },
      requestId: 'req-create-role',
    });
  });

  it('covers create failure helpers with logging and idempotency completion', async () => {
    const unavailableDeps = createDeps();
    const unavailableResponse = await failCreateRoleUnavailable(unavailableDeps, preparedCreate);
    expect(unavailableResponse.status).toBe(503);

    const createdRoleFailureDeps = createDeps();
    const createdRoleFailure = await failCreatedRole(createdRoleFailureDeps, preparedCreate, new Error('keycloak down'));
    expect(createdRoleFailure.status).toBe(503);
    expect(createdRoleFailureDeps.iamUserOperationsCounter.add).toHaveBeenCalledWith(1, {
      action: 'create_role',
      result: 'failure',
    });

    const localWriteDeps = createDeps();
    const localWriteFailure = await failLocalRoleCreateDatabaseWrite(localWriteDeps, preparedCreate, new Error('db write failed'));
    expect(localWriteFailure.status).toBe(409);
    expect(localWriteDeps.logger.error).toHaveBeenCalledWith(
      'Role create database write failed',
      expect.objectContaining({
        error_code: 'DB_WRITE_FAILED',
        error: 'db write failed',
      })
    );

    const compensationDeps = createDeps();
    const compensationFailure = await failCreateCompensation(
      compensationDeps,
      preparedCreate,
      new Error('compensation failed')
    );
    expect(compensationFailure.status).toBe(500);
    expect(compensationDeps.iamRoleSyncCounter.add).toHaveBeenCalledWith(1, {
      operation: 'create',
      result: 'failure',
      error_code: 'COMPENSATION_FAILED',
    });

    const technicalWriteDeps = createDeps();
    const technicalWriteFailure = await failTechnicalRoleDatabaseWrite(
      technicalWriteDeps,
      preparedCreate,
      new Error('db write failed')
    );
    expect(technicalWriteFailure.status).toBe(409);
    expect(technicalWriteDeps.iamRoleSyncCounter.add).toHaveBeenCalledWith(1, {
      operation: 'create',
      result: 'failure',
      error_code: 'DB_WRITE_FAILED',
    });
  });

  it('syncs technical roles and covers unavailable, keycloak failure, compensation and db-write branches', async () => {
    const unavailableDeps = createDeps({
      requireRoleIdentityProvider: vi.fn(async () => new Response('no idp', { status: 503 })),
    });
    const unavailableResponse = await syncTechnicalRoleCreate(unavailableDeps, preparedCreate);
    expect(unavailableResponse.status).toBe(503);

    const keycloakFailureDeps = createDeps({
      trackKeycloakCall: vi.fn(async (operation, work) => {
        if (operation === 'create_role') {
          throw new Error('keycloak down');
        }
        return work();
      }),
    });
    const keycloakFailure = await syncTechnicalRoleCreate(keycloakFailureDeps, preparedCreate);
    expect(keycloakFailure.status).toBe(503);
    expect(keycloakFailureDeps.iamRoleSyncCounter.add).toHaveBeenCalledWith(1, {
      operation: 'create',
      result: 'failure',
      error_code: 'IDP_UNAVAILABLE',
    });

    const successDeps = createDeps();
    const successResponse = await syncTechnicalRoleCreate(successDeps, preparedCreate);
    expect(successResponse.status).toBe(201);
    expect(identityProvider.provider.createRole).toHaveBeenCalledWith({
      externalName: 'editor',
      description: 'Can edit content',
      attributes: {
        displayName: 'Editor',
        instanceId: 'de-musterhausen',
        roleKey: 'editor',
      },
    });
    expect(successDeps.iamRoleSyncCounter.add).toHaveBeenLastCalledWith(1, {
      operation: 'create',
      result: 'success',
      error_code: 'none',
    });

    const compensatedDbFailureDeps = createDeps({
      persistCreatedRole: vi.fn(async () => {
        throw new Error('db write failed');
      }),
    });
    const compensatedDbFailure = await syncTechnicalRoleCreate(compensatedDbFailureDeps, preparedCreate);
    expect(compensatedDbFailure.status).toBe(409);
    expect(identityProvider.provider.deleteRole).toHaveBeenCalledWith('editor');

    const compensationFailureDeps = createDeps({
      persistCreatedRole: vi.fn(async () => {
        throw new Error('db write failed');
      }),
      trackKeycloakCall: vi.fn(async (operation, work) => {
        if (operation === 'delete_role_compensation') {
          throw new Error('compensation failed');
        }
        return work();
      }),
    });
    const compensationFailure = await syncTechnicalRoleCreate(compensationFailureDeps, preparedCreate);
    expect(compensationFailure.status).toBe(500);
  });
});
