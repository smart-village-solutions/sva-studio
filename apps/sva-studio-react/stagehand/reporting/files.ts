import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import type { StagehandMissionArtifacts } from '../runtime/execute.js';
import { toPortableArtifactPath } from './path-utils.js';
import { renderStagehandMarkdownReport, type StagehandMissionReport } from './report.js';

export function writeStagehandMissionArtifacts(
  artifacts: StagehandMissionArtifacts,
  report: StagehandMissionReport
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
  writeFileSync(artifacts.reportPath, `${renderStagehandMarkdownReport(report)}\n`, 'utf8');
  writeFileSync(artifacts.transcriptPath, 'stagehand mission bootstrap pending\n', 'utf8');
}
