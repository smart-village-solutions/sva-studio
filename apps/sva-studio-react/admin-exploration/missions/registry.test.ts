import { describe, expect, it } from 'vitest';

import { getAdminExplorationMission, listAdminExplorationMissions } from './registry.ts';

describe('adminExploration mission registry', () => {
  it('returns the stable pilot mission list in order', () => {
    expect(listAdminExplorationMissions()).toEqual([
      {
        name: 'admin-users-overview',
        startPath: '/admin/users',
        goal: expect.any(String),
      },
      {
        name: 'admin-user-permissions-inspection',
        startPath: '/admin/users',
        goal: expect.any(String),
      },
      {
        name: 'admin-role-management-navigation',
        startPath: '/admin/roles',
        goal: expect.any(String),
      },
    ]);
  });

  it('looks up admin-users-overview at the admin users path', () => {
    expect(getAdminExplorationMission('admin-users-overview')).toEqual({
      name: 'admin-users-overview',
      startPath: '/admin/users',
      goal: expect.any(String),
    });
  });

  it('throws a deterministic error for unknown mission lookups', () => {
    expect(() => getAdminExplorationMission('admin-unknown-mission' as never)).toThrowError(
      'Unknown AdminExploration mission: admin-unknown-mission'
    );
  });

  it('does not allow callers to corrupt mission definitions by mutation', () => {
    const missions = listAdminExplorationMissions() as AdminExplorationMutableMissionDefinition[];

    expect(() => {
      missions[0]!.startPath = '/corrupted';
    }).toThrowError(TypeError);

    expect(getAdminExplorationMission('admin-users-overview').startPath).toBe('/admin/users');
    expect(listAdminExplorationMissions()[0]?.startPath).toBe('/admin/users');
  });
});

interface AdminExplorationMutableMissionDefinition {
  goal: string;
  name: string;
  startPath: string;
}
