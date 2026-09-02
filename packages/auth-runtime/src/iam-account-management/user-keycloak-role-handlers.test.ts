import { describe, expect, it, vi } from 'vitest';

import {
  loadKeycloakRoleCatalog,
  projectKeycloakRoleAssignments,
  resolveKeycloakRoleMutationDelta,
} from './user-keycloak-role-handlers.js';

describe('Keycloak role catalog pagination', () => {
  it('loads all pages when the provider has no role count operation', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      externalName: `role-${index}`,
    }));
    const listRoles = vi
      .fn()
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce([{ externalName: 'role-100' }]);

    const roles = await loadKeycloakRoleCatalog({ listRoles } as never);

    expect(roles).toHaveLength(101);
    expect(listRoles).toHaveBeenNthCalledWith(1, { first: 0, max: 100 });
    expect(listRoles).toHaveBeenNthCalledWith(2, { first: 100, max: 100 });
  });

  it('loads counted pages sequentially to avoid unbounded Keycloak fan-out', async () => {
    let activeRequests = 0;
    let maximumActiveRequests = 0;
    const listRoles = vi.fn(async ({ first }: { first: number }) => {
      activeRequests += 1;
      maximumActiveRequests = Math.max(maximumActiveRequests, activeRequests);
      await Promise.resolve();
      activeRequests -= 1;
      return [{ externalName: `role-${first}` }];
    });

    const roles = await loadKeycloakRoleCatalog({
      countRoles: vi.fn(async () => 201),
      listRoles,
    } as never);

    expect(roles).toHaveLength(3);
    expect(maximumActiveRequests).toBe(1);
    expect(listRoles).toHaveBeenCalledTimes(3);
  });
});

describe('Keycloak role assignment projection', () => {
  const newsRole = { id: 'news', externalName: 'news_editor' };
  const eventRole = { id: 'event', externalName: 'event_editor' };

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
