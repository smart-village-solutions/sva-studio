import { IAM_EXPLORE_MISSION_NAMES, type AdminExplorationMissionName } from '../runtime/types.js';
import type { AdminExplorationMissionDefinition } from './definitions.js';

const IAM_EXPLORE_MISSION_DETAILS = {
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
} as const satisfies Record<AdminExplorationMissionName, Omit<AdminExplorationMissionDefinition, 'name'>>;

function freezeMissionDefinition(mission: AdminExplorationMissionDefinition): AdminExplorationMissionDefinition {
  return Object.freeze({ ...mission });
}

const IAM_EXPLORE_MISSIONS = Object.freeze(
  IAM_EXPLORE_MISSION_NAMES.map((name) =>
    freezeMissionDefinition({
      name,
      ...IAM_EXPLORE_MISSION_DETAILS[name],
    })
  )
) satisfies readonly AdminExplorationMissionDefinition[];

export function listAdminExplorationMissions(): readonly AdminExplorationMissionDefinition[] {
  return IAM_EXPLORE_MISSIONS;
}

export function getAdminExplorationMission(name: AdminExplorationMissionName): AdminExplorationMissionDefinition {
  const mission = IAM_EXPLORE_MISSIONS.find((entry) => entry.name === name);

  if (mission === undefined) {
    throw new Error(`Unknown AdminExploration mission: ${name}`);
  }

  return mission;
}
