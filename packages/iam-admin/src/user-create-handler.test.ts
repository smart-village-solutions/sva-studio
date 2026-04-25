import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createCreateUserHandlerInternal,
  type CreateUserHandlerDeps,
} from './user-create-handler.js';

type TestPayload = {
  readonly email: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly status?: 'active' | 'inactive' | 'pending';
  readonly roleIds: readonly string[];
};

const actor = {
  instanceId: 'de-musterhausen',
  actorAccountId: 'actor-account-1',
  requestId: 'req-create',
  traceId: 'trace-create',
};

const ctx = {
  sessionId: 'session-1',
  user: {
    id: 'kc-actor-1',
    instanceId: 'de-musterhausen',
    roles: ['system_admin'],
  },
};

const payload = {
  email: 'alice@example.com',
  firstName: 'Alice',
  status: 'active',
  roleIds: ['role-editor'],
} satisfies TestPayload;

const identityProvider = {
  provider: {
    createUser: vi.fn(async () => ({ externalId: 'kc-user-1' })),
    syncRoles: vi.fn(async () => undefined),
  },
};

const createJsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const createDeps = (
  overrides: Partial<CreateUserHandlerDeps<TestPayload, typeof identityProvider>> = {}
): CreateUserHandlerDeps<TestPayload, typeof identityProvider> => ({
  asApiItem: vi.fn((data, requestId) => ({ data, ...(requestId ? { requestId } : {}) })),
  completeIdempotency: vi.fn(async () => undefined),
  createApiError: vi.fn((status, code, message, requestId) =>
    createJsonResponse(status, { error: { code, message }, requestId })
  ),
  createIdpUnavailableBody: vi.fn((requestId) => ({
    error: {
      code: 'keycloak_unavailable',
      message: 'Keycloak Admin API ist nicht konfiguriert.',
    },
    requestId,
  })),
  executeCreateUser: vi.fn(async () => ({
    responseData: {
      id: 'account-1',
      keycloakSubject: 'kc-user-1',
      email: 'alice@example.com',
    },
  })),
  iamUserOperationsCounter: {
    add: vi.fn(),
  },
  jsonResponse: vi.fn(createJsonResponse),
  parseCreateUserBody: vi.fn(async () => ({ ok: true, data: payload, rawBody: JSON.stringify(payload) })),
  requireIdempotencyKey: vi.fn(() => ({ key: 'idem-create-1' })),
  reserveIdempotency: vi.fn(async () => ({ status: 'reserved' })),
  resolveCreateUserActorContext: vi.fn(async () => ({
    actor,
    actorSubject: 'kc-actor-1',
  })),
  resolveIdentityProviderForInstance: vi.fn(async () => identityProvider),
  toPayloadHash: vi.fn(() => 'payload-hash-1'),
  ...overrides,
});

describe('createCreateUserHandlerInternal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    identityProvider.provider.createUser.mockClear();
    identityProvider.provider.syncRoles.mockClear();
  });

  it('reserves idempotency, executes creation, completes the request and returns created item', async () => {
    const deps = createDeps();
    const handler = createCreateUserHandlerInternal(deps);

    const response = await handler(new Request('http://localhost/api/v1/iam/users'), ctx);

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        id: 'account-1',
        keycloakSubject: 'kc-user-1',
      },
      requestId: 'req-create',
    });
    expect(deps.reserveIdempotency).toHaveBeenCalledWith({
      instanceId: 'de-musterhausen',
      actorAccountId: 'actor-account-1',
      endpoint: 'POST:/api/v1/iam/users',
      idempotencyKey: 'idem-create-1',
      payloadHash: 'payload-hash-1',
    });
    expect(deps.executeCreateUser).toHaveBeenCalledWith({
      actor: {
        ...actor,
        actorRoles: ['system_admin'],
      },
      actorSubject: 'kc-actor-1',
      identityProvider,
      payload,
    });
    expect(deps.completeIdempotency).toHaveBeenCalledWith({
      instanceId: 'de-musterhausen',
      actorAccountId: 'actor-account-1',
      endpoint: 'POST:/api/v1/iam/users',
      idempotencyKey: 'idem-create-1',
      status: 'COMPLETED',
      responseStatus: 201,
      responseBody: expect.objectContaining({ requestId: 'req-create' }),
    });
    expect(deps.iamUserOperationsCounter.add).toHaveBeenCalledWith(1, {
      action: 'create_user',
      result: 'success',
    });
  });

  it('returns guard responses before idempotency work', async () => {
    const guardResponse = createJsonResponse(403, { error: { code: 'forbidden' } });
    const deps = createDeps({
      resolveCreateUserActorContext: vi.fn(async () => guardResponse),
    });
    const handler = createCreateUserHandlerInternal(deps);

    const response = await handler(new Request('http://localhost/api/v1/iam/users'), ctx);

    expect(response).toBe(guardResponse);
    expect(deps.reserveIdempotency).not.toHaveBeenCalled();
  });

  it('returns replay responses without executing creation', async () => {
    const replayBody = { data: { id: 'existing-account' } };
    const deps = createDeps({
      reserveIdempotency: vi.fn(async () => ({
        status: 'replay',
        responseStatus: 201,
        responseBody: replayBody,
      })),
    });
    const handler = createCreateUserHandlerInternal(deps);

    const response = await handler(new Request('http://localhost/api/v1/iam/users'), ctx);

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual(replayBody);
    expect(deps.executeCreateUser).not.toHaveBeenCalled();
  });

  it('fails and stores idempotency result when no tenant identity provider is configured', async () => {
    const deps = createDeps({
      resolveIdentityProviderForInstance: vi.fn(async () => undefined),
    });
    const handler = createCreateUserHandlerInternal(deps);

    const response = await handler(new Request('http://localhost/api/v1/iam/users'), ctx);

    expect(response.status).toBe(503);
    expect(deps.completeIdempotency).toHaveBeenCalledWith({
      instanceId: 'de-musterhausen',
      actorAccountId: 'actor-account-1',
      endpoint: 'POST:/api/v1/iam/users',
      idempotencyKey: 'idem-create-1',
      status: 'FAILED',
      responseStatus: 503,
      responseBody: expect.objectContaining({
        error: { code: 'keycloak_unavailable', message: 'Keycloak Admin API ist nicht konfiguriert.' },
      }),
    });
  });

  it('marks creation failures as failed idempotent requests', async () => {
    const deps = createDeps({
      executeCreateUser: vi.fn(async () => {
        throw new Error('create failed');
      }),
    });
    const handler = createCreateUserHandlerInternal(deps);

    const response = await handler(new Request('http://localhost/api/v1/iam/users'), ctx);

    expect(response.status).toBe(500);
    expect(deps.completeIdempotency).toHaveBeenCalledWith({
      instanceId: 'de-musterhausen',
      actorAccountId: 'actor-account-1',
      endpoint: 'POST:/api/v1/iam/users',
      idempotencyKey: 'idem-create-1',
      status: 'FAILED',
      responseStatus: 500,
      responseBody: {
        error: {
          code: 'internal_error',
          message: 'Nutzer konnte nicht erstellt werden.',
        },
        requestId: 'req-create',
      },
    });
    expect(deps.iamUserOperationsCounter.add).toHaveBeenCalledWith(1, {
      action: 'create_user',
      result: 'failure',
    });
  });
});
