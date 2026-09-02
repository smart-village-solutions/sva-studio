import { describe, expect, it } from 'vitest';

import {
  projectKeycloakRoleAssignments,
  resolveKeycloakRoleMutationDelta,
} from './user-keycloak-role-handlers.js';

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
