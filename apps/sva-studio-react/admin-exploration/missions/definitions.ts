import type { AdminExplorationMissionName } from '../runtime/types.js';

export interface AdminExplorationMissionDefinition {
  readonly name: AdminExplorationMissionName;
  readonly startPath: string;
  readonly goal: string;
}
