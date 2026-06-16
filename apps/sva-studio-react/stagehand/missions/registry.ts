import { STAGEHAND_MISSION_NAMES, type StagehandMissionName } from '../runtime/types.js';
import type { StagehandMissionDefinition } from './definitions.js';

const STAGEHAND_MISSION_DETAILS = {
  'admin-users-overview': {
    startPath: '/admin/users',
    goal: 'Die Admin-Nutzeruebersicht oeffnen und bestaetigen, dass die Liste erreichbar ist.',
  },
  'admin-user-permissions-inspection': {
    startPath: '/admin/users',
    goal: 'Einen Nutzereintrag pruefen und bestaetigen, dass die Berechtigungsdetails erreichbar sind.',
  },
  'admin-role-management-navigation': {
    startPath: '/admin/roles',
    goal: 'Zur Rollenverwaltung navigieren und bestaetigen, dass der Rollenbereich laedt.',
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
