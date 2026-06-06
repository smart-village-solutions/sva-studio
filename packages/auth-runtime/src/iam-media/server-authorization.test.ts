import { beforeEach, describe, expect, it, vi } from 'vitest';

import { authorizeMediaPrimitiveForUser } from './server-authorization.js';

const resolveEffectivePermissionsMock = vi.fn(async () => ({
  ok: true,
  permissions: [
    {
      action: 'media.read',
      effect: 'allow',
      resourceType: 'media',
    },
  ],
}));

vi.mock('../iam-account-management/shared.js', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
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
    resolveEffectivePermissionsMock.mockReset();
    resolveEffectivePermissionsMock.mockResolvedValue({
      ok: true,
      permissions: [
        {
          action: 'media.read',
          effect: 'allow',
          resourceType: 'media',
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

  it('resolves media permissions instance-wide without reading an active organization context', async () => {
    await expect(
      authorizeMediaPrimitiveForUser({
        ctx: createContext(),
        action: 'media.read',
      })
    ).resolves.toMatchObject({ ok: true });

    expect(resolveEffectivePermissionsMock).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      keycloakSubject: 'kc-user-1',
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
});
