import { describe, expect, it } from 'vitest';

import { getStagehandMission, listStagehandMissions } from './registry.ts';

describe('stagehand mission registry', () => {
  it('returns the stable pilot mission list in order', () => {
    expect(listStagehandMissions()).toEqual([
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
    expect(getStagehandMission('admin-users-overview')).toEqual({
      name: 'admin-users-overview',
      startPath: '/admin/users',
      goal: expect.any(String),
    });
  });

  it('throws a deterministic error for unknown mission lookups', () => {
    expect(() => getStagehandMission('admin-unknown-mission' as never)).toThrowError(
      'Unknown Stagehand mission: admin-unknown-mission'
    );
  });

  it('does not allow callers to corrupt mission definitions by mutation', () => {
    const missions = listStagehandMissions() as StagehandMutableMissionDefinition[];

    expect(() => {
      missions[0]!.startPath = '/corrupted';
    }).toThrowError(TypeError);

    expect(getStagehandMission('admin-users-overview').startPath).toBe('/admin/users');
    expect(listStagehandMissions()[0]?.startPath).toBe('/admin/users');
  });
});

interface StagehandMutableMissionDefinition {
  goal: string;
  name: string;
  startPath: string;
}
