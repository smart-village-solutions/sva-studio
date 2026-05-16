import type { StagehandMissionName } from '../runtime/types.js';

export interface StagehandMissionDefinition {
  readonly name: StagehandMissionName;
  readonly startPath: string;
  readonly goal: string;
}
