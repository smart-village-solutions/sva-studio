import type { IamUserDetail, IamUserListItem } from '@sva/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { KeycloakAdminRequestError, KeycloakAdminUnavailableError } from '../keycloak-admin-client.js';

const state = vi.hoisted(() => ({
  getRoleDisplayName: vi.fn((role: { role_name?: string; role_key: string }) => role.role_name ?? role.role_key),
  getSvaMainserverCredentialAttributeNames: vi.fn(() => ['mainserverAppId', 'mainserverSecret']),
  readIdentityUserAttributes: vi.fn(),
  resolveMainserverCredentialState: vi.fn(() => ({
    mainserverUserApplicationId: undefined,
    mainserverUserApplicationSecretSet: false,
  })),
  resolveIdentityProviderForInstance: vi.fn(),
  resolveRolesByExternalNames: vi.fn(),
  trackKeycloakCall: vi.fn(async (_operation: string, execute: () => Promise<unknown>) => execute()),
}));

vi.mock('../mainserver-credentials.js', () => ({
  getSvaMainserverCredentialAttributeNames: state.getSvaMainserverCredentialAttributeNames,
  readIdentityUserAttributes: state.readIdentityUserAttributes,
  resolveMainserverCredentialState: state.resolveMainserverCredentialState,
}));

vi.mock('./role-audit.js', () => ({
  getRoleDisplayName: state.getRoleDisplayName,
}));

vi.mock('./shared.js', () => ({
  resolveIdentityProviderForInstance: state.resolveIdentityProviderForInstance,
  resolveRolesByExternalNames: state.resolveRolesByExternalNames,
  trackKeycloakCall: state.trackKeycloakCall,
}));

const baseUser = (): IamUserDetail => ({
  id: '11111111-1111-4111-8111-111111111111',
  keycloakSubject: 'kc-user-1',
  displayName: 'Jane Doe',
  email: 'jane@example.com',
  status: 'active',
  roles: [
    {
      roleId: 'role-existing',
      roleKey: 'legacy_editor',
      roleName: 'Legacy Editor',
      roleLevel: 20,
    },
  ],
  mappingStatus: 'mapped',
  editability: 'editable',
  mainserverUserApplicationSecretSet: false,
});

const listUser = (overrides: Partial<IamUserListItem> = {}): IamUserListItem => ({
  id: '22222222-2222-4222-8222-222222222222',
  keycloakSubject: 'kc-user-2',
  displayName: 'Max Mustermann',
  email: 'max@example.com',
  status: 'active',
  roles: [],
  ...overrides,
});

describe('user projection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.resolveMainserverCredentialState.mockReturnValue({
      mainserverUserApplicationId: undefined,
      mainserverUserApplicationSecretSet: false,
    });
    state.resolveRolesByExternalNames.mockResolvedValue([]);
    state.resolveIdentityProviderForInstance.mockResolvedValue({
      provider: {
        listUserRoleNames: vi.fn(async () => ['news.read', 'news.read', 'news.update']),
      },
    });
    state.readIdentityUserAttributes.mockResolvedValue({
      mainserverAppId: ['app-1'],
      mainserverSecret: ['set'],
    });
  });

  it('deduplicates keycloak role names when an identity provider is available', async () => {
    const { resolveKeycloakRoleNames } = await import('./user-projection.js');

    await expect(resolveKeycloakRoleNames('de-musterhausen', 'kc-user-1')).resolves.toEqual([
      'news.read',
      'news.update',
    ]);
    expect(state.trackKeycloakCall).toHaveBeenCalledWith('list_user_roles', expect.any(Function));
  });

  it('returns null when no identity provider can be resolved', async () => {
    const { resolveKeycloakRoleNames } = await import('./user-projection.js');
    state.resolveIdentityProviderForInstance.mockResolvedValueOnce(null);

    await expect(resolveKeycloakRoleNames('de-musterhausen', 'kc-user-1')).resolves.toBeNull();
  });

  it('marks user detail projections as degraded when keycloak roles are unavailable', async () => {
    const { resolveProjectedUserDetail } = await import('./user-projection.js');

    const projectedUser = await resolveProjectedUserDetail({
      client: {},
      instanceId: 'de-musterhausen',
      user: baseUser(),
      keycloakRoleNames: null,
    });

    expect(projectedUser.mappingStatus).toBe('manual_review');
    expect(projectedUser.editability).toBe('blocked');
    expect(projectedUser.fieldEditability).toEqual({
      profile: 'editable',
      status: 'read_only',
      roles: 'blocked',
    });
    expect(projectedUser.diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'keycloak_projection_degraded',
        objectId: projectedUser.id,
      })
    );
  });

  it('keeps DB roles canonical and exposes keycloak role names separately', async () => {
    const { resolveProjectedUserDetail } = await import('./user-projection.js');
    state.resolveRolesByExternalNames.mockResolvedValueOnce([
      {
        id: 'role-news-editor',
        role_key: 'news_editor',
        role_name: 'News Editor',
        role_level: 30,
      },
    ]);

    const projectedUser = await resolveProjectedUserDetail({
      client: {},
      instanceId: 'de-musterhausen',
      user: baseUser(),
      keycloakRoleNames: ['news.editor'],
    });

    expect(projectedUser.roles).toEqual(baseUser().roles);
    expect(projectedUser.keycloakRoles).toEqual(['news.editor']);
    expect(state.resolveRolesByExternalNames).not.toHaveBeenCalled();
  });

  it('falls back to the default mainserver credential state on credential projection errors', async () => {
    const { applyCanonicalUserDetailProjection } = await import('./user-projection.js');
    state.resolveIdentityProviderForInstance.mockRejectedValueOnce(
      new KeycloakAdminUnavailableError('keycloak unavailable')
    );
    state.readIdentityUserAttributes.mockRejectedValueOnce(new Error('identity attributes unavailable'));

    const projectedUser = await applyCanonicalUserDetailProjection({
      client: {},
      instanceId: 'de-musterhausen',
      user: {
        ...baseUser(),
        diagnostics: [{ code: 'keycloak_projection_degraded', objectId: '11111111-1111-4111-8111-111111111111', objectType: 'user' }],
      },
    });

    expect(projectedUser.mainserverUserApplicationId).toBeUndefined();
    expect(projectedUser.mainserverUserApplicationSecretSet).toBe(false);
    expect(projectedUser.mappingStatus).toBe('manual_review');
    expect(
      projectedUser.diagnostics?.filter((diagnostic) => diagnostic.code === 'keycloak_projection_degraded')
    ).toHaveLength(1);
  });

  it('keeps list DB roles canonical while attaching keycloak role names', async () => {
    const { applyCanonicalUserListProjection } = await import('./user-projection.js');
    state.resolveIdentityProviderForInstance
      .mockResolvedValueOnce({
        provider: {
          listUserRoleNames: vi.fn(async () => ['news.editor', 'news.editor']),
        },
      })
      .mockRejectedValueOnce(
        new KeycloakAdminRequestError({
          message: 'temporarily unavailable',
          statusCode: 503,
          code: 'temporarily_unavailable',
          retryable: true,
        })
      );
    state.resolveRolesByExternalNames.mockResolvedValueOnce([
      {
        id: 'role-news-editor',
        role_key: 'news_editor',
        role_name: 'News Editor',
        role_level: 30,
        external_role_name: 'news.editor',
      },
    ]);

    const users = await applyCanonicalUserListProjection({
      client: {},
      instanceId: 'de-musterhausen',
      users: [
        listUser({
          keycloakSubject: 'kc-user-1',
          roles: [
            {
              roleId: 'role-db-editor',
              roleKey: 'db_editor',
              roleName: 'DB Editor',
              roleLevel: 20,
            },
          ],
        }),
        listUser({
          id: '33333333-3333-4333-8333-333333333333',
          keycloakSubject: 'kc-user-2',
          displayName: 'Error User',
          email: 'error@example.com',
        }),
      ],
    });

    expect(users[0]?.roles).toEqual([
      {
        roleId: 'role-db-editor',
        roleKey: 'db_editor',
        roleName: 'DB Editor',
        roleLevel: 20,
      },
    ]);
    expect(users[0]?.keycloakRoles).toEqual(['news.editor']);
    expect(users[1]?.roles).toEqual([]);
    expect(users[1]?.keycloakRoles).toBeUndefined();
    expect(state.resolveRolesByExternalNames).not.toHaveBeenCalled();
  });
});
