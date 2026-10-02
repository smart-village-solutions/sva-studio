import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import type { AdminExplorationMissionArtifacts } from '../runtime/execute.js';
import { toPortableArtifactPath } from './path-utils.js';
import { renderAdminExplorationMarkdownReport, type AdminExplorationMissionReport } from './report.js';

export function writeAdminExplorationMissionArtifacts(
  artifacts: AdminExplorationMissionArtifacts,
  report: AdminExplorationMissionReport
): void {
  mkdirSync(dirname(artifacts.statusPath), { recursive: true });
  mkdirSync(dirname(artifacts.reportPath), { recursive: true });
  mkdirSync(dirname(artifacts.transcriptPath), { recursive: true });

  writeFileSync(
    artifacts.statusPath,
    `${JSON.stringify(
      {
        ...report,
        transcriptPath: toPortableArtifactPath(report.transcriptPath),
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  writeFileSync(artifacts.reportPath, `${renderAdminExplorationMarkdownReport(report)}\n`, 'utf8');
  writeFileSync(artifacts.transcriptPath, 'adminExploration mission bootstrap pending\n', 'utf8');
}
