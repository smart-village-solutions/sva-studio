import { join } from 'node:path';

import type { AdminExplorationMissionReport } from '../reporting/report.js';
import { getAdminExplorationMission } from '../missions/registry.js';
import { getAdminExplorationMissionStories } from '../stories/catalog.js';
import type { AdminExplorationConfig } from './types.js';

export interface AdminExplorationMissionArtifacts {
  readonly reportPath: string;
  readonly statusPath: string;
  readonly transcriptPath: string;
}

export interface AdminExplorationMissionRunResult {
  readonly artifacts: AdminExplorationMissionArtifacts;
  readonly report: AdminExplorationMissionReport;
}

export interface ExecuteAdminExplorationMissionOptions {
  readonly generatedAt?: string;
  readonly reportsRoot: string;
}

export function executeAdminExplorationAdminMission(
  config: AdminExplorationConfig,
  options: ExecuteAdminExplorationMissionOptions
): AdminExplorationMissionRunResult {
  const mission = getAdminExplorationMission(config.mission);
  const stories = getAdminExplorationMissionStories(config.mission);
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
      stories,
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
