import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { AcceptanceDeployReport, AcceptanceDeployStepName, AcceptanceFailureCategory } from './runtime-env.shared.ts';

type CliOptions = {
  latest: boolean;
  reportDir: string;
  reportId?: string;
  writeDocs: boolean;
};

type DeployReviewSummary = {
  failureCategoryCounts: Record<string, number>;
  failedStepCounts: Record<string, number>;
  generatedAt: string;
  latestReportId?: string;
  releaseDecisionFailures: number;
  releaseDecisionPasses: number;
  reportsAnalyzed: number;
  stepDurationMs: Record<string, { avg: number; max: number; median: number }>;
  technicalReleaseSuccessRate: number;
};

const scriptPath = fileURLToPath(import.meta.url);
const rootDir = resolve(dirname(scriptPath), '../..');
const defaultReportDir = resolve(rootDir, 'artifacts/runtime/deployments');
const docsReportDir = resolve(rootDir, 'docs/reports');

const parseCliOptions = (raw: readonly string[]): CliOptions => {
  const parsed: CliOptions = {
    latest: false,
    reportDir: defaultReportDir,
    writeDocs: false,
  };

  for (const rawOption of raw) {
    if (rawOption === '--latest') {
      parsed.latest = true;
      continue;
    }
    if (rawOption === '--write-docs') {
      parsed.writeDocs = true;
      continue;
    }
    if (rawOption.startsWith('--report-id=')) {
      parsed.reportId = rawOption.slice('--report-id='.length).trim();
      continue;
    }
    if (rawOption.startsWith('--report-dir=')) {
      parsed.reportDir = resolve(rootDir, rawOption.slice('--report-dir='.length).trim());
      continue;
    }
    throw new Error(`Unbekannte Option: ${rawOption}`);
  }

  return parsed;
};

const isPrimaryDeployReport = (fileName: string) =>
  fileName.endsWith('.json') &&
  !fileName.endsWith('.manifest.json') &&
  !fileName.endsWith('.phases.json') &&
  !fileName.endsWith('.migration.json') &&
  !fileName.endsWith('.internal-probes.json') &&
  !fileName.endsWith('.external-probes.json') &&
  !fileName.startsWith('release-feedback-summary');

const safeReadJson = <T>(filePath: string): T | null => {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
};

export const listDeployReports = (reportDir: string): AcceptanceDeployReport[] => {
  if (!existsSync(reportDir)) {
    return [];
  }

  return readdirSync(reportDir)
    .filter(isPrimaryDeployReport)
    .map((fileName) => safeReadJson<AcceptanceDeployReport>(resolve(reportDir, fileName)))
    .filter(
      (report): report is AcceptanceDeployReport =>
        report !== null && typeof report.reportId === 'string' && Array.isArray(report.steps)
    )
    .sort((left, right) => left.generatedAt.localeCompare(right.generatedAt));
};

const median = (values: readonly number[]) => {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[middle - 1] + sorted[middle]) / 2) : sorted[middle];
};

export const summarizeDeployReports = (reports: readonly AcceptanceDeployReport[]): DeployReviewSummary => {
  const failureCategoryCounts: Record<string, number> = {};
  const failedStepCounts: Record<string, number> = {};
  const durationByStep: Record<string, number[]> = {};
  let releaseDecisionPasses = 0;
  let releaseDecisionFailures = 0;

  for (const report of reports) {
    if (report.failureCategory) {
      failureCategoryCounts[report.failureCategory] = (failureCategoryCounts[report.failureCategory] ?? 0) + 1;
    }
    if (report.releaseDecision.technicalGatePassed) {
      releaseDecisionPasses += 1;
    } else {
      releaseDecisionFailures += 1;
    }
    for (const step of report.steps) {
      durationByStep[step.name] ??= [];
      durationByStep[step.name].push(step.durationMs);
      if (step.status === 'error') {
        failedStepCounts[step.name] = (failedStepCounts[step.name] ?? 0) + 1;
      }
    }
  }

  const stepDurationMs = Object.fromEntries(
    Object.entries(durationByStep).map(([step, values]) => [
      step,
      {
        avg: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length),
        max: Math.max(...values),
        median: median(values),
      },
    ])
  );

  const reportsAnalyzed = reports.length;
  return {
    failureCategoryCounts,
    failedStepCounts,
    generatedAt: new Date().toISOString(),
    latestReportId: reports.at(-1)?.reportId,
    releaseDecisionFailures,
    releaseDecisionPasses,
    reportsAnalyzed,
    stepDurationMs,
    technicalReleaseSuccessRate: reportsAnalyzed === 0 ? 0 : Number((releaseDecisionPasses / reportsAnalyzed).toFixed(4)),
  };
};

const topEntries = (values: Record<string, number>, limit = 3) =>
  Object.entries(values)
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit);

export const renderDeployFeedbackSummaryMarkdown = (
  summary: DeployReviewSummary,
  reports: readonly AcceptanceDeployReport[]
) => {
  const lines = [
    '# Deploy-Feedback-Summary',
    '',
    `- Generiert: \`${summary.generatedAt}\``,
    `- Ausgewertete Deploy-Reports: \`${summary.reportsAnalyzed}\``,
    `- Technische Erfolgsquote: \`${Math.round(summary.technicalReleaseSuccessRate * 100)}%\``,
    `- Letzter Report: \`${summary.latestReportId ?? 'n/a'}\``,
    '',
    '## Hauefigste Fehlerkategorien',
    '',
    ...(topEntries(summary.failureCategoryCounts).length > 0
      ? topEntries(summary.failureCategoryCounts).map(([category, count]) => `- \`${category}\`: ${count}`)
      : ['- keine']),
    '',
    '## Hauefigste fehlgeschlagene Phasen',
    '',
    ...(topEntries(summary.failedStepCounts).length > 0
      ? topEntries(summary.failedStepCounts).map(([step, count]) => `- \`${step}\`: ${count}`)
      : ['- keine']),
    '',
    '## Phasen-Dauern',
    '',
    ...(Object.entries(summary.stepDurationMs).length > 0
      ? Object.entries(summary.stepDurationMs).map(
          ([step, duration]) =>
            `- \`${step}\`: median=${duration.median} ms, avg=${duration.avg} ms, max=${duration.max} ms`
        )
      : ['- keine']),
    '',
    '## Letzte Deploys',
    '',
    ...(reports.slice(-5).reverse().map(
      (report) =>
        `- \`${report.reportId}\` -> status=\`${report.status}\`, category=\`${report.failureCategory ?? 'none'}\`, decision=\`${report.releaseDecision.technicalGatePassed ? 'passed' : 'failed'}\``
    )),
    '',
    '## Betriebsregel',
    '',
    '- Jeder fehlgeschlagene oder manuell stabilisierte Deploy muss einen Review-Eintrag mit konkreter Repo-Nacharbeit erzeugen.',
  ];

  return `${lines.join('\n')}\n`;
};

const recommendedFollowUp = (category?: AcceptanceFailureCategory, failedStep?: AcceptanceDeployStepName) => {
  if (failedStep === 'image-smoke' || category === 'image') {
    return 'Fehlenden Artefakt-Test oder Startup-Guard in `image-smoke` nachziehen.';
  }
  if (failedStep === 'environment-precheck' || category === 'config') {
    return 'Precheck um den uebersehenen Konfigurations- oder Drift-Fall erweitern.';
  }
  if (failedStep === 'internal-verify' || category === 'health') {
    return 'Interne Probe, Diagnostik oder Health-Klassifikation verschaerfen.';
  }
  if (failedStep === 'external-smoke' || category === 'ingress') {
    return 'Oeffentliche Smoke-Probe oder Ingress-Diagnose ausbauen.';
  }
  if (failedStep === 'migrate' || category === 'migration') {
    return 'Migrationsvertrag, Schema-Guard oder Rollback-Hinweis haerten.';
  }
  return 'Runbook, Test oder Gate ergaenzen, damit dieser Fehler frueher sichtbar wird.';
};

export const renderDeployReviewTemplate = (report: AcceptanceDeployReport) => {
  const failedStep = report.steps.find((step) => step.status === 'error')?.name;
  const lines = [
    `# Deploy-Review ${report.reportId}`,
    '',
    `- Zeitpunkt: \`${report.generatedAt}\``,
    `- Profil: \`${report.profile}\``,
    `- Status: \`${report.status}\``,
    `- Fehlerkategorie: \`${report.failureCategory ?? 'keine'}\``,
    `- Fehlgeschlagene Phase: \`${failedStep ?? 'keine'}\``,
    `- Image-Ref: \`${report.imageRef}\``,
    '',
    '## Beobachtung',
    '',
    '- Was ist konkret schiefgelaufen?',
    '- Welche Probe oder Phase hat den Befund zuerst sichtbar gemacht?',
    '',
    '## Lernschleife',
    '',
    '- Haette ein frueheres Gate diesen Fehler erkennen muessen?',
    '- Fehlt ein Test, ein Probe, ein Alert, ein Dashboard oder ein Runbook-Schritt?',
    '- War manuelle Nacharbeit notwendig? Wenn ja: welche?',
    '',
    '## Verbindliche Nacharbeit',
    '',
    `- Empfohlene Richtung: ${recommendedFollowUp(report.failureCategory, failedStep)}`,
    '- Repo-Aenderung:',
    '- Verantwortlich:',
    '- Zieltermin:',
    '',
    '## Abschlussregel',
    '',
    '- Dieser Deploy gilt erst dann als nachhaltig verarbeitet, wenn aus dem Befund ein dauerhafter Schutz im Repo entstanden ist.',
  ];

  return `${lines.join('\n')}\n`;
};

const writeFile = (filePath: string, content: string) => {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf8');
};

const writeJson = (filePath: string, payload: unknown) => {
  writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`);
};

const selectTargetReport = (reports: readonly AcceptanceDeployReport[], options: CliOptions) => {
  if (reports.length === 0) {
    return undefined;
  }
  if (options.reportId) {
    return reports.find((report) => report.reportId === options.reportId);
  }
  if (options.latest || !options.reportId) {
    return reports.at(-1);
  }
  return undefined;
};

export const main = (rawOptions = process.argv.slice(2)) => {
  const options = parseCliOptions(rawOptions);
  const reports = listDeployReports(options.reportDir);
  if (reports.length === 0) {
    console.log(`Keine Deploy-Reports unter ${options.reportDir} gefunden.`);
    return;
  }

  const summary = summarizeDeployReports(reports);
  const summaryJsonPath = resolve(options.reportDir, 'release-feedback-summary.json');
  const summaryMarkdownPath = resolve(options.reportDir, 'release-feedback-summary.md');
  writeJson(summaryJsonPath, summary);
  writeFile(summaryMarkdownPath, renderDeployFeedbackSummaryMarkdown(summary, reports));

  const targetReport = selectTargetReport(reports, options);
  if (targetReport) {
    const reviewContent = renderDeployReviewTemplate(targetReport);
    const reviewArtifactPath = resolve(options.reportDir, `${targetReport.reportId}.review.md`);
    writeFile(reviewArtifactPath, reviewContent);

    if (options.writeDocs) {
      writeFile(resolve(docsReportDir, `${targetReport.reportId}-review.md`), reviewContent);
    }
  }

  console.log(
    JSON.stringify(
      {
        latestReportId: targetReport?.reportId ?? null,
        reportsAnalyzed: reports.length,
        summaryMarkdownPath,
        summaryJsonPath,
      },
      null,
      2
    )
  );
};

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  main();
}
