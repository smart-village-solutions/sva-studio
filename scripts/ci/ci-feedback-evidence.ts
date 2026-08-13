import fs from 'node:fs';
import path from 'node:path';

import type { ChangedProjectPlan } from './changed-project-plan.ts';

export interface CiFeedbackDuration {
  label: string;
  durationMs: number;
}

export interface CiFeedbackEvidence {
  schemaVersion: 1;
  gate: 'coverage' | 'unit';
  status: 'failed' | 'passed';
  baseSha: string;
  headSha: string;
  scopeMode: 'affected' | 'full';
  plan: ChangedProjectPlan | null;
  phases: CiFeedbackDuration[];
  startedAt: string;
  finishedAt: string;
  firstConfirmedFailureAt: string | null;
}

interface BuildCiFeedbackEvidenceOptions {
  gate: CiFeedbackEvidence['gate'];
  status: CiFeedbackEvidence['status'];
  baseSha: string;
  headSha: string;
  scopeMode: CiFeedbackEvidence['scopeMode'];
  plan: ChangedProjectPlan | null;
  phases: readonly CiFeedbackDuration[];
  startedAt: Date;
  finishedAt: Date;
}

export const buildCiFeedbackEvidence = (
  options: BuildCiFeedbackEvidenceOptions
): CiFeedbackEvidence => ({
  schemaVersion: 1,
  gate: options.gate,
  status: options.status,
  baseSha: options.baseSha,
  headSha: options.headSha,
  scopeMode: options.scopeMode,
  plan: options.plan,
  phases: options.phases.map((phase) => ({ ...phase })),
  startedAt: options.startedAt.toISOString(),
  finishedAt: options.finishedAt.toISOString(),
  firstConfirmedFailureAt: options.status === 'failed' ? options.finishedAt.toISOString() : null,
});

export const writeCiFeedbackEvidence = (
  evidence: CiFeedbackEvidence,
  rootDir = process.cwd()
): string => {
  const evidenceDirectory = path.join(rootDir, 'artifacts', 'ci-feedback');
  const evidencePath = path.join(evidenceDirectory, `${evidence.gate}.json`);
  fs.mkdirSync(evidenceDirectory, { recursive: true });
  fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');

  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    const directProjects = evidence.plan?.directProjects.join(', ') || 'keine';
    const elapsedMs = Date.parse(evidence.finishedAt) - Date.parse(evidence.startedAt);
    fs.appendFileSync(
      summaryPath,
      [
        `### ${evidence.gate === 'unit' ? 'Unit' : 'Coverage'} Fast Feedback`,
        '',
        `- Status: \`${evidence.status}\``,
        `- Scope: \`${evidence.scopeMode}\``,
        `- Direkt priorisiert: ${directProjects}`,
        `- Laufzeit: ${(elapsedMs / 1000).toFixed(2)} s`,
        `- Evidenz: \`${path.relative(rootDir, evidencePath)}\``,
        '',
      ].join('\n'),
      'utf8'
    );
  }

  return evidencePath;
};
