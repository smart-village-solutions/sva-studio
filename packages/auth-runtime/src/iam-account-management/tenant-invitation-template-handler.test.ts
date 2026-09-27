import { DEFAULT_ACCOUNT_INVITATION_TEMPLATE } from '@sva/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  resolveActor: vi.fn(),
  scopedRepository: vi.fn(),
  registryRepository: vi.fn(),
}));

vi.mock('../instance-permission-authorization.js', () => ({
  authorizeInstancePermissionForUser: mocks.authorize,
  toInstancePermissionApiErrorCode: () => 'forbidden',
}));
vi.mock('./mutation-request-context.shared.js', () => ({
  resolveMutationActorWithAccount: mocks.resolveActor,
}));
vi.mock('../iam-instance-registry/repository.js', () => ({
  withScopedRegistryRepository: mocks.scopedRepository,
  withRegistryRepository: mocks.registryRepository,
}));
vi.mock('@sva/server-runtime', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getWorkspaceContext: () => ({ requestId: 'request-1' }),
}));

import {
  getTenantInvitationTemplateInternal,
  updateTenantInvitationTemplateInternal,
} from './tenant-invitation-template-handler.js';

const context = (instanceId?: string) =>
  ({ user: { id: 'subject-1', instanceId, roles: ['system_admin'] } }) as never;

const instance = {
  instanceId: 'tenant-a',
  displayName: 'Tenant A',
  primaryHostname: 'tenant-a.example.org',
  accountInvitationTemplate: undefined,
};

const repository = {
  getInstanceById: vi.fn(async () => instance),
  getServerAccountInvitationTemplate: vi.fn(async () => ({ revision: 0 })),
  updateAccountInvitationTemplate: vi.fn(async () => instance),
};

const request = (method: 'GET' | 'PATCH', suffix = '', body?: unknown) =>
  new Request(`https://tenant-a.example.org/api/v1/iam/users/me/invitation-template${suffix}`, {
    method,
    ...(body === undefined
      ? {}
      : { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authorize.mockResolvedValue({ ok: true });
  mocks.resolveActor.mockResolvedValue({
    actor: { instanceId: 'tenant-a', actorAccountId: 'account-1' },
  });
  mocks.scopedRepository.mockImplementation(async (_instanceId, work) => work(repository));
  mocks.registryRepository.mockImplementation(async (work) => work(repository));
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('tenant invitation template handler', () => {
  it('reads only the session tenant and returns a narrow inherited view', async () => {
    const response = await getTenantInvitationTemplateInternal(request('GET'), context('tenant-a'));
    expect(response.status).toBe(200);
    expect(mocks.authorize).toHaveBeenCalledWith({
      ctx: context('tenant-a'),
      action: 'iam.invitationTemplate.manage',
      instanceId: 'tenant-a',
    });
    expect(mocks.scopedRepository).toHaveBeenCalledWith('tenant-a', expect.any(Function));
    expect(mocks.registryRepository).toHaveBeenCalledWith(expect.any(Function));
    expect((await response.json()).data).toEqual({
      revision: 0,
      effectiveTemplate: { ...DEFAULT_ACCOUNT_INVITATION_TEMPLATE, revision: 0 },
      source: 'sva_default',
      tenantName: 'Tenant A',
      tenantHomepageUrl: 'https://tenant-a.example.org/',
    });
  });

  it('rejects a requested instance and missing permission before reading data', async () => {
    const spoofed = await getTenantInvitationTemplateInternal(
      request('GET', '?instanceId=tenant-b'),
      context('tenant-a')
    );
    expect(spoofed.status).toBe(400);
    mocks.authorize.mockResolvedValueOnce({
      ok: false,
      status: 403,
      error: 'forbidden',
      message: 'Denied',
    });
    const denied = await getTenantInvitationTemplateInternal(request('GET'), context('tenant-a'));
    expect(denied.status).toBe(403);
    expect(mocks.scopedRepository).not.toHaveBeenCalled();
    expect(mocks.registryRepository).not.toHaveBeenCalled();
  });

  it('rejects reads when IAM administration is disabled', async () => {
    vi.stubEnv('IAM_ADMIN_ENABLED', 'false');
    const response = await getTenantInvitationTemplateInternal(request('GET'), context('tenant-a'));
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe('feature_disabled');
    expect(mocks.authorize).not.toHaveBeenCalled();
    expect(mocks.scopedRepository).not.toHaveBeenCalled();
  });

  it('writes the session tenant with the expected revision and supports reset', async () => {
    const response = await updateTenantInvitationTemplateInternal(
      request('PATCH', '', { expectedRevision: 0, template: DEFAULT_ACCOUNT_INVITATION_TEMPLATE }),
      context('tenant-a')
    );
    expect(response.status).toBe(200);
    expect(repository.updateAccountInvitationTemplate).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      expectedRevision: 0,
      template: { ...DEFAULT_ACCOUNT_INVITATION_TEMPLATE, revision: 1 },
      actorId: 'account-1',
    });
    await updateTenantInvitationTemplateInternal(
      request('PATCH', '', { expectedRevision: 1, template: null }),
      context('tenant-a')
    );
    expect(repository.updateAccountInvitationTemplate).toHaveBeenLastCalledWith({
      instanceId: 'tenant-a',
      expectedRevision: 1,
      template: null,
      actorId: 'account-1',
    });
  });

  it('rejects cross-tenant actor resolution and invalid input before mutation', async () => {
    const requestedOtherTenant = await updateTenantInvitationTemplateInternal(
      request('PATCH', '?instanceId=tenant-b', { expectedRevision: 0, template: null }),
      context('tenant-a')
    );
    expect(requestedOtherTenant.status).toBe(400);
    const missingTenant = await updateTenantInvitationTemplateInternal(
      request('PATCH', '', { expectedRevision: 0, template: null }),
      context()
    );
    expect(missingTenant.status).toBe(403);
    mocks.resolveActor.mockResolvedValueOnce({
      actor: { instanceId: 'tenant-b', actorAccountId: 'account-1' },
    });
    const crossed = await updateTenantInvitationTemplateInternal(
      request('PATCH', '', { expectedRevision: 0, template: null }),
      context('tenant-a')
    );
    expect(crossed.status).toBe(403);
    const invalid = await updateTenantInvitationTemplateInternal(
      request('PATCH', '', {
        expectedRevision: 0,
        template: { ...DEFAULT_ACCOUNT_INVITATION_TEMPLATE, body: 'No password link' },
      }),
      context('tenant-a')
    );
    expect(invalid.status).toBe(400);
    expect(repository.updateAccountInvitationTemplate).not.toHaveBeenCalled();
  });

  it('returns a revision conflict without overwriting the saved template', async () => {
    repository.updateAccountInvitationTemplate.mockRejectedValueOnce(
      new Error('account_invitation_template_revision_conflict')
    );
    const response = await updateTenantInvitationTemplateInternal(
      request('PATCH', '', { expectedRevision: 0, template: DEFAULT_ACCOUNT_INVITATION_TEMPLATE }),
      context('tenant-a')
    );
    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe(
      'account_invitation_template_revision_conflict'
    );
  });
});
