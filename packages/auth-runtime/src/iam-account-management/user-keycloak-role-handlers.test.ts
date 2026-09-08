import { describe, expect, it, vi } from 'vitest';

import {
  loadKeycloakRoleCatalog,
  projectKeycloakRoleCatalog,
  projectKeycloakRoleAssignments,
  resolveKeycloakRoleMutationDelta,
} from './user-keycloak-role-handlers.js';

describe('Keycloak role catalog pagination', () => {
  it('loads all pages through the supported paginated role endpoint', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      externalName: `role-${index}`,
    }));
    const listRoles = vi
      .fn()
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce([{ externalName: 'role-100' }]);

    const roles = await loadKeycloakRoleCatalog({ listRoles } as never);

    expect(roles).toHaveLength(101);
    expect(listRoles).toHaveBeenNthCalledWith(1, {
      first: 0,
      max: 100,
      briefRepresentation: false,
    });
    expect(listRoles).toHaveBeenNthCalledWith(2, {
      first: 100,
      max: 100,
      briefRepresentation: false,
    });
  });

  it('fails closed when a provider repeats a full page', async () => {
    const repeatedPage = Array.from({ length: 100 }, (_, index) => ({
      externalName: `role-${index}`,
    }));

    await expect(
      loadKeycloakRoleCatalog({ listRoles: vi.fn(async () => repeatedPage) } as never)
    ).rejects.toMatchObject({
      name: 'KeycloakAdminRequestError',
      code: 'role_catalog_pagination_invalid',
      statusCode: 502,
    });
  });
});

describe('Keycloak role assignment projection', () => {
  const newsRole = { id: 'news', externalName: 'news_editor' };
  const eventRole = { id: 'event', externalName: 'event_editor' };

  it('classifies catalog entries independently from user assignments', () => {
    expect(
      projectKeycloakRoleCatalog([
        { id: 'external', externalName: 'news_editor' },
        { id: 'builtin', externalName: 'offline_access' },
      ])
    ).toEqual([
      expect.objectContaining({ roleName: 'news_editor', managedBy: 'external' }),
      expect.objectContaining({ roleName: 'offline_access', managedBy: 'keycloak_builtin' }),
    ]);
  });

  it('separates direct, inherited and unassigned realm roles', () => {
    const result = projectKeycloakRoleAssignments({
      catalog: [newsRole, eventRole, { id: 'poi', externalName: 'poi_editor' }],
      direct: [newsRole],
      effective: [newsRole, eventRole],
    });

    expect(result).toEqual([
      expect.objectContaining({
        roleName: 'event_editor',
        direct: false,
        effective: true,
        origin: 'composite',
      }),
      expect.objectContaining({
        roleName: 'news_editor',
        direct: true,
        effective: true,
        origin: 'direct',
      }),
      expect.objectContaining({
        roleName: 'poi_editor',
        direct: false,
        effective: false,
        origin: 'unassigned',
      }),
    ]);
  });

  it('projects client roles as visible but protected entries', () => {
    expect(
      projectKeycloakRoleAssignments({
        catalog: [{ id: 'client', externalName: 'manage-users', clientRole: true }],
        direct: [],
        effective: [],
      })
    ).toEqual([
      expect.objectContaining({
        roleName: 'manage-users',
        category: 'client_role',
        assignable: false,
        reasonCode: 'client_role_not_supported',
      }),
    ]);
  });
});

describe('Keycloak role assignment deltas', () => {
  const role = { id: 'news', externalName: 'news_editor' };

  it('is idempotent for an already direct assignment', () => {
    expect(
      resolveKeycloakRoleMutationDelta({
        operation: 'assign',
        roleName: role.externalName,
        direct: [role],
        effective: [role],
      })
    ).toEqual({ needsWrite: false, inheritedOnly: false });
  });

  it('blocks removal of an inherited-only assignment', () => {
    expect(
      resolveKeycloakRoleMutationDelta({
        operation: 'remove',
        roleName: role.externalName,
        direct: [],
        effective: [role],
      })
    ).toEqual({ needsWrite: false, inheritedOnly: true });
  });
});
