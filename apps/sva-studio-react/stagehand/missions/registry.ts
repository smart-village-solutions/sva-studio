import { STAGEHAND_MISSION_NAMES, type StagehandMissionName } from '../runtime/types.js';
import type { StagehandMissionDefinition } from './definitions.js';

const STAGEHAND_MISSION_DETAILS = {
  'admin-users-overview': {
    startPath: '/admin/users',
    goal: 'Open the admin users overview and confirm the list is reachable.',
  },
  'admin-user-permissions-inspection': {
    startPath: '/admin/users',
    goal: 'Inspect a user entry and verify permission details can be reached.',
  },
  'admin-role-management-navigation': {
    startPath: '/admin/roles',
    goal: 'Navigate to role management and confirm the roles area loads.',
  },
} as const satisfies Record<StagehandMissionName, Omit<StagehandMissionDefinition, 'name'>>;

function freezeMissionDefinition(mission: StagehandMissionDefinition): StagehandMissionDefinition {
  return Object.freeze({ ...mission });
}

const STAGEHAND_MISSIONS = Object.freeze(
  STAGEHAND_MISSION_NAMES.map((name) =>
    freezeMissionDefinition({
      name,
      ...STAGEHAND_MISSION_DETAILS[name],
    })
  )
) satisfies readonly StagehandMissionDefinition[];

export function listStagehandMissions(): readonly StagehandMissionDefinition[] {
  return STAGEHAND_MISSIONS;
}

export function getStagehandMission(name: StagehandMissionName): StagehandMissionDefinition {
  const mission = STAGEHAND_MISSIONS.find((entry) => entry.name === name);

  if (mission === undefined) {
    throw new Error(`Unknown Stagehand mission: ${name}`);
  }

  return mission;
}
