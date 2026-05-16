import { join } from 'node:path';

import type { StagehandMissionReport } from '../reporting/report.js';
import { getStagehandMission } from '../missions/registry.js';
import type { StagehandAdminConfig } from './types.js';

export interface StagehandMissionArtifacts {
  readonly reportPath: string;
  readonly statusPath: string;
  readonly transcriptPath: string;
}

export interface StagehandMissionRunResult {
  readonly artifacts: StagehandMissionArtifacts;
  readonly report: StagehandMissionReport;
}

export interface ExecuteStagehandMissionOptions {
  readonly generatedAt?: string;
  readonly reportsRoot: string;
}

export function executeStagehandAdminMission(
  config: StagehandAdminConfig,
  options: ExecuteStagehandMissionOptions
): StagehandMissionRunResult {
  const mission = getStagehandMission(config.mission);
  const missionDirectory = join(options.reportsRoot, config.mission);
  const transcriptPath = join(missionDirectory, 'transcript.jsonl');
  const statusPath = join(missionDirectory, 'status.json');
  const reportPath = join(missionDirectory, 'report.md');

  return {
    artifacts: {
      reportPath,
      statusPath,
      transcriptPath,
    },
    report: {
      generatedAt: options.generatedAt ?? new Date().toISOString(),
      mission: config.mission,
      status: 'blocked',
      findings: [
        'Pilotlauf vorbereitet; echte Browser-Interaktion ist in diesem Schritt noch nicht implementiert.',
        `Startpfad: ${mission.startPath}`,
        `Ziel: ${mission.goal}`,
      ],
      screenshots: [],
      transcriptPath,
    },
  };
}
