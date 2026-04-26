import { beforeEach, describe, expect, it, vi } from 'vitest';

const { evaluateAuthorizeDecisionMock, resolveEffectivePermissionsMock } = vi.hoisted(() => ({
  evaluateAuthorizeDecisionMock: vi.fn(),
  resolveEffectivePermissionsMock: vi.fn(),
}));

vi.mock('@sva/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@sva/core')>();
  return {
    ...actual,
    evaluateAuthorizeDecision: evaluateAuthorizeDecisionMock,
  };
});

vi.mock('../iam-authorization/permission-store.js', () => ({
  resolveEffectivePermissions: resolveEffectivePermissionsMock,
}));

const { authorizeContentAction } = await import('./request-context.js');

describe('content request authorization context', () => {
  beforeEach(() => {
    evaluateAuthorizeDecisionMock.mockReset();
    resolveEffectivePermissionsMock.mockReset();
    resolveEffectivePermissionsMock.mockResolvedValue({ ok: true, permissions: [] });
    evaluateAuthorizeDecisionMock.mockReturnValue({ allowed: true });
  });

  it('preserves the active organization scope when resource context is omitted', async () => {
    await expect(
      authorizeContentAction(
        {
          instanceId: 'instance-1',
          keycloakSubject: 'subject-1',
          actorDisplayName: 'Actor',
          activeOrganizationId: '11111111-1111-1111-8111-111111111111',
        },
        'content.read'
      )
    ).resolves.toBeNull();

    expect(resolveEffectivePermissionsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: '11111111-1111-1111-8111-111111111111',
      })
    );
    expect(evaluateAuthorizeDecisionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: expect.objectContaining({
          organizationId: '11111111-1111-1111-8111-111111111111',
        }),
        context: expect.objectContaining({
          organizationId: '11111111-1111-1111-8111-111111111111',
        }),
      }),
      []
    );
  });

  it('prefers explicit resource organization over active organization scope', async () => {
    await expect(
      authorizeContentAction(
        {
          instanceId: 'instance-1',
          keycloakSubject: 'subject-1',
          actorDisplayName: 'Actor',
          activeOrganizationId: '11111111-1111-1111-8111-111111111111',
        },
        'content.updateMetadata',
        { organizationId: '22222222-2222-4222-8222-222222222222' }
      )
    ).resolves.toBeNull();

    expect(resolveEffectivePermissionsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: '22222222-2222-4222-8222-222222222222',
      })
    );
  });
});
