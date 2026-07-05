import { describe, expect, it, vi } from 'vitest';

import { createInstanceRegistryMutationHttpHandlers, type InstanceRegistryMutationHttpDeps } from './http-mutation-handlers.js';
import {
  readInstanceIdOrError,
  requireIdempotencyKeyOrError,
  requireMutationGuards,
  withScopedRegistryMutation,
} from './http-mutation-shared.js';

type TestContext = {
  readonly userId: string;
};

const createDeps = (): InstanceRegistryMutationHttpDeps<TestContext> => ({
  getRequestId: () => 'req-order',
  getActor: (ctx) => ({ id: ctx.userId }),
  createApiError: (status, code, message) =>
    new Response(JSON.stringify({ code, message }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  jsonResponse: (status, payload) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  asApiItem: (value) => value,
  parseRequestBody: vi.fn(async () => ({ ok: true, data: { rotateClientSecret: false } })),
  requireIdempotencyKey: vi.fn(() => ({ key: 'idem-order' })),
  ensurePlatformAccess: vi.fn(() => null),
  validateCsrf: vi.fn(() => null),
  requireFreshReauth: vi.fn(() => null),
  withRegistryService: vi.fn(),
  withScopedRegistryService: vi.fn(async (_instanceId, work) =>
    work({
      reconcileKeycloak: vi.fn(async () => ({ realmExists: true })),
    } as never)
  ),
});

describe('instance registry mutation workflow', () => {
  it('runs guard, idempotency, parse and execute in the shared order', async () => {
    const deps = createDeps();
    const steps: string[] = [];
    vi.mocked(deps.ensurePlatformAccess).mockImplementation(() => {
      steps.push('authorize');
      return null;
    });
    vi.mocked(deps.validateCsrf).mockImplementation(() => {
      steps.push('csrf');
      return null;
    });
    vi.mocked(deps.requireIdempotencyKey).mockImplementation(() => {
      steps.push('idempotency');
      return { key: 'idem-order' };
    });
    vi.mocked(deps.parseRequestBody).mockImplementation(async () => {
      steps.push('parse');
      return { ok: true, data: { rotateClientSecret: false } };
    });
    vi.mocked(deps.withScopedRegistryService).mockImplementation(async (_instanceId, work) => {
      steps.push('execute');
      return work({
        reconcileKeycloak: vi.fn(async () => ({ realmExists: true })),
      } as never);
    });
    const handlers = createInstanceRegistryMutationHttpHandlers(deps);

    const response = await handlers.reconcileInstanceKeycloak(
      new Request('http://localhost/api/instances/inst-1/keycloak/reconcile', { method: 'POST' }),
      { userId: 'u-1' }
    );

    expect(response.status).toBe(200);
    expect(steps).toEqual(['csrf', 'authorize', 'idempotency', 'parse', 'execute']);
  });

  it('returns direct helper responses for missing instance ids and idempotency keys', () => {
    const deps = createDeps();
    vi.mocked(deps.requireIdempotencyKey).mockReturnValueOnce({
      error: new Response('missing idempotency', { status: 428 }),
    });

    const instanceIdResult = readInstanceIdOrError(
      deps,
      new Request('http://localhost/api/instances', { method: 'POST' })
    );
    const idempotencyResult = requireIdempotencyKeyOrError(
      deps,
      new Request('http://localhost/api/instances/inst-1/keycloak/reconcile', { method: 'POST' })
    );

    expect(instanceIdResult).toBeInstanceOf(Response);
    expect((instanceIdResult as Response).status).toBe(400);
    expect(idempotencyResult).toBeInstanceOf(Response);
    expect((idempotencyResult as Response).status).toBe(428);
  });

  it('returns direct helper values when guards and request metadata are valid', async () => {
    const deps = createDeps();
    const serviceResult = { ok: true } as const;

    const guardResult = requireMutationGuards(
      deps,
      new Request('http://localhost/api/instances/inst-1/keycloak/reconcile', { method: 'POST' }),
      { userId: 'u-1' }
    );
    const instanceIdResult = readInstanceIdOrError(
      deps,
      new Request('http://localhost/api/instances/inst-1/keycloak/reconcile', { method: 'POST' })
    );
    const idempotencyResult = requireIdempotencyKeyOrError(
      deps,
      new Request('http://localhost/api/instances/inst-1/keycloak/reconcile', { method: 'POST' })
    );
    const mutationResult = await withScopedRegistryMutation(deps, 'inst-1', async () => serviceResult);

    expect(guardResult).toBeNull();
    expect(instanceIdResult).toBe('inst-1');
    expect(idempotencyResult).toBe('idem-order');
    expect(mutationResult).toBe(serviceResult);
  });

  it('short-circuits direct guard helpers on access and csrf failures', () => {
    const deps = createDeps();
    vi.mocked(deps.ensurePlatformAccess).mockReturnValueOnce(new Response('forbidden', { status: 403 }));

    const accessResult = requireMutationGuards(
      deps,
      new Request('http://localhost/api/instances/inst-1/keycloak/reconcile', { method: 'POST' }),
      { userId: 'u-1' }
    );

    vi.mocked(deps.ensurePlatformAccess).mockReturnValueOnce(null);
    vi.mocked(deps.validateCsrf).mockReturnValueOnce(new Response('csrf', { status: 403 }));

    const csrfResult = requireMutationGuards(
      deps,
      new Request('http://localhost/api/instances/inst-1/keycloak/reconcile', { method: 'POST' }),
      { userId: 'u-1' }
    );

    expect(accessResult).toBeInstanceOf(Response);
    expect((accessResult as Response).status).toBe(403);
    expect(csrfResult).toBeInstanceOf(Response);
    expect((csrfResult as Response).status).toBe(403);
  });
});
