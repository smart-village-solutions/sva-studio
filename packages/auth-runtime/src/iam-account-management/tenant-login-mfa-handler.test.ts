import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  actor: vi.fn(),
  read: vi.fn(),
  service: vi.fn(),
}));
vi.mock('../instance-permission-authorization.js', () => ({
  authorizeInstancePermissionForUser: mocks.authorize,
  toInstancePermissionApiErrorCode: () => 'forbidden',
}));
vi.mock('./mutation-request-context.shared.js', () => ({
  resolveMutationActorWithAccount: mocks.actor,
}));
vi.mock('../iam-instance-registry/repository.js', () => ({
  withScopedRegistryRepository: mocks.read,
  withScopedRegistryService: mocks.service,
}));
import {
  getTenantLoginMfaInternal,
  updateTenantLoginMfaInternal,
} from './tenant-login-mfa-handler.js';
const ctx = {
  user: { id: 'user', instanceId: 'tenant-a', roles: ['instance_registry_admin'] },
} as never;
const request = (body?: unknown, suffix = '') =>
  new Request(`https://tenant-a.example/api/v1/iam/users/me/authentication-policy${suffix}`, {
    method: body ? 'PATCH' : 'GET',
    ...(body
      ? { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }
      : {}),
  });
const policy = { desiredMode: 'required', appliedMode: 'optional', status: 'pending' };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.authorize.mockResolvedValue({ ok: true });
  mocks.actor.mockResolvedValue({ actor: { instanceId: 'tenant-a', actorAccountId: 'account-a' } });
  mocks.service.mockImplementation(async (_id, work) =>
    work({ updateLoginMfaPolicy: async () => ({ policy, revision: 2, runId: 'run' }) })
  );
});
describe('tenant login MFA management authorization', () => {
  it('rejects caller supplied tenant IDs', async () => {
    expect(
      (await getTenantLoginMfaInternal(request(undefined, '?instanceId=tenant-b'), ctx)).status
    ).toBe(400);
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it('requires tenant permission even for a platform administrator', async () => {
    mocks.authorize.mockResolvedValue({
      ok: false,
      status: 403,
      error: 'forbidden',
      message: 'Denied',
    });
    expect((await getTenantLoginMfaInternal(request(), ctx)).status).toBe(403);
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it('writes only the session tenant through the permission based mutation gate', async () => {
    const result = await updateTenantLoginMfaInternal(
      request({ mode: 'required', expectedRevision: 1 }),
      ctx
    );
    expect(result.status).toBe(202);
    expect((await result.json()).data.policy).toEqual(policy);
    expect(mocks.actor).toHaveBeenCalledWith(
      expect.any(Request),
      ctx,
      expect.objectContaining({
        allowedRoles: new Set(),
        requiredPermissionAction: 'iam.authenticationPolicy.manage',
      })
    );
    expect(mocks.service).toHaveBeenCalledWith('tenant-a', expect.any(Function));
  });
  it('rejects cross tenant actor resolution and body tenant overrides', async () => {
    mocks.actor.mockResolvedValueOnce({ actor: { instanceId: 'tenant-b' } });
    expect(
      (await updateTenantLoginMfaInternal(request({ mode: 'required', expectedRevision: 1 }), ctx))
        .status
    ).toBe(403);
    expect(
      (
        await updateTenantLoginMfaInternal(
          request({ mode: 'required', expectedRevision: 1, instanceId: 'tenant-b' }),
          ctx
        )
      ).status
    ).toBe(400);
    expect(mocks.service).not.toHaveBeenCalled();
  });
});

it.each([
  [{}, { policy: { desiredMode: 'optional', appliedMode: null, status: 'pending' }, revision: 0 }],
  [
    { loginMfaPolicy: policy, loginMfaRevision: 7, loginMfaRunId: 'verified-run' },
    { policy, revision: 7, runId: 'verified-run' },
  ],
])(
  'reads only the authenticated tenant and preserves verified/default evidence',
  async (instance, expected) => {
    const getInstanceById = vi.fn(async () => instance);
    mocks.read.mockImplementation(async (_id, work) => work({ getInstanceById }));
    const response = await getTenantLoginMfaInternal(request(), ctx);
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual(expected);
    expect(mocks.authorize).toHaveBeenCalledWith({
      ctx,
      action: 'iam.authenticationPolicy.manage',
      instanceId: 'tenant-a',
    });
    expect(mocks.read).toHaveBeenCalledWith('tenant-a', expect.any(Function));
    expect(getInstanceById).toHaveBeenCalledWith('tenant-a');
  }
);
it('returns not found for a tenant deleted after authorization', async () => {
  mocks.read.mockImplementation(async (_id, work) => work({ getInstanceById: async () => null }));
  expect((await getTenantLoginMfaInternal(request(), ctx)).status).toBe(404);
});
it.each([getTenantLoginMfaInternal, updateTenantLoginMfaInternal])(
  'rejects absent tenant context before storage access',
  async (handler) => {
    expect(
      (
        await handler(request(), {
          user: { id: 'user', roles: ['instance_registry_admin'] },
        } as never)
      ).status
    ).toBe(403);
    expect(mocks.authorize).not.toHaveBeenCalled();
    expect(mocks.actor).not.toHaveBeenCalled();
    expect(mocks.read).not.toHaveBeenCalled();
    expect(mocks.service).not.toHaveBeenCalled();
  }
);
it('rejects PATCH query overrides before actor resolution', async () => {
  const response = await updateTenantLoginMfaInternal(
    request({ mode: 'required', expectedRevision: 1 }, '?instanceId=tenant-b'),
    ctx
  );
  expect(response.status).toBe(400);
  expect(mocks.actor).not.toHaveBeenCalled();
});
it('preserves mutation-gate denial without invoking the service', async () => {
  const denial = new Response('csrf_denied', { status: 403 });
  mocks.actor.mockResolvedValueOnce({ response: denial });
  expect(
    await updateTenantLoginMfaInternal(request({ mode: 'required', expectedRevision: 1 }), ctx)
  ).toBe(denial);
  expect(mocks.service).not.toHaveBeenCalled();
});
it.each([
  { mode: 'off', expectedRevision: 1 },
  { mode: 'required', expectedRevision: -1 },
  { mode: 'required', expectedRevision: 0.5 },
  { mode: 'optional' },
])('rejects an invalid update %j before enqueueing', async (body) => {
  expect((await updateTenantLoginMfaInternal(request(body), ctx)).status).toBe(400);
  expect(mocks.service).not.toHaveBeenCalled();
});
it('reports revision conflict without pretending to enqueue a new request', async () => {
  mocks.service.mockRejectedValueOnce(new Error('login_mfa_revision_conflict'));
  const response = await updateTenantLoginMfaInternal(
    request({ mode: 'required', expectedRevision: 1 }),
    ctx
  );
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ error: { code: 'conflict' } });
});
it('propagates operational failures instead of misreporting them as revision conflicts', async () => {
  const error = new Error('database_unavailable');
  mocks.service.mockRejectedValueOnce(error);
  await expect(
    updateTenantLoginMfaInternal(request({ mode: 'required', expectedRevision: 1 }), ctx)
  ).rejects.toBe(error);
});
