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
