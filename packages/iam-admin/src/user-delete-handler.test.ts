import type { IamUserDetail } from '@sva/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createJsonResponse, createTestDepsBuilder } from '../test-support/handler-test-helpers.js';
import {
  createDeleteUserHandlerInternal,
  type DeleteUserHandlerDeps,
} from './user-delete-handler.js';

const actor = {
  instanceId: 'de-musterhausen',
  actorAccountId: 'actor-account-1',
  requestId: 'req-delete',
  traceId: 'trace-delete',
};

const ctx = {
  sessionId: 'session-1',
  user: {
    id: 'kc-actor-1',
    instanceId: 'de-musterhausen',
    roles: ['system_admin'],
  },
};

const userDetail = {
  id: '11111111-1111-1111-8111-111111111111',
  keycloakSubject: 'kc-user-1',
  displayName: 'Alice Example',
  email: 'alice@example.com',
  status: 'active',
  roles: [{ roleId: 'role-editor', roleKey: 'editor', roleName: 'Editor', roleLevel: 10 }],
  mainserverUserApplicationSecretSet: false,
} satisfies IamUserDetail;

const createDeps = createTestDepsBuilder<DeleteUserHandlerDeps>(() => ({
  createUnexpectedMutationErrorResponse: vi.fn(({ requestId, message }) =>
    createJsonResponse(500, { error: { code: 'internal_error', message }, requestId })
  ),
  createUserMutationErrorResponse: vi.fn(() => null),
  deleteIdentityUser: vi.fn(async () => undefined),
  emitActivityLog: vi.fn(async () => undefined),
  ensureActorCanManageTarget: vi.fn(() => ({ ok: true })),
  hardDeleteUserRecord: vi.fn(async () => undefined),
  iamUserOperationsCounter: {
    add: vi.fn(),
  },
  isSystemAdminAccount: vi.fn(async () => false),
  jsonResponse: vi.fn(createJsonResponse),
  logger: {
    error: vi.fn(),
  },
  notFoundResponse: vi.fn((requestId) => createJsonResponse(404, { error: { code: 'not_found' }, requestId })),
  purgeAccountHardDeleteBlockers: vi.fn(async () => undefined),
  reconcileOwnedContentForAccountDelete: vi.fn(async () => undefined),
  resolveActorMaxRoleLevel: vi.fn(async () => 100),
  resolveDeleteRequestContext: vi.fn(async () => ({
    actor,
    userId: userDetail.id,
  })),
  resolveUserDetail: vi.fn(async () => userDetail),
  revokeUserSessions: vi.fn(async () => undefined),
  trackKeycloakCall: vi.fn(async (_operation, work) => work()),
  withInstanceScopedDb: vi.fn(async (_instanceId, work) =>
    work({
      query: vi.fn(async () => ({ rows: [], rowCount: 1 })),
    })
  ),
}));

describe('createDeleteUserHandlerInternal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects self delete through mutation error handling', async () => {
    const deps = createDeps({
      createUserMutationErrorResponse: vi.fn(() => createJsonResponse(409, { error: { code: 'self_protection' } })),
      resolveUserDetail: vi.fn(async () => ({
        ...userDetail,
        keycloakSubject: 'kc-actor-1',
      })),
    });
    const handler = createDeleteUserHandlerInternal(deps);

    const response = await handler(new Request(`http://localhost/api/v1/iam/users/${userDetail.id}`), ctx);

    expect(response.status).toBe(409);
    expect(deps.createUserMutationErrorResponse).toHaveBeenCalledWith({
      error: expect.objectContaining({
        message: 'self_protection:Eigener Nutzer kann nicht gelöscht werden.',
      }),
      requestId: 'req-delete',
      forbiddenFallbackMessage: 'Löschung dieses Nutzers ist nicht erlaubt.',
    });
  });

  it('rejects deletion of a system_admin target even for system_admin actors', async () => {
    const deps = createDeps({
      createUserMutationErrorResponse: vi.fn(() =>
        createJsonResponse(409, { error: { code: 'system_admin_delete_protection' } })
      ),
      isSystemAdminAccount: vi.fn(async () => true),
    });
    const handler = createDeleteUserHandlerInternal(deps);

    const response = await handler(new Request(`http://localhost/api/v1/iam/users/${userDetail.id}`), ctx);

    expect(response.status).toBe(409);
    expect(deps.createUserMutationErrorResponse).toHaveBeenCalledWith({
      error: expect.objectContaining({
        message: 'system_admin_delete_protection:system_admin muss vor der Löschung entzogen werden.',
      }),
      requestId: 'req-delete',
      forbiddenFallbackMessage: 'Löschung dieses Nutzers ist nicht erlaubt.',
    });
    expect(deps.reconcileOwnedContentForAccountDelete).not.toHaveBeenCalled();
  });

  it('runs content reconciliation, session revocation, identity delete, hard delete and activity log in order', async () => {
    const events: string[] = [];
    const deps = createDeps({
      deleteIdentityUser: vi.fn(async () => {
        events.push('delete-identity');
      }),
      emitActivityLog: vi.fn(async () => {
        events.push('activity-log');
      }),
      hardDeleteUserRecord: vi.fn(async () => {
        events.push('hard-delete-user');
      }),
      purgeAccountHardDeleteBlockers: vi.fn(async () => {
        events.push('purge-delete-blockers');
      }),
      reconcileOwnedContentForAccountDelete: vi.fn(async () => {
        events.push('content-reconcile');
      }),
      revokeUserSessions: vi.fn(async () => {
        events.push('revoke-sessions');
      }),
      trackKeycloakCall: vi.fn(async (_operation, work) => {
        events.push('keycloak:start');
        const result = await work();
        events.push('keycloak:end');
        return result;
      }),
    });
    const handler = createDeleteUserHandlerInternal(deps);

    const response = await handler(new Request(`http://localhost/api/v1/iam/users/${userDetail.id}`), ctx);

    expect(response.status).toBe(204);
    expect(events).toEqual([
      'content-reconcile',
      'purge-delete-blockers',
      'revoke-sessions',
      'keycloak:start',
      'delete-identity',
      'keycloak:end',
      'hard-delete-user',
      'activity-log',
    ]);
    expect(deps.trackKeycloakCall).toHaveBeenCalledWith('delete_user', expect.any(Function));
    expect(deps.purgeAccountHardDeleteBlockers).toHaveBeenCalledWith(expect.anything(), {
      accountId: userDetail.id,
      instanceId: actor.instanceId,
    });
    expect(deps.hardDeleteUserRecord).toHaveBeenCalledWith(expect.anything(), {
      accountId: userDetail.id,
      instanceId: actor.instanceId,
    });
    expect(deps.emitActivityLog).toHaveBeenCalledWith(expect.anything(), {
      accountId: actor.actorAccountId,
      eventType: 'user.deleted',
      instanceId: actor.instanceId,
      requestId: actor.requestId,
      result: 'success',
      subjectId: userDetail.id,
      traceId: actor.traceId,
    });
    expect(deps.iamUserOperationsCounter.add).toHaveBeenCalledWith(1, {
      action: 'delete_user',
      result: 'success',
    });
  });

  it('returns not_found when the user record does not exist', async () => {
    const deps = createDeps({
      resolveUserDetail: vi.fn(async () => undefined),
    });
    const handler = createDeleteUserHandlerInternal(deps);

    const response = await handler(new Request(`http://localhost/api/v1/iam/users/${userDetail.id}`), ctx);

    expect(response.status).toBe(404);
    expect(deps.notFoundResponse).toHaveBeenCalledWith('req-delete');
    expect(deps.revokeUserSessions).not.toHaveBeenCalled();
    expect(deps.trackKeycloakCall).not.toHaveBeenCalled();
  });
});
