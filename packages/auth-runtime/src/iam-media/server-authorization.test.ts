import { beforeEach, describe, expect, it, vi } from 'vitest';

import { authorizeMediaPrimitiveForUser } from './server-authorization.js';

const getSessionMock = vi.fn();
const resolveEffectivePermissionsMock = vi.fn(async () => ({
  ok: true,
  permissions: [
    {
      action: 'media.read',
      effect: 'allow',
      resourceType: 'media',
      organizationId: '11111111-1111-4111-8111-111111111111',
    },
  ],
}));

vi.mock('../iam-account-management/shared.js', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../redis-session.js', () => ({
  getSession: (...args: Parameters<typeof getSessionMock>) => getSessionMock(...args),
}));

vi.mock('../iam-authorization/permission-store.js', () => ({
  resolveEffectivePermissions: (...args: Parameters<typeof resolveEffectivePermissionsMock>) =>
    resolveEffectivePermissionsMock(...args),
}));

const createContext = (instanceId = 'tenant-a') =>
  ({
    sessionId: 'session-1',
    user: {
      id: 'kc-user-1',
      instanceId,
    },
  }) as never;

describe('authorizeMediaPrimitiveForUser', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    resolveEffectivePermissionsMock.mockReset();
    getSessionMock.mockResolvedValue({ activeOrganizationId: '11111111-1111-4111-8111-111111111111' });
    resolveEffectivePermissionsMock.mockResolvedValue({
      ok: true,
      permissions: [
        {
          action: 'media.read',
          effect: 'allow',
          resourceType: 'media',
          organizationId: '11111111-1111-4111-8111-111111111111',
        },
      ],
    });
  });

  it('authorizes allowed media actions', async () => {
    await expect(
      authorizeMediaPrimitiveForUser({
        ctx: createContext(),
        action: 'media.read',
        resource: { assetId: 'asset-1' },
      })
    ).resolves.toMatchObject({
      ok: true,
      actor: {
        instanceId: 'tenant-a',
        keycloakSubject: 'kc-user-1',
      },
    });
  });

  it('uses the active organization from the session for permission lookup and request scope', async () => {
    await expect(
      authorizeMediaPrimitiveForUser({
        ctx: createContext(),
        action: 'media.read',
      })
    ).resolves.toMatchObject({ ok: true });

    expect(getSessionMock).toHaveBeenCalledWith('session-1');
    expect(resolveEffectivePermissionsMock).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      keycloakSubject: 'kc-user-1',
      organizationId: '11111111-1111-4111-8111-111111111111',
    });
  });

  it('rejects invalid action identifiers before permission resolution', async () => {
    await expect(
      authorizeMediaPrimitiveForUser({
        ctx: createContext(),
        action: 'invalid',
      })
    ).resolves.toEqual({
      ok: false,
      status: 400,
      error: 'invalid_action',
      message: 'Ungültige Action für diese Medienoperation.',
    });
  });

  it('returns forbidden when the permission decision denies the media action', async () => {
    await expect(
      Promise.all(
        ['media.read', 'media.create', 'media.delete'].map((action) =>
          authorizeMediaPrimitiveForUser({
            ctx: createContext(),
            action,
            permissions: [],
          })
        )
      )
    ).resolves.toEqual([
      {
        ok: false,
        status: 403,
        error: 'forbidden',
        message: 'Keine Berechtigung für diese Medienoperation.',
      },
      {
        ok: false,
        status: 403,
        error: 'forbidden',
        message: 'Keine Berechtigung für diese Medienoperation.',
      },
      {
        ok: false,
        status: 403,
        error: 'forbidden',
        message: 'Keine Berechtigung für diese Medienoperation.',
      },
    ]);
  });

  it('returns database_unavailable when the active session organization cannot be read', async () => {
    getSessionMock.mockRejectedValueOnce(new Error('redis down'));

    await expect(
      authorizeMediaPrimitiveForUser({
        ctx: createContext(),
        action: 'media.read',
      })
    ).resolves.toEqual({
      ok: false,
      status: 503,
      error: 'database_unavailable',
      message: 'Berechtigungen konnten nicht geprüft werden.',
    });
  });
});
