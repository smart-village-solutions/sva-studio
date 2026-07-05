import { describe, expect, it, vi } from 'vitest';

import { createInstanceRegistryMutationHttpHandlers, type InstanceRegistryMutationHttpDeps } from './http-mutation-handlers.js';

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
    expect(steps).toEqual(['authorize', 'csrf', 'idempotency', 'parse', 'execute']);
  });
});
